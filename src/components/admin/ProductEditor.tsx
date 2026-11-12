import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { brands, categories, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
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
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{product[0]?.name ?? "Нов продукт"}</h1>
      <ProductForm key={product[0]?.id ?? "new"} product={product[0]} brands={allBrands} categories={tree} returnUrl={returnUrl} />
    </>
  );
}
