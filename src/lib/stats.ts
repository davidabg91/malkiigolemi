import "server-only";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, orderItems, orders, products, users } from "@/db/schema";
import { COURIERS, isCourierId } from "./couriers";
import { getFlagIndex } from "./flags";
import { DELIVERY_METHODS, ORDER_STATUS_LABELS } from "./site";

export const PERIODS = [
  { id: "7", label: "7 дни", days: 7 },
  { id: "30", label: "30 дни", days: 30 },
  { id: "90", label: "90 дни", days: 90 },
  { id: "365", label: "12 месеца", days: 365 },
  { id: "all", label: "От началото", days: null },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];

const DAY = 86_400_000;
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const WEEKDAY_NAMES = ["понеделник", "вторник", "сряда", "четвъртък", "петък", "събота", "неделя"];

// The shop lives in Bulgarian time; the server (and the database) run in UTC.
const sofia = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Sofia",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  weekday: "short",
  hour12: false,
});
const EN_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function sofiaParts(date: Date) {
  const p = Object.fromEntries(sofia.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    month: `${p.year}-${p.month}`,
    hour: Number(p.hour) % 24,
    weekday: EN_WEEKDAYS.indexOf(p.weekday),
  };
}

const MONTHS = ["яну", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"];
const dayLabel = (key: string) => `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;

export type Ranked = { key: string; label: string; sub?: string; value: number; href?: string };

function top<T>(map: Map<string, T>, value: (v: T) => number, n: number): [string, T][] {
  return [...map.entries()].sort((a, b) => value(b[1]) - value(a[1])).slice(0, n);
}

export async function getStats(periodId: PeriodId) {
  const period = PERIODS.find((p) => p.id === periodId) ?? PERIODS[1];
  const now = Date.now();
  const from = period.days ? now - period.days * DAY : 0;
  const prevFrom = period.days ? from - period.days * DAY : 0;

  const [orderRows, itemRows, productRows, categoryRows, userRows, lifetime, flags] = await Promise.all([
    db
      .select({
        id: orders.id,
        createdAt: orders.createdAt,
        total: orders.total,
        status: orders.status,
        userId: orders.userId,
        name: orders.name,
        email: orders.email,
        delivery: orders.delivery,
        courier: orders.courier,
        city: orders.city,
        note: orders.note,
      })
      .from(orders)
      .where(period.days ? gte(orders.createdAt, new Date(prevFrom)) : undefined),
    db
      .select({ productId: orderItems.productId, name: orderItems.name, qty: orderItems.qty, price: orderItems.price })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(ne(orders.status, "cancelled"), period.days ? gte(orders.createdAt, new Date(from)) : undefined)),
    db
      .select({ id: products.id, name: products.name, unit: products.unit, price: products.price, stock: products.stock, active: products.active, categoryId: products.categoryId })
      .from(products),
    db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories),
    db.select({ createdAt: users.createdAt, role: users.role }).from(users),
    // How many orders each customer has ever kept, to tell first-time buyers from returning ones.
    db
      .select({ email: sql<string>`lower(${orders.email})`, n: sql<number>`count(*)` })
      .from(orders)
      .where(ne(orders.status, "cancelled"))
      .groupBy(sql`lower(${orders.email})`),
    getFlagIndex(),
  ]);

  const inPeriod = orderRows.filter((o) => o.createdAt.getTime() >= from);
  const before = period.days ? orderRows.filter((o) => o.createdAt.getTime() < from) : [];
  const kept = inPeriod.filter((o) => o.status !== "cancelled");
  const keptBefore = before.filter((o) => o.status !== "cancelled");
  const cancelled = inPeriod.filter((o) => o.status === "cancelled");
  const sum = (list: { total: number }[]) => list.reduce((s, o) => s + o.total, 0);

  const revenue = sum(kept);
  const units = itemRows.reduce((s, i) => s + i.qty, 0);
  const customers = userRows.filter((u) => u.role === "customer");
  const newUsers = customers.filter((u) => u.createdAt.getTime() >= from).length;
  const newUsersBefore = period.days ? customers.filter((u) => u.createdAt.getTime() >= prevFrom && u.createdAt.getTime() < from).length : null;

  // The span the period really covers, for "per day" maths (a brand-new shop has no 12 months of history).
  const firstOrder = orderRows.reduce((min, o) => Math.min(min, o.createdAt.getTime()), now);
  const spanDays = Math.max(1, period.days ?? Math.ceil((now - firstOrder) / DAY));

  // ── revenue over time
  const monthly = !period.days || period.days > 90;
  const buckets = new Map<string, { revenue: number; orders: number }>();
  const start = period.days ? from : firstOrder;
  for (let t = start; ; t += DAY) {
    const parts = sofiaParts(new Date(Math.min(t, now)));
    buckets.set(monthly ? parts.month : parts.day, { revenue: 0, orders: 0 });
    if (t >= now) break;
  }
  for (const o of kept) {
    const parts = sofiaParts(o.createdAt);
    const bucket = buckets.get(monthly ? parts.month : parts.day);
    if (bucket) {
      bucket.revenue += o.total;
      bucket.orders += 1;
    }
  }
  const series = [...buckets.entries()].map(([key, v]) => ({ key, label: monthly ? monthLabel(key) : dayLabel(key), ...v }));

  // ── products
  const productOf = new Map(productRows.map((p) => [p.id, p]));
  const categoryOf = new Map(categoryRows.map((c) => [c.id, c]));
  const sold = new Map<string, { label: string; qty: number; revenue: number; productId: number | null }>();
  const soldQtyById = new Map<number, number>();
  const byCategory = new Map<string, { label: string; qty: number; revenue: number }>();
  for (const i of itemRows) {
    const product = i.productId != null ? productOf.get(i.productId) : undefined;
    const key = product ? `p${product.id}` : `n${i.name}`;
    const line = sold.get(key) ?? { label: product ? `${product.name} ${product.unit}`.trim() : i.name, qty: 0, revenue: 0, productId: product?.id ?? null };
    line.qty += i.qty;
    line.revenue += i.qty * i.price;
    sold.set(key, line);
    if (product) soldQtyById.set(product.id, (soldQtyById.get(product.id) ?? 0) + i.qty);

    const category = product ? categoryOf.get(product.categoryId) : undefined;
    const root = category?.parentId ? categoryOf.get(category.parentId) : category;
    const cKey = root ? `c${root.id}` : "none";
    const cLine = byCategory.get(cKey) ?? { label: root?.name ?? "Без категория", qty: 0, revenue: 0 };
    cLine.qty += i.qty;
    cLine.revenue += i.qty * i.price;
    byCategory.set(cKey, cLine);
  }
  const productRow = (by: "qty" | "revenue") => (entry: [string, { label: string; qty: number; revenue: number; productId: number | null }]): Ranked => ({
    key: entry[0],
    label: entry[1].label,
    value: entry[1][by],
    sub: by === "qty" ? undefined : `${entry[1].qty} бр`,
    href: entry[1].productId ? `/admin/produkti/${entry[1].productId}` : undefined,
  });
  const topByQty = top(sold, (v) => v.qty, 10).map(productRow("qty"));
  const topByRevenue = top(sold, (v) => v.revenue, 10).map(productRow("revenue"));
  const categoriesByRevenue: Ranked[] = top(byCategory, (v) => v.revenue, 8).map(([key, v]) => ({ key, label: v.label, value: v.revenue, sub: `${v.qty} бр` }));

  // ── stock
  const active = productRows.filter((p) => p.active);
  const runningOut = active
    .map((p) => {
      const qty = soldQtyById.get(p.id) ?? 0;
      const perDay = qty / spanDays;
      return { id: p.id, name: `${p.name} ${p.unit}`.trim(), stock: p.stock, soldQty: qty, daysLeft: perDay > 0 ? p.stock / perDay : Infinity };
    })
    .filter((p) => p.soldQty > 0 && p.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);
  const unsold = active.filter((p) => p.stock > 0 && !soldQtyById.has(p.id));
  const deadStock = unsold
    .map((p) => ({ id: p.id, name: `${p.name} ${p.unit}`.trim(), stock: p.stock, value: p.stock * p.price }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── customers
  const lifetimeOf = new Map(lifetime.map((l) => [l.email, l.n]));
  const byCustomer = new Map<string, { name: string; email: string; userId: number | null; orders: number; spent: number }>();
  for (const o of kept) {
    const email = o.email.toLowerCase();
    const c = byCustomer.get(email) ?? { name: o.name, email, userId: null, orders: 0, spent: 0 };
    c.orders += 1;
    c.spent += o.total;
    c.userId ??= o.userId;
    byCustomer.set(email, c);
  }
  const returning = [...byCustomer.keys()].filter((email) => (lifetimeOf.get(email) ?? 0) >= 2).length;
  const topCustomers = top(byCustomer, (v) => v.spent, 8).map(([, c]) => c);

  // ── delivery, places, timing, statuses
  const tally = <T,>(list: T[], keyOf: (x: T) => string | null) => {
    const map = new Map<string, number>();
    for (const x of list) {
      const key = keyOf(x);
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  };
  const ranked = (map: Map<string, number>, labelOf: (key: string) => string, n = 8): Ranked[] =>
    top(map, (v) => v, n).map(([key, value]) => ({ key, label: labelOf(key), value }));

  const byMethod = ranked(tally(kept, (o) => o.delivery), (k) => DELIVERY_METHODS.find((d) => d.id === k)?.label ?? k);
  const byCourier = ranked(tally(kept, (o) => (o.delivery === "store" ? null : o.courier)), (k) => (isCourierId(k) ? COURIERS[k].name : k));
  const byCity = ranked(tally(kept, (o) => o.city.trim() || null), (k) => k);
  const byStatus: Ranked[] = Object.keys(ORDER_STATUS_LABELS).map((s) => ({
    key: s,
    label: ORDER_STATUS_LABELS[s],
    value: inPeriod.filter((o) => o.status === s).length,
  }));

  const weekdays = WEEKDAYS.map((label, i) => ({ key: String(i), label, value: 0 }));
  const hours = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: `${h}:00`, value: 0 }));
  for (const o of inPeriod) {
    const parts = sofiaParts(o.createdAt);
    if (parts.weekday >= 0) weekdays[parts.weekday].value += 1;
    hours[parts.hour].value += 1;
  }
  const busiestDay = weekdays.reduce((a, b) => (b.value > a.value ? b : a));
  const busiestHour = hours.reduce((a, b) => (b.value > a.value ? b : a));

  return {
    period,
    comparable: Boolean(period.days),
    kpis: {
      revenue: { now: revenue, prev: period.days ? sum(keptBefore) : null },
      orders: { now: kept.length, prev: period.days ? keptBefore.length : null },
      average: {
        now: kept.length ? Math.round(revenue / kept.length) : 0,
        prev: period.days && keptBefore.length ? Math.round(sum(keptBefore) / keptBefore.length) : null,
      },
      units,
      unitsPerOrder: kept.length ? units / kept.length : 0,
      newUsers: { now: newUsers, prev: newUsersBefore },
      cancelled: {
        now: cancelled.length,
        prev: period.days ? before.length - keptBefore.length : null,
        value: sum(cancelled),
        rate: inPeriod.length ? cancelled.length / inPeriod.length : 0,
        byCustomer: cancelled.filter((o) => o.note?.includes("Отказана от клиента")).length,
      },
    },
    series,
    monthly,
    topByQty,
    topByRevenue,
    categoriesByRevenue,
    stock: {
      runningOut,
      deadStock,
      unsoldCount: unsold.length,
      unsoldValue: unsold.reduce((s, p) => s + p.stock * p.price, 0),
      outOfStock: active.filter((p) => p.stock === 0).length,
      activeProducts: active.length,
    },
    customers: {
      registered: customers.length,
      buyers: byCustomer.size,
      returning,
      guestOrders: kept.filter((o) => o.userId == null).length,
      keptOrders: kept.length,
      flagged: flags.count,
      top: topCustomers,
    },
    byMethod,
    byCourier,
    byCity,
    byStatus,
    weekdays,
    hours,
    busiest: inPeriod.length ? { day: WEEKDAY_NAMES[Number(busiestDay.key)], hour: Number(busiestHour.key) } : null,
    totalOrders: inPeriod.length,
  };
}

export type Stats = Awaited<ReturnType<typeof getStats>>;
