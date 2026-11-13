import { desc, eq, inArray } from "drizzle-orm";
import { AlertCircle, ArrowLeft, Mail, MapPin, Package, Phone, Printer, StickyNote, Truck, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { setOrderStatus } from "@/actions/admin";
import { flagOrderContact, removeFlag } from "@/actions/customers";
import { AdminSkeleton, Panel, td, th } from "@/components/admin/bits";
import { EcontWaybill, type ExistingWaybill } from "@/components/admin/EcontWaybill";
import { FlagBanner, FlagPanel } from "@/components/admin/Flag";
import { ProductVisual } from "@/components/product/PackShot";
import { StatusPill } from "@/components/StatusPill";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { brands, ORDER_STATUSES, orders, products, withdrawals } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { courierName } from "@/lib/couriers";
import { econtMode, econtTrackingUrl, parseEvents } from "@/lib/econt";
import { getEcontSettings, missingSenderFields } from "@/lib/econt-settings";
import { defaultWaybill, waybillBlocker } from "@/lib/shipments";
import { stripePaymentUrl } from "@/lib/stripe";
import { findFlag, getFlagIndex } from "@/lib/flags";
import { formatDate, formatPrice, formatTimestamp } from "@/lib/format";
import { DELIVERY_METHODS, ORDER_STATUS_LABELS } from "@/lib/site";

export const metadata: Metadata = { title: "Поръчка" };

async function AdminOrder({ params }: Pick<PageProps<"/admin/porachki/[id]">, "params">) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { items: true } });
  if (!order) notFound();
  const flag = findFlag(await getFlagIndex(), { userId: order.userId, email: order.email, phone: order.phone });
  const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.orderId, order.id)).orderBy(desc(withdrawals.createdAt)).limit(1);

  // The products' pictures. Hand-typed Facebook items have no product, and a product may have been deleted since.
  const productIds = order.items.map((i) => i.productId).filter((v): v is number => v != null);
  const visuals = productIds.length
    ? await db
        .select({ id: products.id, name: products.name, image: products.image, pack: products.pack, color: products.color, brand: brands.name })
        .from(products)
        .leftJoin(brands, eq(products.brandId, brands.id))
        .where(inArray(products.id, productIds))
    : [];
  const visualOf = new Map(visuals.map((v) => [v.id, v]));

  // Econt waybill: either the one already made, or the suggested one for the form.
  const isEcont = order.courier === "econt" && order.delivery !== "store";
  const econtSettings = isEcont ? await getEcontSettings() : null;
  const existing: ExistingWaybill | null =
    isEcont && order.trackingNumber
      ? {
          number: order.trackingNumber,
          pdfUrl: order.waybillUrl,
          trackingUrl: econtTrackingUrl(order.trackingNumber),
          status: order.shipmentStatus,
          events: parseEvents(order.trackingEvents),
          trackedAt: order.trackedAt?.toISOString() ?? null,
          cost: order.shippingCost,
        }
      : null;

  return (
    <>
      <Link href="/admin/porachki" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Всички поръчки
      </Link>

      {flag && (
        <FlagBanner flag={flag}>
          <p className="mt-1 text-ink-soft">Имейлът или телефонът на тази поръчка съвпада с отбелязан клиент. Обади се за потвърждение, преди да изпратиш.</p>
        </FlagBanner>
      )}

      {withdrawal && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-line bg-sun/25 p-4 text-sm">
          <Undo2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="text-base font-semibold">Клиентът се е отказал от договора</p>
            <p className="mt-1">
              На {formatTimestamp(withdrawal.createdAt)}
              {withdrawal.details ? ` — само от: ${withdrawal.details}` : " — от цялата поръчка"}.{" "}
              <Link href="/admin/otkazi" className="font-semibold underline underline-offset-2">
                Към отказите
              </Link>
            </p>
          </div>
        </div>
      )}

      {order.status === "cancelled" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-xs">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="text-sm">
            <p className="font-semibold text-base text-red-950">Поръчката е отказана</p>
            <p className="mt-1 text-red-800">
              {order.note?.includes("Отказана от клиента")
                ? "Тази поръчка беше отказана директно от клиента от секция „Моите поръчки“. Артикулите са автоматично върнати в складовата наличност."
                : "Тази поръчка е анулирана. Артикулите са възстановени в складовата наличност."}
            </p>
          </div>
        </div>
      )}

      <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{order.number}</h1>
        <StatusPill status={order.status} />
        <p className="w-full text-ink-soft">{formatDate(order.createdAt)}</p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel>
          <div className="overflow-x-auto p-1">
            <table className="w-full min-w-[30rem] text-[0.95rem]">
              <thead>
                <tr>
                  <th className={th}>Продукт</th>
                  <th className={`${th} text-right`}>Цена</th>
                  <th className={`${th} text-right`}>Бр</th>
                  <th className={`${th} text-right`}>Общо</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {order.items.map((i) => {
                  const v = i.productId != null ? visualOf.get(i.productId) : undefined;
                  return (
                    <tr key={i.id}>
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <span
                            className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl"
                            style={{ background: v ? `color-mix(in srgb, ${v.color} 12%, #f5f5f4)` : "#f1ede2" }}
                          >
                            {v ? <ProductVisual product={v} size={112} className="h-[88%] w-[88%]" /> : <Package className="h-6 w-6 text-ink-soft" aria-hidden />}
                          </span>
                          <div className="min-w-0">
                            {v ? (
                              <Link href={`/admin/produkti/${v.id}`} className="font-medium hover:text-forest">
                                {i.name}
                              </Link>
                            ) : (
                              i.name
                            )}
                            <p className="text-xs text-ink-soft">Арт. № {i.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{formatPrice(i.price)}</td>
                      <td className={`${td} text-right tabular-nums`}>{i.qty}</td>
                      <td className={`${td} text-right font-semibold tabular-nums`}>{formatPrice(i.price * i.qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <dl className="space-y-2 border-t border-line p-5 text-[0.95rem]">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Продукти</dt>
              <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Доставка</dt>
              <dd className="tabular-nums">{order.shipping === 0 ? "Безплатно" : formatPrice(order.shipping)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-forest">
                <dt>Отстъпка с {order.pointsUsed} точки</dt>
                <dd className="font-semibold tabular-nums">−{formatPrice(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <dt>{order.payment === "card" ? "Общо (с карта)" : order.delivery === "store" ? "Общо (в магазина)" : "Общо (наложен платеж)"}</dt>
              <dd className="tabular-nums">{formatPrice(order.total)}</dd>
            </div>
            {order.payment === "card" && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm">
                <dt className="text-ink-soft">Плащане с карта</dt>
                <dd className="flex items-center gap-2">
                  {order.refundedAt ? (
                    <span className="rounded-full bg-sand px-2.5 py-0.5 font-semibold">Върнато {formatDate(order.refundedAt)}</span>
                  ) : order.paidAt ? (
                    <span className="rounded-full bg-lime/60 px-2.5 py-0.5 font-semibold">Платено {formatDate(order.paidAt)}</span>
                  ) : (
                    <span className="rounded-full bg-tomato px-2.5 py-0.5 font-semibold text-white">Не е платено</span>
                  )}
                  {order.stripePaymentIntent && (
                    <a href={stripePaymentUrl(order.stripePaymentIntent)} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                      в Stripe
                    </a>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </Panel>

        <div className="space-y-6">
          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Статус</h2>
            <form action={setOrderStatus.bind(null, order.id)} className="mt-4 flex gap-2">
              <label htmlFor="status" className="sr-only">
                Нов статус
              </label>
              <select id="status" name="status" defaultValue={order.status} className="field flex-1">
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button type="submit" className={btn.primary}>
                Запази
              </button>
            </form>
            <p className="mt-3 text-sm text-ink-soft">При отказ количествата се връщат автоматично в наличност.</p>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Доставка & Товарителница</h2>
              {order.courier && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    order.courier === "econt"
                      ? "bg-blue-100 text-blue-900"
                      : order.courier === "speedy"
                      ? "bg-red-100 text-red-900"
                      : order.courier === "boxnow"
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-teal-100 text-teal-900"
                  }`}
                >
                  {courierName(order.courier) ?? order.courier}
                </span>
              )}
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-start gap-2.5">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
                <div>
                  <p className="font-semibold text-ink">
                    {DELIVERY_METHODS.find((d) => d.id === order.delivery)?.label ?? order.delivery}
                  </p>
                  {order.officeName && (
                    <p className="mt-0.5 text-ink">
                      {order.officeName}{" "}
                      {order.officeCode && <span className="text-xs text-ink-soft">(код: {order.officeCode})</span>}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {order.city}, {order.address}
                  </p>
                </div>
              </div>

              {isEcont && econtSettings ? (
                <EcontWaybill
                  orderId={order.id}
                  live={econtMode().live}
                  existing={existing}
                  blocker={waybillBlocker(order)}
                  missingSettings={missingSenderFields(econtSettings)}
                  defaults={defaultWaybill(order, econtSettings)}
                  pickupPossible={econtSettings.senderMode === "address"}
                />
              ) : order.trackingNumber ? (
                <div className="mt-4 rounded-xl border border-line bg-sand/40 p-3">
                  <p className="text-xs text-ink-soft">Номер на товарителница:</p>
                  <p className="font-mono text-base font-bold text-forest">{order.trackingNumber}</p>
                  {order.waybillUrl && (
                    <a
                      href={order.waybillUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:underline"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Печат на товарителница (PDF)
                    </a>
                  )}
                </div>
              ) : order.delivery !== "store" ? (
                <div className="mt-3 rounded-xl border border-dashed border-line bg-sand/20 p-3 text-xs text-ink-soft">
                  <p className="font-medium text-ink">Готово за генериране на товарителница</p>
                  <p className="mt-0.5">
                    Куриер: {courierName(order.courier) ?? "не е избран"} ·
                    Код: {order.officeCode || "До адрес"} · {order.payment === "card" ? "без наложен платеж (с карта)" : `НП: ${formatPrice(order.total)}`}
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Клиент</h2>
            <p className="mt-3 font-semibold">{order.name}</p>
            {order.userId ? (
              <Link href={`/admin/potrebiteli/${order.userId}`} className="text-sm font-semibold text-forest hover:underline">
                Профил и всички поръчки
              </Link>
            ) : (
              <p className="text-sm text-ink-soft">Поръчка без регистрация</p>
            )}
            <ul className="mt-3 space-y-2.5 text-[0.95rem]">
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
                <a href={`tel:${order.phone.replace(/\s/g, "")}`} className="hover:underline">
                  {order.phone}
                </a>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
                <a href={`mailto:${order.email}`} className="break-all hover:underline">
                  {order.email}
                </a>
              </li>
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
                <span>
                  {order.city}, {order.address}
                </span>
              </li>
              {order.note && (
                <li className="flex gap-3">
                  <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
                  <span className="whitespace-pre-line">{order.note}</span>
                </li>
              )}
            </ul>
          </Panel>

          <Panel className="p-5">
            <FlagPanel flag={flag} mark={flagOrderContact.bind(null, order.id)} clear={flag ? removeFlag.bind(null, flag.id) : undefined} />
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function Page({ params }: PageProps<"/admin/porachki/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminOrder params={params} />
    </Suspense>
  );
}
