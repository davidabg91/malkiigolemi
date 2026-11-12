import { desc, isNotNull, sql } from "drizzle-orm";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle, Panel, td, th } from "@/components/admin/bits";
import { FlagBadge } from "@/components/admin/Flag";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { findFlag, getFlagIndex } from "@/lib/flags";
import { formatDate, formatPrice } from "@/lib/format";
import { matchesSearch } from "@/lib/translit";

export const metadata: Metadata = { title: "Потребители" };

async function AdminUsers({ searchParams }: Pick<PageProps<"/admin/potrebiteli">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const onlyFlagged = sp.filter === "flagged";

  const [all, perUser, flags] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)),
    db
      .select({
        userId: orders.userId,
        count: sql<number>`count(*)`,
        cancelled: sql<number>`coalesce(sum(case when ${orders.status} = 'cancelled' then 1 else 0 end), 0)`,
        spent: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then ${orders.total} else 0 end), 0)`,
        last: sql<number>`max(${orders.createdAt})`,
      })
      .from(orders)
      .where(isNotNull(orders.userId))
      .groupBy(orders.userId),
    getFlagIndex(),
  ]);
  const statsOf = new Map(perUser.map((s) => [s.userId, s]));

  const rows = all.map((u) => ({ user: u, stats: statsOf.get(u.id), flag: findFlag(flags, { userId: u.id, email: u.email, phone: u.phone }) }));
  const flaggedCount = rows.filter((r) => r.flag).length;
  // Filtered with bilingual transliteration so "венета" matches "veneta" and vice-versa
  const list = rows.filter(
    (r) =>
      (!onlyFlagged || r.flag) &&
      (!q || matchesSearch([r.user.name, r.user.email, r.user.phone], q)),
  );

  const tab = (active: boolean) =>
    `inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition ${active ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`;
  const withQuery = (filter?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter) params.set("filter", filter);
    const qs = params.toString();
    return qs ? `/admin/potrebiteli?${qs}` : "/admin/potrebiteli";
  };

  return (
    <>
      <PageTitle title="Потребители" sub="Всички регистрирани клиенти, техните поръчки и оборот." />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex gap-2">
          <li>
            <Link href={withQuery()} className={tab(!onlyFlagged)}>
              Всички <span className="opacity-60">{rows.length}</span>
            </Link>
          </li>
          <li>
            <Link href={withQuery("flagged")} className={tab(onlyFlagged)}>
              Некоректни <span className="opacity-60">{flaggedCount}</span>
            </Link>
          </li>
        </ul>
        <form action="/admin/potrebiteli" className="flex w-full gap-2 sm:w-auto" role="search">
          {onlyFlagged && <input type="hidden" name="filter" value="flagged" />}
          <label htmlFor="user-search" className="sr-only">
            Търси по име, имейл или телефон
          </label>
          <div className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <input id="user-search" name="q" type="search" defaultValue={q} placeholder="Име, имейл или телефон" className="field pl-10" />
          </div>
          <button type="submit" className={btn.sm}>
            Търси
          </button>
        </form>
      </div>

      <Panel>
        {list.length === 0 ? (
          <p className="px-5 py-14 text-center text-ink-soft">{q || onlyFlagged ? "Няма потребители, които отговарят на търсенето." : "Още няма регистрирани потребители."}</p>
        ) : (
          <div className="overflow-x-auto p-1">
            <table className="w-full min-w-[52rem] text-[0.95rem]">
              <thead>
                <tr>
                  <th className={th}>Клиент</th>
                  <th className={th}>Телефон</th>
                  <th className={th}>Регистриран</th>
                  <th className={`${th} text-right`}>Поръчки</th>
                  <th className={`${th} text-right`}>Оборот</th>
                  <th className={th}>Последна поръчка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map(({ user: u, stats, flag }) => (
                  <tr key={u.id} className={`transition hover:bg-sand/60 ${flag ? "bg-tomato/5" : ""}`}>
                    <td className={td}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/potrebiteli/${u.id}`} className="font-semibold hover:text-forest">
                          {u.name}
                        </Link>
                        {flag && <FlagBadge />}
                        {u.role === "admin" && (
                          <span className="rounded-full bg-ink px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-lime">Админ</span>
                        )}
                      </div>
                      <p className="text-xs text-ink-soft">{u.email}</p>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{u.phone || <span className="text-ink-soft">—</span>}</td>
                    <td className={`${td} whitespace-nowrap text-sm text-ink-soft`}>{formatDate(u.createdAt)}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {stats?.count ?? 0}
                      {stats && stats.cancelled > 0 && <p className="text-xs text-tomato">{stats.cancelled} отказани</p>}
                    </td>
                    <td className={`${td} text-right font-semibold tabular-nums`}>{formatPrice(stats?.spent ?? 0)}</td>
                    <td className={`${td} whitespace-nowrap text-sm text-ink-soft`}>{stats?.last ? formatDate(stats.last * 1000) : "—"}</td>
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

export default function Page({ searchParams }: PageProps<"/admin/potrebiteli">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminUsers searchParams={searchParams} />
    </Suspense>
  );
}
