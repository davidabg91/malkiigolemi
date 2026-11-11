import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle, Panel, td, th } from "@/components/admin/bits";
import { LoyaltyForm } from "@/components/admin/LoyaltyForm";
import { db } from "@/db";
import { loyaltyLedger, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { getLoyaltySettings, pointsValue } from "@/lib/loyalty";

export const metadata: Metadata = { title: "Точки за лоялност" };

async function AdminLoyalty() {
  await requireAdmin();
  const [settings, [totals], holders] = await Promise.all([
    getLoyaltySettings(),
    db
      .select({
        outstanding: sql<number>`coalesce(sum(${loyaltyLedger.points}), 0)`,
        earned: sql<number>`coalesce(sum(case when ${loyaltyLedger.kind} in ('earn','reverse') then ${loyaltyLedger.points} else 0 end), 0)`,
        used: sql<number>`coalesce(-sum(case when ${loyaltyLedger.kind} in ('redeem','refund') then ${loyaltyLedger.points} else 0 end), 0)`,
      })
      .from(loyaltyLedger),
    db
      .select({ id: users.id, name: users.name, email: users.email, points: sql<number>`sum(${loyaltyLedger.points})` })
      .from(loyaltyLedger)
      .innerJoin(users, eq(users.id, loyaltyLedger.userId))
      .groupBy(users.id)
      .having(sql`sum(${loyaltyLedger.points}) > 0`)
      .orderBy(desc(sql`sum(${loyaltyLedger.points})`))
      .limit(10),
  ]);

  const tiles = [
    { label: "Неизползвани точки", value: String(totals.outstanding), hint: `${formatPrice(pointsValue(totals.outstanding, settings))} бъдеща отстъпка` },
    { label: "Раздадени досега", value: String(totals.earned) },
    { label: "Използвани досега", value: String(totals.used), hint: formatPrice(pointsValue(totals.used, settings)) },
  ];

  return (
    <>
      <PageTitle title="Точки за лоялност" sub="Клиентите трупат точки с всяка доставена поръчка и ги използват за отстъпка при следваща." />
      <ul className="mb-6 grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.label} className="rounded-card bg-paper p-5 shadow-soft">
            <p className="text-sm text-ink-soft">{t.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
            {t.hint && <p className="mt-1 text-xs text-ink-soft">{t.hint}</p>}
          </li>
        ))}
      </ul>
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel className="p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Настройки</h2>
          <LoyaltyForm initial={settings} />
        </Panel>
        <Panel>
          <h2 className="px-5 pt-5 font-display text-lg font-semibold">Най-много точки</h2>
          {holders.length === 0 ? (
            <p className="px-5 py-10 text-center text-ink-soft">Още никой няма точки.</p>
          ) : (
            <div className="overflow-x-auto p-1">
              <table className="w-full text-[0.95rem]">
                <thead>
                  <tr>
                    <th className={th}>Клиент</th>
                    <th className={`${th} text-right`}>Точки</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {holders.map((h) => (
                    <tr key={h.id}>
                      <td className={td}>
                        <Link href={`/admin/potrebiteli/${h.id}`} className="font-semibold hover:text-forest">
                          {h.name}
                        </Link>
                        <p className="text-xs text-ink-soft">{h.email}</p>
                      </td>
                      <td className={`${td} text-right font-semibold tabular-nums`}>{h.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminLoyalty />
    </Suspense>
  );
}
