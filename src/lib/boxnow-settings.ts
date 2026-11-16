import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { COMPANY, site } from "./site";

/** How the shop sends with BOX NOW. Kept in the settings table and edited under Админ → Куриери. */
export type BoxNowSettings = {
  /**
   * How parcels reach BOX NOW, as an id from /origins: the "any-apm" entry when the shop drops them in any locker
   * (what the shop's contract allows), or a warehouse BOX NOW's courier collects from. Empty = taken from BOX NOW
   * when the first parcel is made, if the contract has exactly one.
   */
  originId: string;
  originName: string;
  /** "any-apm" or "warehouse". */
  originType: string;
  /** Sender shown on the label. */
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  /** Compartment size unless changed on the parcel: 1 small (8 cm), 2 medium (17 cm), 3 large (36 cm). */
  defaultSize: 1 | 2 | 3;
  /** Kilograms per parcel unless changed. */
  defaultWeight: number;
  /** Let the customer return the parcel through BOX NOW. */
  allowReturn: boolean;
};

export const DEFAULT_BOXNOW_SETTINGS: BoxNowSettings = {
  originId: "",
  originName: "",
  originType: "",
  senderName: COMPANY.name,
  senderPhone: site.phone,
  senderEmail: site.email,
  defaultSize: 2,
  defaultWeight: 1,
  allowReturn: false,
};

const KEY = "boxnow_settings";

export async function getBoxNowSettings(): Promise<BoxNowSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  if (!row) return { ...DEFAULT_BOXNOW_SETTINGS };
  try {
    return { ...DEFAULT_BOXNOW_SETTINGS, ...(JSON.parse(row.value) as Partial<BoxNowSettings>) };
  } catch {
    return { ...DEFAULT_BOXNOW_SETTINGS };
  }
}

export async function saveBoxNowSettings(value: BoxNowSettings) {
  const json = JSON.stringify(value);
  await db
    .insert(settings)
    .values({ key: KEY, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: new Date() } });
}

/** What still has to be filled in before a parcel can be created; empty when ready. */
export function missingBoxNowFields(s: BoxNowSettings): string[] {
  const missing: string[] = [];
  if (!s.senderName.trim()) missing.push("име на подателя");
  if (!s.senderPhone.trim()) missing.push("телефон на подателя");
  if (!s.senderEmail.trim()) missing.push("имейл на подателя");
  return missing;
}
