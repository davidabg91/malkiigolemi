const eur = new Intl.NumberFormat("bg-BG", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** Formats euro cents, e.g. 248 → "2,48 €". */
export function formatPrice(cents: number) {
  return eur.format(cents / 100);
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

/** Price for one unit, taking the "buy N or more" price into account. */
export function unitPriceFor(
  item: { price: number; bulkMinQty?: number | null; bulkPrice?: number | null },
  qty: number,
) {
  if (item.bulkMinQty && item.bulkPrice && qty >= item.bulkMinQty) return item.bulkPrice;
  return item.price;
}
