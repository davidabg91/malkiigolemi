import "server-only";
import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, settings, type Order } from "@/db/schema";
import { deleteEcontLabels, EcontError, econtLabel, econtStatuses, type EcontLabelInput, type EcontLabelResult } from "./econt";
import { getEcontSettings, missingSenderFields, type EcontSettings } from "./econt-settings";
import { changeOrderStatus } from "./order-status";

/** Per-waybill choices the admin can change before creating it. */
export type WaybillOptions = {
  weight: number;
  packCount: number;
  /** Cash on delivery in euro. */
  cod: number;
  description: string;
  pickup?: { from: string; to: string } | null;
};

type OrderWithItems = Order & { items: { name: string; qty: number }[] };

/** Why an order cannot get an Econt waybill, or null when it can. */
export function waybillBlocker(order: Order): string | null {
  if (order.courier !== "econt" || order.delivery === "store") return "Поръчката не е с доставка чрез Еконт.";
  if (order.status === "cancelled") return "Поръчката е отказана.";
  if ((order.delivery === "office" || order.delivery === "box") && !order.officeCode) return "В поръчката няма избран офис на Еконт.";
  if (order.delivery === "address" && (!order.city.trim() || !order.address.trim())) return "В поръчката няма пълен адрес за доставка.";
  return null;
}

/** The suggested waybill for an order: cash on delivery for the amount the customer still owes. */
export function defaultWaybill(order: OrderWithItems, s: EcontSettings): WaybillOptions {
  const owed = order.payment === "cod" ? order.total - (s.payer === "receiver" ? order.shipping : 0) : 0;
  const goods = order.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ");
  return {
    weight: s.defaultWeight,
    packCount: 1,
    cod: Math.max(0, owed) / 100,
    description: `Поръчка ${order.number}: ${goods}`.slice(0, 200),
  };
}

function labelInput(order: Order, s: EcontSettings, o: WaybillOptions): EcontLabelInput {
  const toOffice = order.delivery === "office" || order.delivery === "box";
  return {
    sender: {
      name: s.senderClientId ? s.senderClientName || s.senderName : s.senderName,
      phone: s.senderPhone,
      clientId: s.senderClientId,
      agentName: s.senderClientCompany ? s.senderAgent : null,
      officeCode: s.senderMode === "office" ? s.senderOfficeCode : null,
      city: s.senderCity,
      address: s.senderAddress,
    },
    receiver: {
      name: order.name,
      phone: order.phone,
      officeCode: toOffice ? order.officeCode : null,
      city: order.city,
      address: order.address,
    },
    orderNumber: order.number,
    description: o.description,
    weight: o.weight,
    packCount: o.packCount,
    cod: o.cod,
    payer: s.payer,
    senderPayment: s.senderPayment,
    inspectBeforePay: s.inspectBeforePay,
    sms: s.sms,
    codTemplate: s.codTemplate || null,
    pickup: s.senderMode === "address" ? (o.pickup ?? null) : null,
  };
}

async function loadOrder(orderId: number) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true } });
  if (!order) throw new EcontError("Поръчката не е намерена.");
  const blocker = waybillBlocker(order);
  if (blocker) throw new EcontError(blocker);
  const s = await getEcontSettings();
  const missing = missingSenderFields(s);
  if (missing.length) throw new EcontError(`Първо попълни в Куриери → Еконт: ${missing.join(", ")}.`);
  return { order, s };
}

/** Prices the waybill without creating it. */
export async function quoteWaybill(orderId: number, options: WaybillOptions): Promise<EcontLabelResult> {
  const { order, s } = await loadOrder(orderId);
  return econtLabel(labelInput(order, s, options), "calculate");
}

/**
 * Creates the real waybill and stores its number, PDF and price on the order.
 * A new order becomes "confirmed"; it turns "shipped" once Econt has the parcel (see syncShipments).
 */
export async function createWaybill(orderId: number, options: WaybillOptions): Promise<EcontLabelResult> {
  const { order, s } = await loadOrder(orderId);
  if (order.trackingNumber) throw new EcontError(`Поръчката вече има товарителница ${order.trackingNumber}.`);
  const label = await econtLabel(labelInput(order, s, options), "create");
  if (!label.shipmentNumber) throw new EcontError("Еконт не върна номер на товарителница.");
  await db
    .update(orders)
    .set({
      trackingNumber: label.shipmentNumber,
      waybillUrl: label.pdfUrl,
      shippingCost: Math.round(label.senderDue * 100),
      shipmentStatus: "Товарителницата е създадена",
      trackingEvents: null,
      trackedAt: new Date(),
    })
    .where(eq(orders.id, order.id));
  if (order.status === "new") await changeOrderStatus(order.id, "confirmed", { allowedFrom: ["new"] });
  return label;
}

/** Cancels the waybill at Econt (possible until Econt accepts the parcel) and clears it from the order. */
export async function deleteWaybill(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.trackingNumber) throw new EcontError("Поръчката няма товарителница.");
  const refused = await deleteEcontLabels([order.trackingNumber]);
  if (refused[order.trackingNumber]) throw new EcontError(refused[order.trackingNumber]);
  await db
    .update(orders)
    .set({ trackingNumber: null, waybillUrl: null, shippingCost: null, shipmentStatus: null, trackingEvents: null, trackedAt: null })
    .where(eq(orders.id, order.id));
}

/**
 * Asks Econt about open Econt shipments (or the given orders) and brings the orders up to date:
 * stores the courier's status and history, marks the order "shipped" once Econt has the parcel
 * and "delivered" once the customer has it. Returns how many orders it checked.
 */
export async function syncShipments(orderIds?: number[]): Promise<number> {
  const open = await db
    .select({ id: orders.id, number: orders.trackingNumber, status: orders.status })
    .from(orders)
    .where(
      and(
        eq(orders.courier, "econt"),
        isNotNull(orders.trackingNumber),
        orderIds?.length ? inArray(orders.id, orderIds) : notInArray(orders.status, ["delivered", "cancelled"]),
      ),
    );
  for (let i = 0; i < open.length; i += 100) {
    const batch = open.slice(i, i + 100);
    const statuses = await econtStatuses(batch.map((o) => o.number!));
    const byNumber = new Map(statuses.map((s) => [s.shipmentNumber, s]));
    for (const o of batch) {
      const s = byNumber.get(o.number!);
      if (!s || s.error) continue;
      await db
        .update(orders)
        .set({ shipmentStatus: s.status, trackingEvents: JSON.stringify(s.events), trackedAt: new Date() })
        .where(eq(orders.id, o.id));
      if (s.deliveredAt && !s.returned) await changeOrderStatus(o.id, "delivered", { allowedFrom: ["new", "confirmed", "shipped"] });
      else if (s.sentAt) await changeOrderStatus(o.id, "shipped", { allowedFrom: ["new", "confirmed"] });
    }
  }
  return open.length;
}

const LAST_SYNC = "econt_last_sync";

/** syncShipments, at most every `minutes`; for page views, so tracking stays fresh without a frequent cron. */
export async function syncShipmentsIfStale(minutes = 20) {
  const [row] = await db.select().from(settings).where(eq(settings.key, LAST_SYNC)).limit(1);
  if (row && Date.now() - Number(row.value) < minutes * 60_000) return;
  const now = String(Date.now());
  await db.insert(settings).values({ key: LAST_SYNC, value: now }).onConflictDoUpdate({ target: settings.key, set: { value: now } });
  try {
    await syncShipments();
  } catch (e) {
    console.error("Econt tracking sync failed:", e);
  }
}
