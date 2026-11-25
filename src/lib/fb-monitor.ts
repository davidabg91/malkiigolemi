import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, lt, notInArray, or, sql, type AnyColumn } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { fbClaims, fbMessages, fbPosts, fbRuns, orderItems, orders, products, settings, type FbClaim, type FbRun } from "@/db/schema";
import { getFbOrderSettings } from "./fb-orders";
import { quantityOf } from "./fb-parse";

/**
 * What Админ → От Facebook shows about the browser extension ("the script"): what it reported about itself and
 * its runs, whether it looks healthy, how much of each product people asked for, and which comments a person
 * should look at.
 */

/* ---------- what the extension reports ---------- */

export const fbReportSchema = z.object({
  /** Where the extension stands: sent with every report and whenever its automatic collecting changes. */
  state: z
    .object({
      version: z.string().max(20),
      auto: z.object({ enabled: z.boolean(), min: z.number().int(), max: z.number().int(), from: z.number().int(), to: z.number().int() }),
      /** When it plans to start by itself next (milliseconds), or null. */
      nextAt: z.number().nullable(),
    })
    .optional(),
  /** One finished run. */
  run: z
    .object({
      kind: z.enum(["auto", "manual", "post"]),
      startedAt: z.number(),
      finishedAt: z.number(),
      visited: z.number().int().min(0).max(1000),
      failed: z.number().int().min(0).max(1000),
      added: z.number().int().min(0).max(100000),
      ordered: z.number().int().min(0).max(100000),
      replied: z.number().int().min(0).max(100000),
      /** Posts left alone because they are from before the day collecting starts. */
      skippedOld: z.number().int().min(0).max(1000).default(0),
      stopped: z.boolean(),
      problem: z.string().max(60).nullable(),
    })
    .optional(),
});
export type FbReport = z.infer<typeof fbReportSchema>;

export type FbExtensionState = NonNullable<FbReport["state"]> & { at: number };

const STATE_KEY = "fb_extension_state";
const KEEP_RUNS = 300;

export async function getFbExtensionState(): Promise<FbExtensionState | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, STATE_KEY)).limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as FbExtensionState;
  } catch {
    return null;
  }
}

export async function saveFbReport(report: FbReport) {
  if (report.state) {
    const json = JSON.stringify({ ...report.state, at: Date.now() } satisfies FbExtensionState);
    await db
      .insert(settings)
      .values({ key: STATE_KEY, value: json })
      .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: new Date() } });
  }
  if (report.run) {
    const r = report.run;
    await db.insert(fbRuns).values({
      kind: r.kind,
      startedAt: new Date(r.startedAt),
      finishedAt: new Date(r.finishedAt),
      visited: r.visited,
      failed: r.failed,
      added: r.added,
      ordered: r.ordered,
      replied: r.replied,
      skippedOld: r.skippedOld,
      stopped: r.stopped,
      problem: r.problem,
      version: report.state?.version ?? null,
    });
    // The diary keeps the last few hundred runs.
    const [edge] = await db.select({ id: fbRuns.id }).from(fbRuns).orderBy(desc(fbRuns.id)).limit(1).offset(KEEP_RUNS);
    if (edge) await db.delete(fbRuns).where(lt(fbRuns.id, edge.id + 1));
  }
}

/* ---------- is the script all right? ---------- */

export type FbHealth = {
  level: "ok" | "warn" | "bad" | "idle";
  title: string;
  /** What is wrong (or worth knowing), most important first; empty when all is well. */
  notes: string[];
};

const RUN_PROBLEMS: Record<string, string> = {
  stuck: "Последното автоматично събиране не приключи: прозорецът му не се виждаше на екрана или Facebook не отговори.",
  offline: "При последното събиране нямаше връзка със сайта.",
  unauthorized: "Сайтът не прие ключа на разширението. Отвори тази страница в Chrome с разширението, за да се свърже отново.",
  "no-button": "Отговорите под коментарите спряха: с този профил не може да се отговаря в групата.",
  "not-sent": "Отговорите под коментарите спряха: Facebook не прие отговора. Може временно да е ограничил профила.",
};
export const runProblem = (problem: string | null) => (problem ? (RUN_PROBLEMS[problem] ?? `Последното събиране спря с грешка (${problem}).`) : null);

