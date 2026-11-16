import "server-only";
import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, type Order } from "@/db/schema";
import {
  BoxNowError,
  boxnowConfig,
  boxnowEventText,
  boxnowParcel,
  cancelParcel,
  createDeliveryRequest,
  eventOutcome,
  normalizeEvent,
} from "./boxnow";
import { getBoxNowSettings, missingBoxNowFields, type BoxNowSettings } from "./boxnow-settings";
import { parseEvents, type TrackingEvent } from "./econt";
import { changeOrderStatus } from "./order-status";
import { lineName } from "./product-colors";
import { awaitsCardPayment } from "./stripe";

/** Per-parcel choices the admin can change before creating it. */
export type BoxNowParcelOptions = {
  size: 1 | 2 | 3;
  weight: number;
  /** Cash on delivery in euro (only for orders not paid by card). */
  cod: number;
  description: string;
};

type OrderWithItems = Order & { items: { name: string; qty: number; color?: string | null }[] };

/** Why an order cannot get a BOX NOW parcel, or null when it can. */
export function boxnowBlocker(order: Order): string | null {
  if (order.courier !== "boxnow" || order.delivery !== "box") return "Поръчката не е с доставка до автомат BOX NOW.";
  if (order.status === "cancelled") return "Поръчката е отказана.";
  if (awaitsCardPayment(order)) return "Поръчката още не е платена с карта.";
  if (!order.officeCode) return "В поръчката няма избран автомат на BOX NOW.";
  if (!order.email.trim()) return "BOX NOW изисква имейл на получателя, а поръчката няма.";
  return null;
}

