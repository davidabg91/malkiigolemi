"use server";

import { eq, inArray } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { categories, products, promotionProducts, promotions } from "@/db/schema";
import { assertAdmin } from "@/lib/auth";
import { CATALOG_TAG } from "@/lib/queries";
import { sofiaInputToDate } from "@/lib/time";

export type PromoFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Въведи име на промоцията.").max(80),
  percent: z.coerce.number().int("Цяло число.").min(1, "Поне 1%.").max(90, "Най-много 90%."),
  startsAt: z.string(),
  endsAt: z.string(),
  target: z.enum(["products", "category"]),
  categoryId: z.string(),
});

export async function savePromotion(id: number | null, _prev: PromoFormState, formData: FormData): Promise<PromoFormState> {
  await assertAdmin();
  const parsed = schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Провери отбелязаните полета.", fieldErrors };
  }
  const d = parsed.data;
  const startsAt = sofiaInputToDate(d.startsAt);
  const endsAt = sofiaInputToDate(d.endsAt);
  if (!startsAt) return { error: "Избери начало.", fieldErrors: { startsAt: "Избери дата и час." } };
  if (!endsAt) return { error: "Избери край.", fieldErrors: { endsAt: "Избери дата и час." } };
  if (endsAt <= startsAt) return { error: "Краят трябва да е след началото.", fieldErrors: { endsAt: "Трябва да е след началото." } };

  let categoryId: number | null = null;
  let productIds: number[] = [];
  if (d.target === "category") {
    const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, Number(d.categoryId))).limit(1);
    if (!category) return { error: "Избери категория.", fieldErrors: { categoryId: "Избери категория." } };
    categoryId = category.id;
  } else {
    const wanted = formData.getAll("productIds").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    productIds = wanted.length ? (await db.select({ id: products.id }).from(products).where(inArray(products.id, wanted))).map((p) => p.id) : [];
    if (productIds.length === 0) return { error: "Избери поне един продукт.", fieldErrors: { productIds: "Избери поне един продукт." } };
  }

  const values = { name: d.name, percent: d.percent, startsAt, endsAt, categoryId, enabled: formData.get("enabled") === "on" };
  await db.transaction(async (tx) => {
    let promoId = id;
    if (promoId) {
      await tx.update(promotions).set(values).where(eq(promotions.id, promoId));
      await tx.delete(promotionProducts).where(eq(promotionProducts.promotionId, promoId));
    } else {
      [{ id: promoId }] = await tx.insert(promotions).values(values).returning({ id: promotions.id });
    }
    if (productIds.length) await tx.insert(promotionProducts).values(productIds.map((productId) => ({ promotionId: promoId!, productId })));
  });

  updateTag(CATALOG_TAG);
  redirect("/admin/promocii");
}

export async function togglePromotion(id: number): Promise<void> {
  await assertAdmin();
  const [promo] = await db.select({ enabled: promotions.enabled }).from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!promo) return;
  await db.update(promotions).set({ enabled: !promo.enabled }).where(eq(promotions.id, id));
  updateTag(CATALOG_TAG);
  refresh();
}

export async function deletePromotion(id: number): Promise<void> {
  await assertAdmin();
  await db.delete(promotions).where(eq(promotions.id, id));
  updateTag(CATALOG_TAG);
  redirect("/admin/promocii");
}
