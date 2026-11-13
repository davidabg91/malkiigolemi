import "server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { categories, events, orderItems, orders, products } from "@/db/schema";

const sofia = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });

function sofiaNow(date = new Date()) {
  const p = Object.fromEntries(sofia.formatToParts(date).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|facebookexternalhit|curl|wget|python|scrapy/i;

/**
 * A visitor's id for today: a keyed hash of the day, IP address and browser. It changes every day and
 * cannot be turned back into either, so no cookie is needed. Null for bots.
 */
export function visitorOf(headers: Headers): string | null {
  const ua = headers.get("user-agent") ?? "";
  if (!ua || BOTS.test(ua)) return null;
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.SESSION_SECRET ?? "dev")
    .update(`${sofiaNow().day}|${ip}|${ua}`)
    .digest("hex")
    .slice(0, 16);
}

/** What kind of page a path is; the statistics group by this. */
export function pageKind(path: string) {
  if (path === "/") return "home";
  const first = path.split("/")[1];
  const kinds: Record<string, string> = {
    produkt: "product",
    kategoria: "category",
    marka: "brand",
    tarsene: "search",
    kolichka: "cart",
    porachka: path === "/porachka" ? "checkout" : "order",
    produkti: "listing",
    novi: "listing",
    promo: "listing",
    lyubimi: "wishlist",
    profil: "account",
    vhod: "account",
    registratsiya: "account",
  };
  return kinds[first] ?? "info";
}

const batch = z.object({
  d: z.enum(["mobile", "desktop"]),
  e: z
    .array(
      z.object({
        t: z.enum(["view", "time", "click", "cart_add"]),
        p: z.string().startsWith("/").max(200),
        l: z.string().max(80).optional(),
        id: z.number().int().positive().optional(),
        v: z.number().int().min(0).max(1800).optional(),
        r: z.string().max(60).optional(),
      }),
    )
    .min(1)
    .max(40),
});

/** Stores one batch from the browser. Returns false for anything malformed. */
export async function recordBatch(visitor: string, raw: unknown) {
  const parsed = batch.safeParse(raw);
  if (!parsed.success) return false;
  const { day, hour } = sofiaNow();
  await db.insert(events).values(
    parsed.data.e
      .filter((e) => !e.p.startsWith("/admin") && !e.p.startsWith("/api"))
      .map((e) => ({
        day,
        hour,
        visitor,
        type: e.t,
        path: e.p,
        kind: pageKind(e.p),
        label: e.l?.trim() || null,
        productId: e.t === "cart_add" ? (e.id ?? null) : null,
        value: e.t === "time" ? (e.v ?? null) : null,
        source: e.t === "view" ? (e.r?.trim().toLowerCase() || null) : null,
        device: parsed.data.d,
      })),
  );
  return true;
}

/** An order placed in the shop, so the funnel can end in "поръчаха". */
export async function recordOrder(visitor: string, total: number) {
  const { day, hour } = sofiaNow();
  await db.insert(events).values({ day, hour, visitor, type: "order", path: "/porachka", kind: "checkout", value: total }).catch(() => {});
}

/** Statistics older than this are deleted (see the daily cron). */
export const KEEP_DAYS = 90;

export async function pruneEvents() {
  const cutoff = sofiaNow(new Date(Date.now() - KEEP_DAYS * 86_400_000)).day;
  await db.delete(events).where(lt(events.day, cutoff));
}

export const VISIT_PERIODS = [
  { id: "1", label: "Днес", days: 1 },
  { id: "7", label: "7 дни", days: 7 },
  { id: "30", label: "30 дни", days: 30 },
  { id: "90", label: "90 дни", days: 90 },
] as const;
export type VisitPeriodId = (typeof VISIT_PERIODS)[number]["id"];

const MONTHS = ["яну", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"];
const dayLabel = (key: string) => `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;

const KIND_LABELS: Record<string, string> = {
  home: "Начална страница",
  product: "Страници на продукти",
  category: "Категории",
  brand: "Марки",
  search: "Търсене",
  cart: "Количка",
  checkout: "Завършване на поръчка",
  order: "Потвърдена поръчка",
  listing: "Всички / нови / промоции",
  wishlist: "Любими",
  account: "Профил и вход",
  info: "Информационни страници",
};

const n = sql<number>`count(*)`;
const visitors = sql<number>`count(distinct ${events.visitor})`;

export async function getVisitStats(periodId: VisitPeriodId) {
  const period = VISIT_PERIODS.find((p) => p.id === periodId) ?? VISIT_PERIODS[1];
  const today = sofiaNow().day;
  const days = Array.from({ length: period.days }, (_, i) => sofiaNow(new Date(Date.now() - (period.days - 1 - i) * 86_400_000)).day);
  const from = days[0];
  const prevFrom = sofiaNow(new Date(Date.now() - (period.days * 2 - 1) * 86_400_000)).day;
  const inPeriod = gte(events.day, from);
  const of = (type: (typeof events.type.enumValues)[number]) => and(inPeriod, eq(events.type, type));

  const [byDay, byHour, totals, prevTotals, time, timeByKind, kinds, productViews, cartAdds, categoryPages, clicks, searches, sources, devices, funnelRows, live, orderTotals] =
    await Promise.all([
      db
        .select({ day: events.day, visitors, views: sql<number>`sum(case when ${events.type} = 'view' then 1 else 0 end)` })
        .from(events)
        .where(inPeriod)
        .groupBy(events.day),
      db.select({ hour: events.hour, n }).from(events).where(of("view")).groupBy(events.hour),
      db.select({ visitors, views: sql<number>`coalesce(sum(case when ${events.type} = 'view' then 1 else 0 end), 0)` }).from(events).where(inPeriod),
      db.select({ visitors }).from(events).where(and(gte(events.day, prevFrom), lt(events.day, from))),
      // Time per visit: the seconds each visitor's pages were on screen that day, added up.
      db
        .select({ visits: sql<number>`count(*)`, seconds: sql<number>`coalesce(sum(s), 0)`, short: sql<number>`coalesce(sum(case when s < 10 then 1 else 0 end), 0)` })
        .from(
          db
            .select({ s: sql<number>`sum(${events.value})`.as("s") })
            .from(events)
            .where(of("time"))
            .groupBy(events.visitor)
            .as("per_visit"),
        ),
      db.select({ kind: events.kind, seconds: sql<number>`sum(${events.value})`, n }).from(events).where(of("time")).groupBy(events.kind),
      db.select({ kind: events.kind, n, visitors }).from(events).where(of("view")).groupBy(events.kind),
      db
        .select({ id: products.id, name: products.name, unit: products.unit, categoryId: products.categoryId, n, visitors })
        .from(events)
        .innerJoin(products, eq(events.path, sql`'/produkt/' || ${products.slug}`))
        .where(of("view"))
        .groupBy(products.id),
      db
        .select({ id: products.id, name: products.name, unit: products.unit, n, visitors })
        .from(events)
        .innerJoin(products, eq(events.productId, products.id))
        .where(of("cart_add"))
        .groupBy(products.id),
      db
        .select({ id: categories.id, n })
        .from(events)
        .innerJoin(categories, eq(events.path, sql`'/kategoria/' || ${categories.slug}`))
        .where(of("view"))
        .groupBy(categories.id),
      db.select({ label: events.label, n, visitors }).from(events).where(of("click")).groupBy(events.label).orderBy(sql`count(*) desc`).limit(15),
      db
        .select({ label: events.label, n })
        .from(events)
        .where(and(of("view"), eq(events.kind, "search"), sql`${events.label} is not null`))
        .groupBy(events.label)
        .orderBy(sql`count(*) desc`)
        .limit(12),
      db.select({ source: events.source, n }).from(events).where(and(of("view"), sql`${events.source} is not null`)).groupBy(events.source).orderBy(sql`count(*) desc`).limit(8),
      db.select({ device: events.device, visitors }).from(events).where(of("view")).groupBy(events.device),
      // One row per visitor: how far down the path to an order they got.
      db
        .select({
          product: sql<number>`max(case when ${events.type} = 'view' and ${events.kind} = 'product' then 1 else 0 end)`,
          cart: sql<number>`max(case when ${events.type} = 'cart_add' then 1 else 0 end)`,
          checkout: sql<number>`max(case when ${events.type} = 'view' and ${events.kind} = 'checkout' then 1 else 0 end)`,
          order: sql<number>`max(case when ${events.type} = 'order' then 1 else 0 end)`,
        })
        .from(events)
        .where(inPeriod)
        .groupBy(events.visitor),
      db
        .select({ visitors })
        .from(events)
        .where(and(eq(events.day, today), gte(events.createdAt, new Date(Date.now() - 5 * 60_000)))),
      db.select({ value: sql<number>`coalesce(sum(${events.value}), 0)` }).from(events).where(of("order")),
    ]);

  // Units sold per product in the same days, to set next to "added to the cart".
  const addedIds = cartAdds.map((c) => c.id);
  const sold = addedIds.length
    ? await db
        .select({ id: orderItems.productId, qty: sql<number>`sum(${orderItems.qty})` })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(inArray(orderItems.productId, addedIds), gte(orders.createdAt, new Date(Date.now() - period.days * 86_400_000)), sql`${orders.status} != 'cancelled'`))
        .groupBy(orderItems.productId)
    : [];
  const soldOf = new Map(sold.map((s) => [s.id, Number(s.qty)]));

  const dayMap = new Map(byDay.map((d) => [d.day, d]));
  const series = days.map((key) => ({ key, label: dayLabel(key), visitors: Number(dayMap.get(key)?.visitors ?? 0), views: Number(dayMap.get(key)?.views ?? 0) }));
  const hourMap = new Map(byHour.map((h) => [h.hour, Number(h.n)]));
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, views: hourMap.get(h) ?? 0 }));

  // Categories: their own pages plus the pages of their products, rolled up to the top-level category.
  const cats = await db.select({ id: categories.id, name: categories.name, parentId: categories.parentId, slug: categories.slug }).from(categories);
  const catOf = new Map(cats.map((c) => [c.id, c]));
  const rootOf = (id: number | null) => {
    let c = id == null ? undefined : catOf.get(id);
    while (c?.parentId != null && catOf.get(c.parentId)) c = catOf.get(c.parentId);
    return c;
  };
  const catViews = new Map<number, { name: string; slug: string; pages: number; products: number }>();
  const bump = (id: number | null, field: "pages" | "products", by: number) => {
    const root = rootOf(id);
    if (!root) return;
    const row = catViews.get(root.id) ?? { name: root.name, slug: root.slug, pages: 0, products: 0 };
    row[field] += by;
    catViews.set(root.id, row);
  };
  for (const c of categoryPages) bump(c.id, "pages", Number(c.n));
  for (const p of productViews) bump(p.categoryId, "products", Number(p.n));

  const addsOf = new Map(cartAdds.map((c) => [c.id, Number(c.n)]));
  const funnel = {
    visitors: funnelRows.length,
    product: funnelRows.filter((r) => r.product).length,
    cart: funnelRows.filter((r) => r.cart).length,
    checkout: funnelRows.filter((r) => r.cart && r.checkout).length,
    order: funnelRows.filter((r) => r.order).length,
    /** Put something in the cart and left without ordering. */
    abandoned: funnelRows.filter((r) => r.cart && !r.order).length,
  };
  const timeRow = time[0];

  return {
    period,
    hasData: Number(totals[0]?.views ?? 0) > 0,
    live: Number(live[0]?.visitors ?? 0),
    kpis: {
      visitors: Number(totals[0]?.visitors ?? 0),
      prevVisitors: period.days === 90 ? null : Number(prevTotals[0]?.visitors ?? 0),
      views: Number(totals[0]?.views ?? 0),
      perDay: Number(totals[0]?.visitors ?? 0) / period.days,
      avgSeconds: Number(timeRow?.visits) ? Number(timeRow.seconds) / Number(timeRow.visits) : 0,
      /** Share of visits that left within 10 seconds. */
      bounce: Number(timeRow?.visits) ? Number(timeRow.short) / Number(timeRow.visits) : 0,
      orderValue: Number(orderTotals[0]?.value ?? 0),
    },
    series,
    hours,
    kinds: kinds
      .map((k) => ({ key: k.kind, label: KIND_LABELS[k.kind] ?? k.kind, value: Number(k.n), visitors: Number(k.visitors) }))
      .sort((a, b) => b.value - a.value),
    timeByKind: timeByKind
      .filter((k) => Number(k.n) > 0)
      .map((k) => ({ key: k.kind, label: KIND_LABELS[k.kind] ?? k.kind, value: Math.round(Number(k.seconds) / Number(k.n)) }))
      .sort((a, b) => b.value - a.value),
    products: productViews
      .map((p) => ({ id: p.id, name: `${p.name} ${p.unit}`.trim(), views: Number(p.n), visitors: Number(p.visitors), adds: addsOf.get(p.id) ?? 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15),
    categories: [...catViews.entries()]
      .map(([id, c]) => ({ id, name: c.name, slug: c.slug, value: c.pages + c.products, pages: c.pages, products: c.products }))
      .sort((a, b) => b.value - a.value),
    cartAdds: cartAdds
      .map((c) => ({ id: c.id, name: `${c.name} ${c.unit}`.trim(), adds: Number(c.n), visitors: Number(c.visitors), sold: soldOf.get(c.id) ?? 0 }))
      .sort((a, b) => b.adds - a.adds)
      .slice(0, 12),
    clicks: clicks.map((c) => ({ label: c.label ?? "—", value: Number(c.n), visitors: Number(c.visitors) })),
    searches: searches.map((s) => ({ label: s.label ?? "", value: Number(s.n) })),
    sources: sources.map((s) => ({ label: s.source ?? "", value: Number(s.n) })),
    devices: devices.map((d) => ({ device: d.device ?? "desktop", visitors: Number(d.visitors) })),
    funnel,
  };
}

export type VisitStats = Awaited<ReturnType<typeof getVisitStats>>;
