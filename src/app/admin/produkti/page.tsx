import { and, asc, desc, eq, inArray, like, lt, sql, type SQL } from "drizzle-orm";
import { Pencil, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle, Panel, td, th } from "@/components/admin/bits";
import { BULK_PRODUCTS_FORM, BulkProductsBar, SelectAllProducts } from "@/components/admin/BulkProducts";
import { DeleteButton, ToggleActive } from "@/components/admin/RowActions";
import { ProductVisual } from "@/components/product/PackShot";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { brands, categories, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Продукти" };

const PER_PAGE = 30;

async function AdminProducts({ searchParams }: Pick<PageProps<"/admin/produkti">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 60);
  const cat = Number(sp.cat) || 0;
  const lowStock = sp.stock === "low";
  const page = Math.max(1, Number(sp.page) || 1);

  const allCategories = await db.select().from(categories).orderBy(asc(categories.sort), asc(categories.id));
  const roots = allCategories.filter((c) => c.parentId === null);

  const where: SQL[] = [];
  for (const word of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    where.push(like(products.searchText, `%${word.replace(/[%_]/g, "")}%`));
  }
  if (cat) {
    const ids = [cat, ...allCategories.filter((c) => c.parentId === cat).map((c) => c.id)];
    where.push(inArray(products.categoryId, ids));
  }
  if (lowStock) where.push(lt(products.stock, 10));

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ product: products, brand: brands.name, category: categories.name })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...where))
      .orderBy(desc(products.id))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ total: sql<number>`count(*)` }).from(products).where(and(...where)),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const hrefFor = (p: number) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (cat) qs.set("cat", String(cat));
    if (lowStock) qs.set("stock", "low");
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/admin/produkti?${s}` : "/admin/produkti";
  };

  return (
    <>
      <PageTitle
        title="Продукти"
        sub={`${total} ${total === 1 ? "продукт" : "продукта"}${lowStock ? " с ниска наличност" : ""}`}
        action={
          <Link href="/admin/produkti/nov" className={btn.primary}>
            <Plus className="h-[18px] w-[18px]" />
            Нов продукт
          </Link>
        }
      />

      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <div className="relative min-w-56 flex-1">
          <label htmlFor="q" className="sr-only">
            Търсене по име, марка или номер
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input id="q" name="q" defaultValue={q} placeholder="Име, марка или артикулен №" className="field pl-11" />
        </div>
        <label htmlFor="cat" className="sr-only">
          Категория
        </label>
        <select id="cat" name="cat" defaultValue={cat || ""} className="field w-auto">
          <option value="">Всички категории</option>
          {roots.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {lowStock && <input type="hidden" name="stock" value="low" />}
        <button type="submit" className={btn.dark}>
          Филтрирай
        </button>
        {(q || cat || lowStock) && (
          <Link href="/admin/produkti" className={btn.ghost}>
            Изчисти
          </Link>
        )}
      </form>

      {rows.length > 0 && <BulkProductsBar />}

      <Panel>
        {rows.length === 0 ? (
          <p className="px-5 py-14 text-center text-ink-soft">Няма продукти по тези критерии.</p>
        ) : (
          <div className="overflow-x-auto p-1">
            <table className="w-full min-w-[48rem] text-[0.95rem]">
              <thead>
                <tr>
                  <th className={`${th} w-10`}>
                    <SelectAllProducts />
                  </th>
                  <th className={th}>Продукт</th>
                  <th className={th}>Категория</th>
                  <th className={`${th} text-right`}>Цена</th>
                  <th className={`${th} text-right`}>Наличност</th>
                  <th className={`${th} text-right`}>Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ product: p, brand, category }) => (
                  <tr key={p.id} className={`transition hover:bg-sand/60 ${p.active ? "" : "opacity-55"}`}>
                    <td className={td}>
                      <input type="checkbox" form={BULK_PRODUCTS_FORM} name="ids" value={p.id} aria-label={`Избери: ${p.name}`} className="block h-5 w-5 accent-[#33484b]" />
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sand">
                          <ProductVisual product={{ ...p, brand }} size={96} className="h-10 w-10" />
                        </span>
                        <div className="min-w-0">
                          <Link href={`/admin/produkti/${p.id}`} className="line-clamp-1 font-medium hover:text-forest">
                            {p.name}
                          </Link>
                          <p className="truncate text-xs text-ink-soft">
                            {brand ?? "без марка"} · {p.unit} · № {p.sku}
                            {!p.active && " · скрит"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`${td} text-ink-soft`}>{category}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      <span className="font-semibold">{formatPrice(p.price)}</span>
                      {p.oldPrice && <span className="block text-xs text-ink-soft line-through">{formatPrice(p.oldPrice)}</span>}
                    </td>
                    <td className={`${td} text-right`}>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${p.stock === 0 ? "bg-tomato text-white" : p.stock < 10 ? "bg-sun/50" : "bg-sand"}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className={td}>
                      <div className="flex justify-end">
                        <Link href={`/admin/produkti/${p.id}`} className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink" aria-label={`Редактирай: ${p.name}`} title="Редактирай">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <ToggleActive id={p.id} active={p.active} name={p.name} />
                        <DeleteButton id={p.id} name={p.name} kind="product" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {pages > 1 && (
        <nav aria-label="Страници" className="mt-6 flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={hrefFor(n)}
              aria-current={n === page ? "page" : undefined}
              className={`grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-semibold ${n === page ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/produkti">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminProducts searchParams={searchParams} />
    </Suspense>
  );
}
