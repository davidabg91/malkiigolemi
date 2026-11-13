import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { changeOrderStatus } from "@/lib/order-status";
import { recordPayment, stripe, stripeConfigured } from "@/lib/stripe";

/** An unpaid card order whose payment page ran out: cancelled, so its goods go back on sale. */
async function cancelUnpaid(session: Stripe.Checkout.Session) {
  const orderId = Number(session.metadata?.orderId);
  if (!Number.isInteger(orderId)) return;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  // A newer payment page may be open for the same order; only the latest one counts.
  if (!order || order.paidAt || order.stripeSessionId !== session.id) return;
  await changeOrderStatus(order.id, "cancelled", { allowedFrom: ["new"], note: "Отказана автоматично: плащането с карта не беше завършено." });
}

/** Stripe calls this when a card payment succeeds or a payment page expires (Stripe → Developers → Webhooks). */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripeConfigured()) return new Response("Stripe is not configured", { status: 503 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await recordPayment(event.data.object);
      break;
    case "checkout.session.expired":
      await cancelUnpaid(event.data.object);
      break;
  }
  return Response.json({ received: true });
}
