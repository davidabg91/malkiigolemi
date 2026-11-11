"use server";

import { getLiveCards, type ProductCardData } from "@/lib/queries";

/** Current price, stock and promotion for products in a cart, read fresh rather than from the catalogue cache. */
export async function liveCartData(ids: number[]): Promise<ProductCardData[]> {
  const clean = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
  return getLiveCards(clean);
}
