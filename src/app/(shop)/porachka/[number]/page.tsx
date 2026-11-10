import { eq } from "drizzle-orm";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, site } from "@/lib/site";

export const metadata: Metadata = { title: "Благодарим за поръчката", robots: { index: false } };

type Props = PageProps<"/porachka/[number]">;

async function Confirmation({ params }: Pick<Props, "params">) {
  const { number } = await params;
  const order = await db.query.orders.findFirst({ where: eq(orders.number, number), with: { items: true } });
  if (!order) notFound();
  const delivery = DELIVERY_METHODS.find((d) => d.id === order.delivery);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative isolate overflow-hidden rounded-tile bg-forest-deep px-6 py-12 text-center text-cream sm:px-10">
        <span className="absolute -left-16 -top-16 -z-10 h-56 w-56 rounded-full bg-forest" aria-hidden />
        <span className="mx-auto grid h-16 w-16 animate-rise place-items-center rounded-full bg-lime text-ink">
          <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Благодарим, {order.name.split(" ")[0]}!</h1>
        <p className="mt-3 text-cream/75">
          Поръчка <strong className="text-lime">{order.number}</strong> е приета. Ще ти се обадим на {order.phone} за потвърждение.
        </p>
      </div>

      <div className="mt-6 rounded-tile bg-paper p-6 shadow-soft sm:p-8">
        <h2 className="font-display text-lg font-semibold">Детайли</h2>
        <ul className="mt-4 divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-3 text-[0.95rem]">
              <span>
                {i.name} <span className="text-ink-soft">× {i.qty}</span>
              </span>
              <span className="font-medium tabular-nums">{formatPrice(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-2 border-t border-line pt-4 text-[0.95rem]">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Доставка · {delivery?.label.toLowerCase() ?? order.delivery}</dt>
            <dd className="font-medium tabular-nums">{order.shipping === 0 ? "Безплатно" : formatPrice(order.shipping)}</dd>
          </div>
          <div className="flex justify-between text-lg">
            <dt className="font-semibold">Общо (наложен платеж)</dt>
            <dd className="font-bold tabular-nums">{formatPrice(order.total)}</dd>
          </div>
        </dl>
        <p className="mt-5 rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
          Доставяме до: {order.city}, {order.address}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className={btn.primary}>
          Продължи с пазаруването
        </Link>
        <a href={site.phoneHref} className={btn.ghost}>
          Въпроси? {site.phone}
        </a>
      </div>
    </div>
  );
}

export default function Page({ params }: Props) {
  return (
    <div className="container-shop pt-8 sm:pt-12">
      <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse rounded-tile bg-sand" aria-hidden />}>
        <Confirmation params={params} />
      </Suspense>
    </div>
  );
}
