"use server";

import bcrypt from "bcryptjs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { orderItems, orders, products, users } from "@/db/schema";
import { createSession, getSession, tooManyAttempts } from "@/lib/auth";
import { savedOffice } from "@/lib/courier-offices";
import { isCourierId } from "@/lib/couriers";
import { CATALOG_TAG, getLiveCards, type ProductCardData } from "@/lib/queries";
import { DELIVERY_METHODS } from "@/lib/site";

export type AccountFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

function firstErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return fieldErrors;
}

const deliverySchema = z
  .object({
    delivery: z.enum(DELIVERY_METHODS.map((d) => d.id) as [string, ...string[]], { message: "Избери начин на доставка." }),
    courier: z.string().trim().max(20).optional(),
    officeCode: z.string().trim().max(40).optional(),
    city: z.string().trim().max(80),
    address: z.string().trim().max(200),
  })
  .superRefine((d, ctx) => {
    if (d.delivery === "store") return;
    if (d.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Въведи населено място." });
    if (!isCourierId(d.courier)) ctx.addIssue({ code: "custom", path: ["courier"], message: "Избери куриер." });
    if (d.delivery === "office" || d.delivery === "box") {
      if (!d.officeCode) {
        ctx.addIssue({ code: "custom", path: ["office"], message: d.delivery === "box" ? "Избери автомат." : "Избери офис на куриер." });
      }
    } else if (d.delivery === "address") {
      if (d.address.length < 3) {
        ctx.addIssue({ code: "custom", path: ["address"], message: "Въведи точен адрес (улица, номер)." });
      }
    }
  });

export async function saveDeliveryPrefs(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const session = await getSession();
  if (!session) return { error: "Сесията ти е изтекла. Влез отново." };

  const parsed = deliverySchema.safeParse({
    delivery: String(formData.get("delivery") ?? ""),
    courier: String(formData.get("courier") ?? ""),
    officeCode: String(formData.get("officeCode") ?? ""),
    city: String(formData.get("city") ?? ""),
    address: String(formData.get("address") ?? ""),
  });
  if (!parsed.success) return { error: "Провери отбелязаните полета.", fieldErrors: firstErrors(parsed.error.issues) };
  const d = parsed.data;

  const isStore = d.delivery === "store";
  // The office's name and address come from our own list, never from the form: the form only says which one.
  const office = savedOffice(d.delivery, d.courier ?? null, d.officeCode ?? null);
  if ((d.delivery === "office" || d.delivery === "box") && !office) {
    return {
      error: "Провери отбелязаните полета.",
      fieldErrors: { office: d.delivery === "box" ? "Избери автомат от списъка." : "Избери офис от списъка." },
    };
  }

  await db
    .update(users)
    .set({
      preferredDelivery: d.delivery,
      // Picking up from the store keeps the courier details for later, in case they switch back.
      ...(isStore
        ? {}
        : {
            preferredCourier: d.courier || null,
            preferredOfficeCode: office?.code ?? null,
            preferredOfficeName: office?.name ?? null,
            city: office?.city ?? d.city,
            address: office?.address ?? d.address,
          }),
    })
    .where(eq(users.id, session.uid));
  refresh();
  return { ok: true };
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Въведи име и фамилия.").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9 ]{8,15})?$/, "Въведи валиден телефон."),
});

export async function saveProfile(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const session = await getSession();
  if (!session) return { error: "Сесията ти е изтекла. Влез отново." };

  const parsed = profileSchema.safeParse({ name: formData.get("name") ?? "", phone: formData.get("phone") ?? "" });
  if (!parsed.success) return { error: "Провери отбелязаните полета.", fieldErrors: firstErrors(parsed.error.issues) };

  await db
    .update(users)
    .set({ name: parsed.data.name, phone: parsed.data.phone || null })
    .where(eq(users.id, session.uid));
  // The greeting reads the name from the session cookie, so re-issue it.
  await createSession({ ...session, name: parsed.data.name });
  refresh();
  return { ok: true };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Въведи текущата парола."),
    next: z.string().min(8, "Новата парола трябва да е поне 8 символа.").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { path: ["confirm"], message: "Паролите не съвпадат." });

