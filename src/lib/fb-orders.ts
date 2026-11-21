import "server-only";
import { and, asc, desc, eq, getTableColumns, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { type FbClaim, fbClaims, fbContacts, fbMessages, type FbPost, fbPosts, type Order, type OrderItem, orderItems, orders, products, settings } from "@/db/schema";
import { deliveryNote } from "./availability";
import { fbContactKey } from "./fb-contacts";
import { quantityOf } from "./fb-parse";
import { savedOffice } from "./courier-offices";
import { quoteShipping } from "./delivery-quote";
import { formatPrice, formatTimestamp, unitPriceFor } from "./format";
import { changeOrderStatus } from "./order-status";
import { orderNumber } from "./orders";
import { pricedColumns } from "./pricing";
import { notifyAdmins } from "./push";
import { shippingFor, site, STORE } from "./site";
import { moveStock, takeStock } from "./stock";

/**
 * Orders gathered from the Facebook group, one per person: whatever somebody asks for under the posts is added
 * to their one open order (store pickup), which the admin can split, and marks "Готова за взимане" when the
 * goods are in the shop. That mark queues a message the browser extension writes in the person's chat.
 */

type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

export type FbOrderSettings = {
  /** Claims with a clear quantity and enough stock go into the person's order by themselves. */
  auto: boolean;
  /** The message for "Готова за взимане"; {име}, {продукти}, {сума} and {адрес} are filled in. */
  message: string;
  /**
   * The day collecting starts ("YYYY-MM-DD", Bulgarian time): posts published before it are left alone when the
   * script goes through the group, because their orders were taken by hand. Null collects from every post.
   */
  since: string | null;
};

export const DEFAULT_FB_ORDERS: FbOrderSettings = {
  auto: true,
  // The owner asked on this day for only the posts from then on: the earlier ones were already written down by hand.
  since: "2026-11-18",
  message:
    "Здравейте, {име}! Пристигнаха продуктите от Вашата поръчка:\n{продукти}\nОбщо: {сума}\nВижте поръчката си тук: {линк}\nМоже да я вземете от магазина ({адрес}) или на същия линк да оставите данни за доставка с куриер.\nБлагодарим Ви!",
};

/** The wording before the order got its public page: a shop that never changed it gets the new one. */
const FIRST_MESSAGE = "Здравейте, {име}! Поръчката Ви е в магазина и може да я вземете:\n{продукти}\nОбщо: {сума}\nАдрес: {адрес}\nБлагодарим Ви!";

const KEY = "fb_orders";

export async function getFbOrderSettings(): Promise<FbOrderSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  if (!row) return { ...DEFAULT_FB_ORDERS };
  try {
    const saved = { ...DEFAULT_FB_ORDERS, ...(JSON.parse(row.value) as Partial<FbOrderSettings>) };
    return saved.message.replace(/\r\n/g, "\n").trim() === FIRST_MESSAGE ? { ...saved, message: DEFAULT_FB_ORDERS.message } : saved;
  } catch {
    return { ...DEFAULT_FB_ORDERS };
  }
}

export async function saveFbOrderSettings(value: FbOrderSettings) {
  const json = JSON.stringify(value);
  await db
    .insert(settings)
    .values({ key: KEY, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: new Date() } });
}

/** An order can still be changed (items added, split, removed) while it is new or confirmed and not sent anywhere. */
const OPEN = ["new", "confirmed"] as const;
export const isEditableOrder = (o: Pick<Order, "status" | "trackingNumber" | "payment" | "discount">) =>
  (OPEN as readonly string[]).includes(o.status) && !o.trackingNumber && o.payment !== "card" && o.discount === 0;

/** Adds the lines up again after items were added, moved or removed. */
async function recalc(tx: Tx, orderId: number) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;
  const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const shipping = lines.length === 0 ? 0 : shippingFor(order.delivery, subtotal, order.courier);
  await tx
    .update(orders)
    .set({ subtotal, shipping, total: Math.max(0, subtotal + shipping - order.discount) })
    .where(eq(orders.id, orderId));
}

