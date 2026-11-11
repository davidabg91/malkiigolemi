"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { products, stockAlerts } from "@/db/schema";
import { getSession, tooManyAttempts } from "@/lib/auth";

export type AlertFormState = { ok?: boolean; error?: string; email?: string } | undefined;

const email = z.string().trim().toLowerCase().pipe(z.email("Въведи валиден имейл."));

export async function subscribeStockAlert(productId: number, _prev: AlertFormState, formData: FormData): Promise<AlertFormState> {
  const session = await getSession();
  const parsed = email.safeParse(String(formData.get("email") ?? "") || session?.email || "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Въведи валиден имейл." };
  if (tooManyAttempts(`alert:${parsed.data}`, 20, 60 * 60_000)) return { error: "Твърде много заявки. Опитай по-късно." };

  const [product] = await db.select({ id: products.id, stock: products.stock }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return { error: "Продуктът не е намерен." };
  if (product.stock > 0) return { error: "Продуктът вече е наличен. Обнови страницата." };

  await db
    .insert(stockAlerts)
    .values({ productId: product.id, email: parsed.data, userId: session?.uid ?? null })
    // Asking twice just keeps the first request.
    .onConflictDoNothing();
  return { ok: true, email: parsed.data };
}

/** A signed-in customer dismissing a "back in stock" note, or cancelling a request. */
export async function dismissStockAlert(alertId: number): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await db.delete(stockAlerts).where(and(eq(stockAlerts.id, alertId), eq(stockAlerts.userId, session.uid)));
  refresh();
}
