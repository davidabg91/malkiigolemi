"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { loyaltyLedger, users } from "@/db/schema";
import { assertAdmin } from "@/lib/auth";
import { saveLoyaltySettings } from "@/lib/loyalty";

export type LoyaltyFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

const euro = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "Между 0 и 100 €." });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

const schema = z.object({
  pointsPerEuro: z.coerce.number().int("Цяло число.").min(1, "Поне 1.").max(100, "Най-много 100."),
  value100: euro,
  minRedeem: z.coerce.number().int("Цяло число.").min(1, "Поне 1.").max(100000),
  maxPercent: z.coerce.number().int("Цяло число.").min(1, "Поне 1%.").max(100, "Най-много 100%."),
});

export async function updateLoyaltySettings(_prev: LoyaltyFormState, formData: FormData): Promise<LoyaltyFormState> {
  await assertAdmin();
  const parsed = schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Провери отбелязаните полета.", fieldErrors };
  }
  const d = parsed.data;
  await saveLoyaltySettings({
    enabled: formData.get("enabled") === "on",
    pointsPerEuro: d.pointsPerEuro,
    centsPer100: d.value100,
    minRedeem: d.minRedeem,
    maxPercent: d.maxPercent,
  });
  refresh();
  return { ok: true };
}

/** Manual correction from a customer's admin profile, e.g. a goodwill bonus or fixing a mistake. */
export async function adjustPoints(userId: number, formData: FormData): Promise<void> {
  await assertAdmin();
  const points = Math.trunc(Number(formData.get("points")));
  if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 100000) return;
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || "Корекция от магазина";
  await db.insert(loyaltyLedger).values({ userId: user.id, points, kind: "adjust", note });
  refresh();
}