/**
 * The order this person's next item goes into: gathered from Facebook, still open, not yet marked as waiting
 * in the shop. The oldest one, so after a split the original keeps collecting. The profile's number decides
 * when both sides have it (two people can share a name); otherwise the name does.
 */
async function openOrderFor(tx: Tx, who: { key: string; userId: string | null }) {
  const rows = await tx
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.source, "facebook"),
        isNull(orders.readyAt),
        inArray(orders.status, [...OPEN]),
        isNull(orders.trackingNumber),
        who.userId ? or(eq(orders.fbName, who.key), eq(orders.fbUserId, who.userId)) : eq(orders.fbName, who.key),
      ),
    )
    .orderBy(asc(orders.id));
  return rows.find((o) => (o.fbUserId && who.userId ? o.fbUserId === who.userId : o.fbName === who.key)) ?? null;
}

type PricedProduct = Awaited<ReturnType<typeof pricedProduct>>;
const pricedProduct = async (id: number) =>
  (
    await db
      .select({ ...getTableColumns(products), ...pricedColumns })
      .from(products)
      .where(eq(products.id, id))
      .limit(1)
  )[0];

/**
 * Puts one claim into its person's open order (making the order when there is none) and takes the stock.
 * Throws "ALREADY_DONE" when the claim is no longer waiting and "OUT_OF_STOCK" when the goods ran out meanwhile.
 */
async function addClaimToOrder(
  tx: Tx,
  claim: FbClaim,
  post: FbPost,
  product: PricedProduct | undefined,
  /** Set when an admin adds it: their number of pieces and colour, a comment the script had left out is fine, and stock may run short. */
  byHand?: { qty: number; color: string | null },
) {
  const qty = byHand?.qty ?? claim.qty;
  const color = byHand?.color ?? null;
  // Claim it first and only while still waiting, so two readings at once cannot add it twice.
  const taken = await tx
    .update(fbClaims)
    .set({ status: "ordered", qty, orderedBy: byHand ? "hand" : "auto", skipReason: null })
    .where(and(eq(fbClaims.id, claim.id), byHand ? inArray(fbClaims.status, ["pending", "rejected"]) : eq(fbClaims.status, "pending")))
    .returning({ id: fbClaims.id });
  if (taken.length === 0) throw new Error("ALREADY_DONE");

  const key = fbContactKey(claim.name);
  let order = await openOrderFor(tx, { key, userId: claim.fbUserId });
  if (!order) {
    // The phone and e-mail this name used last time, when the admin once filled them in.
    const [contact] = await tx.select().from(fbContacts).where(eq(fbContacts.key, key)).limit(1);
    [order] = await tx
      .insert(orders)
      .values({
        number: orderNumber(),
        name: claim.name,
        phone: contact?.phone ?? "",
        email: contact?.email ?? "",
        delivery: "store",
        city: STORE.city,
        address: STORE.address,
        note: "Събрана от коментарите във Facebook групата.",
        subtotal: 0,
        shipping: 0,
        total: 0,
        status: "confirmed",
        source: "facebook",
        fbName: key,
        fbUserId: claim.fbUserId,
      })
      .returning();
  } else if (!order.fbUserId && claim.fbUserId) {
    await tx.update(orders).set({ fbUserId: claim.fbUserId }).where(eq(orders.id, order.id));
  }

  const price = product ? unitPriceFor(product, qty) : post.price!;
  const name = product ? `${product.name} ${product.unit}`.trim() : post.productName;
  // The same product (and colour) at the same price is one line with a bigger number.
  const [line] = await tx
    .select()
    .from(orderItems)
    .where(
      and(
        eq(orderItems.orderId, order.id),
        product ? eq(orderItems.productId, product.id) : and(isNull(orderItems.productId), eq(orderItems.name, name)),
        eq(orderItems.price, price),
        color ? eq(orderItems.color, color) : isNull(orderItems.color),
      ),
    )
    .limit(1);
  if (line) {
    await tx
      .update(orderItems)
      .set({ qty: line.qty + qty })
      .where(eq(orderItems.id, line.id));
  } else {
    await tx.insert(orderItems).values({
      orderId: order.id,
      productId: product?.id ?? null,
      name,
      sku: product?.sku ?? "FB",
      price,
      qty,
      color,
      deliveryTime: product ? deliveryNote(product) : null,
    });
  }
  if (product && (await takeStock(tx, product, qty, color)) === null) {
    if (!byHand) throw new Error("OUT_OF_STOCK");
    // The admin knows the goods are coming: the order is taken, and the shop's stock goes down to what it has (never below zero).
    await moveStock(tx, product.id, -qty, color);
  }
  await tx.update(fbClaims).set({ orderId: order.id }).where(eq(fbClaims.id, claim.id));
  await recalc(tx, order.id);
  return order.id;
}

