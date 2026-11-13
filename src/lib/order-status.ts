import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, type OrderStatus } from "@/db/schema";
import { syncOrderPoints } from "./loyalty";
import { sendOrderShipped } from "./order-mail";
import { refundOrder } from "./stripe";
import { notifyRestocked } from "./stock-alerts";

/**
 * The one place an order's status changes, for the admin (one or many orders) and for a customer cancelling.
 * In a single transaction it:
 * - changes the status only if it is still `from` (or any of `allowedFrom`), so two clicks cannot both apply;
 * - returns goods to stock when an order is cancelled, and takes them again if it is re-opened;
 * - keeps loyalty points in step (earned on delivery, used points returned on cancel).
 * Afterwards, anyone waiting for a product that came back in stock is told, and a shipped order's customer gets an e-mail.
 */
export async function changeOrderStatus(
  orderId: number,
  to: OrderStatus,
  opts: { allowedFrom?: OrderStatus[]; note?: string } = {},
): Promise<"changed" | "unchanged" | "blocked"> {
  const restocked: number[] = [];
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return "blocked" as const;
    if (order.status === to) return "unchanged" as const;
    if (opts.allowedFrom && !opts.allowedFrom.includes(order.status)) return "blocked" as const;

    const changed = await tx
      .update(orders)
      .set({ status: to, ...(opts.note ? { note: order.note ? `${order.note}\n${opts.note}` : opts.note } : {}) })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
      .returning({ id: orders.id });
    if (changed.length === 0) return "blocked" as const;

    const sign = to === "cancelled" ? 1 : order.status === "cancelled" ? -1 : 0;
    if (sign !== 0) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      for (const i of items) {
        if (i.productId == null) continue;
        const [p] = await tx
          .update(products)
          .set({ stock: sql`max(0, ${products.stock} + ${sign * i.qty})` })
          .where(eq(products.id, i.productId))
          .returning({ id: products.id, stock: products.stock });
        if (sign > 0 && p && p.stock === i.qty) restocked.push(p.id);
      }
    }
    await syncOrderPoints(tx, order.id);
    return "changed" as const;
  });
  if (restocked.length) await notifyRestocked(restocked);
  if (result === "changed" && to === "shipped") await sendOrderShipped(orderId);
  // A cancelled order paid by card gets its money back; if Stripe refuses, the admin sees a note to do it by hand.
  if (result === "changed" && to === "cancelled" && !(await refundOrder(orderId))) {
    await db
      .update(orders)
      .set({ note: sql`trim(coalesce(${orders.note}, '') || char(10) || 'Връщането на сумата в Stripe не успя — направи го ръчно от Stripe.')` })
      .where(eq(orders.id, orderId));
  }
  return result;
}

export async function changeOrdersStatus(ids: number[], to: OrderStatus) {
  const existing = await db.select({ id: orders.id }).from(orders).where(inArray(orders.id, ids));
  let changed = 0;
  for (const { id } of existing) {
    if ((await changeOrderStatus(id, to)) === "changed") changed += 1;
  }
  return changed;
}