export async function changePassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const session = await getSession();
  if (!session) return { error: "Сесията ти е изтекла. Влез отново." };
  if (tooManyAttempts(`password:${session.uid}`, 5)) {
    return { error: "Твърде много опити. Опитай отново след няколко минути." };
  }

  const parsed = passwordSchema.safeParse({
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { error: "Провери отбелязаните полета.", fieldErrors: firstErrors(parsed.error.issues) };

  const [user] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!user || !(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: "Текущата парола е грешна.", fieldErrors: { current: "Грешна парола." } };
  }

  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(parsed.data.next, 10) })
    .where(eq(users.id, session.uid));
  return { ok: true };
}

export type ReorderResult =
  | { ok: true; items: (ProductCardData & { qty: number })[]; missing: string[]; reduced: string[] }
  | { ok: false; error: string };

/** Looks up a past order's products at today's prices and stock; the client then adds them to the cart. */
export async function reorder(orderId: number): Promise<ReorderResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Влез в профила си, за да поръчаш отново." };

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.uid)))
    .limit(1);
  if (!order) return { ok: false, error: "Поръчката не е намерена." };

  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const live = await getLiveCards(lines.flatMap((l) => (l.productId == null ? [] : [l.productId])));
  const byId = new Map(live.map((p) => [p.id, p]));

  const items: (ProductCardData & { qty: number })[] = [];
  const missing: string[] = [];
  const reduced: string[] = [];
  for (const l of lines) {
    const p = l.productId == null ? undefined : byId.get(l.productId);
    if (!p || p.stock <= 0) {
      missing.push(l.name);
      continue;
    }
    const qty = Math.min(l.qty, p.stock);
    if (qty < l.qty) reduced.push(p.name);
    items.push({ ...p, qty });
  }
  return { ok: true, items, missing, reduced };
}

export type CancelOrderResult = { ok: boolean; error?: string };

/** Allows a customer to cancel an unfulfilled order (new or confirmed) directly from their profile. */
export async function cancelOrder(orderId: number): Promise<CancelOrderResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Сесията ти е изтекла. Влез отново." };

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.uid)))
    .limit(1);

  if (!order) return { ok: false, error: "Поръчката не е намерена." };

  if (order.status === "cancelled") {
    return { ok: false, error: "Поръчката вече е отказана." };
  }

  if (order.status !== "new" && order.status !== "confirmed") {
    return {
      ok: false,
      error: "Поръчката вече се подготвя за изпращане или е изпратена и не може да бъде отказана от тук. Моля, свържи се с нас за съдействие.",
    };
  }

  const cancelDateStr = new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(new Date());

  const cancellationNote = `[Отказана от клиента на ${cancelDateStr}]`;
  const updatedNote = order.note ? `${order.note}\n${cancellationNote}` : cancellationNote;

  let cancelled = false;
  await db.transaction(async (tx) => {
    // Flip the status first, and only if it is still open. Two requests at once (a double click, a second tab,
    // or the shop cancelling at the same moment) then cannot both return the goods to stock.
    const flipped = await tx
      .update(orders)
      .set({ status: "cancelled", note: updatedNote })
      .where(and(eq(orders.id, order.id), inArray(orders.status, ["new", "confirmed"])))
      .returning({ id: orders.id });
    if (flipped.length === 0) return;
    cancelled = true;

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      if (item.productId == null) continue;
      await tx
        .update(products)
        .set({ stock: sql`max(0, ${products.stock} + ${item.qty})` })
        .where(eq(products.id, item.productId));
    }
  });
  if (!cancelled) return { ok: false, error: "Статусът на поръчката току-що се промени. Обнови страницата." };

  updateTag(CATALOG_TAG);
  refresh();
  return { ok: true };
}
