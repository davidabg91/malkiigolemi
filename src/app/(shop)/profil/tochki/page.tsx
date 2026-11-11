import { Gift } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { getLoyaltySettings, pointsBalance, pointsHistory, pointsValue } from "@/lib/loyalty";

export const metadata: Metadata = { title: "Точки", robots: { index: false } };

const KIND_LABELS = { earn: "Събрани", reverse: "Отнети", redeem: "Използвани", refund: "Върнати", adjust: "Корекция" } as const;

async function Points() {
  const session = await getSession();
  if (!session) redirect("/vhod?next=/profil/tochki");
  const [settings, balance, history] = await Promise.all([getLoyaltySettings(), pointsBalance(session.uid), pointsHistory(session.uid)]);

  if (!settings.enabled && balance === 0) {
    return <p className="rounded-tile bg-paper px-6 py-14 text-center text-ink-soft shadow-soft">Програмата за точки в момента не е активна.</p>;
  }
  const toNext = Math.max(0, settings.minRedeem - balance);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-5 rounded-tile bg-forest p-6 text-cream shadow-soft sm:p-8">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-lime text-ink">
          <Gift className="h-7 w-7" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-cream/80">Твоите точки</p>
          <p className="font-display text-4xl font-semibold tabular-nums">{balance}</p>
          <p className="mt-1 text-cream/80">
            {balance > 0 ? `Струват ${formatPrice(pointsValue(balance, settings))} отстъпка.` : "Още нямаш точки."}
            {settings.enabled && toNext > 0 && ` Още ${toNext} точки и можеш да ги използваш.`}
          </p>
        </div>
      </section>

      {settings.enabled && (
        <section className="rounded-tile bg-paper p-6 shadow-soft sm:p-8">
          <h2 className="font-display text-lg font-semibold">Как работи</h2>
          <ul className="mt-3 space-y-2 text-ink-soft">
            <li>
              • За всеки 1 € от продуктите получаваш <strong className="text-ink">{settings.pointsPerEuro} {settings.pointsPerEuro === 1 ? "точка" : "точки"}</strong>, когато поръчката ти е доставена.
            </li>
            <li>
              • 100 точки = <strong className="text-ink">{formatPrice(settings.centsPer100)}</strong> отстъпка. Използваш ги при поръчка, от {settings.minRedeem} точки нагоре.
            </li>
            <li>• С точки можеш да платиш до {settings.maxPercent}% от продуктите в една поръчка.</li>
            <li>• Ако поръчка бъде отказана, използваните за нея точки се връщат.</li>
          </ul>
        </section>
      )}

      <section className="rounded-tile bg-paper p-6 shadow-soft sm:p-8">
        <h2 className="font-display text-lg font-semibold">История</h2>
        {history.length === 0 ? (
          <p className="py-6 text-center text-ink-soft">Точките ще се появят тук, когато получиш първата си поръчка.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {history.map(({ entry: e, orderNumber }) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-3 text-[0.95rem]">
                <div className="min-w-0">
                  <p className="font-medium">
                    {KIND_LABELS[e.kind]}
                    {orderNumber ? ` · ${orderNumber}` : ""}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {formatDate(e.createdAt)}
                    {e.kind === "adjust" && e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 font-bold tabular-nums ${e.points >= 0 ? "text-forest" : "text-tomato"}`}>
                  {e.points > 0 ? "+" : "−"}
                  {Math.abs(e.points)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-tile bg-sand" aria-hidden />}>
      <Points />
    </Suspense>
  );
}
