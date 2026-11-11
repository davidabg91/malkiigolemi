import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, type Promotion } from "@/db/schema";

export type PromoState = "live" | "upcoming" | "ended" | "off";

export function promoState(p: Pick<Promotion, "enabled" | "startsAt" | "endsAt">, now = new Date()): PromoState {
  if (!p.enabled) return "off";
  if (p.endsAt <= now) return "ended";
  if (p.startsAt > now) return "upcoming";
  return "live";
}

export const PROMO_STATE_LABELS: Record<PromoState, { label: string; className: string }> = {
  live: { label: "Активна", className: "bg-[#cdebd3] text-[#0f3d26]" },
  upcoming: { label: "Предстояща", className: "bg-[#cde5f6] text-[#0c3350]" },
  ended: { label: "Изтекла", className: "bg-sand text-ink-soft" },
  off: { label: "Изключена", className: "bg-tomato/15 text-tomato" },
};

/** Products and categories for the promotion form. */
export async function promotionFormOptions() {
  const [productRows, categoryRows] = await Promise.all([
    db.select({ id: products.id, name: products.name, unit: products.unit, price: products.price }).from(products).where(eq(products.active, true)).orderBy(asc(products.name)),
    db.select({ id: categories.id, name: categories.name, parentId: categories.parentId, sort: categories.sort }).from(categories).orderBy(asc(categories.sort), asc(categories.id)),
  ]);
  const roots = categoryRows.filter((c) => c.parentId === null);
  const options = roots.flatMap((r) => [
    { id: r.id, label: `${r.name} (цялата)` },
    ...categoryRows.filter((c) => c.parentId === r.id).map((c) => ({ id: c.id, label: `   ${r.name} › ${c.name}` })),
  ]);
  return {
    products: productRows.map((p) => ({ id: p.id, label: `${p.name} ${p.unit}`.trim(), price: p.price })),
    categories: options,
  };
}

/** Suggested dates for a new promotion: from the next full hour, for a week. */
export function newPromotionWindow() {
  const start = new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000);
  return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
}
