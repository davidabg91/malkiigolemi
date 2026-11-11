import { asc, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle, Panel, td, th } from "@/components/admin/bits";
import { FbImport } from "@/components/admin/FbImport";
import { db } from "@/db";
import { fbClaims, fbPosts, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Поръчки от Facebook" };

async function AdminFacebook() {
  await requireAdmin();
  const [productList, posts] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, unit: products.unit, stock: products.stock })
      .from(products)
      .where(eq(products.active, true))
      .orderBy(asc(products.name)),
    db
      .select({
        id: fbPosts.id,
        productName: fbPosts.productName,
        createdAt: fbPosts.createdAt,
        claims: sql<number>`count(${fbClaims.id})`,
        units: sql<number>`coalesce(sum(case when ${fbClaims.status} != 'rejected' then ${fbClaims.qty} else 0 end), 0)`,
        pending: sql<number>`coalesce(sum(case when ${fbClaims.status} = 'pending' then 1 else 0 end), 0)`,
        ordered: sql<number>`coalesce(sum(case when ${fbClaims.status} = 'ordered' then 1 else 0 end), 0)`,
      })
      .from(fbPosts)
      .leftJoin(fbClaims, eq(fbClaims.postId, fbPosts.id))
      .groupBy(fbPosts.id)
      .orderBy(desc(fbPosts.createdAt))
      .limit(100),
  ]);

  return (
    <>
      <PageTitle title="Поръчки от Facebook" sub="Постави коментарите под пост от групата. Сайтът разпознава кой колко иска и ги прави на поръчки." />

      <div className="grid items-start gap-6 2xl:grid-cols-[1.4fr_1fr]">
        <Panel className="p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Нов пост</h2>
          <FbImport products={productList.map((p) => ({ id: p.id, label: `${p.name} ${p.unit}`.trim(), stock: p.stock }))} />
        </Panel>

        <Panel>
          <h2 className="px-5 pt-5 font-display text-lg font-semibold">Постове</h2>
          {posts.length === 0 ? (
            <p className="px-5 py-12 text-center text-ink-soft">Още няма добавени постове.</p>
          ) : (
            <div className="overflow-x-auto p-1">
              <table className="w-full min-w-[30rem] text-[0.95rem]">
                <thead>
                  <tr>
                    <th className={th}>Продукт</th>
                    <th className={`${th} text-right`}>Заявки</th>
                    <th className={`${th} text-right`}>Чакат</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {posts.map((p) => (
                    <tr key={p.id} className="transition hover:bg-sand/60">
                      <td className={td}>
                        <Link href={`/admin/facebook/${p.id}`} className="font-semibold hover:text-forest">
                          {p.productName}
                        </Link>
                        <p className="text-xs text-ink-soft">{formatDate(p.createdAt)}</p>
                      </td>
                      <td className={`${td} text-right tabular-nums`}>
                        {p.claims}
                        <p className="text-xs text-ink-soft">{p.units} бр</p>
                      </td>
                      <td className={`${td} text-right`}>
                        {p.pending > 0 ? (
                          <span className="rounded-full bg-sun/50 px-2.5 py-1 text-xs font-bold tabular-nums">{p.pending}</span>
                        ) : (
                          <span className="text-xs font-semibold text-forest">Готово</span>
                        )}
                      </td>
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
      <AdminFacebook />
    </Suspense>
  );
}
