import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { Search, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle, Panel, td, th } from "@/components/admin/bits";
import { BULK_FORM, BulkStatusBar, SelectAllOrders } from "@/components/admin/BulkStatus";
import { FlagBadge } from "@/components/admin/Flag";
import { StatusPill } from "@/components/StatusPill";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { ORDER_STATUSES, orders, type OrderStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { findFlag, getFlagIndex } from "@/lib/flags";
import { formatDate, formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, ORDER_STATUS_LABELS } from "@/lib/site";
import { searchVariants } from "@/lib/translit";

export const metadata: Metadata = { title: "Поръчки" };

/**
 * Orders matching a free-text search: number, name, email, city or phone.
 * Bidirectionally transliterates between Cyrillic and Latin (e.g. "венета" matches "veneta" and vice-versa)
 * and generates case variants to support SQLite's case matching on Cyrillic text.
 */
function searchWhere(q: string): SQL | undefined {
  const text = q.trim().replace(/[%_]/g, "");
  if (!text) return undefined;

  const forms = searchVariants(text);
  const conds: SQL[] = forms.flatMap((f) => [
    like(orders.number, `%${f}%`),
    like(orders.name, `%${f}%`),
    like(orders.email, `%${f}%`),
    like(orders.city, `%${f}%`),
  ]);

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const wordGroups: (SQL | undefined)[] = words.map((w) => {
      const wForms = searchVariants(w);
      const wConds = wForms.flatMap((f) => [
        like(orders.number, `%${f}%`),
        like(orders.name, `%${f}%`),
        like(orders.email, `%${f}%`),
        like(orders.city, `%${f}%`),
      ]);
      return or(...wConds);
    });
    const validGroups = wordGroups.filter(Boolean) as SQL[];
    if (validGroups.length > 0) {
      conds.push(and(...validGroups)!);
    }
  }

  // Also match linked registered user profile (name or email) in case recipient name differed
  const userForms = forms.slice(0, 12);
  const userChecks = userForms.flatMap((f) => [
    sql`users.name like ${`%${f}%`}`,
    sql`users.email like ${`%${f}%`}`,
  ]);
  if (userChecks.length > 0) {
    conds.push(
      sql`exists (select 1 from users where users.id = ${orders.userId} and (${sql.join(userChecks, sql` or `)}))`
    );
  }

  const digits = text.replace(/\D/g, "");
  if (digits.length >= 3) {
    const phone = sql`replace(replace(replace(replace(${orders.phone}, ' ', ''), '-', ''), '+', ''), '/', '')`;
    conds.push(sql`${phone} like ${`%${digits}%`}`);
    if (digits.startsWith("0")) conds.push(sql`${phone} like ${`%${digits.slice(1)}%`}`);
  }

  return or(...conds);
}

async function AdminOrders({ searchParams }: Pick<PageProps<"/admin/porachki">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = ORDER_STATUSES.find((s) => s === sp.status) as OrderStatus | undefined;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const search = searchWhere(q);

  const [list, counts, flags] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(and(search, status ? eq(orders.status, status) : undefined))
      .orderBy(desc(orders.createdAt))
      .limit(200),
    // The tab counts follow the search, so they say how many matches each status has.
    db.select({ status: orders.status, n: sql<number>`count(*)` }).from(orders).where(search).groupBy(orders.status),
    getFlagIndex(),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const all = counts.reduce((sum, c) => sum + c.n, 0);

  const tab = (active: boolean) =>
    `inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition ${active ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`;
  const href = (s?: string) => {
    const qs = new URLSearchParams();
    if (s) qs.set("status", s);
    if (q) qs.set("q", q);
    const str = qs.toString();
    return str ? `/admin/porachki?${str}` : "/admin/porachki";
  };

  return (
    <>
      <PageTitle title="Поръчки" />
      <form action="/admin/porachki" role="search" className="mb-4 flex max-w-2xl gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <label htmlFor="orders-q" className="sr-only">
          Търсене в поръчките
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            id="orders-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Номер, име, телефон, имейл или град…"
            autoComplete="off"
            className="field h-11 bg-paper pl-11"
          />
        </div>
        <button type="submit" className={`${btn.primary} h-11 px-5`}>
          Търси
        </button>
        {q && (
          <Link href={href(status)} className={`${btn.ghost} h-11 px-4`} aria-label="Изчисти търсенето">
            <X className="h-4 w-4" />
          </Link>
        )}
      </form>
      <ul className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        <li>
          <Link href={href()} className={tab(!status)}>
            Всички <span className="opacity-60">{all}</span>
          </Link>
        </li>
        {ORDER_STATUSES.map((s) => (
          <li key={s}>
            <Link href={href(s)} className={tab(status === s)}>
              {ORDER_STATUS_LABELS[s]} <span className="opacity-60">{countOf(s)}</span>
            </Link>
          </li>
        ))}
      </ul>

      {list.length > 0 && <BulkStatusBar />}
      <Panel>
        {list.length === 0 ? (
          <p className="px-5 py-14 text-center text-ink-soft">{q ? `Няма поръчки за „${q}“${status ? " с този статус" : ""}.` : "Няма поръчки с този статус."}</p>
        ) : (
          <div className="overflow-x-auto p-1">
            <table className="w-full min-w-[46rem] text-[0.95rem]">
              <thead>
                <tr>
                  <th className={`${th} w-10`}>
                    <SelectAllOrders />
                  </th>
                  <th className={th}>Номер</th>
                  <th className={th}>Клиент</th>
                  <th className={th}>Доставка</th>
                  <th className={th}>Статус</th>
                  <th className={`${th} text-right`}>Сума</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((o) => (
                  <tr key={o.id} className="transition hover:bg-sand/60">
                    <td className={td}>
                      <input type="checkbox" form={BULK_FORM} name="ids" value={o.id} aria-label={`Избери ${o.number}`} className="h-5 w-5 accent-[#1f5c3f]" />
                    </td>
                    <td className={td}>
                      <Link href={`/admin/porachki/${o.id}`} className="font-semibold hover:text-forest">
                        {o.number}
                      </Link>
                      <p className="text-xs text-ink-soft">
                        {formatDate(o.createdAt)}
                        {o.source === "facebook" && <span className="ml-1.5 rounded bg-[#e2ecfb] px-1.5 py-0.5 text-[0.65rem] font-bold text-[#1b3f7a]">Facebook</span>}
                      </p>
                    </td>
                    <td className={td}>
                      {o.name}
                      {findFlag(flags, { userId: o.userId, email: o.email, phone: o.phone }) && <FlagBadge className="ml-2 align-middle" />}
                      <p className="text-xs text-ink-soft">{o.phone}</p>
                    </td>
                    <td className={td}>
                      {DELIVERY_METHODS.find((d) => d.id === o.delivery)?.label ?? o.delivery}
                      <p className="text-xs text-ink-soft">{o.city}</p>
                    </td>
                    <td className={td}>
                      <StatusPill status={o.status} />
                      {o.status === "cancelled" && o.note?.includes("Отказана от клиента") && (
                        <p className="mt-1 text-[11px] font-semibold text-red-700">от клиента</p>
                      )}
                    </td>
                    <td className={`${td} text-right font-semibold tabular-nums`}>{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/porachki">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminOrders searchParams={searchParams} />
    </Suspense>
  );
}
