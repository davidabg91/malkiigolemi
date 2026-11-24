import "server-only";
import { and, desc, eq, gte, inArray, like, lt, notExists, or, sql, type SQL } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { orders, settings, storePayments, stripePayments, type StorePayment, type StripePayment } from "@/db/schema";
import { parseEuro } from "./format";
import { stripe, stripeConfigured } from "./stripe";
import type { PaymentDetails } from "./stripe-labels";

/**
 * The whole history of card payments for the admin (Админ → Плащания). Stripe is asked for its payments
 * ("charges") and they are copied into `stripe_payments`, so the list is quick, can be searched and does
 * not need Stripe to be reachable. A sync runs after every payment the site records and, while the admin
 * page is open, about once a minute; it also picks up refunds and disputes made in Stripe itself.
 */

type PaymentRow = typeof stripePayments.$inferInsert;

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

/** One Stripe charge as a row of `stripe_payments`. `knownKind` is what our own tables say it paid for. */
export function chargeRow(c: Stripe.Charge, dispute: Stripe.Dispute | null, knownKind?: "store" | "order"): PaymentRow {
  const bt = c.balance_transaction && typeof c.balance_transaction === "object" ? c.balance_transaction : null;
  const card = c.payment_method_details?.card ?? null;
  const a = c.billing_details?.address;
  const failed = c.status === "failed";

  const details: PaymentDetails = {
    description: c.description,
    statement: c.calculated_statement_descriptor,
    receiptUrl: c.receipt_url,
    availableOn: bt?.available_on ?? null,
    fees: bt?.fee_details.map((f) => ({ amount: f.amount, type: f.type, description: f.description })) ?? [],
    method: c.payment_method_details?.type ?? null,
    card: card && {
      brand: card.brand,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      funding: card.funding,
      country: card.country,
      network: card.network,
      issuer: card.issuer ?? null,
      wallet: card.wallet?.type ?? null,
      walletLast4: card.wallet?.dynamic_last4 ?? null,
      threeDS: card.three_d_secure?.result ?? null,
      cvc: card.checks?.cvc_check ?? null,
      postal: card.checks?.address_postal_code_check ?? null,
    },
    phone: c.billing_details?.phone ?? null,
    address: a ? [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state].filter(Boolean).join(", ") || null : null,
    country: a?.country ?? null,
    risk: c.outcome && (c.outcome.risk_level || c.outcome.risk_score != null) ? { level: c.outcome.risk_level ?? null, score: c.outcome.risk_score ?? null } : null,
    failure: failed
      ? { code: c.failure_code, reason: c.outcome?.reason ?? null, message: c.failure_message, bank: c.outcome?.network_decline_code ?? null }
      : null,
    refunds: c.refunds?.data.map((r) => ({ id: r.id, amount: r.amount, created: r.created, reason: r.reason, status: r.status })) ?? [],
    dispute: dispute && {
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
      created: dispute.created,
      dueBy: dispute.evidence_details?.due_by ?? null,
    },
    orderNumber: c.metadata?.number || null,
    note: c.metadata?.note || null,
  };

  return {
    id: c.id,
    paymentIntent: idOf(c.payment_intent),
    created: new Date(c.created * 1000),
    amount: c.amount,
    amountRefunded: c.amount_refunded,
    fee: bt?.fee ?? null,
    net: bt?.net ?? null,
    currency: c.currency,
    status: c.status,
    disputed: c.disputed,
    kind: c.metadata?.kind === "store" ? "store" : c.metadata?.orderId ? "order" : (knownKind ?? "other"),
    name: c.billing_details?.name ?? null,
    email: c.billing_details?.email ?? c.receipt_email ?? null,
    last4: card?.last4 ?? null,
    data: JSON.stringify(details),
    syncedAt: new Date(),
  };
}

async function saveCharges(charges: Stripe.Charge[]) {
  if (!charges.length) return;
  // Payments made before the kind was sent to Stripe are told apart by our own tables.
  const intents = [...new Set(charges.map((c) => idOf(c.payment_intent)).filter((x): x is string => Boolean(x)))];
  const known = new Map<string, "store" | "order">();
  for (let i = 0; i < intents.length; i += 200) {
    const part = intents.slice(i, i + 200);
    const [inStore, inOrders] = await Promise.all([
      db.select({ pi: storePayments.stripePaymentIntent }).from(storePayments).where(inArray(storePayments.stripePaymentIntent, part)),
      db.select({ pi: orders.stripePaymentIntent }).from(orders).where(inArray(orders.stripePaymentIntent, part)),
    ]);
    for (const r of inOrders) if (r.pi) known.set(r.pi, "order");
    for (const r of inStore) if (r.pi) known.set(r.pi, "store");
  }

  for (const c of charges) {
    const dispute = c.disputed ? ((await stripe().disputes.list({ charge: c.id, limit: 1 })).data[0] ?? null) : null;
    const { id, ...row } = chargeRow(c, dispute, known.get(idOf(c.payment_intent) ?? ""));
    await db.insert(stripePayments).values({ id, ...row }).onConflictDoUpdate({ target: stripePayments.id, set: row });
  }
}

