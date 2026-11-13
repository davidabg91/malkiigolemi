"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { EcontError, type EcontLabelResult } from "@/lib/econt";
import { saveEcontSettings, type EcontSettings } from "@/lib/econt-settings";
import { createWaybill, deleteWaybill, quoteWaybill, syncShipments, type WaybillOptions } from "@/lib/shipments";

export type EcontSettingsState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

const decimal = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((n) => Number.isFinite(n) && n >= min && n <= max, message);

const settingsSchema = z
  .object({
    senderName: z.string().trim().min(2, "Въведи име на подателя.").max(80),
    senderPhone: z.string().trim().regex(/^[+\d][\d\s-]{5,19}$/, "Въведи телефон."),
    senderMode: z.enum(["office", "address"]),
    senderOfficeCode: z.string().trim().max(20),
    senderCity: z.string().trim().max(80),
    senderAddress: z.string().trim().max(200),
    defaultWeight: decimal(0.1, 50, "Между 0,1 и 50 кг."),
    payer: z.enum(["sender", "receiver"]),
    senderPayment: z.enum(["cash", "credit"]),
    codTemplate: z.string().trim().max(60),
  })
  .superRefine((d, ctx) => {
    if (d.senderMode === "office" && !d.senderOfficeCode) ctx.addIssue({ code: "custom", path: ["senderOfficeCode"], message: "Въведи кода на офиса." });
    if (d.senderMode === "address" && !d.senderCity) ctx.addIssue({ code: "custom", path: ["senderCity"], message: "Въведи населено място." });
    if (d.senderMode === "address" && !d.senderAddress) ctx.addIssue({ code: "custom", path: ["senderAddress"], message: "Въведи адрес." });
  });

export async function saveEcontSettingsAction(_prev: EcontSettingsState, formData: FormData): Promise<EcontSettingsState> {
  await assertAdmin();
  const text = (k: string) => String(formData.get(k) ?? "");
  const parsed = settingsSchema.safeParse(Object.fromEntries(Object.keys(settingsSchema.shape).map((k) => [k, text(k)])));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Провери отбелязаните полета.", fieldErrors };
  }
  const value: EcontSettings = { ...parsed.data, inspectBeforePay: formData.get("inspectBeforePay") === "on", sms: formData.get("sms") === "on" };
  await saveEcontSettings(value);
  refresh();
  return { ok: true };
}

const optionsSchema = z.object({
  weight: z.number().min(0.01, "Теглото трябва да е над 0.").max(50, "Най-много 50 кг."),
  packCount: z.number().int().min(1).max(20),
  cod: z.number().min(0).max(10000),
  description: z.string().trim().min(1, "Опиши съдържанието.").max(200),
  pickup: z
    .object({ from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/) })
    .refine((p) => p.from < p.to, "Часът „от“ трябва да е преди „до“.")
    .nullable()
    .optional(),
});

export type WaybillResult = { ok: true; label: EcontLabelResult } | { ok: false; error: string };

async function run(work: () => Promise<EcontLabelResult>): Promise<WaybillResult> {
  try {
    return { ok: true, label: await work() };
  } catch (e) {
    if (e instanceof EcontError) return { ok: false, error: e.message };
    console.error("Econt waybill failed:", e);
    return { ok: false, error: "Неочаквана грешка при връзката с Еконт." };
  }
}

function parseOptions(raw: WaybillOptions): WaybillOptions | string {
  const parsed = optionsSchema.safeParse(raw);
  return parsed.success ? parsed.data : (parsed.error.issues[0]?.message ?? "Невалидни данни.");
}

/** The price Econt would charge, without creating anything. */
export async function quoteWaybillAction(orderId: number, raw: WaybillOptions): Promise<WaybillResult> {
  await assertAdmin();
  const options = parseOptions(raw);
  if (typeof options === "string") return { ok: false, error: options };
  return run(() => quoteWaybill(orderId, options));
}

export async function createWaybillAction(orderId: number, raw: WaybillOptions): Promise<WaybillResult> {
  await assertAdmin();
  const options = parseOptions(raw);
  if (typeof options === "string") return { ok: false, error: options };
  const result = await run(() => createWaybill(orderId, options));
  if (result.ok) refresh();
  return result;
}

export async function deleteWaybillAction(orderId: number): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  try {
    await deleteWaybill(orderId);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof EcontError ? e.message : "Неочаквана грешка при връзката с Еконт." };
  }
}

/** Fetches the latest tracking now, for one order or for every open Econt shipment. */
export async function refreshTrackingAction(orderId?: number): Promise<{ ok: boolean; checked?: number; error?: string }> {
  await assertAdmin();
  try {
    const checked = await syncShipments(orderId ? [orderId] : undefined);
    refresh();
    return { ok: true, checked };
  } catch (e) {
    return { ok: false, error: e instanceof EcontError ? e.message : "Неочаквана грешка при връзката с Еконт." };
  }
}