/**
 * Goes through a post's waiting claims in the order they were written and puts each into its person's order.
 * Only what needs no person to look at it: the post has its product (without colours, or typed by hand with a
 * price), the quantity was read with certainty, and there is enough stock. The rest stay waiting for the admin.
 * Returns how many claims became order lines, and whether stock was taken.
 */
export async function autoOrderClaims(postId: number): Promise<{ ordered: number; stockChanged: boolean }> {
  const none = { ordered: 0, stockChanged: false };
  if (!(await getFbOrderSettings()).auto) return none;
  const [post] = await db.select().from(fbPosts).where(eq(fbPosts.id, postId)).limit(1);
  if (!post || post.closedAt) return none;
  const product = post.productId ? await pricedProduct(post.productId) : undefined;
  if (post.productId ? !product || product.colorOptions.length > 0 : post.price == null) return none;

  const waiting = await db
    .select()
    .from(fbClaims)
    .where(and(eq(fbClaims.postId, postId), eq(fbClaims.status, "pending")))
    .orderBy(asc(fbClaims.id));
  let ordered = 0;
  for (const claim of waiting) {
    const read = quantityOf(claim.comment);
    if (!read.sure || read.qty !== claim.qty) continue;
    try {
      await db.transaction((tx) => addClaimToOrder(tx, claim, post, product));
      ordered++;
    } catch (e) {
      // Out of stock or taken by another reading: it stays (or is already) where it should be.
      if (!(e instanceof Error) || !["OUT_OF_STOCK", "ALREADY_DONE"].includes(e.message)) console.error("auto order from claim failed", claim.id, e);
    }
  }
  return { ordered, stockChanged: ordered > 0 && Boolean(product) };
}

/**
 * An admin puts a comment into its person's order by hand: one the script was not sure about, or one it did not
 * take for an order at all. `color` is needed for a product sold in several colours.
 */
export async function addClaimByHand(claimId: number, qty: number, color: string | null): Promise<{ ok: true; orderId: number; stockChanged: boolean } | { ok: false; error: string; field?: "qty" | "color" }> {
  const [claim] = await db.select().from(fbClaims).where(eq(fbClaims.id, claimId)).limit(1);
  if (!claim) return { ok: false, error: "Коментарът не е намерен." };
  if (claim.status === "ordered") return { ok: false, error: "Този коментар вече е в поръчка." };
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) return { ok: false, error: "Въведи брой от 1 до 99.", field: "qty" };
  const [post] = await db.select().from(fbPosts).where(eq(fbPosts.id, claim.postId)).limit(1);
  if (!post) return { ok: false, error: "Постът не е намерен." };
  const product = post.productId ? await pricedProduct(post.productId) : undefined;
  if (post.productId ? !product : post.price == null) return { ok: false, error: "Първо избери продукта на поста." };
  let picked: string | null = null;
  if (product && product.colorOptions.length > 0) {
    picked = color && product.colorOptions.includes(color) ? color : null;
    if (!picked) return { ok: false, error: "Избери цвят.", field: "color" };
  }
  try {
    const orderId = await db.transaction((tx) => addClaimToOrder(tx, claim, post, product, { qty, color: picked }));
    return { ok: true, orderId, stockChanged: Boolean(product) };
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_DONE") return { ok: false, error: "Този коментар вече е обработен." };
    console.error("adding a claim by hand failed", claimId, e);
    return { ok: false, error: "Неуспешно добавяне към поръчката." };
  }
}

