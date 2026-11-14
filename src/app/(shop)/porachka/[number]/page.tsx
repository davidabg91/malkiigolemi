import { eq } from "drizzle-orm";
import { Check, CreditCard, Loader2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { payOrder } from "@/actions/payment";
import { PushToggle } from "@/components/PushToggle";
import { StoreLocation } from "@/components/StoreLocation";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { courierName } from "@/lib/couriers";
import { formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, site } from "@/lib/site";
import { pushConfigured, vapidPublicKey } from "@/lib/push";
import { awaitsCardPayment, syncPayment } from "@/lib/stripe";

export const metadata: Metadata = { title: "Благодарим за поръчката", robots: { index: false } };

type Props = PageProps<"/porachka/[number]">;

async function Confirmation({ params, searchParams }: Props) {
  const [{ number }, { plashtane }] = await Promise.all([params, searchParams]);
  const order = await db.query.orders.findFirst({ where: eq(orders.number, number), with: { items: true } });
  if (!order) notFound();
  // Back from Stripe before its webhook arrived: ask Stripe directly.
  const justPaid = await syncPayment(order);
  const paid = Boolean(order.paidAt) || justPaid;
  const unpaid = awaitsCardPayment(order) && !justPaid;
  const delivery = DELIVERY_METHODS.find((d) => d.id === order.delivery);
  const pickup = order.delivery === "store";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative isolate overflow-hidden rounded-tile bg-forest-deep px-6 py-12 text-center text-cream sm:px-10">
        <span className="absolute -left-16 -top-16 -z-10 h-56 w-56 rounded-full bg-forest" aria-hidden />
        <span className="mx-auto grid h-16 w-16 animate-rise place-items-center rounded-full bg-lime text-ink">
          <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Благодарим, {order.name.split(" ")[0]}!</h1>
        <p className="mt-3 text-cream/75">
          {unpaid ? (
            <>
              Поръчка <strong className="text-lime">{order.number}</strong> е записана и чака плащане с карта.
            </>
          ) : (
            <>
              Поръчка <strong className="text-lime">{order.number}</strong> е {paid ? "платена и " : ""}приета. Ще ти се обадим на {order.phone} за потвърждение.
            </>
          )}
        </p>
      </div>

      {pushConfigured() && order.status !== "cancelled" && order.status !== "delivered" && (
        <PushToggle publicKey={vapidPublicKey()} orderNumber={order.number} className="mt-6" />
      )}

      {unpaid && (
        <div className="mt-6 rounded-tile border border-line bg-paper p-6 shadow-soft sm:p-8">
          {plashtane === "uspeshno" ? (
            <p role="status" className="flex items-center gap-2 font-medium">
              <Loader2 className="h-5 w-5 animate-spin text-forest" aria-hidden />
              Плащането се потвърждава… Обнови страницата след малко.
            </p>
          ) : (
            <>
              <h2 className="font-display text-lg font-semibold">Плащането не е завършено</h2>
              <p className="mt-1 text-ink-soft">
                {plashtane === "greshka"
                  ? "Страницата за плащане не можа да се отвори. Опитай отново или ни се обади."
                  : "Плати сега, за да изпратим поръчката. Ако не платиш до час, поръчката се отказва автоматично."}
              </p>
              <form action={payOrder.bind(null, order.number)} className="mt-4">
                <button type="submit" className={btn.primary}>
                  <CreditCard className="h-5 w-5" aria-hidden />
                  Плати с карта {formatPrice(order.total)}
                </button>
              </form>
            </>
          )}
        </div>
      )}

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
          {order.discount > 0 && (
            <div className="flex justify-between text-forest">
              <dt>Отстъпка с {order.pointsUsed} точки</dt>
              <dd className="font-semibold tabular-nums">−{formatPrice(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-lg">
            <dt className="font-semibold">
              {pickup
                ? "Общо (плащане в магазина)"
                : order.payment === "card"
                ? paid
                  ? "Общо (платено с карта)"
                  : "Общо (плащане с карта)"
                : "Общо (наложен платеж)"}
            </dt>
            <dd className="font-bold tabular-nums">{formatPrice(order.total)}</dd>
          </div>
        </dl>
        {pickup ? (
          <StoreLocation className="mt-5" />
        ) : (
          <div className="mt-5 rounded-2xl bg-sand p-4 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium text-ink">
              <span>
                {order.delivery === "box"
                  ? "Доставка до автомат: "
                  : order.delivery === "office"
                  ? "Доставка до офис: "
                  : "Доставка до адрес: "}
                <strong>
                  {courierName(order.courier) ?? "Куриер"}
                </strong>
              </span>
              {order.officeCode && (
                <span className="rounded bg-paper px-1.5 py-0.5 text-xs font-semibold text-ink-soft">
                  Код #{order.officeCode}
                </span>
              )}
            </div>
            {order.officeName && <p className="font-semibold text-ink">{order.officeName}</p>}
            <p className="text-ink-soft">
              {order.city}, {order.address}
            </p>
          </div>
        )}
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

export default function Page({ params, searchParams }: Props) {
  return (
    <div className="container-shop pt-8 sm:pt-12">
      <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse rounded-tile bg-sand" aria-hidden />}>
        <Confirmation params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
