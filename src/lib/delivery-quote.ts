import "server-only";
import { findOffice } from "./courier-offices";
import { econtLabel } from "./econt";
import { getEcontSettings, missingSenderFields } from "./econt-settings";
import { econtSender } from "./shipments";
import { shippingFor } from "./site";

/** Where and how an order is delivered, as far as the price depends on it. */
export type QuoteInput = {
  delivery: string;
  courier?: string | null;
  officeCode?: string | null;
  city?: string | null;
  payment: "cod" | "card";
  /** Goods in euro cents. */
  subtotal: number;
};

export type ShippingQuote = {
  /** Euro cents. */
  shipping: number;
  /** The courier's own price for this parcel, not the shop's flat one. */
  exact: boolean;
};

// The same parcel is priced when the customer looks and again when the order is placed: keep the answer a while.
const cache = new Map<string, { price: number; until: number }>();
const TTL = 15 * 60_000;

/**
 * What Econt charges for this delivery, in cents: its own calculation for the shop's contract, sender and
 * usual parcel weight, with the cash-on-delivery fee when the customer pays on delivery. Null when Econt is not
 * set up, the switch in Куриери → Еконт is off, or Econt does not answer (the flat price applies then).
 */
async function econtPrice(q: QuoteInput, flat: number): Promise<number | null> {
  const toOffice = q.delivery === "office" || q.delivery === "box";
  const office = toOffice && q.officeCode ? findOffice("econt", q.officeCode) : undefined;
  const city = (q.city ?? "").trim();
  if (toOffice ? !office : q.delivery !== "address" || city.length < 2) return null;

  const s = await getEcontSettings();
  if (!s.exactPrice || missingSenderFields(s).length) return null;
  // Cash on delivery covers goods and delivery; the fee is a small share of it, so the flat price stands in for the delivery part.
  const cod = q.payment === "cod" ? Math.round((q.subtotal + flat) / 100) : 0;
  const key = JSON.stringify([toOffice ? office!.code : city.toLowerCase(), cod, s.defaultWeight, s.senderMode, s.senderOfficeCode, s.senderCity, s.senderClientId, s.payer, s.sms]);
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.price;

  try {
    const label = await econtLabel(
      {
        sender: econtSender(s),
        // The street does not change the price; the settlement does.
        receiver: { name: "Клиент", phone: s.senderPhone, officeCode: office?.code ?? null, city, address: "" },
        orderNumber: "",
        description: "Стоки",
        weight: s.defaultWeight,
        packCount: 1,
        cod,
        payer: s.payer,
        senderPayment: s.senderPayment,
        inspectBeforePay: s.inspectBeforePay,
        sms: s.sms,
        codTemplate: s.codTemplate || null,
      },
      "calculate",
      6_000,
    );
    const price = Math.round(label.price * 100);
    // Anything odd (another currency, zero, a huge sum) is not shown to a customer.
    if (label.currency !== "EUR" || price <= 0 || price > 5000) return null;
    if (cache.size > 2000) cache.clear();
    cache.set(key, { price, until: Date.now() + TTL });
    return price;
  } catch {
    return null;
  }
}

/** The delivery price for an order: the courier's exact one where we can ask for it, otherwise the shop's flat price. */
export async function quoteShipping(q: QuoteInput): Promise<ShippingQuote> {
  const flat = shippingFor(q.delivery, q.subtotal, q.courier);
  if (q.courier === "econt" && q.delivery !== "store") {
    const exact = await econtPrice(q, flat);
    if (exact != null) return { shipping: exact, exact: true };
  }
  return { shipping: flat, exact: false };
}