export type ItemPick = { itemId: number; qty: number };

/** The picked pieces that really belong to the order, each capped at what its line holds. */
function validPicks(lines: OrderItem[], picks: ItemPick[]) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const out: { line: OrderItem; qty: number }[] = [];
  for (const p of picks) {
    const line = byId.get(p.itemId);
    if (!line || !Number.isInteger(p.qty) || p.qty < 1) continue;
    byId.delete(p.itemId);
    out.push({ line, qty: Math.min(p.qty, line.qty) });
  }
  return out;
}

export type OrderEditResult = { ok: true; orderId: number } | { ok: false; error: string };

/**
 * Moves the picked pieces into a new order for the same customer (same contact and delivery), e.g. the part of
 * the goods that has arrived. Both orders are added up again. Something must stay in the original.
 */
export async function splitOrder(orderId: number, picks: ItemPick[]): Promise<OrderEditResult> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return { ok: false, error: "Поръчката не е намерена." } as const;
    if (!isEditableOrder(order)) return { ok: false, error: "Тази поръчка вече не може да се разделя." } as const;
    const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const moving = validPicks(lines, picks);
    const pieces = (list: { qty: number }[]) => list.reduce((sum, l) => sum + l.qty, 0);
    if (moving.length === 0) return { ok: false, error: "Отбележи кои продукти да се отделят." } as const;
    if (pieces(moving) >= pieces(lines)) return { ok: false, error: "Нещо трябва да остане и в тази поръчка." } as const;

    // The same customer, contact and delivery; its own number, sums and state.
    const [fresh] = await tx
      .insert(orders)
      .values({
        number: orderNumber(),
        userId: order.userId,
        name: order.name,
        phone: order.phone,
        email: order.email,
        delivery: order.delivery,
        courier: order.courier,
        officeCode: order.officeCode,
        officeName: order.officeName,
        city: order.city,
        address: order.address,
        note: order.note,
        payment: order.payment,
        subtotal: 0,
        shipping: 0,
        total: 0,
        status: order.status,
        source: order.source,
        pushSubscriptionId: order.pushSubscriptionId,
        fbName: order.fbName,
        fbUserId: order.fbUserId,
      })
      .returning({ id: orders.id });
    for (const { line, qty } of moving) {
      if (qty === line.qty) {
        await tx.update(orderItems).set({ orderId: fresh.id }).where(eq(orderItems.id, line.id));
      } else {
        await tx
          .update(orderItems)
          .set({ qty: line.qty - qty })
          .where(eq(orderItems.id, line.id));
        await tx.insert(orderItems).values({ orderId: fresh.id, productId: line.productId, name: line.name, sku: line.sku, price: line.price, qty, color: line.color, deliveryTime: line.deliveryTime });
      }
    }
    await recalc(tx, orderId);
    await recalc(tx, fresh.id);
    return { ok: true, orderId: fresh.id } as const;
  });
}

/**
 * Takes the picked pieces out of the order (the customer gave them up) and returns them to stock.
 * An order left with nothing is cancelled.
 */
export async function removeOrderItems(orderId: number, picks: ItemPick[]): Promise<OrderEditResult & { restocked?: boolean }> {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return { ok: false, error: "Поръчката не е намерена." } as const;
    if (!isEditableOrder(order)) return { ok: false, error: "От тази поръчка вече не може да се маха." } as const;
    const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const removing = validPicks(lines, picks);
    if (removing.length === 0) return { ok: false, error: "Отбележи кои продукти да се махнат." } as const;
    let restocked = false;
    for (const { line, qty } of removing) {
      if (qty === line.qty) await tx.delete(orderItems).where(eq(orderItems.id, line.id));
      else
        await tx
          .update(orderItems)
          .set({ qty: line.qty - qty })
          .where(eq(orderItems.id, line.id));
      if (line.productId != null && (await moveStock(tx, line.productId, qty, line.color)) !== null) restocked = true;
    }
    await recalc(tx, orderId);
    const [{ left }] = await tx.select({ left: sql<number>`count(*)` }).from(orderItems).where(eq(orderItems.orderId, orderId));
    return { ok: true, orderId, restocked, empty: Number(left) === 0 } as const;
  });
  // Nothing left in it: the lines are gone, so cancelling returns no stock a second time.
  if (result.ok && result.empty) await changeOrderStatus(orderId, "cancelled", { note: "Всички продукти са махнати от поръчката." });
  return result;
}

