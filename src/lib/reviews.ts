import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, reviews, users } from "@/db/schema";

/** "Мария Георгиева" → "Мария Г." so reviews show who wrote them without exposing full names. */
export function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

/** Only customers who received the product may review it: a delivered order of theirs contains it. */
export async function hasReceived(userId: number, productId: number) {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.userId, userId), eq(orders.status, "delivered"), eq(orderItems.productId, productId)))
    .limit(1);
  return Boolean(row);
}

export async function productReviews(productId: number) {
  const [list, dist] = await Promise.all([
    db
      .select({ id: reviews.id, rating: reviews.rating, body: reviews.body, createdAt: reviews.createdAt, userId: reviews.userId, name: users.name })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(and(eq(reviews.productId, productId), eq(reviews.hidden, false)))
      .orderBy(desc(reviews.createdAt))
      .limit(100),
    db
      .select({ rating: reviews.rating, n: sql<number>`count(*)` })
      .from(reviews)
      .where(and(eq(reviews.productId, productId), eq(reviews.hidden, false)))
      .groupBy(reviews.rating),
  ]);
  const count = dist.reduce((s, d) => s + d.n, 0);
  const average = count ? dist.reduce((s, d) => s + d.rating * d.n, 0) / count : 0;
  const byStars = [5, 4, 3, 2, 1].map((stars) => ({ stars, n: dist.find((d) => d.rating === stars)?.n ?? 0 }));
  return { list: list.map((r) => ({ ...r, name: shortName(r.name) })), count, average, byStars };
}

export async function ownReview(userId: number, productId: number) {
  const [row] = await db.select().from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.productId, productId))).limit(1);
  return row ?? null;
}
