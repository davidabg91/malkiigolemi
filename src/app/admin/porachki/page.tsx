import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Panel, PageTitle, td, th } from "@/components/admin/bits";
import { StatusPill } from "@/components/StatusPill";
import { db } from "@/db";
import { ORDER_STATUSES, orders, type OrderStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, ORDER_STATUS_LABELS } from "@/lib/site";

export const metadata: Metadata = { title: "Поръчки" };

export default async function AdminOrders({ searchParams }: PageProps<"/admin/porachki">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = ORDER_STATUSES.find((s) => s === sp.status) as OrderStatus | undefined;

  const [list, counts] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(status ? eq(orders.status, status) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(200),
    db.select({ status: orders.status, n: sql<number>`count(*)` }).from(orders).groupBy(orders.status),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const all = counts.reduce((sum, c) => sum + c.n, 0);

  const tab = (active: boolean) =>
    `inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition ${active ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`;

  return (
    <>
      <PageTitle title="Поръчки" />
      <ul className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        <li>
          <Link href="/admin/porachki" className={tab(!status)}>
            Всички <span className="opacity-60">{all}</span>
          </Link>
        </li>
        {ORDER_STATUSES.map((s) => (
          <li key={s}>
            <Link href={`/admin/porachki?status=${s}`} className={tab(status === s)}>
              {ORDER_STATUS_LABELS[s]} <span className="opacity-60">{countOf(s)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Panel>
        {list.length === 0 ? (
          <p className="px-5 py-14 text-center text-ink-soft">Няма поръчки с този статус.</p>
        ) : (
          <div className="overflow-x-auto p-1">
            <table className="w-full min-w-[46rem] text-[0.95rem]">
              <thead>
                <tr>
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
                      <Link href={`/admin/porachki/${o.id}`} className="font-semibold hover:text-forest">
                        {o.number}
                      </Link>
                      <p className="text-xs text-ink-soft">{formatDate(o.createdAt)}</p>
                    </td>
                    <td className={td}>
                      {o.name}
                      <p className="text-xs text-ink-soft">{o.phone}</p>
                    </td>
                    <td className={td}>
                      {DELIVERY_METHODS.find((d) => d.id === o.delivery)?.label ?? o.delivery}
                      <p className="text-xs text-ink-soft">{o.city}</p>
                    </td>
                    <td className={td}>
                      <StatusPill status={o.status} />
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
