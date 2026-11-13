import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { site } from "./site";

/** How the shop sends with Econt. Kept in the settings table and edited under Админ → Куриери. */
export type EcontSettings = {
  senderName: string;
  senderPhone: string;
  /** Parcels are taken to an Econt office, or a courier collects them from the shop's address. */
  senderMode: "office" | "address";
  senderOfficeCode: string;
  senderCity: string;
  senderAddress: string;
  /** Kilograms per parcel unless changed on the waybill. */
  defaultWeight: number;
  /** Who pays Econt: the shop (the customer already paid delivery with the order) or the customer at pickup. */
  payer: "sender" | "receiver";
  /** How the shop pays Econt: cash at the office, or on account under its contract. */
  senderPayment: "cash" | "credit";
  inspectBeforePay: boolean;
  sms: boolean;
  /** Econt's code for the shop's cash-on-delivery agreement. */
  codTemplate: string;
};

export const DEFAULT_ECONT_SETTINGS: EcontSettings = {
  senderName: site.name,
  senderPhone: site.phone,
  senderMode: "office",
  senderOfficeCode: "",
  senderCity: "Плевен",
  senderAddress: "",
  defaultWeight: 1,
  payer: "sender",
  senderPayment: "cash",
  inspectBeforePay: true,
  sms: false,
  codTemplate: "",
};

const KEY = "econt_settings";

export async function getEcontSettings(): Promise<EcontSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  if (!row) return { ...DEFAULT_ECONT_SETTINGS };
  try {
    return { ...DEFAULT_ECONT_SETTINGS, ...(JSON.parse(row.value) as Partial<EcontSettings>) };
  } catch {
    return { ...DEFAULT_ECONT_SETTINGS };
  }
}

export async function saveEcontSettings(value: EcontSettings) {
  const json = JSON.stringify(value);
  await db
    .insert(settings)
    .values({ key: KEY, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: new Date() } });
}

/** What still has to be filled in before a waybill can be made; empty when ready. */
export function missingSenderFields(s: EcontSettings): string[] {
  const missing: string[] = [];
  if (!s.senderName.trim()) missing.push("име на подателя");
  if (!s.senderPhone.trim()) missing.push("телефон на подателя");
  if (s.senderMode === "office" && !s.senderOfficeCode.trim()) missing.push("офис на Еконт, от който изпращаш");
  if (s.senderMode === "address" && (!s.senderCity.trim() || !s.senderAddress.trim())) missing.push("адрес, от който куриерът взема пратките");
  return missing;
}
