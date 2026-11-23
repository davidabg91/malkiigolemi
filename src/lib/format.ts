import { ownColorPrice } from "./product-colors";

const eur = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** Formats euro cents, e.g. 248 → "2,48 €". */
export function formatPrice(cents: number) {
  return eur.format(cents / 100);
}

/** Reads a sum typed by a person, "12,50" or "12.5 €", into euro cents; null when it is not a sum. */
export function parseEuro(raw: string) {
  const s = raw.replace(/[\s€]/g, "").replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function discountPercent(price: number, oldPrice: number | null | undefined) {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round((1 - price / oldPrice) * 100);
}

const dateFmt = new Intl.DateTimeFormat("bg-BG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(d: Date | number) {
  return dateFmt.format(d);
}

const stampFmt = new Intl.DateTimeFormat("bg-BG", {
  timeZone: "Europe/Sofia",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Exact Bulgarian date and time, e.g. "13.11.2026 г., 15:42:07", for records such as a withdrawal. */
export function formatTimestamp(d: Date | number) {
  return stampFmt.format(d);
}

/**
 * Price for one unit, taking the "buy N or more" price into account. A colour (or size) with a price of
 * its own always costs that price: the price for quantity is the product's, not the colour's.
 */
export function unitPriceFor(
  item: Parameters<typeof ownColorPrice>[0] & { bulkMinQty?: number | null; bulkPrice?: number | null },
  qty: number,
  color?: string | null,
) {
  const own = ownColorPrice(item, color);
  if (own) return own.price;
  if (item.bulkMinQty && item.bulkPrice && qty >= item.bulkMinQty) return item.bulkPrice;
  return item.price;
}
