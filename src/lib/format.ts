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

/** Price for one unit, taking the "buy N or more" price into account. */
export function unitPriceFor(
  item: { price: number; bulkMinQty?: number | null; bulkPrice?: number | null },
  qty: number,
) {
  if (item.bulkMinQty && item.bulkPrice && qty >= item.bulkMinQty) return item.bulkPrice;
  return item.price;
}
