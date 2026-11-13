"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { awaitsCardPayment, createCheckout } from "@/lib/stripe";

/** "Плати с карта" on the order page: opens a fresh Stripe payment page for an unpaid card order. */
export async function payOrder(number: string) {
  const [order] = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  if (!order || !awaitsCardPayment(order)) redirect(`/porachka/${encodeURIComponent(number)}`);
  let url: string;
  try {
    url = await createCheckout(order.id);
  } catch (e) {
    console.error("Stripe checkout failed", number, e);
    redirect(`/porachka/${encodeURIComponent(number)}?plashtane=greshka`);
  }
  redirect(url);
}
