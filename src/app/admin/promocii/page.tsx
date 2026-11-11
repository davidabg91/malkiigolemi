import { desc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { togglePromotion } from "@/actions/promotions";
import { AdminSkeleton, PageTitle, Panel, td, th } from "@/components/admin/bits";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { categories, promotionProducts, promotions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { PROMO_STATE_LABELS, promoState } from "@/lib/promotions-admin";

export const metadata: Metadata = { title: "Промоции" };

async function AdminPromotions() {
  await requireAdmin();
  const rows = await db
    .select({
      promo: promotions,
      category: categories.name,
      products: sql<number>`(select count(*) from ${promotionProducts} pp where pp.promotion_id = ${promotions.id})`,
    })
    .from(promotions)
    .leftJoin(categories, eq(categories.id, promotions.categoryId))
    .orderBy(desc(promotions.startsAt));
  const now = new Date();
  const order = { live: 0, upcoming: 1, off: 2, ended: 3 };
  const list = rows.map((r) => ({ ...r, state: promoState(r.promo, now) })).sort((a, b) => order[a.state] - order[b.state]);

  return (
    <>
      <PageTitle
        title="Промоции"
        sub="Отстъпка с начало и край. Включва се и се изключва сама; на сайта цената се показва зачертана."
        action={
          <Link href="/admin/promocii/nova" className={btn.primary}>
            <Plus className="h-5 w-5" aria-hidden />
            Нова промоция
          </Link>
        }
      />
      <Panel>
        {list.length === 0 ? (
          <p className="px-5 py-14 text-center text-ink-soft">Още няма промоции.</p>
        ) : (
          <div className="overflow-x-auto p-1">
            <table className="w-full min-w-[46rem] text-[0.95rem]">
              <thead>
                <tr>
                  <th className={th}>Промоция</th>
                  <th className={th}>Обхват</th>
                  <th className={th}>Период</th>
                  <th className={th}>Статус</th>
                  <th className={th}>
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map(({ promo: p, category, products, state }) => (
                  <tr key={p.id} className="transition hover:bg-sand/60">
                    <td className={td}>
                      <Link href={`/admin/promocii/${p.id}`} className="font-semibold hover:text-forest">
                        {p.name}
                      </Link>
                      <p className="text-sm font-bold text-tomato">−{p.percent}%</p>
                    </td>
                    <td className={td}>{category ? `Категория „${category}“` : `${products} продукта`}</td>
                    <td className={`${td} text-sm`}>
                      {formatDate(p.startsAt)}
                      <p className="text-ink-soft">до {formatDate(p.endsAt)}</p>
                    </td>
                    <td className={td}>
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${PROMO_STATE_LABELS[state].className}`}>{PROMO_STATE_LABELS[state].label}</span>
                    </td>
                    <td className={`${td} text-right`}>
                      {state !== "ended" && (
                        <form action={togglePromotion.bind(null, p.id)}>
                          <button type="submit" className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-ink">
                            {p.enabled ? "Изключи" : "Включи"}
                          </button>
                        </form>
                      )}
                    </td>
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

export default function Page() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminPromotions />
    </Suspense>
  );
}
