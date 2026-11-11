"use server";

import { and, eq, getTableColumns, gte, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { fbClaims, fbPosts, orderItems, orders, products } from "@/db/schema";
import { assertAdmin } from "@/lib/auth";
import { isCourierId } from "@/lib/couriers";
import { unitPriceFor } from "@/lib/format";
import { orderNumber } from "@/lib/orders";
import { pricedColumns } from "@/lib/pricing";
import { CATALOG_TAG } from "@/lib/queries";
import { DELIVERY_METHODS, shippingFor, STORE } from "@/lib/site";

export type FbFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; orderNumber?: string } | undefined;

const importSchema = z.object({
  productId: z.coerce.number().int().positive({ message: "Избери продукт." }),
  url: z.string().trim().max(500).optional(),
  claims: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        qty: z.number().int().min(1).max(99),
        comment: z.string().trim().max(1000),
      }),
    )
    .min(1, "Няма избрани заявки."),
});

/** Saves a post and the claims picked in the preview, then opens the post. */
export async function importFbPost(_prev: FbFormState, formData: FormData): Promise<FbFormState> {
  await assertAdmin();
  let claims: unknown;
  try {
    claims = JSON.parse(String(formData.get("claims") ?? "[]"));
  } catch {
    return { error: "Неуспешно четене на заявките. Постави коментарите отново." };
  }
  const parsed = importSchema.safeParse({
    productId: formData.get("productId"),
    url: String(formData.get("url") ?? ""),
    claims,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Провери данните.", fieldErrors: { [String(first?.path[0] ?? "form")]: first?.message ?? "" } };
  }
  const d = parsed.data;
  if (d.url && !/^https:\/\/(www\.|m\.|web\.)?facebook\.com\//i.test(d.url)) {
    return { error: "Линкът трябва да е към facebook.com.", fieldErrors: { url: "Линкът трябва да е към facebook.com." } };
  }
  const [product] = await db.select().from(products).where(eq(products.id, d.productId)).limit(1);
  if (!product) return { error: "Продуктът не е намерен.", fieldErrors: { productId: "Продуктът не е намерен." } };

  const postId = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(fbPosts)
      .values({ productId: product.id, productName: `${product.name} ${product.unit}`.trim(), url: d.url || null })
      .returning({ id: fbPosts.id });
    await tx.insert(fbClaims).values(d.claims.map((c) => ({ postId: post.id, name: c.name, qty: c.qty, comment: c.comment })));
    return post.id;
  });
  redirect(`/admin/facebook/${postId}`);
}

const orderSchema = z
  .object({
    name: z.string().trim().min(2, "Въведи име.").max(80),
    phone: z.string().trim().regex(/^\+?[0-9 ]{8,15}$/, "Въведи валиден телефон."),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Невалиден имейл."))]),
    qty: z.coerce.number().int().min(1, "Поне 1 бр.").max(99),
    delivery: z.enum(DELIVERY_METHODS.map((m) => m.id) as [string, ...string[]]),
    courier: z.string().trim().optional(),
    city: z.string().trim().max(80),
    address: z.string().trim().max(200),
  })
  .superRefine((d, ctx) => {
    if (d.delivery === "store") return;
    if (!isCourierId(d.courier)) ctx.addIssue({ code: "custom", path: ["courier"], message: "Избери куриер." });
    if (d.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Въведи населено място." });
    if (d.address.length < 3) ctx.addIssue({ code: "custom", path: ["address"], message: "Въведи адрес, офис или автомат." });
  });

/** Turns one claim into a real order: takes the stock, and marks the claim as ordered. */
export async function orderFromClaim(claimId: number, _prev: FbFormState, formData: FormData): Promise<FbFormState> {
  await assertAdmin();
  const parsed = orderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { error: "Провери отбелязаните полета.", fieldErrors };
  }
  const d = parsed.data;

  const [claim] = await db.select().from(fbClaims).where(eq(fbClaims.id, claimId)).limit(1);
  if (!claim) return { error: "Заявката не е намерена." };
  if (claim.status !== "pending") return { error: "Заявката вече е обработена." };
  const [post] = await db.select().from(fbPosts).where(eq(fbPosts.id, claim.postId)).limit(1);
  const [product] = post?.productId
    ? await db.select({ ...getTableColumns(products), ...pricedColumns }).from(products).where(eq(products.id, post.productId)).limit(1)
    : [];
  if (!product) return { error: "Продуктът от поста вече не съществува." };
  if (product.stock < d.qty) return { error: `Няма достатъчна наличност (остават ${product.stock} бр).` };

  const pickup = d.delivery === "store";
  const price = unitPriceFor(product, d.qty);
  const subtotal = price * d.qty;
  const shipping = shippingFor(d.delivery, subtotal);
  const number = orderNumber();

  try {
    await db.transaction(async (tx) => {
      // Claim it first and only while still pending, so a double click cannot create two orders.
      const taken = await tx
        .update(fbClaims)
        .set({ status: "ordered", qty: d.qty })
        .where(and(eq(fbClaims.id, claim.id), eq(fbClaims.status, "pending")))
        .returning({ id: fbClaims.id });
      if (taken.length === 0) throw new Error("ALREADY_DONE");

      const [order] = await tx
        .insert(orders)
        .values({
          number,
          name: d.name,
          phone: d.phone,
          email: d.email,
          delivery: d.delivery,
          courier: pickup ? null : (d.courier ?? null),
          city: pickup ? STORE.city : d.city,
          address: pickup ? STORE.address : d.address,
          note: `Facebook: „${claim.comment}“`,
          subtotal,
          shipping,
          total: subtotal + shipping,
          status: "confirmed",
          source: "facebook",
        })
        .returning({ id: orders.id });
      await tx.insert(orderItems).values({ orderId: order.id, productId: product.id, name: `${product.name} ${product.unit}`.trim(), sku: product.sku, price, qty: d.qty });
      const left = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${d.qty}` })
        .where(and(eq(products.id, product.id), gte(products.stock, d.qty)))
        .returning({ id: products.id });
      if (left.length === 0) throw new Error("OUT_OF_STOCK");
      await tx.update(fbClaims).set({ orderId: order.id }).where(eq(fbClaims.id, claim.id));
    });
  } catch (e) {
    if (e instanceof Error && e.message === "OUT_OF_STOCK") return { error: "Наличността току-що се промени. Опитай отново." };
    if (e instanceof Error && e.message === "ALREADY_DONE") return { error: "Заявката вече е обработена." };
    console.error("orderFromClaim failed", e);
    return { error: "Неуспешно създаване на поръчката." };
  }

  updateTag(CATALOG_TAG);
  refresh();
  return { ok: true, orderNumber: number };
}

export async function setClaimStatus(claimId: number, status: "pending" | "rejected"): Promise<void> {
  await assertAdmin();
  // An ordered claim is changed through its order, never back to pending from here.
  await db
    .update(fbClaims)
    .set({ status })
    .where(and(eq(fbClaims.id, claimId), sql`${fbClaims.status} != 'ordered'`));
  refresh();
}

export async function deleteFbPost(postId: number): Promise<void> {
  await assertAdmin();
  // Orders already made from the post stay; only the list of comments goes.
  await db.delete(fbPosts).where(eq(fbPosts.id, postId));
  redirect("/admin/facebook");
}
