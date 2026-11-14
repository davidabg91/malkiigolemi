import "server-only";
import { randomBytes } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { cookies } from "next/headers";
import webpush from "web-push";
import { db } from "@/db";
import { orders, pushSubscriptions, settings, users, type OrderStatus, type PushSubscriptionRow } from "@/db/schema";
import { courierName } from "./couriers";
import { formatPrice } from "./format";
import { ADMIN_NOTICES, type AdminNoticeKey, type AdminNoticePrefs } from "./notices";
import { site } from "./site";

/**
 * Notifications on the customer's phone (Web Push), like those of any installed app. VAPID_PUBLIC_KEY and
 * VAPID_PRIVATE_KEY turn them on; without them nothing is offered and nothing is sent.
 */
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";
export const pushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** What a device shows: a title, a line under it, and the page a tap opens. */
export type PushMessage = { title: string; body: string; url: string; tag?: string };

const DEVICE_COOKIE = "push_device";

let ready = false;
function client() {
  if (!ready) {
    webpush.setVapidDetails(`mailto:${site.email}`, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    ready = true;
  }
  return webpush;
}

/** Sends one message to each device. Devices whose subscription has ended are forgotten. Never throws. */
export async function sendPush(devices: PushSubscriptionRow[], message: PushMessage) {
  if (!pushConfigured() || devices.length === 0) return 0;
  const gone: number[] = [];
  let sent = 0;
  await Promise.all(
    devices.map(async (d) => {
      try {
        await client().sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify(message), {
          // Keep trying for a day if the phone is off; an order update is still worth reading then.
          TTL: 86_400,
          urgency: "high",
        });
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404 and 410 mean the browser dropped the subscription (notifications turned off, app removed).
        if (status === 404 || status === 410) gone.push(d.id);
        else console.error("Push failed", status ?? e);
      }
    }),
  );
  if (gone.length) await forgetDevices(gone).catch(() => {});
  return sent;
}

/** Deletes devices, first untying the orders that pointed at them. */
async function forgetDevices(ids: number[]) {
  await db.update(orders).set({ pushSubscriptionId: null }).where(inArray(orders.pushSubscriptionId, ids));
  await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, ids));
}

/** Remembers a device (or refreshes what is known about it) and returns its row. */
export async function savePushDevice(sub: { endpoint: string; p256dh: string; auth: string }, userId: number | null) {
  const [existing] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint)).limit(1);
  const jar = await cookies();
  let row: PushSubscriptionRow;
  if (existing) {
    // Signing out does not unlink the account: the device asked to hear about that account's orders.
    [row] = await db
      .update(pushSubscriptions)
      .set({ p256dh: sub.p256dh, auth: sub.auth, userId: userId ?? existing.userId })
      .where(eq(pushSubscriptions.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(pushSubscriptions)
      .values({ ...sub, userId, token: randomBytes(24).toString("base64url") })
      .returning();
  }
  jar.set(DEVICE_COOKIE, row.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 400 * 86_400 });
  return row;
}

export async function removePushDevice(endpoint: string) {
  const rows = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  if (rows.length) await forgetDevices(rows.map((r) => r.id));
  (await cookies()).delete(DEVICE_COOKIE);
}

/** The device this request comes from, if it has notifications on. Used to tie a new order to it. */
export async function currentPushDeviceId(): Promise<number | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token || !pushConfigured()) return null;
  const [row] = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.token, token)).limit(1);
  return row?.id ?? null;
}

