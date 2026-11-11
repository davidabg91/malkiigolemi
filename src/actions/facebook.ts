"use server";

import { and, eq, getTableColumns, gte, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { fbClaims, fbContacts, fbPosts, orderItems, orders, products } from "@/db/schema";
import { assertAdmin } from "@/lib/auth";
import { savedOffice } from "@/lib/courier-offices";
import { isCourierId } from "@/lib/couriers";
import { fbContactKey } from "@/lib/fb-contacts";
import { unitPriceFor } from "@/lib/format";
import { orderNumber } from "@/lib/orders";
import { pricedColumns } from "@/lib/pricing";
import { CATALOG_TAG } from "@/lib/queries";
import { DELIVERY_METHODS, shippingFor, STORE } from "@/lib/site";

export type FbFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; orderNumber?: string } | undefined;

/** "12,50" or "12.50" euros → cents. */
const euros = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = Number(v.replace(",", "."));
    if (!v || !Number.isFinite(n) || n <= 0 || n > 100000) {
      ctx.addIssue({ code: "custom", message: "Въведи цена." });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

const claimsSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(120),
      qty: z.number().int().min(1).max(99),
      comment: z.string().trim().max(1000),
    }),
  )
  .min(1, "Няма избрани заявки.");

/** Saves a post and the claims picked in the preview, then opens the post. */
export async function importFbPost(_prev: FbFormState, formData: FormData): Promise<FbFormState> {
  await assertAdmin();
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("claims") ?? "[]"));
  } catch {
    return { error: "Неуспешно четене на заявките. Постави коментарите отново." };
  }
  const claims = claimsSchema.safeParse(raw);
  if (!claims.success) return { error: claims.error.issues[0]?.message ?? "Провери заявките." };

  const url = String(formData.get("url") ?? "").trim();
  if (url && !/^https:\/\/(www\.|m\.|web\.)?facebook\.com\//i.test(url)) {
    return { error: "Линкът трябва да е към facebook.com.", fieldErrors: { url: "Линкът трябва да е към facebook.com." } };
  }

  // The product is either one from the shop or one typed in by hand (not sold on the site).
  let values: { productId: number | null; productName: string; price: number | null };
  if (formData.get("productSource") === "manual") {
    const name = String(formData.get("manualName") ?? "").trim();
    if (name.length < 2 || name.length > 160) return { error: "Въведи име на продукта.", fieldErrors: { manualName: "Въведи име на продукта." } };
    const price = euros.safeParse(String(formData.get("manualPrice") ?? ""));
    if (!price.success) return { error: "Въведи цена.", fieldErrors: { manualPrice: "Въведи цена за брой." } };
    values = { productId: null, productName: name, price: price.data };
  } else {
    const id = Number(formData.get("productId"));
    const [product] = Number.isInteger(id) && id > 0 ? await db.select().from(products).where(eq(products.id, id)).limit(1) : [];
    if (!product) return { error: "Избери продукт.", fieldErrors: { productId: "Избери продукт." } };
    values = { productId: product.id, productName: `${product.name} ${product.unit}`.trim(), price: null };
  }

  const postId = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(fbPosts)
      .values({ ...values, url: url || null })
      .returning({ id: fbPosts.id });
    await tx.insert(fbClaims).values(claims.data.map((c) => ({ postId: post.id, name: c.name, qty: c.qty, comment: c.comment })));
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
    officeCode: z.string().trim().max(40).optional(),
    city: z.string().trim().max(80).default(""),
    address: z.string().trim().max(200).default(""),
  })
  .superRefine((d, ctx) => {
    if (d.delivery === "store") return;
    if (!isCourierId(d.courier)) ctx.addIssue({ code: "custom", path: ["courier"], message: "Избери куриер." });
    if (d.delivery === "address") {
      if (d.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Въведи населено място." });
      if (d.address.length < 3) ctx.addIssue({ code: "custom", path: ["address"], message: "Въведи адрес." });
    } else if (!d.officeCode) {
      ctx.addIssue({ code: "custom", path: ["office"], message: d.delivery === "box" ? "Избери автомат." : "Избери офис." });
    }
  });

/** Turns one claim into a real order, takes the stock, and remembers the details for this Facebook name. */
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
  if (!post) return { error: "Постът не е намерен." };

  // A shop product is priced live and takes stock; a hand-typed one has its own price and no stock.
  const [product] = post.productId
    ? await db.select({ ...getTableColumns(products), ...pricedColumns }).from(products).where(eq(products.id, post.productId)).limit(1)
    : [];
  if (post.productId && !product) return { error: "Продуктът от поста вече не съществува." };
  if (!product && post.price == null) return { error: "Постът няма цена." };
  if (product && product.stock < d.qty) return { error: `Няма достатъчна наличност (остават ${product.stock} бр).` };

  const pickup = d.delivery === "store";
  const office = savedOffice(d.delivery, d.courier ?? null, d.officeCode ?? null);
  if ((d.delivery === "office" || d.delivery === "box") && !office) {
    return { error: "Провери отбелязаните полета.", fieldErrors: { office: "Избери офис от списъка." } };
  }
  const city = pickup ? STORE.city : (office?.city ?? d.city);
  const address = pickup ? STORE.address : (office?.address ?? d.address);

  const price = product ? unitPriceFor(product, d.qty) : post.price!;
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
          officeCode: office?.code ?? null,
          officeName: office?.name ?? null,
          city,
          address,
          note: `Facebook: „${claim.comment}“`,
          subtotal,
          shipping,
          total: subtotal + shipping,
          status: "confirmed",
          source: "facebook",
        })
        .returning({ id: orders.id });
      await tx.insert(orderItems).values({
        orderId: order.id,
        productId: product?.id ?? null,
        name: product ? `${product.name} ${product.unit}`.trim() : post.productName,
        sku: product?.sku ?? "FB",
        price,
        qty: d.qty,
      });
      if (product) {
        const left = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${d.qty}` })
          .where(and(eq(products.id, product.id), gte(products.stock, d.qty)))
          .returning({ id: products.id });
        if (left.length === 0) throw new Error("OUT_OF_STOCK");
      }
      await tx.update(fbClaims).set({ orderId: order.id }).where(eq(fbClaims.id, claim.id));

      // Next time this name comments, the form opens the way it was filled now.
      const remembered = {
        name: d.name,
        phone: d.phone,
        email: d.email,
        delivery: d.delivery,
        courier: pickup ? null : (d.courier ?? null),
        officeCode: office?.code ?? null,
        city: pickup ? "" : city,
        address: d.delivery === "address" ? address : "",
        updatedAt: new Date(),
      };
      for (const key of new Set([fbContactKey(claim.name), fbContactKey(d.name)])) {
        await tx.insert(fbContacts).values({ key, ...remembered }).onConflictDoUpdate({ target: fbContacts.key, set: remembered });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "OUT_OF_STOCK") return { error: "Наличността току-що се промени. Опитай отново." };
    if (e instanceof Error && e.message === "ALREADY_DONE") return { error: "Заявката вече е обработена." };
    console.error("orderFromClaim failed", e);
    return { error: "Неуспешно създаване на поръчката." };
  }

  if (product) updateTag(CATALOG_TAG);
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