/** The message for "Готова за взимане", with the order's own products in it. */
/** The page anybody with the link can open to see the order, without an account (app/(shop)/porachka/[number]). */
export const publicOrderUrl = (number: string) => `${site.url}/porachka/${encodeURIComponent(number)}`;

export function pickupMessage(template: string, order: Pick<Order, "name" | "total" | "number">, items: Pick<OrderItem, "name" | "qty" | "color">[]) {
  const first = order.name.trim().split(/\s+/)[0] ?? "";
  const list = items.map((i) => `• ${i.name}${i.color ? ` (${i.color})` : ""} × ${i.qty} бр`).join("\n");
  // The link to the order is the point of the message: a wording without it gets it at the end.
  const wording = template.includes("{линк}") ? template : `${template.trimEnd()}\nПоръчката Ви: {линк}`;
  return wording
    .replaceAll("{име}", first)
    .replaceAll("{продукти}", list)
    .replaceAll("{сума}", formatPrice(order.total))
    .replaceAll("{адрес}", STORE.address)
    .replaceAll("{линк}", publicOrderUrl(order.number))
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1900);
}

/** Queues the pickup message for the extension. False when the customer's Facebook profile is not known. */
async function queuePickupMessage(tx: Tx, order: Order, template: string) {
  if (!order.fbUserId) return false;
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  // The chat is recognised by the person's name on Facebook, which is the one on their comments: the name on
  // the order may since have become the one they gave for the courier.
  const [comment] = await tx.select({ name: fbClaims.name }).from(fbClaims).where(eq(fbClaims.fbUserId, order.fbUserId)).orderBy(desc(fbClaims.id)).limit(1);
  // One waiting message per order: pressing again replaces it with the current products.
  await tx.delete(fbMessages).where(and(eq(fbMessages.orderId, order.id), eq(fbMessages.status, "pending")));
  await tx.insert(fbMessages).values({ orderId: order.id, fbUserId: order.fbUserId, name: comment?.name ?? order.name, body: pickupMessage(template, order, items) });
  return true;
}

/** Whether the customer may still say how they want an order gathered from the group: from the shop or by courier. */
export const canChooseDelivery = (o: Pick<Order, "source" | "status" | "trackingNumber" | "payment" | "discount">) => o.source === "facebook" && isEditableOrder(o);

export type DeliveryChoice = { delivery: string; courier: string | null; officeCode: string | null; city: string; address: string; name: string; phone: string };

/**
 * The customer chose, on the order's public page, to take it from the shop or to have it sent: the order gets
 * the delivery, the contact and the delivery price that goes with them, and the shop is told.
 */
