"use server";

import { eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { storePayments } from "@/db/schema";
import { assertAdmin, tooManyAttempts } from "@/lib/auth";
import { formatPrice, parseEuro } from "@/lib/format";
import { createStoreCheckout, STORE_PAY_MAX, STORE_PAY_MIN } from "@/lib/store-payments";
import { stripeConfigured } from "@/lib/stripe";

export type StorePayState = { error: string } | null;

/** The form on /plati: checks the sum and sends the customer to Stripe's payment page. */
export async function payInStore(_prev: StorePayState, form: FormData): Promise<StorePayState> {
  if (!stripeConfigured()) return { error: "Плащането с карта не е включено в момента. Плати на касата." };
  const amount = parseEuro(String(form.get("amount") ?? ""));
  if (amount === null) return { error: "Въведи сумата с цифри, например 12,50." };
  if (amount < STORE_PAY_MIN) return { error: `Най-малката сума е ${formatPrice(STORE_PAY_MIN)}.` };
  if (amount > STORE_PAY_MAX) return { error: `Най-голямата сума за едно плащане е ${formatPrice(STORE_PAY_MAX)}.` };
  const note = String(form.get("note") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooManyAttempts(`store-pay:${ip}`, 20, 10 * 60_000)) return { error: "Твърде много опити. Изчакай няколко минути." };

  let url: string;
  try {
    url = await createStoreCheckout(amount, note);
  } catch (e) {
    console.error("Stripe store checkout failed", e);
    return { error: "Страницата за плащане не можа да се отвори. Опитай отново." };
  }
  redirect(url);
}

/** Admin: the payment was seen at the till; toggles back on a second click. */
export async function markStorePaymentSeen(id: number, seen: boolean) {
  await assertAdmin();
  await db.update(storePayments).set({ seenAt: seen ? new Date() : null }).where(eq(storePayments.id, id));
  refresh();
}

export async function markAllStorePaymentsSeen() {
  await assertAdmin();
  await db.update(storePayments).set({ seenAt: new Date() }).where(isNull(storePayments.seenAt));
  refresh();
}
