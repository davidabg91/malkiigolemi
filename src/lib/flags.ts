import "server-only";
import { db } from "@/db";
import { flaggedContacts, type FlaggedContact } from "@/db/schema";

/** "+359 88 637 8751", "00359886378751" and "0886378751" are the same number. */
export function normalizePhone(phone: string | null | undefined) {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00359")) digits = `0${digits.slice(5)}`;
  else if (digits.startsWith("359") && digits.length >= 11) digits = `0${digits.slice(3)}`;
  return digits;
}

export type FlagIndex = {
  byUser: Map<number, FlaggedContact>;
  byEmail: Map<string, FlaggedContact>;
  byPhone: Map<string, FlaggedContact>;
  count: number;
};

/** Every "некоректен" mark, indexed for quick lookups while rendering a list of orders or customers. */
export async function getFlagIndex(): Promise<FlagIndex> {
  const rows = await db.select().from(flaggedContacts);
  const index: FlagIndex = { byUser: new Map(), byEmail: new Map(), byPhone: new Map(), count: rows.length };
  for (const row of rows) {
    if (row.userId != null) index.byUser.set(row.userId, row);
    if (row.email) index.byEmail.set(row.email, row);
    if (row.phone) index.byPhone.set(row.phone, row);
  }
  return index;
}

/** The mark that applies to this account, e-mail or phone, if any. */
export function findFlag(
  index: FlagIndex,
  who: { userId?: number | null; email?: string | null; phone?: string | null },
): FlaggedContact | null {
  if (who.userId != null) {
    const hit = index.byUser.get(who.userId);
    if (hit) return hit;
  }
  const email = who.email?.trim().toLowerCase();
  if (email) {
    const hit = index.byEmail.get(email);
    if (hit) return hit;
  }
  const phone = normalizePhone(who.phone);
  return (phone && index.byPhone.get(phone)) || null;
}
