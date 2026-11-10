"use server";

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { orderItems, orders, products, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { unitPriceFor } from "@/lib/format";
import { CATALOG_TAG } from "@/lib/queries";
import { DELIVERY_METHODS, shippingFor, STORE } from "@/lib/site";

const input = z.object({
  name: z.string().trim().min(3, "Въведи име и фамилия.").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,15}$/, "Въведи валиден телефон."),
  email: z.string().trim().toLowerCase().pipe(z.email("Въведи валиден имейл.")),
  delivery: z.enum(DELIVERY_METHODS.map((d) => d.id) as [string, ...string[]]),
  city: z.string().trim().max(80).default(""),
  address: z.string().trim().max(200).default(""),
  note: z.string().trim().max(500).optional(),
  /** Signed-in customers can keep these delivery details as their default. */
  saveAsDefault: z.boolean().optional(),
  items: z
    .array(z.object({ id: z.number().int().positive(), qty: z.number().int().min(1).max(99) }))
    .min(1, "Количката е празна.")
    .max(100),
}).superRefine((d, ctx) => {
  // Store pickup needs no address; every courier option does.
  if (d.delivery === "store") return;
  if (d.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Въведи населено място." });
  if (d.address.length < 3) ctx.addIssue({ code: "custom", path: ["address"], message: "Въведи адрес, офис или автомат." });
});

export type CheckoutInput = z.input<typeof input>;
export type CheckoutResult =
  | { ok: true; number: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function orderNumber() {
  let out = "LM-";
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export async function placeOrder(raw: CheckoutInput): Promise<CheckoutResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Моля, провери отбелязаните полета.", fieldErrors };
  }
  const data = parsed.data;
  const pickup = data.delivery === "store";
  const city = pickup ? STORE.city : data.city;
  const address = pickup ? STORE.address : data.address;

  // Merge duplicate lines, then price everything from the database — the client only tells us ids and quantities.
  const qtyById = new Map<number, number>();
  for (const i of data.items) qtyById.set(i.id, Math.min(99, (qtyById.get(i.id) ?? 0) + i.qty));

  const rows = await db
    .select()
    .from(products)
    .where(and(inArray(products.id, [...qtyById.keys()]), eq(products.active, true)));
  if (rows.length !== qtyById.size) {
    return { ok: false, error: "Някои продукти вече не се предлагат. Обнови количката и опитай отново." };
  }
  for (const p of rows) {
    if (p.stock < qtyById.get(p.id)!) {
      return { ok: false, error: `Няма достатъчна наличност от „${p.name}“ (остават ${p.stock} бр).` };
    }
  }

  const lines = rows.map((p) => {
    const qty = qtyById.get(p.id)!;
    return { productId: p.id, name: `${p.name} ${p.unit}`.trim(), sku: p.sku, qty, price: unitPriceFor(p, qty) };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const shipping = shippingFor(data.delivery, subtotal);
  const session = await getSession();
  const number = orderNumber();

  let soldOut = false;
  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          number,
          userId: session?.uid ?? null,
          name: data.name,
          phone: data.phone,
          email: data.email,
          delivery: data.delivery,
          city,
          address,
          note: data.note || null,
          subtotal,
          shipping,
          total: subtotal + shipping,
        })
        .returning({ id: orders.id });
      await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: order.id })));
      for (const l of lines) {
        // The stock guard in WHERE makes two simultaneous orders unable to oversell.
        const updated = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${l.qty}` })
          .where(and(eq(products.id, l.productId), gte(products.stock, l.qty)))
          .returning({ stock: products.stock });
        if (updated.length === 0) throw new Error("OUT_OF_STOCK");
        if (updated[0].stock === 0) soldOut = true;
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "OUT_OF_STOCK") {
      return { ok: false, error: "Наличността току-що се промени. Обнови количката и опитай отново." };
    }
    console.error("placeOrder failed", e);
    return { ok: false, error: "Възникна грешка при записване на поръчката. Опитай отново." };
  }

  if (session && data.saveAsDefault) {
    // Only when asked: silently overwriting a saved address with a one-off gift delivery would be annoying.
    await db
      .update(users)
      .set({
        phone: data.phone,
        preferredDelivery: data.delivery,
        // Pickup has no address of its own, so keep whatever address the customer had saved.
        ...(pickup ? {} : { city: data.city, address: data.address }),
      })
      .where(eq(users.id, session.uid))
      .catch(() => {});
  }
  if (soldOut) updateTag(CATALOG_TAG);
  return { ok: true, number };
}
