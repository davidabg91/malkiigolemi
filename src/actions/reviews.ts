"use server";

import { after } from "next/server";
import { notifyAdmins } from "@/lib/push";
import { eq, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { assertAdmin, getSession } from "@/lib/auth";
import { CATALOG_TAG } from "@/lib/queries";
import { hasReceived } from "@/lib/reviews";

export type ReviewFormState = { ok?: boolean; error?: string } | undefined;

const schema = z.object({
  rating: z.coerce.number().int().min(1, "Избери оценка от 1 до 5 звезди.").max(5),
  body: z.string().trim().max(1000, "Най-много 1000 знака."),
});

export async function submitReview(productId: number, _prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const session = await getSession();
  if (!session) return { error: "Влез в профила си, за да оцениш продукта." };
  const parsed = schema.safeParse({ rating: formData.get("rating") ?? "", body: String(formData.get("body") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Провери оценката." };
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return { error: "Продуктът не е намерен." };
  if (!(await hasReceived(session.uid, product.id))) return { error: "Само клиенти, получили продукта, могат да го оценяват." };

  // One review per customer and product; writing again updates it.
  await db
    .insert(reviews)
    .values({ productId: product.id, userId: session.uid, rating: parsed.data.rating, body: parsed.data.body })
    .onConflictDoUpdate({
      target: [reviews.productId, reviews.userId],
      set: { rating: parsed.data.rating, body: parsed.data.body, updatedAt: sql`(unixepoch())` },
    });
  updateTag(CATALOG_TAG);
  refresh();
  after(() =>
    notifyAdmins("review", {
      title: `Нов отзив: ${parsed.data.rating} от 5`,
      body: `${session.name}${parsed.data.body ? `: ${parsed.data.body.slice(0, 110)}` : ""}`,
      url: "/admin/otzivi",
      tag: "review",
    }),
  );
  return { ok: true };
}

export async function setReviewHidden(id: number, hidden: boolean): Promise<void> {
  await assertAdmin();
  await db.update(reviews).set({ hidden }).where(eq(reviews.id, id));
  updateTag(CATALOG_TAG);
  refresh();
}

export async function deleteReview(id: number): Promise<void> {
  await assertAdmin();
  await db.delete(reviews).where(eq(reviews.id, id));
  updateTag(CATALOG_TAG);
  refresh();
}
