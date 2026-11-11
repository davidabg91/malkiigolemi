import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { ArrowLeft, Mail, MapPin, Phone, Truck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { flagUser, removeFlag } from "@/actions/customers";
import { adjustPoints } from "@/actions/loyalty";
import { AdminSkeleton, Panel, td, th } from "@/components/admin/bits";
import { FlagBanner, FlagPanel } from "@/components/admin/Flag";
import { StatusPill } from "@/components/StatusPill";
import { db } from "@/db";
import { orders, users, type Order } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { courierName } from "@/lib/couriers";
import { findFlag, getFlagIndex } from "@/lib/flags";
import { formatDate, formatPrice } from "@/lib/format";
import { getLoyaltySettings, pointsBalance, pointsValue } from "@/lib/loyalty";
import { DELIVERY_METHODS } from "@/lib/site";

export const metadata: Metadata = { title: "Потребител" };

const deliveryLabel = (id: string | null) => DELIVERY_METHODS.find((d) => d.id === id)?.label ?? id ?? "—";

function OrdersTable({ list }: { list: Order[] }) {
  return (
    <div className="overflow-x-auto p-1">
      <table className="w-full min-w-[40rem] text-[0.95rem]">
        <thead>
          <tr>
            <th className={th}>Номер</th>
            <th className={th}>Доставка</th>
            <th className={th}>Статус</th>
            <th className={`${th} text-right`}>Сума</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.map((o) => (
            <tr key={o.id} className="transition hover:bg-sand/60">
              <td className={td}>
                <Link href={`/admin/porachki/${o.id}`} className="font-semibold hover:text-forest">
                  {o.number}
                </Link>
                <p className="text-xs text-ink-soft">{formatDate(o.createdAt)}</p>
              </td>
              <td className={td}>
                {deliveryLabel(o.delivery)}
                <p className="text-xs text-ink-soft">{[courierName(o.courier), o.city].filter(Boolean).join(" · ")}</p>
              </td>
              <td className={td}>
                <StatusPill status={o.status} />
              </td>
              <td className={`${td} text-right font-semibold tabular-nums`}>{formatPrice(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function AdminUser({ params }: Pick<PageProps<"/admin/potrebiteli/[id]">, "params">) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) notFound();

  const [own, asGuest, flags, points, loyalty] = await Promise.all([
    db.select().from(orders).where(eq(orders.userId, id)).orderBy(desc(orders.createdAt)),
    // Orders placed without signing in, but with this customer's e-mail.
    db
      .select()
      .from(orders)
      .where(and(isNull(orders.userId), eq(sql`lower(${orders.email})`, user.email.toLowerCase())))
      .orderBy(desc(orders.createdAt)),
    getFlagIndex(),
    pointsBalance(id),
    getLoyaltySettings(),
  ]);
  const flag = findFlag(flags, { userId: user.id, email: user.email, phone: user.phone });

  const kept = own.filter((o) => o.status !== "cancelled");
  const spent = kept.reduce((sum, o) => sum + o.total, 0);
  const tiles = [
    { label: "Поръчки", value: String(own.length) },
    { label: "Оборот (без отказани)", value: formatPrice(spent) },
    { label: "Средна поръчка", value: kept.length ? formatPrice(Math.round(spent / kept.length)) : "—" },
    { label: "Отказани", value: String(own.length - kept.length) },
  ];

  return (
    <>
      <Link href="/admin/potrebiteli" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Всички потребители
      </Link>

      {flag && <FlagBanner flag={flag} />}

      <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-lime">
          <UserRound className="h-6 w-6" strokeWidth={1.5} aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{user.name}</h1>
          <p className="text-sm text-ink-soft">
            Регистриран на {formatDate(user.createdAt)}
            {user.role === "admin" ? " · администратор" : ""}
          </p>
        </div>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label} className="rounded-card bg-paper p-5 shadow-soft">
            <p className="text-sm text-ink-soft">{t.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <Panel>
            <h2 className="px-5 pt-5 font-display text-lg font-semibold">Поръчки</h2>
            {own.length === 0 ? <p className="px-5 py-10 text-center text-ink-soft">Този клиент още няма поръчки.</p> : <OrdersTable list={own} />}
          </Panel>

          {asGuest.length > 0 && (
            <Panel>
              <h2 className="px-5 pt-5 font-display text-lg font-semibold">Поръчки без вход, със същия имейл</h2>
              <OrdersTable list={asGuest} />
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Данни</h2>
            <ul className="mt-3 space-y-2.5 text-[0.95rem]">
              <li className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
                <a href={`mailto:${user.email}`} className="break-all hover:text-forest">
                  {user.email}
                </a>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
                {user.phone ? (
                  <a href={`tel:${user.phone.replace(/\s/g, "")}`} className="hover:text-forest">
                    {user.phone}
                  </a>
                ) : (
                  <span className="text-ink-soft">Няма въведен телефон</span>
                )}
              </li>
              <li className="flex gap-3">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
                <span>
                  {user.preferredDelivery ? deliveryLabel(user.preferredDelivery) : <span className="text-ink-soft">Няма предпочитана доставка</span>}
                  {user.preferredDelivery && user.preferredDelivery !== "store" && courierName(user.preferredCourier) && (
                    <span className="text-ink-soft"> · {courierName(user.preferredCourier)}</span>
                  )}
                  {user.preferredOfficeName && <span className="block text-sm text-ink-soft">{user.preferredOfficeName}</span>}
                </span>
              </li>
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
                {user.city || user.address ? (
                  <span>{[user.city, user.address].filter(Boolean).join(", ")}</span>
                ) : (
                  <span className="text-ink-soft">Няма запазен адрес</span>
                )}
              </li>
            </ul>
          </Panel>

          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Точки</h2>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {points} <span className="text-base font-medium text-ink-soft">= {formatPrice(pointsValue(points, loyalty))}</span>
            </p>
            <form action={adjustPoints.bind(null, user.id)} className="mt-4 grid grid-cols-[6rem_1fr] gap-2">
              <label htmlFor="adjust-points" className="sr-only">
                Точки
              </label>
              <input id="adjust-points" name="points" type="number" required placeholder="+50 / −20" className="field h-10 text-sm tabular-nums" />
              <label htmlFor="adjust-note" className="sr-only">
                Причина
              </label>
              <input id="adjust-note" name="note" maxLength={200} placeholder="Причина (по желание)" className="field h-10 text-sm" />
              <button type="submit" className="col-span-2 inline-flex h-10 items-center justify-center rounded-full border border-line bg-paper text-sm font-semibold transition hover:border-ink">
                Добави или отнеми точки
              </button>
            </form>
          </Panel>

          {user.role !== "admin" && (
            <Panel className="p-5">
              <FlagPanel flag={flag} mark={flagUser.bind(null, user.id)} clear={flag ? removeFlag.bind(null, flag.id) : undefined} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page({ params }: PageProps<"/admin/potrebiteli/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminUser params={params} />
    </Suspense>
  );
}