const minutes = (ms: number) => Math.round(ms / 60000);
export function ago(ms: number) {
  const m = minutes(ms);
  if (m < 1) return "преди по-малко от минута";
  if (m < 60) return `преди ${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `преди ${h} ч${m % 60 ? ` и ${m % 60} мин` : ""}`;
  const d = Math.floor(h / 24);
  return `преди ${d} ${d === 1 ? "ден" : "дни"}`;
}

/** The hour of the day in Bulgaria, where the admin's computer is. */
const hourInSofia = (at: number) => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Sofia" }).format(at));
const inHours = (auto: FbExtensionState["auto"], at: number) => {
  const hour = hourInSofia(at);
  if (auto.from === auto.to % 24) return true;
  return auto.from < auto.to ? hour >= auto.from && hour < auto.to : hour >= auto.from || hour < auto.to;
};

export function fbHealth(input: { state: FbExtensionState | null; lastRun: FbRun | null; latestVersion: string; failedMessages: number; waitingMessages: number; now?: number }): FbHealth {
  const now = input.now ?? Date.now();
  const { state, lastRun } = input;
  if (!state && !lastRun) {
    return { level: "idle", title: "Скриптът още не се е обадил", notes: ["Инсталирай последната версия на разширението (най-долу на страницата) и отвори тази страница в същия Chrome."] };
  }
  const bad: string[] = [];
  const warn: string[] = [];
  /** Worth knowing, but nothing is wrong. */
  const info: string[] = [];

  if (state && state.version !== input.latestVersion) warn.push(`Разширението е версия ${state.version}, а последната е ${input.latestVersion}. Изтегли новата (най-долу на страницата).`);
  const problem = lastRun && runProblem(lastRun.problem);
  if (problem) (lastRun.problem === "unauthorized" || lastRun.problem === "stuck" ? bad : warn).push(problem);
  if (lastRun && lastRun.visited > 0 && lastRun.failed === lastRun.visited) bad.push("При последното събиране нито един пост не се отвори. Провери дали в този Chrome си влязъл във Facebook.");
  else if (lastRun && lastRun.failed > 0) info.push(`При последното събиране ${lastRun.failed} от ${lastRun.visited} поста ${lastRun.failed === 1 ? "не се отвори (изтрит или недостъпен)" : "не се отвориха (изтрити или недостъпни)"}. Ако постът вече го няма, спри събирането от него.`);

  if (state?.auto.enabled) {
    // Late by more than a run would take: the browser is closed, the computer sleeps, or the window is covered.
    const late = state.nextAt != null && now - state.nextAt > 30 * 60000 && inHours(state.auto, now);
    if (late) bad.push(`Автоматичното събиране закъснява: трябваше да тръгне ${ago(now - state.nextAt!)}. Chrome с разширението вероятно е затворен или компютърът спи.`);
  }
  if (input.failedMessages > 0) warn.push(`${input.failedMessages} ${input.failedMessages === 1 ? "съобщение до клиент не е изпратено" : "съобщения до клиенти не са изпратени"} (виж „Съобщения до клиенти“).`);

  if (bad.length > 0) return { level: "bad", title: "Има проблем със скрипта", notes: [...bad, ...warn, ...info] };
  if (warn.length > 0) return { level: "warn", title: "Скриптът работи, но има забележки", notes: [...warn, ...info] };
  // Nothing is wrong, but nothing happens by itself either.
  if (state && !state.auto.enabled) return { level: "idle", title: "Автоматичното събиране е изключено", notes: ["Събира се само когато някой го пусне на ръка. Включва се от иконата на разширението в Chrome.", ...info] };
  return { level: "ok", title: "Скриптът работи", notes: info };
}

/* ---------- the numbers on the page ---------- */

export const FB_PERIODS = [
  { id: "today", label: "Днес", days: 1 },
  { id: "7", label: "7 дни", days: 7 },
  { id: "30", label: "30 дни", days: 30 },
  { id: "all", label: "Всичко", days: null },
] as const;
export type FbPeriodId = (typeof FB_PERIODS)[number]["id"];

const dayInSofia = (at: Date | number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(at);

/** Midnight in Bulgaria `daysBack` days ago (0 = today), as a moment. */
function startOfDay(daysBack: number, now = Date.now()) {
  // Walk back from "now" to the first instant that is still the wanted calendar day there.
  const day = dayInSofia(now - daysBack * 86400000);
  let at = new Date(`${day}T00:00:00Z`).getTime();
  // Bulgaria is two or three hours ahead of UTC: step back until the local day matches.
  for (let i = 0; i < 4 && dayInSofia(at - 3600000) === day; i++) at -= 3600000;
  return new Date(at);
}

export type ReviewItem = {
  claim: FbClaim;
  post: { id: number; name: string; url: string | null; hasProduct: boolean };
  /** Colours to choose from when the post's product is sold in several. */
  colors: string[];
  stock: number | null;
  /** Why the script did not put it in an order by itself. */
  why: string;
  /** The script did not take it for an order at all (no quantity in it). */
  unclear: boolean;
};

export type ProductDemand = {
  key: string;
  productId: number | null;
  name: string;
  /** Pieces in open orders still waiting for the goods, and how many people they belong to. */
  ordered: number;
  people: number;
  /** Pieces in orders already marked "Готова за взимане". */
  ready: number;
  /** Pieces in comments not yet in any order. */
  waiting: number;
  stock: number | null;
};

export async function fbDashboard(period: FbPeriodId) {
  const days = FB_PERIODS.find((p) => p.id === period)?.days ?? null;
  const since = days == null ? null : startOfDay(days - 1);
  const chartSince = startOfDay(13);
  const inPeriod = (column: AnyColumn) => (since ? gte(column, since) : undefined);

  const fbOrder = and(eq(orders.source, "facebook"), isNotNull(orders.fbName));
  const [claimStats, messageStats, orderStats, repliedRow, posts, runs, state, review, demandRows, waitingRows, chartRows, failedMessages, orderSettings] = await Promise.all([
    db
      .select({ status: fbClaims.status, skipReason: fbClaims.skipReason, orderedBy: fbClaims.orderedBy, n: sql<number>`count(*)`, qty: sql<number>`coalesce(sum(${fbClaims.qty}), 0)` })
      .from(fbClaims)
      .where(inPeriod(fbClaims.createdAt))
      .groupBy(fbClaims.status, fbClaims.skipReason, fbClaims.orderedBy),
    db
      .select({ status: fbMessages.status, n: sql<number>`count(*)` })
      .from(fbMessages)
      .where(inPeriod(fbMessages.createdAt))
      .groupBy(fbMessages.status),
    db
      .select({
        orders: sql<number>`count(*)`,
        people: sql<number>`count(distinct ${orders.fbName})`,
        total: sql<number>`coalesce(sum(${orders.total}), 0)`,
        ready: sql<number>`coalesce(sum(case when ${orders.readyAt} is not null then 1 else 0 end), 0)`,
      })
      .from(orders)
      .where(and(fbOrder, sql`${orders.status} != 'cancelled'`, inPeriod(orders.createdAt))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(fbClaims)
      .where(and(isNotNull(fbClaims.repliedAt), sql`${fbClaims.status} != 'rejected'`, since ? gte(fbClaims.repliedAt, since) : undefined)),
    // Every post the script knows, newest first, with what its comments turned into.
    db
      .select({
        id: fbPosts.id,
        productName: fbPosts.productName,
        productId: fbPosts.productId,
        price: fbPosts.price,
        url: fbPosts.url,
        fbId: fbPosts.fbId,
        closedAt: fbPosts.closedAt,
        syncedAt: fbPosts.syncedAt,
        createdAt: fbPosts.createdAt,
        comments: sql<number>`count(${fbClaims.id})`,
        ordered: sql<number>`coalesce(sum(case when ${fbClaims.status} = 'ordered' then 1 else 0 end), 0)`,
        orderedQty: sql<number>`coalesce(sum(case when ${fbClaims.status} = 'ordered' then ${fbClaims.qty} else 0 end), 0)`,
        pending: sql<number>`coalesce(sum(case when ${fbClaims.status} = 'pending' then 1 else 0 end), 0)`,
        unclear: sql<number>`coalesce(sum(case when ${fbClaims.status} = 'rejected' and ${fbClaims.skipReason} = 'unclear' then 1 else 0 end), 0)`,
      })
      .from(fbPosts)
      .leftJoin(fbClaims, eq(fbClaims.postId, fbPosts.id))
      .groupBy(fbPosts.id)
      .orderBy(desc(fbPosts.createdAt))
      .limit(60),
    db.select().from(fbRuns).orderBy(desc(fbRuns.finishedAt)).limit(12),
    getFbExtensionState(),
    // Comments a person should look at: still waiting, or left out because no quantity was found in them.
    db
      .select({ claim: fbClaims, post: fbPosts })
      .from(fbClaims)
      .innerJoin(fbPosts, eq(fbPosts.id, fbClaims.postId))
      .where(or(eq(fbClaims.status, "pending"), and(eq(fbClaims.status, "rejected"), eq(fbClaims.skipReason, "unclear"))))
      .orderBy(desc(fbClaims.id))
      .limit(80),
    // What sits in open orders gathered from the group, per product.
    db
      .select({
        productId: orderItems.productId,
        name: orderItems.name,
        ordered: sql<number>`coalesce(sum(case when ${orders.readyAt} is null then ${orderItems.qty} else 0 end), 0)`,
        ready: sql<number>`coalesce(sum(case when ${orders.readyAt} is not null then ${orderItems.qty} else 0 end), 0)`,
        people: sql<number>`count(distinct case when ${orders.readyAt} is null then ${orders.id} end)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(fbOrder, inArray(orders.status, ["new", "confirmed"])))
      .groupBy(sql`coalesce(${orderItems.productId}, ${orderItems.name})`),
    db
      .select({ productId: fbPosts.productId, name: fbPosts.productName, qty: sql<number>`coalesce(sum(${fbClaims.qty}), 0)` })
      .from(fbClaims)
      .innerJoin(fbPosts, eq(fbPosts.id, fbClaims.postId))
      .where(eq(fbClaims.status, "pending"))
      .groupBy(sql`coalesce(${fbPosts.productId}, ${fbPosts.productName})`),
    db.select({ createdAt: fbClaims.createdAt, status: fbClaims.status }).from(fbClaims).where(gte(fbClaims.createdAt, chartSince)),
    db
      .select({ message: fbMessages, order: { id: orders.id, number: orders.number } })
      .from(fbMessages)
      .innerJoin(orders, eq(orders.id, fbMessages.orderId))
      .where(notInArray(fbMessages.status, ["sent"]))
      .orderBy(desc(fbMessages.id))
      .limit(20),
    getFbOrderSettings(),
  ]);

  /* numbers for the period */
  const sum = (pick: (r: (typeof claimStats)[number]) => boolean) => claimStats.filter(pick).reduce((n, r) => n + Number(r.n), 0);
  const comments = sum(() => true);
  const orderedAuto = sum((r) => r.status === "ordered" && r.orderedBy === "auto");
  const orderedAll = sum((r) => r.status === "ordered");
  const pending = sum((r) => r.status === "pending");
  const unclear = sum((r) => r.status === "rejected" && r.skipReason === "unclear");
  const answers = sum((r) => r.status === "rejected" && (r.skipReason === "reply" || r.skipReason === "author"));
  const dismissed = sum((r) => r.status === "rejected" && (r.skipReason === "admin" || r.skipReason == null));
  const pieces = claimStats.filter((r) => r.status === "ordered").reduce((n, r) => n + Number(r.qty), 0);
  const messages = Object.fromEntries(messageStats.map((m) => [m.status, Number(m.n)])) as Partial<Record<"pending" | "sent" | "failed", number>>;

  /* comments to look at */
  const productIds = [...new Set(review.map((r) => r.post.productId).filter((v): v is number => v != null))];
  const reviewProducts = productIds.length ? await db.select({ id: products.id, stock: products.stock, colorOptions: products.colorOptions, colorStock: products.colorStock }).from(products).where(inArray(products.id, productIds)) : [];
  const productOf = new Map(reviewProducts.map((p) => [p.id, p]));
  const items: ReviewItem[] = review.map(({ claim, post }) => {
    const product = post.productId != null ? productOf.get(post.productId) : undefined;
    const hasProduct = post.productId != null ? Boolean(product) : post.price != null;
    const unclearClaim = claim.status === "rejected";
    const read = quantityOf(claim.comment);
    const why = unclearClaim
      ? "Скриптът не откри бройка в коментара и не го брои за поръчка."
      : !hasProduct
        ? "Постът още няма избран продукт от сайта."
        : post.closedAt
          ? "Събирането от този пост е спряно."
          : product && product.colorOptions.length > 0
            ? "Продуктът е с цветове: трябва да се избере цвят."
            : !read.sure || read.qty !== claim.qty
              ? "Бройката не е написана ясно."
              : product && product.stock < claim.qty
                ? `Няма достатъчна наличност в сайта (${product.stock} бр).`
                : !orderSettings.auto
                  ? "Автоматичното добавяне е изключено."
                  : "Ще се добави при следващото събиране.";
    return {
      claim,
      post: { id: post.id, name: post.productName, url: post.url, hasProduct },
      colors: product?.colorOptions ?? [],
      stock: product ? product.stock : null,
      why,
      unclear: unclearClaim,
    };
  });

  /* how much of each product people asked for */
  const demand = new Map<string, ProductDemand>();
  const row = (productId: number | null, name: string) => {
    const key = productId != null ? `p${productId}` : `n${name}`;
    let d = demand.get(key);
    if (!d) demand.set(key, (d = { key, productId, name, ordered: 0, people: 0, ready: 0, waiting: 0, stock: null }));
    return d;
  };
  for (const r of demandRows) {
    const d = row(r.productId, r.name);
    d.ordered += Number(r.ordered);
    d.ready += Number(r.ready);
    d.people += Number(r.people);
  }
  for (const r of waitingRows) row(r.productId, r.name).waiting += Number(r.qty);
  const demandIds = [...demand.values()].map((d) => d.productId).filter((v): v is number => v != null);
  if (demandIds.length) {
    const stocks = await db.select({ id: products.id, stock: products.stock, name: products.name, unit: products.unit }).from(products).where(inArray(products.id, demandIds));
    for (const s of stocks) {
      const d = demand.get(`p${s.id}`);
      if (d) Object.assign(d, { stock: s.stock, name: `${s.name} ${s.unit}`.trim() });
    }
  }

  /* comments and orders per day, the last two weeks */
  const perDay = new Map<string, { comments: number; ordered: number }>();
  for (let i = 13; i >= 0; i--) perDay.set(dayInSofia(Date.now() - i * 86400000), { comments: 0, ordered: 0 });
  for (const c of chartRows) {
    const day = perDay.get(dayInSofia(c.createdAt));
    if (!day) continue;
    day.comments++;
    if (c.status === "ordered") day.ordered++;
  }

  return {
    /** The moment these numbers were read, for "преди 5 мин". */
    now: Date.now(),
    state,
    runs,
    lastRun: runs[0] ?? null,
    stats: {
      comments,
      orderedAll,
      orderedAuto,
      orderedByHand: orderedAll - orderedAuto,
      pending,
      unclear,
      answers,
      dismissed,
      pieces,
      replied: Number(repliedRow[0]?.n ?? 0),
      messages: { sent: messages.sent ?? 0, failed: messages.failed ?? 0, pending: messages.pending ?? 0 },
      orders: Number(orderStats[0]?.orders ?? 0),
      people: Number(orderStats[0]?.people ?? 0),
      total: Number(orderStats[0]?.total ?? 0),
      readyOrders: Number(orderStats[0]?.ready ?? 0),
    },
    posts: posts.map((p) => ({ ...p, comments: Number(p.comments), ordered: Number(p.ordered), orderedQty: Number(p.orderedQty), pending: Number(p.pending), unclear: Number(p.unclear) })),
    review: items,
    demand: [...demand.values()].sort((a, b) => b.ordered + b.waiting - (a.ordered + a.waiting)),
    days: [...perDay.entries()].map(([day, v]) => ({ day, ...v })),
    openMessages: failedMessages,
    /** The days collecting covers; none when every post counts. */
    periods: orderSettings.periods,
  };
}

export type FbDashboard = Awaited<ReturnType<typeof fbDashboard>>;
