import { Check, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { btn } from "@/components/ui";
import { formatPrice, formatTimestamp } from "@/lib/format";
import { storePaymentOf } from "@/lib/store-payments";
import { stripeConfigured } from "@/lib/stripe";

export const metadata: Metadata = { title: "Плащане в магазина", robots: { index: false } };

type Props = PageProps<"/plati/gotovo">;

async function Result({ searchParams }: Pick<Props, "searchParams">) {
  const { s } = await searchParams;
  const payment = typeof s === "string" && stripeConfigured() ? await storePaymentOf(s) : null;

  if (!payment) {
    return (
      <div className="rounded-card bg-paper p-6 text-center shadow-soft sm:p-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sun/40 text-ink">
          <CircleAlert className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold">Плащането не е завършено</h1>
        <p className="mt-2 text-ink-soft">Не виждаме получено плащане. Опитай отново или плати на касата.</p>
        <Link href="/plati" className={`${btn.primary} mt-6`}>
          Опитай отново
        </Link>
      </div>
    );
  }

  return (
    <div role="status" className="rounded-card bg-forest-deep p-6 text-center text-cream shadow-soft sm:p-8">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-lime text-ink">
        <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold">Плащането е получено</h1>
      <p className="mt-3 font-display text-5xl font-bold tabular-nums">{formatPrice(payment.amount)}</p>
      <dl className="mx-auto mt-5 grid max-w-xs grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-[0.95rem]">
        <dt className="text-cream/70">Плащане №</dt>
        <dd className="text-right font-semibold tabular-nums">{payment.id}</dd>
        <dt className="text-cream/70">Получено</dt>
        <dd className="text-right font-semibold tabular-nums">{formatTimestamp(payment.createdAt)} ч.</dd>
        {payment.note && (
          <>
            <dt className="text-cream/70">Бележка</dt>
            <dd className="text-right font-semibold">{payment.note}</dd>
          </>
        )}
      </dl>
      <p className="mt-5 text-sm text-cream/80">Покажи този екран на касата. Благодарим ти!</p>
    </div>
  );
}

export default function Page({ searchParams }: Props) {
  return (
    <div className="container-shop max-w-md pb-6 pt-8 sm:pt-12">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-card bg-paper shadow-soft" />}>
        <Result searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
