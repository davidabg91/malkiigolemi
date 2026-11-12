import { Edit3, Eye, Package, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function AdminProductBar({
  product,
}: {
  product: { id: number; slug: string; name: string; sku: string; stock: number; active: boolean; price: number };
}) {
  const editUrl = `/admin/produkti/${product.id}?returnUrl=${encodeURIComponent(`/produkt/${product.slug}`)}`;

  return (
    <div className="mb-6 rounded-2xl border-2 border-forest/30 bg-forest-deep text-cream p-3.5 sm:p-4 shadow-lift">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lime text-ink">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-lime">Администратор</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${product.active ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${product.active ? "bg-emerald-400" : "bg-red-400"}`} />
                {product.active ? "Активен в сайта" : "Скрит от клиенти"}
              </span>
            </div>
            <p className="text-xs text-cream/70 mt-0.5">
              Арт. №: <span className="font-mono text-white font-medium">{product.sku}</span> · Наличност: <span className="text-white font-medium">{product.stock} бр.</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={editUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-lime px-4 py-2 text-xs font-bold text-ink shadow transition hover:bg-lime-deep hover:scale-105"
          >
            <Edit3 className="h-4 w-4" />
            Редактирай този артикул
          </Link>
          <Link
            href="/admin/produkti"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <Package className="h-3.5 w-3.5" />
            Всички продукти
          </Link>
        </div>
      </div>
    </div>
  );
}
