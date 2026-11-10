import { eq } from "drizzle-orm";
import { ArrowLeft, Mail, MapPin, Phone, StickyNote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setOrderStatus } from "@/actions/admin";
import { Panel, td, th } from "@/components/admin/bits";
import { StatusPill } from "@/components/StatusPill";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { ORDER_STATUSES, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, ORDER_STATUS_LABELS } from "@/lib/site";

export const metadata: Metadata = { title: "Поръчка" };

export default async function AdminOrder({ params }: PageProps<"/admin/porachki/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, id), with: { items: true } });
  if (!order) notFound();

  return (
    <>
      <Link href="/admin/porachki" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Всички поръчки
      </Link>
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
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td className={td}>
                      {i.name}
                      <p className="text-xs text-ink-soft">Арт. № {i.sku}</p>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{formatPrice(i.price)}</td>
                    <td className={`${td} text-right tabular-nums`}>{i.qty}</td>
                    <td className={`${td} text-right font-semibold tabular-nums`}>{formatPrice(i.price * i.qty)}</td>
                  </tr>
                ))}
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
            <div className="flex justify-between text-lg font-bold">
              <dt>Общо (наложен платеж)</dt>
              <dd className="tabular-nums">{formatPrice(order.total)}</dd>
            </div>
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
            <h2 className="font-display text-lg font-semibold">Клиент</h2>
            <p className="mt-3 font-semibold">{order.name}</p>
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
                  {DELIVERY_METHODS.find((d) => d.id === order.delivery)?.label ?? order.delivery}
                  <br />
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
        </div>
      </div>
    </>
  );
}
