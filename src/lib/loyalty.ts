import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { loyaltyLedger, orders, settings } from "@/db/schema";
import { DEFAULT_LOYALTY, pointsForGoods, type LoyaltySettings } from "./loyalty-math";

export * from "./loyalty-math";

const KEY = "loyalty";
type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function getLoyaltySettings(conn: Db | Tx = db): Promise<LoyaltySettings> {
  const [row] = await conn.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  if (!row) return DEFAULT_LOYALTY;
  try {
    return { ...DEFAULT_LOYALTY, ...(JSON.parse(row.value) as Partial<LoyaltySettings>) };
  } catch {
    return DEFAULT_LOYALTY;
  }
}

export async function saveLoyaltySettings(value: LoyaltySettings) {
  const json = JSON.stringify(value);
  await db.insert(settings).values({ key: KEY, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } });
}

export async function pointsBalance(userId: number, conn: Db | Tx = db) {
  const [row] = await conn.select({ n: sql<number>`coalesce(sum(${loyaltyLedger.points}), 0)` }).from(loyaltyLedger).where(eq(loyaltyLedger.userId, userId));
  return row?.n ?? 0;
}

export async function pointsHistory(userId: number, limit = 50) {
  return db
    .select({ entry: loyaltyLedger, orderNumber: orders.number })
    .from(loyaltyLedger)
    .leftJoin(orders, eq(orders.id, loyaltyLedger.orderId))
    .where(eq(loyaltyLedger.userId, userId))
    .orderBy(desc(loyaltyLedger.createdAt), desc(loyaltyLedger.id))
    .limit(limit);
}

/**
 * Brings an order's points in line with its status, inside the caller's transaction:
 * a delivered order earns points, any other status earns none; a cancelled order gives back the points it used.
 * Works from the ledger's running totals, so calling it twice, or going delivered → cancelled → delivered, stays right.
 */
export async function syncOrderPoints(tx: Tx, orderId: number) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.userId) return;
  const s = await getLoyaltySettings(tx);

  const net = async (kinds: ("earn" | "reverse" | "redeem" | "refund")[]) => {
    const [row] = await tx
      .select({ n: sql<number>`coalesce(sum(${loyaltyLedger.points}), 0)` })
      .from(loyaltyLedger)
      .where(and(eq(loyaltyLedger.orderId, order.id), inArray(loyaltyLedger.kind, kinds)));
    return row?.n ?? 0;
  };

  const earned = await net(["earn", "reverse"]);
  // Points earned once stay at the rate of that day; only a status change takes them back.
  const shouldEarn = order.status === "delivered" ? (earned > 0 ? earned : s.enabled ? pointsForGoods(order.subtotal - order.discount, s) : 0) : 0;
  if (shouldEarn !== earned) {
    await tx.insert(loyaltyLedger).values({
      userId: order.userId,
      orderId: order.id,
      points: shouldEarn - earned,
      kind: shouldEarn > earned ? "earn" : "reverse",
      note: shouldEarn > earned ? `Поръчка ${order.number}` : `Поръчка ${order.number} вече не е доставена`,
    });
  }

  const used = await net(["redeem", "refund"]);
  const shouldUse = order.status === "cancelled" ? 0 : -order.pointsUsed;
  if (shouldUse !== used) {
    await tx.insert(loyaltyLedger).values({
      userId: order.userId,
      orderId: order.id,
      points: shouldUse - used,
      kind: shouldUse > used ? "refund" : "redeem",
      note: shouldUse > used ? `Отказана поръчка ${order.number}` : `Поръчка ${order.number}`,
    });
  }
}
