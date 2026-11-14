"use server";

import { and, eq, getTableColumns, gte, inArray, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { orderItems, orders, products, users } from "@/db/schema";
import { recordOrder, visitorOf } from "@/lib/analytics";
import { getSession } from "@/lib/auth";
import { currentPushDeviceId, notifyAdmins } from "@/lib/push";
import { unitPriceFor } from "@/lib/format";
import { sendOrderPlaced } from "@/lib/order-mail";
import { orderNumber } from "@/lib/orders";
import { getLoyaltySettings, pointsBalance, redeemable, syncOrderPoints } from "@/lib/loyalty";
import { pricedColumns } from "@/lib/pricing";
import { savedOffice } from "@/lib/courier-offices";
import { CATALOG_TAG, sellable } from "@/lib/queries";
import { DELIVERY_METHODS, shippingFor, STORE } from "@/lib/site";
import { createCheckout, stripeConfigured } from "@/lib/stripe";

const input = z.object({
  name: z.string().trim().min(3, "Въведи име и фамилия.").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,15}$/, "Въведи валиден телефон."),
  email: z.string().trim().toLowerCase().pipe(z.email("Въведи валиден имейл.")),
  delivery: z.enum(DELIVERY_METHODS.map((d) => d.id) as [string, ...string[]]),
  courier: z.enum(["econt", "speedy", "boxnow", "pigeon"]).optional(),
  officeCode: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).default(""),
  address: z.string().trim().max(200).default(""),
  note: z.string().trim().max(500).optional(),
  /** Signed-in customers can keep these delivery details as their default. */
  saveAsDefault: z.boolean().optional(),
  payment: z.enum(["cod", "card"]).default("cod"),
  /** Signed-in customers can pay part of the goods with loyalty points. */
  usePoints: z.boolean().optional(),
  items: z
    .array(z.object({ id: z.number().int().positive(), qty: z.number().int().min(1).max(99) }))
    .min(1, "Количката е празна.")
    .max(100),
}).superRefine((d, ctx) => {
  // Store pickup needs no address; every courier option does.
  if (d.delivery === "store") return;
  if (d.delivery === "box" && d.payment !== "card") {
    ctx.addIssue({ code: "custom", path: ["payment"], message: "Доставката до автомат изисква плащане с карта." });
  }
  if (d.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Въведи населено място." });
  if (d.delivery === "office" || d.delivery === "box") {
    if (!d.courier) {
      ctx.addIssue({ code: "custom", path: ["courier"], message: "Избери куриер." });
    }
    if (!d.officeCode) {
      ctx.addIssue({ code: "custom", path: ["office"], message: d.delivery === "box" ? "Избери автомат." : "Избери офис на куриер." });
    }
  } else if (d.delivery === "address") {
    if (d.address.length < 3) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Въведи точен адрес (улица, номер)." });
    }
  }
});

export type CheckoutInput = z.input<typeof input>;
export type CheckoutResult =
  | { ok: true; number: string; /** Stripe's payment page, for card orders. */ payUrl?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

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
  if (data.delivery === "box" && data.payment !== "card") {
    return { ok: false, error: "Доставката до автомат изисква плащане с карта." };
  }
  const pickup = data.delivery === "store";
  const toOffice = data.delivery === "office" || data.delivery === "box";
  // The office's name and address come from our own list: the form only says which one was picked.
  const office = savedOffice(data.delivery, data.courier ?? null, data.officeCode ?? null);
  if (toOffice && !office) {
    return {
      ok: false,
      error: "Моля, провери отбелязаните полета.",
      fieldErrors: { office: data.delivery === "box" ? "Избери автомат от списъка." : "Избери офис от списъка." },
    };
  }
  const city = pickup ? STORE.city : (office?.city ?? data.city);
  const address = pickup ? STORE.address : (office?.address ?? data.address);

  // Merge duplicate lines, then price everything from the database — the client only tells us ids and quantities.
  const qtyById = new Map<number, number>();
  for (const i of data.items) qtyById.set(i.id, Math.min(99, (qtyById.get(i.id) ?? 0) + i.qty));

  // Priced now, with any live promotion, whatever the cart remembered.
  const rows = await db
    .select({ ...getTableColumns(products), ...pricedColumns })
    .from(products)
    .where(and(inArray(products.id, [...qtyById.keys()]), sellable));
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
  const shipping = shippingFor(data.delivery, subtotal, data.courier);
  const session = await getSession();
  // The phone the order comes from, when it has notifications on, hears about this order too.
  const pushDeviceId = await currentPushDeviceId();
  const number = orderNumber();

  let soldOut = false;
  const soldOutNames: string[] = [];
  let orderId = 0;
  try {
    await db.transaction(async (tx) => {
      // Points are counted inside the transaction, so two orders at once cannot spend the same points.
      let discount = 0;
      let pointsUsed = 0;
      if (session && data.usePoints) {
        const loyalty = await getLoyaltySettings(tx);
        ({ points: pointsUsed, discount } = redeemable(await pointsBalance(session.uid, tx), subtotal, loyalty));
      }
      const [order] = await tx
        .insert(orders)
        .values({
          number,
          userId: session?.uid ?? null,
          pushSubscriptionId: pushDeviceId,
          name: data.name,
          phone: data.phone,
          email: data.email,
          delivery: data.delivery,
          courier: pickup ? null : (data.courier ?? null),
          officeCode: office?.code ?? null,
          officeName: office?.name ?? null,
          city,
          address,
          note: data.note || null,
          payment: data.payment,
          subtotal,
          shipping,
          discount,
          pointsUsed,
          total: subtotal + shipping - discount,
        })
        .returning({ id: orders.id });
      orderId = order.id;
      await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: order.id })));
      // Writes the "used points" line in the customer's history.
      if (pointsUsed > 0) await syncOrderPoints(tx, order.id);
      for (const l of lines) {
        // The stock guard in WHERE makes two simultaneous orders unable to oversell.
        const updated = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${l.qty}` })
          .where(and(eq(products.id, l.productId), gte(products.stock, l.qty)))
          .returning({ stock: products.stock });
        if (updated.length === 0) throw new Error("OUT_OF_STOCK");
        if (updated[0].stock === 0) {
          soldOut = true;
          soldOutNames.push(l.name);
        }
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
        // Pickup has no courier or address of its own, so keep whatever the customer had saved.
        ...(pickup
          ? {}
          : {
              preferredCourier: data.courier ?? null,
              preferredOfficeCode: office?.code ?? null,
              preferredOfficeName: office?.name ?? null,
              city,
              address,
            }),
      })
      .where(eq(users.id, session.uid))
      .catch(() => {});
  }
  if (soldOut) {
    updateTag(CATALOG_TAG);
    after(() => notifyAdmins("soldOut", { title: "Изчерпан продукт", body: soldOutNames.join(", ").slice(0, 160), url: "/admin/produkti?stock=low", tag: "sold-out" }));
  }
  // For the visitor statistics: this visit ended in an order.
  const visitor = session?.role === "admin" ? null : visitorOf(await headers());
  if (visitor) after(() => recordOrder(visitor, subtotal + shipping));
  if (data.payment === "card" && stripeConfigured()) {
    // The "order received" e-mails wait for the payment (see recordPayment). If Stripe cannot open the
    // page now, the order page offers to pay again.
    const payUrl = await createCheckout(orderId).catch((e) => {
      console.error("Stripe checkout failed", number, e);
      return undefined;
    });
    return { ok: true, number, payUrl };
  }
  after(() => sendOrderPlaced(orderId));
  return { ok: true, number };
}
