import { eq } from "drizzle-orm";
import { Check, CreditCard, Loader2, Truck, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { payOrder } from "@/actions/payment";
import { OrderProgress } from "@/components/account/OrderProgress";
import { PushToggle } from "@/components/PushToggle";
import { StoreLocation } from "@/components/StoreLocation";
import { TrackingTimeline } from "@/components/TrackingTimeline";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { OrderDeliveryChoice, type DeliveryNow } from "@/components/OrderDeliveryChoice";
import { boxnowTrackingUrl } from "@/lib/boxnow";
import { savedOffice } from "@/lib/courier-offices";
import { courierName, isCourierId } from "@/lib/couriers";
import { econtTrackingUrl, parseEvents } from "@/lib/econt";
import { canChooseDelivery } from "@/lib/fb-orders";
import { formatDate, formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, type DeliveryId, site } from "@/lib/site";
import { pushConfigured, vapidPublicKey } from "@/lib/push";
import { syncShipmentsIfStale } from "@/lib/shipments";
import { awaitsCardPayment, syncPayment } from "@/lib/stripe";
import { lineName } from "@/lib/product-colors";

// Anybody with the link sees the order, without an account: the number in the address is the key to it.
export const metadata: Metadata = { title: "Вашата поръчка", robots: { index: false } };

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
  const fromGroup = order.source === "facebook";
  const cancelled = order.status === "cancelled";
  const courier = courierName(order.courier);
  // Where an order from the site has got to, once the shop has moved it on from "new".
  const progress =
    order.status === "confirmed"
      ? pickup
        ? "е потвърдена и се подготвя за взимане от магазина."
        : "е потвърдена и се подготвя за изпращане."
      : order.status === "shipped"
        ? pickup
          ? "е готова и те чака в магазина."
          : `е изпратена${courier ? ` с ${courier}` : ""}.`
        : order.status === "delivered"
          ? pickup
            ? "е взета. Благодарим ти!"
            : "е доставена. Благодарим ти!"
          : cancelled
            ? "е отказана."
            : null;
  // Ask the courier where the parcel is, for the next look at this page.
  if (order.trackingNumber && !cancelled && order.status !== "delivered") after(() => syncShipmentsIfStale());
  // The customer of an order from the group chooses here: from the shop, or sent by courier.
  const deliveryNow: DeliveryNow | null = canChooseDelivery(order)
    ? {
        delivery: (delivery?.id ?? "store") as DeliveryId,
        courier: isCourierId(order.courier) ? order.courier : "",
        office: savedOffice(order.delivery, order.courier, order.officeCode),
        city: pickup ? "" : order.city,
        address: pickup ? "" : order.address,
        name: order.name,
        phone: order.phone,
      }
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative isolate overflow-hidden rounded-tile bg-forest-deep px-6 py-12 text-center text-cream sm:px-10">
        <span className="absolute -left-16 -top-16 -z-10 h-56 w-56 rounded-full bg-forest" aria-hidden />
        <span className="mx-auto grid h-16 w-16 animate-rise place-items-center rounded-full bg-lime text-ink">
          {cancelled ? <X className="h-8 w-8" strokeWidth={2.5} aria-hidden /> : <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />}
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">
          {fromGroup ? "Здравейте" : cancelled ? "Здравей" : "Благодарим"}, {order.name.split(" ")[0]}!
        </h1>
        <p className="mt-3 text-cream/75">
          {fromGroup ? (
            // An order gathered from the Facebook group: this page is where its customer follows it.
            <>
              Поръчка <strong className="text-lime">{order.number}</strong>{" "}
              {order.status === "cancelled"
                ? "е отказана."
                : order.status === "delivered"
                  ? "е получена. Благодарим Ви!"
                  : order.status === "shipped"
                    ? "е изпратена с куриер."
                    : pickup
                      ? order.readyAt
                        ? "е в магазина и Ви чака."
                        : "е записана. Ще Ви пишем, когато продуктите пристигнат."
                      : order.readyAt
                        ? "ще бъде изпратена с куриер на посочените от Вас данни."
                        : "е записана за доставка с куриер. Изпращаме я, щом продуктите пристигнат."}
            </>
          ) : unpaid ? (
            <>
              Поръчка <strong className="text-lime">{order.number}</strong> е записана и чака плащане с карта.
            </>
          ) : progress ? (
            <>
              Поръчка <strong className="text-lime">{order.number}</strong> {progress}
            </>
          ) : (
            <>
              Поръчка <strong className="text-lime">{order.number}</strong> е {paid ? "платена и " : ""}приета.{order.phone ? ` Ще ти се обадим на ${order.phone} за потвърждение.` : ""}
            </>
          )}
        </p>
      </div>

      {!unpaid && (!fromGroup || cancelled || order.trackingNumber) && (
        <div className="mt-6 rounded-tile bg-paper p-6 shadow-soft sm:p-8">
          <h2 className="font-display text-lg font-semibold">Статус на поръчката</h2>
          {cancelled ? (
            <p className="mt-2 text-ink-soft">
              Поръчката е отказана и няма да бъде изпратена.
              {paid &&
                (order.refundedAt
                  ? ` Сумата ${formatPrice(order.total)} е върната по картата на ${formatDate(order.refundedAt)}. Банката я показва до няколко работни дни.`
                  : ` Платената сума ${formatPrice(order.total)} се връща по картата. Обади ни се, ако не я получиш до няколко дни.`)}
            </p>
          ) : (
            // An order from the Facebook group follows its own steps, told in the text above.
            !fromGroup && <OrderProgress status={order.status} pickup={pickup} />
          )}
          {order.trackingNumber && !cancelled && (
            <div className="mt-5 rounded-2xl bg-sand p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold">
                  <Truck className="h-4 w-4 text-forest" aria-hidden />
                  {order.shipmentStatus ?? "Пратката е подготвена"}
                </p>
                {order.courier === "econt" || order.courier === "boxnow" ? (
                  <a
                    href={order.courier === "econt" ? econtTrackingUrl(order.trackingNumber) : boxnowTrackingUrl(order.trackingNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-forest underline underline-offset-2"
                  >
                    Проследи пратка № {order.trackingNumber}
                  </a>
                ) : (
                  <span className="text-ink-soft">Товарителница № {order.trackingNumber}</span>
                )}
              </div>
              <TrackingTimeline events={parseEvents(order.trackingEvents).slice(-4)} />
            </div>
          )}
        </div>
      )}

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
                {lineName(i.name, i.color)} <span className="text-ink-soft">× {i.qty}</span>
                {i.deliveryTime && <span className="block text-sm text-ink-soft">Срок за доставка: {i.deliveryTime}</span>}
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

      {deliveryNow && <OrderDeliveryChoice key={`${order.delivery}-${order.officeCode ?? ""}`} number={order.number} now={deliveryNow} />}

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
