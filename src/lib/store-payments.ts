import "server-only";
import { desc, eq, gte, isNull, sql } from "drizzle-orm";
import { after } from "next/server";
import type Stripe from "stripe";
import { db } from "@/db";
import { storePayments, type StorePayment } from "@/db/schema";
import { formatPrice, formatTimestamp } from "./format";
import { escapeHtml, mailLayout, sendMail } from "./mail";
import { site } from "./site";
import { stripe } from "./stripe";

/**
 * Card payments at the till: the customer scans the shop's QR code, types the sum on /plati and pays on
 * Stripe's page (Apple Pay, Google Pay or a card). The shop sees it in Админ → Плащания.
 */
// The printed QR code carries this address for good, so it is the shop's own domain whatever SITE_URL says.
export const STORE_PAY_URL = `https://${site.domain}/plati`;
/** Euro cents a customer may pay in one go. */
export const STORE_PAY_MIN = 100;
export const STORE_PAY_MAX = 200_000;

export const isStorePayment = (session: Stripe.Checkout.Session) => session.metadata?.kind === "store";

/** Opens a Stripe Checkout page for a sum typed by the customer and returns its address. */
export async function createStoreCheckout(amount: number, note: string): Promise<string> {
  const metadata = { kind: "store", note };
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    submit_type: "pay",
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: amount, product_data: { name: "Плащане в магазина" } } }],
    locale: "bg",
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    metadata,
    payment_intent_data: { description: note ? `Плащане в магазина: ${note}` : "Плащане в магазина", metadata },
    success_url: `${STORE_PAY_URL}/gotovo?s={CHECKOUT_SESSION_ID}`,
    cancel_url: STORE_PAY_URL,
  });
  if (!session.url) throw new Error("Stripe не върна адрес за плащане.");
  return session.url;
}

/**
 * Writes the payment down once Stripe says it is paid. Safe to call more than once (webhook, the
 * customer's "готово" page): only the first call adds the row and tells the shop by e-mail.
 */
export async function recordStorePayment(session: Stripe.Checkout.Session): Promise<StorePayment | null> {
  if (!isStorePayment(session) || session.payment_status !== "paid" || !session.amount_total) return null;
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const [added] = await db
    .insert(storePayments)
    .values({ amount: session.amount_total, note: session.metadata?.note || null, stripeSessionId: session.id, stripePaymentIntent: intent })
    .onConflictDoNothing()
    .returning();
  if (!added) {
    const [existing] = await db.select().from(storePayments).where(eq(storePayments.stripeSessionId, session.id)).limit(1);
    return existing ?? null;
  }
  after(() =>
    sendMail(
      site.email,
      `Плащане в магазина: ${formatPrice(added.amount)}`,
      mailLayout(
        `Получено плащане ${formatPrice(added.amount)}`,
        `<p style="margin:0 0 8px">Плащане № ${added.id}, получено на ${formatTimestamp(added.createdAt)} ч. през QR кода в магазина.</p>${added.note ? `<p style="margin:0">Бележка от клиента: ${escapeHtml(added.note)}</p>` : ""}`,
        { href: `${site.url}/admin/plashtaniya`, label: "Виж плащанията" },
      ),
    ),
  );
  return added;
}

/** The payment behind a Stripe page the customer has just come back from; null when it is not paid. */
export async function storePaymentOf(sessionId: string) {
  const session = await stripe().checkout.sessions.retrieve(sessionId).catch(() => null);
  return session ? recordStorePayment(session) : null;
}

const sofiaClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/** The latest payments with what came in today (Bulgarian time) and in the last 30 days, for the admin. */
export async function getStorePayments() {
  const now = Date.now();
  const [h, m, s] = sofiaClock.format(now).split(":").map(Number);
  const dayStart = new Date(now - (((h % 24) * 60 + m) * 60 + s) * 1000);
  const totals = (since: Date) =>
    db
      .select({ sum: sql<number>`coalesce(sum(${storePayments.amount}), 0)`, n: sql<number>`count(*)` })
      .from(storePayments)
      .where(gte(storePayments.createdAt, since));
  const [list, [today], [month], [unseen]] = await Promise.all([
    db.select().from(storePayments).orderBy(desc(storePayments.createdAt)).limit(200),
    totals(dayStart),
    totals(new Date(now - 30 * 86_400_000)),
    db.select({ n: sql<number>`count(*)` }).from(storePayments).where(isNull(storePayments.seenAt)),
  ]);
  const num = (t: { sum: number; n: number }) => ({ sum: Number(t.sum), n: Number(t.n) });
  return { list, today: num(today), month: num(month), unseen: Number(unseen.n) };
}