export function defaultParcel(order: OrderWithItems, s: BoxNowSettings): BoxNowParcelOptions {
  const goods = order.items.map((i) => `${lineName(i.name, i.color)}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ");
  return {
    size: s.defaultSize,
    weight: s.defaultWeight,
    cod: order.payment === "cod" ? order.total / 100 : 0,
    description: `Поръчка ${order.number}: ${goods}`.slice(0, 200),
  };
}

/** Our own label link (the PDF needs BOX NOW's token, so the admin gets it through the shop). */
export const boxnowLabelPath = (orderId: number) => `/api/admin/boxnow-label/${orderId}`;

async function loadOrder(orderId: number) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true } });
  if (!order) throw new BoxNowError("Поръчката не е намерена.");
  const blocker = boxnowBlocker(order);
  if (blocker) throw new BoxNowError(blocker);
  const s = await getBoxNowSettings();
  const missing = missingBoxNowFields(s);
  if (missing.length) throw new BoxNowError(`Първо попълни в Куриери → BOX NOW: ${missing.join(", ")}.`);
  return { order, s };
}

/**
 * Creates the delivery request at BOX NOW and stores the parcel id on the order (as its tracking number).
 * A new order becomes "confirmed"; it turns "shipped" and "delivered" from BOX NOW's events.
 */
export async function createBoxNowParcel(orderId: number, o: BoxNowParcelOptions): Promise<string> {
  const { order, s } = await loadOrder(orderId);
  if (order.trackingNumber) throw new BoxNowError(`Поръчката вече има пратка ${order.trackingNumber}.`);
  const input = {
    orderNumber: order.number,
    invoiceValue: order.subtotal / 100,
    cod: order.payment === "card" ? 0 : o.cod,
    allowReturn: s.allowReturn,
    origin: { name: s.senderName, phone: s.senderPhone, email: s.senderEmail, locationId: s.originId },
    destination: { name: order.name, phone: order.phone, email: order.email, locationId: order.officeCode! },
    description: o.description,
    parcels: [{ name: o.description.slice(0, 100), value: order.subtotal / 100, weight: o.weight, size: o.size }],
  };
  let result;
  try {
    result = await createDeliveryRequest(input);
  } catch (e) {
    // An order number can be used only once at BOX NOW, even after its parcel was cancelled: send a variant.
    if (!(e instanceof BoxNowError) || e.code !== "P410") throw e;
    result = await createDeliveryRequest({ ...input, orderNumber: `${order.number}-${Date.now().toString(36).slice(-4).toUpperCase()}` });
  }
  const parcelId = result.parcelIds[0];
  if (!parcelId) throw new BoxNowError("BOX NOW не върна номер на пратката.");
  const now = new Date();
  await db
    .update(orders)
    .set({
      trackingNumber: parcelId,
      waybillUrl: boxnowLabelPath(order.id),
      shippingCost: null,
      shipmentStatus: boxnowEventText("new"),
      trackingEvents: JSON.stringify([{ time: now.toISOString(), text: boxnowEventText("new"), place: null }] satisfies TrackingEvent[]),
      trackedAt: now,
    })
    .where(eq(orders.id, order.id));
  if (order.status === "new") await changeOrderStatus(order.id, "confirmed", { allowedFrom: ["new"] });
  return parcelId;
}

/** Cancels the parcel at BOX NOW (possible while it is still "new") and clears it from the order. */
export async function cancelBoxNowParcel(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.trackingNumber || order.courier !== "boxnow") throw new BoxNowError("Поръчката няма пратка в BOX NOW.");
  await cancelParcel(order.trackingNumber);
  await db
    .update(orders)
    .set({ trackingNumber: null, waybillUrl: null, shippingCost: null, shipmentStatus: null, trackingEvents: null, trackedAt: null })
    .where(eq(orders.id, order.id));
}

/** Moves the order along for an event: "shipped" once BOX NOW has the parcel, "delivered" once the customer took it. */
async function applyOutcome(orderId: number, event: string) {
  const outcome = eventOutcome(event);
  if (outcome === "delivered") await changeOrderStatus(orderId, "delivered", { allowedFrom: ["new", "confirmed", "shipped"] });
  else if (outcome === "shipped") await changeOrderStatus(orderId, "shipped", { allowedFrom: ["new", "confirmed"] });
}

/**
 * One event from BOX NOW's webhook: adds it to the order's history (once), shows it as the current status
 * when it is the newest, and moves the order along. Returns false when no order has this parcel.
 */
export async function recordBoxNowEvent(e: { parcelId: string; orderNumber?: string | null; event: string; time: string; place?: string | null }): Promise<boolean> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.courier, "boxnow"), eq(orders.trackingNumber, e.parcelId)))
    .limit(1);
  if (!order) return false;
  const time = Number.isNaN(Date.parse(e.time)) ? new Date().toISOString() : new Date(e.time).toISOString();
  const text = boxnowEventText(e.event);
  const events = parseEvents(order.trackingEvents);
  if (!events.some((x) => x.time === time && x.text === text)) events.push({ time, text, place: e.place?.trim() || null });
  events.sort((a, b) => a.time.localeCompare(b.time));
  // Calls can arrive late or twice; the newest event in the history is the current status.
  const latest = events[events.length - 1];
  await db
    .update(orders)
    .set({ trackingEvents: JSON.stringify(events), shipmentStatus: latest.text, trackedAt: new Date() })
    .where(eq(orders.id, order.id));
  if (latest.text === text) await applyOutcome(order.id, normalizeEvent(e.event));
  else if (normalizeEvent(e.event) === "delivered") await applyOutcome(order.id, "delivered");
  return true;
}

/**
 * Asks BOX NOW about open BOX NOW parcels (or the given orders) and brings the orders up to date.
 * The webhook does this as it happens; this is the safety net (cron) and the admin's "refresh" button.
 */
export async function syncBoxNowParcels(orderIds?: number[]): Promise<number> {
  if (!boxnowConfig().configured) return 0;
  const open = await db
    .select({ id: orders.id, parcelId: orders.trackingNumber })
    .from(orders)
    .where(
      and(
        eq(orders.courier, "boxnow"),
        isNotNull(orders.trackingNumber),
        orderIds?.length ? inArray(orders.id, orderIds) : notInArray(orders.status, ["delivered", "cancelled"]),
      ),
    );
  for (const o of open) {
    const p = await boxnowParcel(o.parcelId!);
    if (!p) continue;
    const events: TrackingEvent[] = p.events.map((x) => ({ time: x.time, text: boxnowEventText(x.type), place: x.place }));
    const current = p.state ?? p.events[p.events.length - 1]?.type ?? null;
    await db
      .update(orders)
      .set({
        ...(events.length ? { trackingEvents: JSON.stringify(events) } : {}),
        ...(current ? { shipmentStatus: boxnowEventText(current) } : {}),
        trackedAt: new Date(),
      })
      .where(eq(orders.id, o.id));
    if (current) await applyOutcome(o.id, current);
  }
  return open.length;
}
