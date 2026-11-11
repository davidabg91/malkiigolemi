import { CalendarClock, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle, Panel, td, th } from "@/components/admin/bits";
import { BarList, Columns, Delta, StatTile } from "@/components/admin/charts";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { getStats, PERIODS, type PeriodId } from "@/lib/stats";

export const metadata: Metadata = { title: "Статистика" };

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");
const ordersWord = (n: number) => (n === 1 ? "поръчка" : "поръчки");

function Section({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <Panel className={`p-5 sm:p-6 ${className}`}>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

async function AdminStats({ searchParams }: Pick<PageProps<"/admin/statistika">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const periodId = (PERIODS.find((p) => p.id === sp.period)?.id ?? "30") as PeriodId;
  const s = await getStats(periodId);
  const { kpis, stock, customers } = s;

  const tab = (active: boolean) =>
    `inline-flex h-10 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition ${active ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`;
  const bestBucket = s.series.reduce((a, b) => (b.revenue > a.revenue ? b : a), s.series[0]);

  return (
    <>
      <PageTitle title="Статистика" sub="Оборот, продукти, наличности и клиенти. Отказаните поръчки не влизат в оборота." />

      <ul className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Период">
        {PERIODS.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/statistika?period=${p.id}`} className={tab(p.id === periodId)} aria-current={p.id === periodId ? "true" : undefined}>
              {p.label}
            </Link>
          </li>
        ))}
      </ul>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Оборот" value={formatPrice(kpis.revenue.now)}>
          <Delta now={kpis.revenue.now} prev={kpis.revenue.prev} />
        </StatTile>
        <StatTile label="Поръчки" value={String(kpis.orders.now)}>
          <Delta now={kpis.orders.now} prev={kpis.orders.prev} />
        </StatTile>
        <StatTile label="Средна стойност на поръчка" value={kpis.orders.now ? formatPrice(kpis.average.now) : "—"}>
          <Delta now={kpis.average.now} prev={kpis.average.prev} />
        </StatTile>
        <StatTile
          label="Продадени бройки"
          value={String(kpis.units)}
          hint={kpis.orders.now ? `Средно ${kpis.unitsPerOrder.toFixed(1).replace(".", ",")} бр в поръчка` : undefined}
        />
        <StatTile label="Нови регистрации" value={String(kpis.newUsers.now)} hint={`Общо ${customers.registered} регистрирани клиенти`}>
          <Delta now={kpis.newUsers.now} prev={kpis.newUsers.prev} />
        </StatTile>
        <StatTile
          label="Отказани поръчки"
          value={`${kpis.cancelled.now} (${percent(kpis.cancelled.now, s.totalOrders)})`}
          hint={kpis.cancelled.now ? `Пропуснат оборот ${formatPrice(kpis.cancelled.value)} · ${kpis.cancelled.byCustomer} отказани от клиента` : undefined}
        >
          <Delta now={kpis.cancelled.now} prev={kpis.cancelled.prev} lowerIsBetter />
        </StatTile>
      </ul>

      <div className="mt-6 space-y-6">
        <Section
          title={s.monthly ? "Оборот по месеци" : "Оборот по дни"}
          sub={
            kpis.revenue.now > 0
              ? `Най-силен ${s.monthly ? "месец" : "ден"}: ${bestBucket.label} с ${formatPrice(bestBucket.revenue)} от ${bestBucket.orders} ${ordersWord(bestBucket.orders)}.`
              : "Няма поръчки за този период."
          }
        >
          <Columns points={s.series.map((b) => ({ key: b.key, label: b.label, value: b.revenue, tip: `${formatPrice(b.revenue)} · ${b.orders} ${ordersWord(b.orders)}` }))} height="h-52" />
        </Section>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Section title="Най-продавани продукти" sub="По брой продадени бройки.">
            <BarList rows={s.topByQty} format={(n) => `${n} бр`} />
          </Section>
          <Section title="Продукти с най-голям оборот" sub="Кои продукти носят най-много пари.">
            <BarList rows={s.topByRevenue} format={formatPrice} />
          </Section>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Section title="Оборот по категории">
            <BarList rows={s.categoriesByRevenue} format={formatPrice} />
          </Section>
          <Section title="Поръчки по статус" sub={`Общо ${s.totalOrders} ${ordersWord(s.totalOrders)} в периода, с отказаните.`}>
            <BarList rows={s.byStatus} empty="Няма поръчки за този период." />
          </Section>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Section
            title="Свършват скоро"
            sub="При сегашното темпо на продажби наличността стига за под 30 дни. Зареди ги първи."
          >
            {stock.runningOut.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Няма продукти, които да свършват скоро.</p>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr>
                      <th className={th}>Продукт</th>
                      <th className={`${th} text-right`}>Продадени</th>
                      <th className={`${th} text-right`}>Налични</th>
                      <th className={`${th} text-right`}>Стига за</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {stock.runningOut.map((p) => (
                      <tr key={p.id}>
                        <td className={td}>
                          <Link href={`/admin/produkti/${p.id}`} className="font-medium hover:text-forest hover:underline">
                            {p.name}
                          </Link>
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{p.soldQty} бр</td>
                        <td className={`${td} text-right tabular-nums`}>{p.stock} бр</td>
                        <td className={`${td} text-right`}>
                          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${p.stock === 0 ? "bg-tomato text-white" : p.daysLeft <= 7 ? "bg-tomato/15 text-tomato" : "bg-sun/50"}`}>
                            {p.stock === 0 ? "Изчерпан" : `${Math.max(1, Math.round(p.daysLeft))} дни`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-4 text-sm text-ink-soft">
              Изчерпани в момента: <strong className="text-ink">{stock.outOfStock}</strong> от {stock.activeProducts} активни продукта.
            </p>
          </Section>

          <Section
            title="Залежала стока"
            sub={
              stock.unsoldCount
                ? `${stock.unsoldCount} продукта с наличност не са поръчвани нито веднъж в периода. В тях стоят ${formatPrice(stock.unsoldValue)} по продажни цени.`
                : "Всеки продукт с наличност е поръчван поне веднъж в периода."
            }
          >
            {stock.deadStock.length > 0 && (
              <>
                <BarList rows={stock.deadStock.map((p) => ({ key: String(p.id), label: p.name, value: p.value, sub: `${p.stock} бр`, href: `/admin/produkti/${p.id}` }))} format={formatPrice} />
                <p className="mt-4 flex gap-2 text-sm text-ink-soft">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
                  Добри кандидати за промоция или пакетна цена.
                </p>
              </>
            )}
          </Section>
        </div>

        <Section title="Клиенти">
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <li className="rounded-2xl bg-sand/60 p-4">
              <p className="text-sm text-ink-soft">Поръчали в периода</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{customers.buyers}</p>
              <p className="mt-1 text-xs text-ink-soft">различни клиенти</p>
            </li>
            <li className="rounded-2xl bg-sand/60 p-4">
              <p className="text-sm text-ink-soft">Връщащи се клиенти</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{percent(customers.returning, customers.buyers)}</p>
              <p className="mt-1 text-xs text-ink-soft">{customers.returning} с две или повече поръчки досега</p>
            </li>
            <li className="rounded-2xl bg-sand/60 p-4">
              <p className="text-sm text-ink-soft">Поръчки без регистрация</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{percent(customers.guestOrders, customers.keptOrders)}</p>
              <p className="mt-1 text-xs text-ink-soft">{customers.guestOrders} от {customers.keptOrders} поръчки</p>
            </li>
            <li className="rounded-2xl bg-sand/60 p-4">
              <p className="text-sm text-ink-soft">Отбелязани като некоректни</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{customers.flagged}</p>
              <Link href="/admin/potrebiteli?filter=flagged" className="mt-1 inline-block text-xs font-semibold text-forest hover:underline">
                Виж ги
              </Link>
            </li>
          </ul>

          <h3 className="mb-2 mt-7 text-sm font-semibold">Най-добри клиенти в периода</h3>
          {customers.top.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">Няма поръчки за този период.</p>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr>
                    <th className={th}>Клиент</th>
                    <th className={`${th} text-right`}>Поръчки</th>
                    <th className={`${th} text-right`}>Оборот</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {customers.top.map((c) => (
                    <tr key={c.email}>
                      <td className={td}>
                        {c.userId ? (
                          <Link href={`/admin/potrebiteli/${c.userId}`} className="font-medium hover:text-forest hover:underline">
                            {c.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{c.name}</span>
                        )}
                        <p className="text-xs text-ink-soft">
                          {c.email}
                          {c.userId ? "" : " · без регистрация"}
                        </p>
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{c.orders}</td>
                      <td className={`${td} text-right font-semibold tabular-nums`}>{formatPrice(c.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          title="Кога поръчват клиентите"
          sub={
            s.busiest
              ? `Най-много поръчки идват в ${s.busiest.day} и около ${s.busiest.hour}:00 ч. Тогава си струва да пуснеш пост или промоция във Facebook групата.`
              : "Няма поръчки за този период."
          }
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-forest" aria-hidden />
                По ден от седмицата
              </h3>
              <Columns points={s.weekdays.map((d) => ({ ...d, tip: `${d.value} ${ordersWord(d.value)}` }))} labelEvery={1} height="h-36" />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">По час от денонощието</h3>
              <Columns points={s.hours.map((h) => ({ ...h, tip: `${h.value} ${ordersWord(h.value)}` }))} labelEvery={3} height="h-36" />
            </div>
          </div>
        </Section>

        <div className="grid items-start gap-6 xl:grid-cols-3">
          <Section title="Начин на доставка">
            <BarList rows={s.byMethod} format={(n) => `${n} (${percent(n, kpis.orders.now)})`} />
          </Section>
          <Section title="Куриери">
            <BarList rows={s.byCourier} format={(n) => `${n} ${ordersWord(n)}`} empty="Няма поръчки с куриер за този период." />
          </Section>
          <Section title="Населени места">
            <BarList rows={s.byCity} format={(n) => `${n} ${ordersWord(n)}`} />
          </Section>
        </div>
      </div>
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/statistika">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminStats searchParams={searchParams} />
    </Suspense>
  );
}
