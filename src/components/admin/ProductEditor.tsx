import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink, EyeOff } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { brands, categories, products } from "@/db/schema";
import { ShareButton } from "@/components/ShareButton";
import { btn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { absoluteUrl, productTitle } from "@/lib/seo";
import { ProductForm } from "./ProductForm";

/** Shared by the "new" and "edit" admin pages. */
export async function ProductEditor({ id, returnUrl }: { id?: number; returnUrl?: string }) {
  await requireAdmin();
  const [allCategories, allBrands, product] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sort), asc(categories.id)),
    db.select().from(brands).orderBy(asc(brands.name)),
    id ? db.select().from(products).where(eq(products.id, id)).limit(1) : Promise.resolve([]),
  ]);
  if (id && !product[0]) notFound();

  const tree = allCategories
    .filter((c) => c.parentId === null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      children: allCategories.filter((s) => s.parentId === c.id).map((s) => ({ id: s.id, name: s.name })),
    }));

  return (
    <>
      <Link href={returnUrl || "/admin/produkti"} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        {returnUrl ? "Назад към обявата в сайта" : "Всички продукти"}
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="min-w-0 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{product[0]?.name ?? "Нов продукт"}</h1>
        {/* The listing as customers see it, and its link to send on. It shows what is saved, not what is being typed. */}
        {product[0] && (
          <div className="flex flex-wrap items-center gap-2">
            {!product[0].active && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sun/50 px-3 py-1.5 text-xs font-semibold" title="Обявата е скрита: вижда я само администратор.">
                <EyeOff className="h-3.5 w-3.5" aria-hidden />
                Скрита от клиенти
              </span>
            )}
            <Link href={`/produkt/${product[0].slug}`} className={btn.sm}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Виж обявата
            </Link>
            {/* A hidden listing opens only for an admin, so there is nothing to send to a customer. */}
            {product[0].active && (
              <ShareButton
                url={absoluteUrl(`/produkt/${product[0].slug}`)}
                title={productTitle({ name: product[0].name, unit: product[0].unit, brand: allBrands.find((b) => b.id === product[0].brandId)?.name ?? null })}
              />
            )}
          </div>
        )}
      </div>
      <ProductForm
        key={product[0]?.id ?? "new"}
        // What the form shows; the view counter and the place in the listings change without it.
        version={product[0] ? JSON.stringify({ ...product[0], views: 0, rank: null }) : "new"}
        product={product[0]}
        brands={allBrands}
        categories={tree}
        returnUrl={returnUrl}
      />
    </>
  );
}
