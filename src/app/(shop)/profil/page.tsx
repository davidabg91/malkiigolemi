import { desc, eq } from "drizzle-orm";
import { Package, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CancelOrderButton } from "@/components/account/CancelOrderButton";
import { OrderProgress } from "@/components/account/OrderProgress";
import { ReorderButton } from "@/components/account/Reorder";
import { ProductVisual } from "@/components/product/PackShot";
import { StatusPill } from "@/components/StatusPill";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { DELIVERY_METHODS } from "@/lib/site";

export const metadata: Metadata = { title: "Моите поръчки", robots: { index: false } };

async function Orders() {
  const session = await getSession();
  if (!session) redirect("/vhod?next=/profil");

  const list = await db.query.orders.findMany({
    where: eq(orders.userId, session.uid),
    orderBy: desc(orders.createdAt),
    with: {
      items: {
        with: {
          product: {
            with: { brand: true },
          },
        },
      },
    },
    limit: 50,
  });

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-tile bg-paper px-6 py-16 text-center shadow-soft">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-lime">
          <Package className="h-7 w-7" strokeWidth={1.5} aria-hidden />
        </span>
        <p className="mt-5 font-display text-lg font-semibold">Още нямаш поръчки</p>
        <p className="mt-2 text-ink-soft">Когато поръчаш, ще виждаш статуса тук и ще можеш да поръчаш същото с един клик.</p>
        <Link href="/produkti" className={`${btn.primary} mt-6`}>
          Към продуктите
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-6">
      {list.map((o) => {
        const pickup = o.delivery === "store";
        const method = DELIVERY_METHODS.find((d) => d.id === o.delivery);
        const canCancel = o.status === "new" || o.status === "confirmed";

        return (
          <li key={o.id} className="rounded-card bg-paper p-5 shadow-soft sm:p-6 border border-line/60">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink text-base">{o.number}</p>
                <p className="text-sm text-ink-soft">{formatDate(o.createdAt)}</p>
              </div>
              <StatusPill status={o.status} />
            </div>

            {/* Tracking / Progress */}
            {o.status === "cancelled" ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs sm:text-sm text-red-900">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold text-red-950">Поръчката е отказана</p>
                  <p className="mt-0.5 text-red-800">
                    Тази поръчка е анулирана и артикулите са върнати обратно в наличност.
                  </p>
                </div>
              </div>
            ) : (
              <OrderProgress status={o.status} pickup={pickup} />
            )}

            {/* Order Items with visual thumbnails */}
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Поръчани продукти ({o.items.reduce((sum, item) => sum + item.qty, 0)})
              </p>
              <ul className="divide-y divide-line/60 rounded-2xl border border-line/60 bg-sand/20 p-2 sm:p-3">
                {o.items.map((i) => {
                  const p = i.product;
                  const visualData = p
                    ? {
                        name: i.name,
                        image: p.image,
                        pack: p.pack,
                        color: p.color,
                        brand: p.brand?.name ?? null,
                      }
                    : {
                        name: i.name,
                        image: null,
                        pack: "box",
                        color: "#6b7280",
                        brand: null,
                      };

                  const productHref = p?.slug ? `/produkt/${p.slug}` : null;

                  return (
                    <li key={i.id} className="flex items-center gap-3.5 py-2.5 first:pt-1 last:pb-1 sm:gap-4">
                      {productHref ? (
                        <Link
                          href={productHref}
                          className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-paper p-1 shadow-xs transition hover:scale-105 sm:h-20 sm:w-20"
                        >
                          <ProductVisual product={visualData} size={96} className="h-full w-full object-contain" />
                        </Link>
                      ) : (
                        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-paper p-1 shadow-xs sm:h-20 sm:w-20">
                          <ProductVisual product={visualData} size={96} className="h-full w-full object-contain" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        {productHref ? (
                          <Link
                            href={productHref}
                            className="line-clamp-2 text-sm font-medium leading-snug text-ink transition hover:text-forest sm:text-base"
                          >
                            {i.name}
                          </Link>
                        ) : (
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-ink sm:text-base">
                            {i.name}
                          </p>
                        )}

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
                          {p?.brand?.name && <span>{p.brand.name}</span>}
                          {p?.brand?.name && <span>·</span>}
                          <span>Арт. № {i.sku}</span>
                          {p?.unit && (
                            <>
                              <span>·</span>
                              <span>Мярка: {p.unit}</span>
                            </>
                          )}
                        </div>

                        <div className="mt-1 flex items-center text-xs text-ink-soft sm:text-sm">
                          <span>
                            {formatPrice(i.price)} {p?.unit ? `/${p.unit}` : ""} × {i.qty} бр.
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 pl-2 text-right">
                        <span className="block text-sm font-bold tabular-nums text-ink sm:text-base">
                          {formatPrice(i.price * i.qty)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Delivery address info */}
            <p className="mt-3 text-sm text-ink-soft">
              {method?.label ?? o.delivery}
              {pickup ? "" : ` · ${o.city}, ${o.address}`}
            </p>

            {/* Footer with actions */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <div>
                <p className="text-xs text-ink-soft">Крайна сума</p>
                <p className="text-base font-bold text-ink sm:text-lg">
                  <span className="tabular-nums">{formatPrice(o.total)}</span>
                  <span className="ml-1.5 text-xs font-normal text-ink-soft">
                    (вкл. {o.shipping === 0 ? "безплатна доставка" : `доставка ${formatPrice(o.shipping)}`})
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canCancel && <CancelOrderButton orderId={o.id} orderNumber={o.number} />}
                <ReorderButton orderId={o.id} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function Page() {
  return (
    <section aria-labelledby="orders-heading">
      <h2 id="orders-heading" className="mb-4 font-display text-xl font-semibold">
        Моите поръчки
      </h2>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-tile bg-sand" aria-hidden />}>
        <Orders />
      </Suspense>
    </section>
  );
}