const STATE = "stripe_ledger_sync";
/** `at`: when a sync last started (ms). `since`: Stripe time (s) up to which changes are known. */
type SyncState = { at: number; since: number | null; error: string | null };

async function readState(): Promise<SyncState> {
  const [row] = await db.select().from(settings).where(eq(settings.key, STATE)).limit(1);
  try {
    return { at: 0, since: null, error: null, ...(row ? JSON.parse(row.value) : {}) };
  } catch {
    return { at: 0, since: null, error: null };
  }
}

async function writeState(state: SyncState) {
  const value = JSON.stringify(state);
  await db.insert(settings).values({ key: STATE, value }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Everything that changes a payment after it is made; Stripe keeps these events for 30 days. */
const CHANGE_EVENTS = [
  "charge.succeeded",
  "charge.failed",
  "charge.pending",
  "charge.captured",
  "charge.expired",
  "charge.updated",
  "charge.refunded",
  "charge.refund.updated",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
  "refund.created",
  "refund.updated",
  "refund.failed",
];

function chargeOfEvent(e: Stripe.Event) {
  const o = e.data.object as unknown as { object?: string; id?: string; charge?: string | { id: string } | null };
  return o.object === "charge" ? (o.id ?? null) : idOf(o.charge);
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/**
 * Brings `stripe_payments` up to date. The first run (and `full`) reads every payment the account has;
 * later runs read the payments made since the last one and the older ones Stripe's event log says changed.
 */
export async function syncStripePayments(full = false) {
  if (!stripeConfigured()) return;
  const state = await readState();
  const startedAt = Math.floor(Date.now() / 1000);
  await writeState({ ...state, at: Date.now() });
  const whole = full || !state.since || startedAt - state.since > 25 * 86_400;

  try {
    let error: string | null = null;
    if (whole) {
      const all = await stripe().charges.list({ limit: 100, expand: ["data.balance_transaction", "data.refunds"] }).autoPagingToArray({ limit: 10_000 });
      await saveCharges(all);
      console.log(`Stripe ledger: whole history read, ${all.length} payments`);
    } else {
      // A few minutes of overlap, so nothing made while the last sync ran is missed.
      const from = state.since! - 300;
      const fresh = await stripe()
        .charges.list({ limit: 100, created: { gte: from }, expand: ["data.balance_transaction", "data.refunds"] })
        .autoPagingToArray({ limit: 5000 });
      await saveCharges(fresh);
      try {
        const events = await stripe().events.list({ limit: 100, created: { gte: from }, types: CHANGE_EVENTS }).autoPagingToArray({ limit: 5000 });
        const seen = new Set(fresh.map((c) => c.id));
        const changedIds = [...new Set(events.map(chargeOfEvent).filter((x): x is string => Boolean(x)))].filter((id) => !seen.has(id));
        const changed: Stripe.Charge[] = [];
        for (const id of changedIds) changed.push(await stripe().charges.retrieve(id, { expand: ["balance_transaction", "refunds"] }));
        await saveCharges(changed);
      } catch (e) {
        // New payments are in; only refunds and disputes of older ones could not be checked.
        console.error("Stripe ledger: reading the event log failed", e);
        error = `Връщанията и споровете не можаха да се проверят: ${message(e)}`;
      }
    }
    await writeState({ at: Date.now(), since: startedAt, error });
  } catch (e) {
    console.error("Stripe ledger sync failed", e);
    await writeState({ ...state, at: Date.now(), error: message(e) });
  }
}

/** syncStripePayments, at most every `seconds`: for page views. */
export async function syncStripeIfStale(seconds: number) {
  if (!stripeConfigured()) return;
  const state = await readState();
  if (Date.now() - state.at < seconds * 1000) return;
  await syncStripePayments();
}

export const LEDGER_KINDS = ["store", "order", "all"] as const;
export const LEDGER_STATUSES = ["all", "paid", "refunded", "failed"] as const;
export type LedgerFilter = {
  kind: (typeof LEDGER_KINDS)[number];
  status: (typeof LEDGER_STATUSES)[number];
  q: string;
  from: Date | null;
  /** Exclusive. */
  to: Date | null;
  limit: number;
};

export type LedgerRow = {
  p: StripePayment;
  /** The shop payment (№, note, "seen") or the order this money was for. */
  store: StorePayment | null;
  orderId: number | null;
  orderNumber: string | null;
};

function ledgerWhere(f: LedgerFilter) {
  const conds: (SQL | undefined)[] = [];
  if (f.kind !== "all") conds.push(eq(stripePayments.kind, f.kind));
  if (f.status === "paid") conds.push(eq(stripePayments.status, "succeeded"));
  if (f.status === "failed") conds.push(eq(stripePayments.status, "failed"));
  if (f.status === "refunded") conds.push(sql`${stripePayments.amountRefunded} > 0`);
  if (f.from) conds.push(gte(stripePayments.created, f.from));
  if (f.to) conds.push(lt(stripePayments.created, f.to));

  if (f.q) {
    const text = `%${f.q.replace(/[%_]/g, "")}%`;
    const any: (SQL | undefined)[] = [
      like(stripePayments.name, text),
      like(stripePayments.email, text),
      like(storePayments.note, text),
      like(orders.number, text),
      like(orders.name, text),
    ];
    if (/^\d{4}$/.test(f.q)) any.push(eq(stripePayments.last4, f.q));
    if (/^\d{1,9}$/.test(f.q)) any.push(eq(storePayments.id, Number(f.q)));
    const sum = parseEuro(f.q);
    if (sum !== null) any.push(eq(stripePayments.amount, sum));
    if (/^(ch|py|pi)_/.test(f.q)) any.push(eq(stripePayments.id, f.q), eq(stripePayments.paymentIntent, f.q));
    conds.push(or(...any));
  }
  return and(...conds);
}

/** The payments for the admin's filter, newest first, with their totals and the state of the last sync. */
export async function getLedger(f: LedgerFilter) {
  const where = ledgerWhere(f);
  const paid = sql`${stripePayments.status} = 'succeeded'`;

  const [rows, [sums], state] = await Promise.all([
    db
      .select({ p: stripePayments, store: storePayments, orderId: orders.id, orderNumber: orders.number })
      .from(stripePayments)
      .leftJoin(storePayments, eq(storePayments.stripePaymentIntent, stripePayments.paymentIntent))
      .leftJoin(orders, eq(orders.stripePaymentIntent, stripePayments.paymentIntent))
      .where(where)
      .orderBy(desc(stripePayments.created), desc(stripePayments.id))
      .limit(f.limit + 1),
    db
      .select({
        n: sql<number>`count(*)`,
        paidN: sql<number>`coalesce(sum(case when ${paid} then 1 else 0 end), 0)`,
        gross: sql<number>`coalesce(sum(case when ${paid} then ${stripePayments.amount} else 0 end), 0)`,
        refunded: sql<number>`coalesce(sum(${stripePayments.amountRefunded}), 0)`,
        fee: sql<number>`coalesce(sum(case when ${paid} then coalesce(${stripePayments.fee}, 0) else 0 end), 0)`,
      })
      .from(stripePayments)
      .leftJoin(storePayments, eq(storePayments.stripePaymentIntent, stripePayments.paymentIntent))
      .leftJoin(orders, eq(orders.stripePaymentIntent, stripePayments.paymentIntent))
      .where(where),
    readState(),
  ]);

  const totals = { n: Number(sums.n), paidN: Number(sums.paidN), gross: Number(sums.gross), refunded: Number(sums.refunded), fee: Number(sums.fee) };
  return { rows: rows.slice(0, f.limit) as LedgerRow[], more: rows.length > f.limit, totals, synced: state.since ? new Date(state.since * 1000) : null, syncError: state.error };
}

/**
 * Shop payments Stripe's details have not arrived for yet (a payment from seconds ago, or Stripe could not
 * be read). They are always shown, so the till never waits on the sync to see a payment.
 */
export async function getUnsyncedStorePayments(f: LedgerFilter) {
  if (f.kind === "order" || f.status === "refunded" || f.status === "failed") return [];
  const conds: (SQL | undefined)[] = [
    notExists(db.select({ one: sql`1` }).from(stripePayments).where(eq(stripePayments.paymentIntent, storePayments.stripePaymentIntent))),
  ];
  if (f.from) conds.push(gte(storePayments.createdAt, f.from));
  if (f.to) conds.push(lt(storePayments.createdAt, f.to));
  if (f.q) {
    const any: (SQL | undefined)[] = [like(storePayments.note, `%${f.q.replace(/[%_]/g, "")}%`)];
    if (/^\d{1,9}$/.test(f.q)) any.push(eq(storePayments.id, Number(f.q)));
    const sum = parseEuro(f.q);
    if (sum !== null) any.push(eq(storePayments.amount, sum));
    conds.push(or(...any));
  }
  return db.select().from(storePayments).where(and(...conds)).orderBy(desc(storePayments.createdAt)).limit(200);
}
