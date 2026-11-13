import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { after } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { orders, type Order } from "@/db/schema";
import { sendOrderPlaced } from "./order-mail";
import { site } from "./site";

/**
 * Card payments go through Stripe Checkout: the customer pays on Stripe's page (3D Secure, Apple Pay,
 * Google Pay) and comes back to the order page. STRIPE_SECRET_KEY turns it on; STRIPE_WEBHOOK_SECRET lets
 * /api/stripe/webhook confirm payments. Without the key, card orders are taken unpaid as before.
 */
export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | undefined;
export function stripe() {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/** How long a customer has to pay before the order is cancelled and its goods go back on sale. */
const PAY_WITHIN_MINUTES = 60;

/** Whether this order still waits for its card payment. */
export const awaitsCardPayment = (o: Pick<Order, "payment" | "paidAt" | "status">) =>
  stripeConfigured() && o.payment === "card" && !o.paidAt && o.status !== "cancelled";

/** Opens a Stripe Checkout page for an unpaid card order and returns its address. */
export async function createCheckout(orderId: number): Promise<string> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true } });
  if (!order || !awaitsCardPayment(order)) throw new Error("Поръчката не чака плащане с карта.");

  // Loyalty discounts cannot be a negative line, so a discounted order is charged as one line with its total.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    order.discount > 0
      ? [{ quantity: 1, price_data: { currency: "eur", unit_amount: order.total, product_data: { name: `Поръчка ${order.number}` } } }]
      : [
          ...order.items.map((i) => ({ quantity: i.qty, price_data: { currency: "eur", unit_amount: i.price, product_data: { name: i.name.slice(0, 250) } } })),
          ...(order.shipping > 0
            ? [{ quantity: 1, price_data: { currency: "eur", unit_amount: order.shipping, product_data: { name: "Доставка" } } }]
            : []),
        ];
  const metadata = { orderId: String(order.id), number: order.number };

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    customer_email: order.email,
    client_reference_id: order.number,
    locale: "bg",
    expires_at: Math.floor(Date.now() / 1000) + PAY_WITHIN_MINUTES * 60,
    metadata,
    payment_intent_data: { description: `Поръчка ${order.number}`, metadata },
    success_url: `${site.url}/porachka/${order.number}?plashtane=uspeshno`,
    cancel_url: `${site.url}/porachka/${order.number}`,
  });

  // Paying twice for one order must not be possible: close the page opened before this one.
  if (order.stripeSessionId) await stripe().checkout.sessions.expire(order.stripeSessionId).catch(() => {});
  await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, order.id));
  if (!session.url) throw new Error("Stripe не върна адрес за плащане.");
  return session.url;
}

/**
 * Marks the order paid once Stripe says so. Safe to call more than once (webhook, return to the order
 * page): only the first call records it and sends the "order received" e-mails.
 */
export async function recordPayment(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return false;
  const orderId = Number(session.metadata?.orderId);
  if (!Number.isInteger(orderId)) return false;
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const updated = await db
    .update(orders)
    .set({ paidAt: new Date(), stripePaymentIntent: intent })
    .where(and(eq(orders.id, orderId), isNull(orders.paidAt)))
    .returning({ id: orders.id });
  if (updated.length) after(() => sendOrderPlaced(orderId));
  return true;
}

/** Asks Stripe about the order's open payment page, for when the customer is back before the webhook. */
export async function syncPayment(order: Pick<Order, "stripeSessionId" | "payment" | "paidAt" | "status">) {
  if (!awaitsCardPayment(order) || !order.stripeSessionId) return false;
  const session = await stripe().checkout.sessions.retrieve(order.stripeSessionId).catch(() => null);
  return session ? recordPayment(session) : false;
}

/** Gives a cancelled card order its money back, in full. Returns false when it could not be done. */
export async function refundOrder(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.paidAt || order.refundedAt || !order.stripePaymentIntent || !stripeConfigured()) return true;
  try {
    await stripe().refunds.create({ payment_intent: order.stripePaymentIntent }, { idempotencyKey: `refund-order-${order.id}` });
    await db.update(orders).set({ refundedAt: new Date() }).where(eq(orders.id, order.id));
    return true;
  } catch (e) {
    console.error("Stripe refund failed", order.number, e);
    return false;
  }
}

/** The payment in the Stripe dashboard, for the admin. */
export const stripePaymentUrl = (intent: string) => `https://dashboard.stripe.com/payments/${encodeURIComponent(intent)}`;
