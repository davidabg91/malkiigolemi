import { desc, eq } from "drizzle-orm";
import { LogOut, Package, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/actions/auth";
import { StatusPill } from "@/components/StatusPill";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Моят профил", robots: { index: false } };

async function Profile() {
  const session = await getSession();
  if (!session) redirect("/vhod?next=/profil");

  const list = await db.query.orders.findMany({
    where: eq(orders.userId, session.uid),
    orderBy: desc(orders.createdAt),
    with: { items: true },
    limit: 50,
  });

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">{session.email}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem]">Здравей, {session.name.split(" ")[0]}</h1>
        </div>
        <div className="flex gap-2">
          {session.role === "admin" && (
            <Link href="/admin" className={btn.sm}>
              <Settings className="h-4 w-4" />
              Админ панел
            </Link>
          )}
          <form action={logout}>
            <button type="submit" className={btn.sm}>
              <LogOut className="h-4 w-4" />
              Изход
            </button>
          </form>
        </div>
      </header>

      <section className="mt-10" aria-labelledby="orders-heading">
        <h2 id="orders-heading" className="mb-4 font-display text-xl font-semibold">
          Моите поръчки
        </h2>
        {list.length === 0 ? (
          <div className="flex flex-col items-center rounded-tile bg-paper px-6 py-16 text-center shadow-soft">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-lime">
              <Package className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            </span>
            <p className="mt-5 font-display text-lg font-semibold">Още нямаш поръчки</p>
            <p className="mt-2 text-ink-soft">Когато поръчаш, ще виждаш статуса тук.</p>
            <Link href="/produkti" className={`${btn.primary} mt-6`}>
              Към продуктите
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {list.map((o) => (
              <li key={o.id} className="rounded-card bg-paper p-5 shadow-soft sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{o.number}</p>
                    <p className="text-sm text-ink-soft">{formatDate(o.createdAt)}</p>
                  </div>
                  <StatusPill status={o.status} />
                </div>
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
                <p className="mt-3 flex justify-between border-t border-line pt-3 font-semibold">
                  <span>Общо с доставка</span>
                  <span className="tabular-nums">{formatPrice(o.total)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function Page() {
  return (
    <div className="container-shop max-w-3xl pt-8 sm:pt-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-tile bg-sand" aria-hidden />}>
        <Profile />
      </Suspense>
    </div>
  );
}
