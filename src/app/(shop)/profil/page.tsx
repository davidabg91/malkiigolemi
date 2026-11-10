import { desc, eq } from "drizzle-orm";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrderProgress } from "@/components/account/OrderProgress";
import { ReorderButton } from "@/components/account/Reorder";
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
    with: { items: true },
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
    <ul className="space-y-4">
      {list.map((o) => {
        const pickup = o.delivery === "store";
        const method = DELIVERY_METHODS.find((d) => d.id === o.delivery);
        return (
          <li key={o.id} className="rounded-card bg-paper p-5 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{o.number}</p>
                <p className="text-sm text-ink-soft">{formatDate(o.createdAt)}</p>
              </div>
              <StatusPill status={o.status} />
            </div>
            <OrderProgress status={o.status} pickup={pickup} />
            <ul className="mt-4 space-y-1 border-t border-line pt-4 text-sm text-ink-soft">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4">
                  <span>
                    {i.name} × {i.qty}
                  </span>
                  <span className="tabular-nums">{formatPrice(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-soft">
              {method?.label ?? o.delivery}
              {pickup ? "" : ` · ${o.city}, ${o.address}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <p className="font-semibold">
                Общо <span className="tabular-nums">{formatPrice(o.total)}</span>
              </p>
              <ReorderButton orderId={o.id} />
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
