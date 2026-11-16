"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { BoxNowError, boxnowConfig, boxnowOrigins, type BoxNowOrigin } from "@/lib/boxnow";
import { saveBoxNowSettings } from "@/lib/boxnow-settings";
import { cancelBoxNowParcel, createBoxNowParcel, syncBoxNowParcels, type BoxNowParcelOptions } from "@/lib/boxnow-shipments";

const message = (e: unknown) => {
  if (e instanceof BoxNowError) return e.message;
  console.error("BOX NOW action failed:", e);
  return "Неочаквана грешка при връзката с BOX NOW.";
};

export type BoxNowSettingsState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

const settingsSchema = z.object({
  originId: z.string().trim().min(1, "Избери как предаваш пратките.").max(40),
  originName: z.string().trim().max(160),
  originType: z.string().trim().max(40),
  dropOffLocker: z.string().trim().max(160),
  senderName: z.string().trim().min(2, "Въведи име на подателя.").max(100),
  senderPhone: z.string().trim().regex(/^[+\d][\d\s-]{5,19}$/, "Въведи телефон."),
  senderEmail: z.email("Въведи имейл.").max(120),
  defaultSize: z.enum(["1", "2", "3"]).transform((v) => Number(v) as 1 | 2 | 3),
  defaultWeight: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((n) => Number.isFinite(n) && n > 0 && n <= 20, "Между 0,1 и 20 кг."),
});

export async function saveBoxNowSettingsAction(_prev: BoxNowSettingsState, formData: FormData): Promise<BoxNowSettingsState> {
  await assertAdmin();
  const text = (k: string) => String(formData.get(k) ?? "");
  const parsed = settingsSchema.safeParse(Object.fromEntries(Object.keys(settingsSchema.shape).map((k) => [k, text(k)])));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Провери отбелязаните полета.", fieldErrors };
  }
  await saveBoxNowSettings({ ...parsed.data, allowReturn: formData.get("allowReturn") === "on" });
  refresh();
  return { ok: true };
}

export type BoxNowConnection = { ok: true; origins: BoxNowOrigin[] } | { ok: false; configured: boolean; error: string };

/** Logs in to BOX NOW and lists the pickup places (warehouses) on the contract. */
export async function testBoxNowConnectionAction(): Promise<BoxNowConnection> {
  await assertAdmin();
  const { configured } = boxnowConfig();
  if (!configured) return { ok: false, configured, error: "Липсват BOXNOW_CLIENT_ID и BOXNOW_CLIENT_SECRET във Vercel." };
  try {
    return { ok: true, origins: await boxnowOrigins() };
  } catch (e) {
    return { ok: false, configured, error: message(e) };
  }
}

const optionsSchema = z.object({
  size: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  weight: z.number().min(0.01, "Теглото трябва да е над 0.").max(20, "BOX NOW приема до 20 кг."),
  cod: z.number().min(0).max(5000),
  description: z.string().trim().min(1, "Опиши съдържанието.").max(200),
});

export async function createBoxNowParcelAction(orderId: number, raw: BoxNowParcelOptions): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const parsed = optionsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Невалидни данни." };
  try {
    await createBoxNowParcel(orderId, parsed.data);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function cancelBoxNowParcelAction(orderId: number): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  try {
    await cancelBoxNowParcel(orderId);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function refreshBoxNowAction(orderId: number): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  try {
    await syncBoxNowParcels([orderId]);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
