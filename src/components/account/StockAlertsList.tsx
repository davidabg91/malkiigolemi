import { and, desc, eq } from "drizzle-orm";
import { BellRing, PackageCheck, X } from "lucide-react";
import Link from "next/link";
import { dismissStockAlert } from "@/actions/stock-alerts";
import { db } from "@/db";
import { products, stockAlerts } from "@/db/schema";

/**
 * Products the customer asked to be told about: the ones back in stock first, then the ones still awaited.
 * Works without e-mail, so a signed-in customer always finds out.
 */
export async function StockAlertsList({ userId }: { userId: number }) {
  const rows = await db
    .select({ id: stockAlerts.id, name: products.name, unit: products.unit, slug: products.slug, stock: products.stock })
    .from(stockAlerts)
    .innerJoin(products, eq(products.id, stockAlerts.productId))
    .where(and(eq(stockAlerts.userId, userId), eq(products.active, true)))
    .orderBy(desc(stockAlerts.createdAt));
  if (rows.length === 0) return null;
  const back = rows.filter((r) => r.stock > 0);
  const waiting = rows.filter((r) => r.stock <= 0);

  const row = (r: (typeof rows)[number], ready: boolean) => (
    <li key={r.id} className="flex items-center gap-3 py-2.5">
      {ready ? <PackageCheck className="h-5 w-5 shrink-0 text-forest" aria-hidden /> : <BellRing className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />}
      <Link href={`/produkt/${r.slug}`} className="min-w-0 flex-1 truncate font-medium hover:text-forest">
        {r.name} {r.unit}
      </Link>
      {ready && <span className="shrink-0 rounded-full bg-lime px-2.5 py-0.5 text-xs font-bold">Наличен</span>}
      <form action={dismissStockAlert.bind(null, r.id)}>
        <button type="submit" aria-label={ready ? `Скрий ${r.name}` : `Спри известието за ${r.name}`} className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </li>
  );

  return (
    <section className={`mb-6 rounded-tile p-5 shadow-soft sm:p-6 ${back.length ? "bg-lime/30" : "bg-paper"}`} aria-labelledby="alerts-heading">
      <h2 id="alerts-heading" className="font-display text-lg font-semibold">
        {back.length ? "Отново в наличност" : "Чакаш да се заредят"}
      </h2>
      <ul className="mt-2 divide-y divide-line">
        {back.map((r) => row(r, true))}
        {waiting.map((r) => row(r, false))}
      </ul>
    </section>
  );
}
