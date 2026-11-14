import { SearchX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { Breadcrumbs, btn } from "@/components/ui";
import { SORTS, type SortKey } from "@/lib/listing";
import { listProducts, type ListingScope } from "@/lib/queries";
import { ListingShell, type Current } from "./ListingShell";
import { SortableGrid } from "./SortableGrid";

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) =>
  one(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
const euros = (v: string | string[] | undefined) => {
  const n = Number(one(v));
  return one(v) !== "" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

export function parseFilters(sp: SearchParams): Current & { page: number } {
  const sort = one(sp.sort);
  return {
    categories: list(sp.cat),
    brands: list(sp.brand),
    origins: list(sp.origin).map((o) => o.toUpperCase()),
    min: euros(sp.min),
    max: euros(sp.max),
    only: list(sp.only).filter((k) => k === "promo" || k === "new" || k === "stock"),
    sort: (sort in SORTS ? sort : "popular") as SortKey,
    page: Math.max(1, Math.floor(Number(one(sp.page))) || 1),
  };
}

function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav aria-label="Страници" className="mt-10 flex justify-center">
      <ul className="flex items-center gap-1.5">
        {nums.map((n, i) => (
          <li key={n} className="flex items-center gap-1.5">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-soft">…</span>}
            <Link
              href={hrefFor(n)}
              aria-current={n === page ? "page" : undefined}
              className={`grid h-11 min-w-11 place-items-center rounded-full px-3 text-sm font-semibold transition ${n === page ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`}
            >
              {n}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ListingHeader({
  crumbs,
  title,
  description,
  children,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  description?: string | null;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[2.6rem]">{title}</h1>
      {description && <p className="mt-3 max-w-2xl text-lg text-ink-soft">{description}</p>}
      {children}
    </header>
  );
}

export async function Listing({
  scope,
  searchParams,
  basePath,
  preserve,
  nav,
  emptyHint,
}: {
  scope: ListingScope;
  searchParams: SearchParams;
  basePath: string;
  preserve?: Record<string, string>;
  nav?: ReactNode;
  emptyHint?: string;
}) {
  const f = parseFilters(searchParams);
  const result = await listProducts(scope, {
    categories: f.categories,
    brands: f.brands,
    origins: f.origins,
    min: f.min != null ? f.min * 100 : undefined,
    max: f.max != null ? f.max * 100 : undefined,
    only: f.only,
    sort: f.sort,
    page: f.page,
  });

  const hrefFor = (p: number) => {
    const qs = new URLSearchParams(preserve);
    for (const key of ["cat", "brand", "origin", "min", "max", "only", "sort"] as const) {
      const v = one(searchParams[key]);
      if (v) qs.set(key, v);
    }
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <ListingShell
      basePath={basePath}
      preserve={preserve}
      total={result.total}
      current={{ categories: f.categories, brands: f.brands, origins: f.origins, min: f.min, max: f.max, only: f.only, sort: f.sort }}
      facets={{
        categories: result.facets.categories,
        subcategories: result.facets.subcategories,
        scopeTotal: result.facets.scopeTotal,
        // A filter that would keep everything, or nothing, is not offered.
        only: (
          [
            ["promo", "С намаление", result.facets.promo],
            ["new", "Нови", result.facets.fresh],
            ["stock", "В наличност", result.facets.stock],
          ] as const
        )
          .filter(([key, , n]) => (n > 0 && n < result.facets.scopeTotal) || f.only.includes(key))
          .map(([key, label, n]) => ({ key, label, n })),
        brands: result.facets.brands,
        origins: result.facets.origins,
        priceMin: Math.floor(result.facets.priceMin / 100),
        priceMax: Math.ceil(result.facets.priceMax / 100),
      }}
      nav={nav}
    >
      {result.items.length === 0 ? (
        <div className="flex flex-col items-center rounded-tile bg-paper px-6 py-16 text-center shadow-soft">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-sand">
            <SearchX className="h-7 w-7 text-ink-soft" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="mt-5 font-display text-xl font-semibold">Няма намерени продукти</p>
          <p className="mt-2 max-w-sm text-ink-soft">{emptyHint ?? "Опитай да махнеш някой филтър или разгледай друга категория."}</p>
          <Link href={basePath + (preserve ? `?${new URLSearchParams(preserve)}` : "")} className={`${btn.primary} mt-6`}>
            Изчисти филтрите
          </Link>
        </div>
      ) : (
        <>
          <SortableGrid
            ids={result.items.map((p) => p.id)}
            cards={result.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
            // Arranging by hand makes sense in a category, in the shop's own order.
            sortable={Boolean(scope.categoryIds?.length) && f.sort === "popular"}
          />
          <Pagination page={result.page} pages={result.pages} hrefFor={hrefFor} />
        </>
      )}
    </ListingShell>
  );
}

export function ListingSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[16.5rem_1fr]" aria-hidden>
      <div className="hidden h-96 animate-pulse rounded-card bg-sand lg:block" />
      <div>
        <div className="mb-5 h-10 w-40 animate-pulse rounded-full bg-sand" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[3/4.4] animate-pulse rounded-card bg-sand" />
          ))}
        </div>
      </div>
    </div>
  );
}
