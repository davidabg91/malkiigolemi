/**
 * What the shop tells the customer about getting a product: "Налично" (on hand, green), "Доставка 7 дни"
 * (ordered in for the customer, pale orange) or "Очаква се" (on its way to the shop, blue). The admin
 * picks it in the product form. It is information only: whether a product can be ordered is still its stock.
 */
export const AVAILABILITY = ["available", "delivery", "expected"] as const;
export type Availability = (typeof AVAILABILITY)[number];
/** What is shown: the admin's choice, or "soldout" when nothing is left. */
export type StockState = Availability | "soldout";

type Source = { stock: number; availability?: string | null; deliveryTime?: string | null };

export const AVAILABILITY_OPTIONS: { id: Availability; label: string; hint: string }[] = [
  { id: "available", label: "Налично", hint: "При теб е и се изпраща веднага." },
  { id: "delivery", label: "С доставка", hint: "Поръчва се за клиента. Напиши срока." },
  { id: "expected", label: "Очаква се", hint: "Предстои да пристигне." },
];

/**
 * A cart line saved on the customer's device before the status existed has none: a delivery time then
 * means "delivery". "Delivery" without a time says nothing, so it counts as on hand.
 */
export function availabilityOf(p: Pick<Source, "availability" | "deliveryTime">): Availability {
  if (p.availability === "expected") return "expected";
  if (p.availability === "available") return "available";
  return p.deliveryTime ? "delivery" : "available";
}

/** The status as the customer reads it on a product. */
export function stockState(p: Source): { kind: StockState; label: string } {
  const kind = availabilityOf(p);
  // Goods on their way are "expected" even with none on hand: that is the whole point of the status.
  if (kind === "expected") return { kind, label: p.deliveryTime ? `Очаква се ${p.deliveryTime}` : "Очаква се" };
  if (p.stock <= 0) return { kind: "soldout", label: "Изчерпан" };
  if (kind === "delivery") return { kind, label: `Доставка ${p.deliveryTime}` };
  return { kind, label: "Налично" };
}

/** What an order line remembers about delivery (shown as "Срок за доставка: …"), or null for goods on hand. */
export function deliveryNote(p: Pick<Source, "availability" | "deliveryTime">): string | null {
  const kind = availabilityOf(p);
  if (kind === "delivery") return p.deliveryTime ?? null;
  if (kind === "expected") return p.deliveryTime ? `очаква се ${p.deliveryTime}` : "очаква се";
  return null;
}
