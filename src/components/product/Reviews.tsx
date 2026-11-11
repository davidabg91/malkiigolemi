import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { hasReceived, ownReview, productReviews } from "@/lib/reviews";
import { ReviewForm } from "./ReviewForm";
import { ratingLabel, Stars } from "./Stars";

/** Reviews block on the product page. Read per request: it depends on who is looking. */
export async function Reviews({ productId, slug }: { productId: number; slug: string }) {
  const session = await getSession();
  const [data, received, mine] = await Promise.all([
    productReviews(productId),
    session ? hasReceived(session.uid, productId) : false,
    session ? ownReview(session.uid, productId) : null,
  ]);

  return (
    <section id="otzivi" aria-labelledby="reviews-heading" className="scroll-mt-32">
      <h2 id="reviews-heading" className="font-display text-2xl font-semibold tracking-tight">
        Отзиви {data.count > 0 && <span className="text-ink-soft">({data.count})</span>}
      </h2>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-5">
          {data.count > 0 ? (
            <div className="rounded-tile bg-paper p-6 shadow-soft">
              <p className="flex items-end gap-3">
                <span className="text-5xl font-bold tabular-nums">{ratingLabel(data.average)}</span>
                <span className="pb-1.5 text-ink-soft">от 5</span>
              </p>
              <Stars value={data.average} className="mt-2 h-5 w-5" />
              <p className="mt-1 text-sm text-ink-soft">{data.count === 1 ? "1 отзив" : `${data.count} отзива`} от реални купувачи</p>
              <ul className="mt-5 space-y-2">
                {data.byStars.map((b) => (
                  <li key={b.stars} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 tabular-nums text-ink-soft">{b.stars} ★</span>
                    <span className="h-2 flex-1 rounded-[4px] bg-sand">
                      <span className="block h-2 rounded-[4px] bg-[#e8a317]" style={{ width: `${(b.n / data.count) * 100}%` }} />
                    </span>
                    <span className="w-6 shrink-0 text-right tabular-nums">{b.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-tile bg-paper p-6 text-ink-soft shadow-soft">Още няма отзиви. Отзиви пишат само клиенти, получили продукта.</p>
          )}

          <div className="rounded-tile bg-paper p-6 shadow-soft">
            {!session ? (
              <p className="text-sm text-ink-soft">
                Купил си го?{" "}
                <Link href={`/vhod?next=/produkt/${slug}%23otzivi`} className="font-semibold text-forest hover:underline">
                  Влез в профила си
                </Link>
                , за да го оцениш.
              </p>
            ) : received ? (
              <>
                <h3 className="mb-4 font-semibold">{mine ? "Твоят отзив" : "Оцени продукта"}</h3>
                <ReviewForm productId={productId} initial={mine ? { rating: mine.rating, body: mine.body } : null} />
                {mine?.hidden && <p className="mt-3 text-sm text-tomato">Отзивът ти е скрит от магазина.</p>}
              </>
            ) : (
              <p className="text-sm text-ink-soft">Ще можеш да оцениш продукта, след като получиш поръчка с него.</p>
            )}
          </div>
        </div>

        {data.list.length > 0 && (
          <ul className="space-y-4">
            {data.list.map((r) => (
              <li key={r.id} className="rounded-tile bg-paper p-5 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold">
                    {r.name}
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-forest">
                      <BadgeCheck className="h-4 w-4" aria-hidden />
                      Проверен купувач
                    </span>
                  </p>
                  <p className="text-sm text-ink-soft">{formatDate(r.createdAt)}</p>
                </div>
                <p className="mt-1.5 flex items-center gap-2 text-sm">
                  <Stars value={r.rating} />
                  <span className="sr-only">{r.rating} от 5</span>
                </p>
                {r.body && <p className="mt-2 whitespace-pre-line leading-relaxed">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
