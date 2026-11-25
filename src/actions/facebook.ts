"use server";

import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { fbClaims, fbContacts, fbPosts, orderItems, orders, products } from "@/db/schema";
import { assertAdmin } from "@/lib/auth";
import { savedOffice } from "@/lib/courier-offices";
import { isCourierId } from "@/lib/couriers";
import { fbContactKey } from "@/lib/fb-contacts";
import { addClaimByHand, autoOrderClaims, markOrderReady, removeOrderItems, saveFbOrderSettings, splitOrder, unmarkOrderReady } from "@/lib/fb-orders";
import { saveFbReplySettings } from "@/lib/fb-reply";
import { type FbPeriod, startOfSofiaDay } from "@/lib/fb-since";
import { unitPriceFor } from "@/lib/format";
import { orderNumber } from "@/lib/orders";
import { pricedColumns } from "@/lib/pricing";
import { CATALOG_TAG } from "@/lib/queries";
import { DELIVERY_METHODS, shippingFor, STORE } from "@/lib/site";
import { colorChoices, matchColor } from "@/lib/product-colors";
import { deliveryNote } from "@/lib/availability";
import { takeStock } from "@/lib/stock";

export type FbFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; orderNumber?: string } | undefined;

const orderSchema = z
  .object({
    name: z.string().trim().min(2, "Въведи име.").max(80),
    phone: z.string().trim().regex(/^\+?[0-9 ]{8,15}$/, "Въведи валиден телефон."),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Невалиден имейл."))]),
    qty: z.coerce.number().int().min(1, "Поне 1 бр.").max(99),
    /** For a product sold in several colours: which one. */
    color: z.string().trim().max(40).optional(),
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
  if (!product && post.price == null) return { error: "Първо избери продукта на поста (най-горе на страницата)." };
  if (product && product.stock < d.qty) return { error: `Няма достатъчна наличност (остават ${product.stock} бр).` };
  // A product sold in several colours is counted per colour, so the order has to say which.
  let color: string | null = null;
  if (product && product.colorOptions.length > 0) {
    color = matchColor(product.colorOptions, d.color);
    if (!color) return { error: "Провери отбелязаните полета.", fieldErrors: { color: "Избери цвят." } };
    const left = colorChoices({ colors: product.colorOptions, colorStock: product.colorStock }).find((c) => c.name === color)?.stock ?? 0;
    if (left < d.qty) return { error: `От цвят „${color}“ остават ${left} бр.`, fieldErrors: { color: left === 0 ? "Изчерпан." : `Остават ${left} бр.` } };
  }

  const pickup = d.delivery === "store";
  const office = savedOffice(d.delivery, d.courier ?? null, d.officeCode ?? null);
  if ((d.delivery === "office" || d.delivery === "box") && !office) {
    return { error: "Провери отбелязаните полета.", fieldErrors: { office: "Избери офис от списъка." } };
  }
  const city = pickup ? STORE.city : (office?.city ?? d.city);
  const address = pickup ? STORE.address : (office?.address ?? d.address);

  const price = product ? unitPriceFor(product, d.qty, color) : post.price!;
  const subtotal = price * d.qty;
  const shipping = shippingFor(d.delivery, subtotal, d.courier);
  const number = orderNumber();

  try {
    await db.transaction(async (tx) => {
      // Claim it first and only while still pending, so a double click cannot create two orders.
      const taken = await tx
        .update(fbClaims)
        .set({ status: "ordered", qty: d.qty, orderedBy: "hand", skipReason: null })
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
        color,
        deliveryTime: product ? deliveryNote(product) : null,
      });
      if (product && (await takeStock(tx, product, d.qty, color)) === null) throw new Error("OUT_OF_STOCK");
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
    .set({ status, skipReason: status === "rejected" ? "admin" : null })
    .where(and(eq(fbClaims.id, claimId), sql`${fbClaims.status} != 'ordered'`));
  refresh();
}

/**
 * Админ → От Facebook, "За проверка": an admin puts a comment into its person's order, with the number of
 * pieces (and the colour) they read in it.
 */
export async function addClaimToPersonOrder(claimId: number, _prev: FbFormState, formData: FormData): Promise<FbFormState> {
  await assertAdmin();
  const result = await addClaimByHand(claimId, Math.floor(Number(formData.get("qty") ?? 0)), String(formData.get("color") ?? "").trim() || null);
  if (!result.ok) return { error: result.error, fieldErrors: result.field ? { [result.field]: result.error } : undefined };
  if (result.stockChanged) updateTag(CATALOG_TAG);
  refresh();
  return { ok: true };
}

/** Picks the shop product for a post the extension could not match by itself. */
export async function setFbPostProduct(postId: number, formData: FormData): Promise<void> {
  await assertAdmin();
  const id = Number(formData.get("productId"));
  const [product] = Number.isInteger(id) && id > 0 ? await db.select().from(products).where(eq(products.id, id)).limit(1) : [];
  if (!product) return;
  await db
    .update(fbPosts)
    .set({ productId: product.id, productName: `${product.name} ${product.unit}`.trim(), price: null })
    .where(eq(fbPosts.id, postId));
  // The claims that were waiting only for the product now go into their people's orders.
  if ((await autoOrderClaims(postId)).stockChanged) updateTag(CATALOG_TAG);
  refresh();
}

/** Админ → От Facebook: whether claims go into orders by themselves, and the wording of the pickup message. */
export async function saveFbOrders(_prev: FbFormState, formData: FormData): Promise<FbFormState> {
  await assertAdmin();
  const message = String(formData.get("message") ?? "").replace(/\r\n/g, "\n").trim();
  if (message.length < 10 || message.length > 1000) return { error: "Напиши съобщението (до 1000 знака).", fieldErrors: { message: "Напиши съобщението (до 1000 знака)." } };
  // The days collecting covers: rows of "from" and "to"; a row left empty is not a period.
  const froms = formData.getAll("from").map((v) => String(v).trim());
  const tos = formData.getAll("to").map((v) => String(v).trim());
  const periods: FbPeriod[] = [];
  const wrong = (text: string): FbFormState => ({ error: text, fieldErrors: { periods: text } });
  for (let i = 0; i < froms.length; i++) {
    const from = froms[i];
    const to = tos[i] ?? "";
    if (!from && !to) continue;
    if (!from) return wrong("Избери начална дата за всеки период.");
    if (startOfSofiaDay(from) === null || (to && startOfSofiaDay(to) === null)) return wrong("Избери датите от календара.");
    if (to && to < from) return wrong("Крайната дата не може да е преди началната.");
    periods.push({ from, to: to || null });
  }
  if (periods.length > 30) return wrong("Най-много 30 периода.");
  periods.sort((a, b) => a.from.localeCompare(b.from));
  await saveFbOrderSettings({ auto: formData.get("auto") === "on", message, periods });
  refresh();
  return { ok: true };
}

/**
 * The order page's "Раздели поръчката": the ticked pieces go into a new order of the same customer ("split"),
 * or out of the order and back to stock ("remove").
 */
export async function editOrderItems(orderId: number, _prev: FbFormState, formData: FormData): Promise<FbFormState> {
  await assertAdmin();
  const picks = formData
    .getAll("item")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
    .map((itemId) => ({ itemId, qty: Math.floor(Number(formData.get(`qty-${itemId}`) ?? 0)) }));
  if (formData.get("do") === "remove") {
    const result = await removeOrderItems(orderId, picks);
    if (!result.ok) return { error: result.error };
    if (result.restocked) updateTag(CATALOG_TAG);
    refresh();
    return { ok: true };
  }
  const result = await splitOrder(orderId, picks);
  if (!result.ok) return { error: result.error };
  redirect(`/admin/porachki/${result.orderId}`);
}

/** "Готова за взимане" on a store-pickup order, and taking it back. */
export async function setOrderReady(orderId: number, ready: boolean): Promise<void> {
  await assertAdmin();
  if (ready) await markOrderReady(orderId);
  else await unmarkOrderReady(orderId);
  refresh();
}

/** Switches the extension's automatic answer on or off and sets its wording (Админ → От Facebook). */
export async function saveFbAutoReply(_prev: FbFormState, formData: FormData): Promise<FbFormState> {
  await assertAdmin();
  const text = String(formData.get("text") ?? "").replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 200) return { error: "Напиши отговора (до 200 знака).", fieldErrors: { text: "Напиши отговора (до 200 знака)." } };
  await saveFbReplySettings({ enabled: formData.get("enabled") === "on", text });
  refresh();
  return { ok: true };
}

/** Stops (or resumes) reading a post when the extension collects from all posts. */
export async function setFbPostClosed(postId: number, closed: boolean): Promise<void> {
  await assertAdmin();
  await db
    .update(fbPosts)
    .set({ closedAt: closed ? new Date() : null })
    .where(eq(fbPosts.id, postId));
  refresh();
}

export async function deleteFbPost(postId: number): Promise<void> {
  await assertAdmin();
  // Orders already made from the post stay; only the list of comments goes.
  await db.delete(fbPosts).where(eq(fbPosts.id, postId));
  redirect("/admin/facebook");
}
