import { asc, desc, eq, isNull, lt, ne, sql } from "drizzle-orm";
import { AlertTriangle, Euro, Package, ReceiptText } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle, Panel, td, th } from "@/components/admin/bits";
import { FlagBadge } from "@/components/admin/Flag";
import { StatusPill } from "@/components/StatusPill";
import { db } from "@/db";
import { orders, products, stockAlerts } from "@/db/schema";
import { MailSamples, MailTest } from "@/components/admin/MailTest";
import { site } from "@/lib/site";
import { mailConfigured, mailSender } from "@/lib/mail";
import { requireAdmin } from "@/lib/auth";
import { findFlag, getFlagIndex } from "@/lib/flags";
import { formatDate, formatPrice } from "@/lib/format";

const LOW_STOCK = 10;

async function AdminDashboard() {
  const session = await requireAdmin();

  const [[stats], [catalog], recent, low, flags, awaited] = await Promise.all([
    db
      .select({
        fresh: sql<number>`coalesce(sum(case when ${orders.status} = 'new' then 1 else 0 end), 0)`,
        count: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
      })
      .from(orders)
      .where(ne(orders.status, "cancelled")),
    db
      .select({
        total: sql<number>`count(*)`,
        low: sql<number>`coalesce(sum(case when ${products.stock} < ${LOW_STOCK} then 1 else 0 end), 0)`,
      })
      .from(products)
      .where(eq(products.active, true)),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
    db.select().from(products).where(lt(products.stock, LOW_STOCK)).orderBy(asc(products.stock)).limit(6),
    getFlagIndex(),
    // Products people asked to be told about, most wanted first: what to restock next.
    db
      .select({ id: products.id, name: products.name, stock: products.stock, n: sql<number>`count(*)` })
      .from(stockAlerts)
      .innerJoin(products, eq(products.id, stockAlerts.productId))
      .where(isNull(stockAlerts.notifiedAt))
      .groupBy(products.id)
      .orderBy(desc(sql`count(*)`))
      .limit(6),
  ]);

  const cards = [
    { label: "Нови поръчки", value: String(stats.fresh), icon: ReceiptText, href: "/admin/porachki?status=new", accent: stats.fresh > 0 },
    { label: "Оборот (без отказани)", value: formatPrice(stats.revenue), icon: Euro, href: "/admin/porachki" },
    { label: "Активни продукти", value: String(catalog.total), icon: Package, href: "/admin/produkti" },
    { label: "С ниска наличност", value: String(catalog.low), icon: AlertTriangle, href: "/admin/produkti?stock=low" },
  ];

  return (
    <>
      <PageTitle title="Табло" sub={`Общо ${stats.count} поръчки досега.`} />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, href, accent }) => (
          <li key={label}>
            <Link href={href} className={`block rounded-card p-5 shadow-soft transition hover:shadow-lift ${accent ? "bg-lime" : "bg-paper"}`}>
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${accent ? "bg-ink text-lime" : "bg-sand text-forest"}`}>
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <p className="mt-4 text-sm text-ink-soft">{label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Panel>
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-display text-lg font-semibold">Последни поръчки</h2>
            <Link href="/admin/porachki" className="text-sm font-semibold text-forest hover:underline">
              Всички
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-ink-soft">Още няма поръчки.</p>
          ) : (
            <div className="overflow-x-auto p-1">
              <table className="w-full min-w-[34rem] text-[0.95rem]">
                <thead>
                  <tr>
                    <th className={th}>Номер</th>
                    <th className={th}>Клиент</th>
                    <th className={th}>Статус</th>
                    <th className={`${th} text-right`}>Сума</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recent.map((o) => (
                    <tr key={o.id} className="transition hover:bg-sand/60">
                      <td className={td}>
                        <Link href={`/admin/porachki/${o.id}`} className="font-semibold hover:text-forest">
                          {o.number}
                        </Link>
                        <p className="text-xs text-ink-soft">{formatDate(o.createdAt)}</p>
                      </td>
                      <td className={td}>
                        {o.name}
                        {findFlag(flags, { userId: o.userId, email: o.email, phone: o.phone }) && <FlagBadge className="ml-2 align-middle" />}
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

        <div className="space-y-6">
        <Panel className="p-5">
          <h2 className="font-display text-lg font-semibold">Имейли</h2>
          <MailTest configured={mailConfigured()} from={mailSender()} to={site.email} />
          {mailConfigured() && <MailSamples defaultTo={session.email} />}
        </Panel>
        {awaited.length > 0 && (
          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Клиенти чакат наличност</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {mailConfigured() ? "При зареждане получават имейл автоматично." : "Имейлите не са настроени: регистрираните клиенти виждат наличността в профила си."}
            </p>
            <ul className="mt-3 divide-y divide-line">
              {awaited.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/admin/produkti/${p.id}`} className="min-w-0 truncate text-[0.95rem] font-medium hover:text-forest">
                    {p.name}
                  </Link>
                  <span className="shrink-0 rounded-full bg-lime px-2.5 py-1 text-xs font-bold tabular-nums">
                    {p.n} {p.n === 1 ? "човек" : "души"}
                    {p.stock > 0 ? " · зареден" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <Panel className="p-5">
          <h2 className="font-display text-lg font-semibold">Ниска наличност</h2>
          {low.length === 0 ? (
            <p className="py-8 text-center text-ink-soft">Всичко е заредено.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {low.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/admin/produkti/${p.id}`} className="min-w-0 truncate text-[0.95rem] font-medium hover:text-forest">
                    {p.name}
                  </Link>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${p.stock === 0 ? "bg-tomato text-white" : "bg-sun/50"}`}>
                    {p.stock} бр
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminDashboard />
    </Suspense>
  );
}