function statusMessage(o: { number: string; status: OrderStatus; delivery: string; courier: string | null; trackingNumber: string | null }): Omit<PushMessage, "url" | "tag"> | null {
  const pickup = o.delivery === "store";
  switch (o.status) {
    case "confirmed":
      return { title: "Поръчката ти е потвърдена", body: `Поръчка ${o.number} се подготвя${pickup ? " за взимане от магазина" : " за изпращане"}.` };
    case "shipped":
      if (pickup) return { title: "Поръчката ти е готова", body: `Поръчка ${o.number} те чака в магазина.` };
      return {
        title: "Поръчката ти е изпратена",
        body: `Поръчка ${o.number} пътува${courierName(o.courier) ? ` с ${courierName(o.courier)}` : ""}.${o.trackingNumber ? ` Товарителница ${o.trackingNumber}.` : ""}`,
      };
    case "delivered":
      return { title: pickup ? "Поръчката ти е получена" : "Поръчката ти е доставена", body: `Благодарим ти за поръчка ${o.number}! Ще се радваме на отзив.` };
    case "cancelled":
      return { title: "Поръчката ти е отказана", body: `Поръчка ${o.number} беше отказана. Пиши ни, ако имаш въпроси.` };
    default:
      return null;
  }
}

/**
 * Tells the customer's devices that their order moved on: every device signed in to the order's account
 * and the device the order was placed from. Never throws.
 */
export async function notifyOrderStatus(orderId: number) {
  if (!pushConfigured()) return;
  try {
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!o) return;
    const message = statusMessage(o);
    if (!message) return;
    const where = [o.pushSubscriptionId ? eq(pushSubscriptions.id, o.pushSubscriptionId) : undefined, o.userId ? eq(pushSubscriptions.userId, o.userId) : undefined].filter((c) => c !== undefined);
    if (where.length === 0) return;
    const devices = await db.select().from(pushSubscriptions).where(or(...where));
    // The same tag replaces the order's earlier notification instead of stacking a second one.
    await sendPush(devices, { ...message, url: `/porachka/${o.number}`, tag: `order-${o.number}` });
  } catch (e) {
    console.error("Order push failed", orderId, e);
  }
}

export async function adminDevices() {
  return db
    .select({ d: pushSubscriptions })
    .from(pushSubscriptions)
    .innerJoin(users, eq(users.id, pushSubscriptions.userId))
    .where(eq(users.role, "admin"))
    .then((rows) => rows.map((r) => r.d));
}

const NOTICES_KEY = "admin_notices";

/** Which notifications the shop's phones get (Админ → Известия); anything never chosen keeps its default. */
export async function getAdminNoticePrefs(): Promise<AdminNoticePrefs> {
  const [row] = await db.select().from(settings).where(eq(settings.key, NOTICES_KEY)).limit(1);
  let saved: Partial<AdminNoticePrefs> = {};
  try {
    saved = row?.value ? JSON.parse(row.value) : {};
  } catch {}
  return Object.fromEntries(ADMIN_NOTICES.map((n) => [n.key, typeof saved[n.key] === "boolean" ? saved[n.key] : n.on])) as AdminNoticePrefs;
}

export async function setAdminNoticePrefs(prefs: AdminNoticePrefs) {
  const value = JSON.stringify(prefs);
  await db.insert(settings).values({ key: NOTICES_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/**
 * Tells the shop's own phones (admins with notifications on) about something, unless that kind of
 * notification is switched off. Never throws.
 */
export async function notifyAdmins(kind: AdminNoticeKey, message: PushMessage) {
  if (!pushConfigured()) return;
  try {
    if (!(await getAdminNoticePrefs())[kind]) return;
    await sendPush(await adminDevices(), message);
  } catch (e) {
    console.error("Admin push failed", kind, e);
  }
}

/** Tells the shop's own phones (admins with notifications on) about a new order. Never throws. */
export async function notifyAdminsNewOrder(orderId: number) {
  const [o] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
    .catch(() => []);
  if (!o) return;
  await notifyAdmins("order", { title: `Нова поръчка ${formatPrice(o.total)}`, body: `${o.number} · ${o.name}`, url: `/admin/porachki/${o.id}`, tag: `admin-order-${o.id}` });
}

/** Tells the shop's own phones about a payment made through the QR code at the till. Never throws. */
export async function notifyAdminsStorePayment(amount: number, id: number, note: string | null) {
  await notifyAdmins("storePayment", { title: `Плащане в магазина ${formatPrice(amount)}`, body: `Плащане № ${id}${note ? ` · ${note}` : ""}`, url: "/admin/plashtaniya", tag: `store-pay-${id}` });
}
