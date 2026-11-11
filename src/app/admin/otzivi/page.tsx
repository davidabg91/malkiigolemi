import { desc, eq, sql } from "drizzle-orm";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { deleteReview, setReviewHidden } from "@/actions/reviews";
import { AdminSkeleton, PageTitle, Panel } from "@/components/admin/bits";
import { ratingLabel, Stars } from "@/components/product/Stars";
import { db } from "@/db";
import { products, reviews, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Отзиви" };

async function AdminReviews({ searchParams }: Pick<PageProps<"/admin/otzivi">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const low = sp.filter === "low";
  const [list, [summary]] = await Promise.all([
    db
      .select({ review: reviews, product: products.name, unit: products.unit, productId: products.id, slug: products.slug, user: users.name, userId: users.id })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(low ? sql`${reviews.rating} <= 2` : undefined)
      .orderBy(desc(reviews.createdAt))
      .limit(300),
    db
      .select({ n: sql<number>`count(*)`, avg: sql<number | null>`avg(${reviews.rating})`, low: sql<number>`coalesce(sum(case when ${reviews.rating} <= 2 then 1 else 0 end), 0)` })
      .from(reviews),
  ]);
  const tab = (active: boolean) =>
    `inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition ${active ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`;

  return (
    <>
      <PageTitle
        title="Отзиви"
        sub={summary.n ? `${summary.n} отзива, средна оценка ${ratingLabel(summary.avg ?? 0)} от 5. Пишат ги само клиенти с доставена поръчка.` : "Пишат ги само клиенти с доставена поръчка."}
      />
      <ul className="mb-5 flex gap-2">
        <li>
          <Link href="/admin/otzivi" className={tab(!low)}>
            Всички <span className="opacity-60">{summary.n}</span>
          </Link>
        </li>
        <li>
          <Link href="/admin/otzivi?filter=low" className={tab(low)}>
            С 1–2 звезди <span className="opacity-60">{summary.low}</span>
          </Link>
        </li>
      </ul>

      {list.length === 0 ? (
        <Panel>
          <p className="px-5 py-14 text-center text-ink-soft">Няма отзиви.</p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {list.map(({ review: r, product, unit, productId, slug, user, userId }) => (
            <li key={r.id}>
              <Panel className={`p-5 ${r.hidden ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Stars value={r.rating} />
                      <span className="text-sm font-semibold tabular-nums">{r.rating}/5</span>
                      {r.hidden && <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-semibold">Скрит</span>}
                    </p>
                    <p className="mt-1 text-sm">
                      <Link href={`/admin/produkti/${productId}`} className="font-semibold hover:text-forest">
                        {product} {unit}
                      </Link>
                      <span className="text-ink-soft"> · </span>
                      <Link href={`/admin/potrebiteli/${userId}`} className="hover:text-forest">
                        {user}
                      </Link>
                      <span className="text-ink-soft"> · {formatDate(r.createdAt)}</span>
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/produkt/${slug}#otzivi`} className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-sand hover:text-ink">
                      В сайта
                    </Link>
                    <form action={setReviewHidden.bind(null, r.id, !r.hidden)}>
                      <button type="submit" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-sand hover:text-ink">
                        {r.hidden ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
                        {r.hidden ? "Покажи" : "Скрий"}
                      </button>
                    </form>
                    <form action={deleteReview.bind(null, r.id)}>
                      <button type="submit" aria-label="Изтрий отзива" className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-tomato">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </form>
                  </div>
                </div>
                {r.body && <p className="mt-3 whitespace-pre-line">{r.body}</p>}
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/otzivi">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminReviews searchParams={searchParams} />
    </Suspense>
  );
}