export async function chooseOrderDelivery(number: string, choice: DeliveryChoice): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  const [order] = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  if (!order) return { ok: false, error: "Поръчката не е намерена." };
  if (!canChooseDelivery(order)) return { ok: false, error: "Доставката на тази поръчка вече не може да се променя. Обадете ни се." };

  const pickup = choice.delivery === "store";
  const office = savedOffice(choice.delivery, choice.courier, choice.officeCode);
  if ((choice.delivery === "office" || choice.delivery === "box") && !office) return { ok: false, error: "Изберете офис от списъка.", field: "office" };
  const city = pickup ? STORE.city : (office?.city ?? choice.city);
  const address = pickup ? STORE.address : (office?.address ?? choice.address);
  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const { shipping } = await quoteShipping({ delivery: choice.delivery, courier: pickup ? null : choice.courier, officeCode: office?.code, city, payment: "cod", subtotal });
  const how = pickup ? "взимане от магазина" : `доставка ${choice.delivery === "address" ? "до адрес" : choice.delivery === "box" ? "до автомат" : "до офис"}`;
  const note = `Клиентът избра ${how} на ${formatTimestamp(new Date())}.`;

  const changed = await db
    .update(orders)
    .set({
      delivery: choice.delivery,
      courier: pickup ? null : choice.courier,
      officeCode: office?.code ?? null,
      officeName: office?.name ?? null,
      city,
      address,
      name: choice.name || order.name,
      phone: choice.phone || order.phone,
      subtotal,
      shipping,
      total: Math.max(0, subtotal + shipping - order.discount),
      note: order.note ? `${order.note}\n${note}` : note,
    })
    // Only while it is still as it was read: not shipped or cancelled in the meantime.
    .where(and(eq(orders.id, order.id), eq(orders.status, order.status), isNull(orders.trackingNumber)))
    .returning({ id: orders.id });
  if (changed.length === 0) return { ok: false, error: "Поръчката току-що се промени. Опитайте отново." };

  // Next time this person orders in the group, their details are known.
  if (order.fbName && choice.phone) {
    const remembered = { name: choice.name || order.name, phone: choice.phone, delivery: choice.delivery, courier: pickup ? null : choice.courier, officeCode: office?.code ?? null, city: pickup ? "" : city, address: choice.delivery === "address" ? address : "", updatedAt: new Date() };
    await db.insert(fbContacts).values({ key: order.fbName, email: "", ...remembered }).onConflictDoUpdate({ target: fbContacts.key, set: remembered });
  }
  await notifyAdmins("order", {
    title: pickup ? `${order.number}: ще се вземе от магазина` : `${order.number}: клиентът иска доставка`,
    body: pickup ? `${order.name} ще вземе поръчката от магазина.` : `${choice.name || order.name} · ${choice.phone} · ${office?.name ?? `${city}, ${address}`}`,
    url: `/admin/porachki/${order.id}`,
    tag: `order-delivery-${order.id}`,
  });
  return { ok: true };
}

/**
 * "Готова за взимане": the goods are in the shop. The order takes no more items from now on, and the customer
 * gets a message in their Facebook chat (through the extension) when their profile is known.
 */
export async function markOrderReady(orderId: number): Promise<{ ok: boolean; queued: boolean }> {
  const { message } = await getFbOrderSettings();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.delivery !== "store" || !(OPEN as readonly string[]).includes(order.status)) return { ok: false, queued: false };
    if (!order.readyAt) await tx.update(orders).set({ readyAt: new Date() }).where(eq(orders.id, orderId));
    return { ok: true, queued: await queuePickupMessage(tx, order, message) };
  });
}

/** The messages waiting for the extension, oldest first, and what it reported back about one. */
export async function pendingFbMessages(limit = 10) {
  return db.select().from(fbMessages).where(eq(fbMessages.status, "pending")).orderBy(asc(fbMessages.id)).limit(limit);
}

/** The short reason in a stored error ("no-type" from "no-type (focus 0, swaps 2)"), and the details after it. */
export const fbMessageError = (error: string | null) => {
  const [code, detail] = (error ?? "").split(" (");
  return { code, detail: detail ? detail.replace(/\)$/, "") : null };
};

export async function reportFbMessage(id: number, outcome: string, detail?: string) {
  const sent = outcome === "sent";
  // The details are kept after the reason, so a failure on somebody's computer can be understood afterwards.
  const error = `${outcome}${detail ? ` (${detail.replace(/[()]/g, "")})` : ""}`.slice(0, 180);
  await db
    .update(fbMessages)
    .set(sent ? { status: "sent", sentAt: new Date(), error: null } : { status: "failed", error })
    .where(and(eq(fbMessages.id, id), eq(fbMessages.status, "pending")));
}

/** Takes "Готова за взимане" back; a message that has not gone out yet is dropped. */
export async function unmarkOrderReady(orderId: number) {
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ readyAt: null }).where(eq(orders.id, orderId));
    await tx.delete(fbMessages).where(and(eq(fbMessages.orderId, orderId), eq(fbMessages.status, "pending")));
  });
}
