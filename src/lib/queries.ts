import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, like, lte, or, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { brands, categories, categoryRedirects, products, type Category } from "@/db/schema";
import { PER_PAGE, type SortKey } from "./listing";
import { catalogCacheLife, effectiveOldPrice, effectivePrice, pricedColumns, promoPercent } from "./pricing";

/**
 * The shop's order: products the admin arranged by hand keep their place, the rest go newest first
 * (see `rank` in the schema).
 */
const shopOrder = [sql`coalesce(${products.rank}, -${products.createdAt})`, desc(products.id)];

/** Every catalogue read is tagged so admin edits can invalidate it in one call. */
export const CATALOG_TAG = "catalog";

const card = {
  id: products.id,
  slug: products.slug,
  sku: products.sku,
  name: products.name,
  unit: products.unit,
  // Prices as the customer pays them right now, live promotions included.
  ...pricedColumns,
  image: products.image,
  pack: products.pack,
  color: products.color,
  origin: products.origin,
  isNew: products.isNew,
  stock: products.stock,
  brand: brands.name,
  rating: sql<number | null>`(select round(avg(r.rating), 1) from reviews r where r.product_id = ${products.id} and r.hidden = 0)`,
  reviewCount: sql<number>`(select count(*) from reviews r where r.product_id = ${products.id} and r.hidden = 0)`,
};

export type ProductCardData = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  oldPrice: number | null;
  bulkMinQty: number | null;
  bulkPrice: number | null;
  image: string | null;
  pack: string;
  color: string;
  origin: string | null;
  isNew: boolean;
  stock: number;
  brand: string | null;
  /** Average of published reviews, one decimal; null without reviews. */
  rating?: number | null;
  reviewCount?: number;
};

export type CategoryNode = Category & { children: Category[]; count: number };

const cards = () => db.select(card).from(products).leftJoin(brands, eq(products.brandId, brands.id));
const isPromo = or(isNotNull(products.oldPrice), isNotNull(products.bulkPrice), sql`${promoPercent} is not null`)!;

/**
 * What the shop may show and sell: an active product whose category, and that category's parent,
 * are both switched on. Switching a category off in the admin hides its products everywhere, not just the menu.
 */
export const sellable = and(
  eq(products.active, true),
  sql`${products.categoryId} not in (
    select c.id from categories c left join categories p on p.id = c.parent_id
    where c.active = 0 or coalesce(p.active, 1) = 0
  )`,
)!;

export async function getCategoryTree(): Promise<CategoryNode[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const all = await db
    .select()
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.sort), asc(categories.id));
  const counts = await db
    .select({ categoryId: products.categoryId, n: sql<number>`count(*)` })
    .from(products)
    .where(sellable)
    .groupBy(products.categoryId);
  const countOf = new Map(counts.map((c) => [c.categoryId, c.n]));

  return all
    .filter((c) => c.parentId === null)
    .map((root) => {
      const children = all.filter((c) => c.parentId === root.id);
      const count = [root, ...children].reduce((sum, c) => sum + (countOf.get(c.id) ?? 0), 0);
      return { ...root, children, count };
    });
}

/** A few hero products per root category, used to illustrate the category tiles. */
export async function getCategoryShowcase() {
  "use cache";
  await catalogCacheLife();
  cacheTag(CATALOG_TAG);

  const tree = await getCategoryTree();
  const out: Record<number, ProductCardData[]> = {};
  for (const root of tree) {
    const ids = [root.id, ...root.children.map((c) => c.id)];
    const rows = await cards()
      .where(and(sellable, inArray(products.categoryId, ids)))
      .orderBy(...shopOrder)
      .limit(12);
    // Prefer visually different packs so the tile does not show three identical boxes.
    const picked: ProductCardData[] = [];
    for (const r of rows) {
      if (picked.length < 3 && !picked.some((p) => p.pack === r.pack)) picked.push(r);
    }
    for (const r of rows) {
      if (picked.length < 3 && !picked.includes(r)) picked.push(r);
    }
    out[root.id] = picked;
  }
  return out;
}

export async function getHomeData() {
  "use cache";
  await catalogCacheLife();
  cacheTag(CATALOG_TAG);

  const active = sellable;
  const [promo, fresh, bulk, origins, brandList] = await Promise.all([
    cards().where(and(active, sql`${effectiveOldPrice} is not null`)).orderBy(...shopOrder).limit(12),
    // Enough for a few pages of the auto-advancing shelf.
    cards().where(and(active, eq(products.isNew, true))).orderBy(desc(products.createdAt)).limit(30),
    cards().where(and(active, isNotNull(products.bulkPrice))).orderBy(...shopOrder).limit(4),
    // The countries the shop actually sells most products from, for the "by origin" tabs.
    db
      .select({ origin: products.origin, n: sql<number>`count(*)` })
      .from(products)
      .where(and(active, isNotNull(products.origin)))
      .groupBy(products.origin)
      .orderBy(desc(sql`count(*)`))
      .limit(4),
    // Only brands with something on sale: each one links to its own page.
    db
      .select({ id: brands.id, slug: brands.slug, name: brands.name })
      .from(brands)
      .innerJoin(products, eq(products.brandId, brands.id))
      .where(active)
      .groupBy(brands.id)
      .orderBy(asc(brands.name)),
  ]);
  const byOrigin = await Promise.all(
    origins
      .filter((o) => o.origin)
      .map(async (o) => ({
        origin: o.origin!,
        count: o.n,
        products: await cards().where(and(active, eq(products.origin, o.origin!))).orderBy(...shopOrder).limit(20),
      })),
  );
  return { promo, fresh, bulk, byOrigin, brands: brandList };
}

export async function getCategoryPath(slugs: string[]) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const tree = await getCategoryTree();
  const root = tree.find((c) => c.slug === slugs[0]);
  if (!root) return null;
  if (slugs.length === 1) return { root, sub: null };
  const sub = root.children.find((c) => c.slug === slugs[1]);
  if (!sub || slugs.length > 2) return null;
  return { root, sub };
}

/**
 * Where an address that no longer names a category leads now: a renamed category keeps its old slugs in
 * `category_redirects`. Returns the current path, or null when the address was never a category.
 */
export async function getRenamedCategoryPath(slugs: string[]): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  if (slugs.length === 0 || slugs.length > 2) return null;
  const all = await db.select({ id: categories.id, slug: categories.slug, parentId: categories.parentId }).from(categories);
  const old = await db.select().from(categoryRedirects).where(inArray(categoryRedirects.slug, slugs));
  const find = (slug: string) => all.find((c) => c.slug === slug) ?? all.find((c) => c.id === old.find((o) => o.slug === slug)?.categoryId);
  // The last part names the page; the path of a subcategory is rebuilt from its parent.
  const target = find(slugs[slugs.length - 1]);
  if (!target) return null;
  const parent = target.parentId ? all.find((c) => c.id === target.parentId) : null;
  if (target.parentId && !parent) return null;
  return parent ? `/kategoria/${parent.slug}/${target.slug}` : `/kategoria/${target.slug}`;
}

/** A brand by its slug, for the brand page. */
export async function getBrand(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const [brand] = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
  return brand ?? null;
}

export type ListingScope = {
  categoryIds?: number[];
  brandId?: number;
  promo?: boolean;
  isNew?: boolean;
  q?: string;
};

export type ListingFilters = {
  /** Root category slugs; each one includes its subcategories. */
  categories?: string[];
  brands?: string[];
  origins?: string[];
  min?: number;
  max?: number;
  /** "promo", "new", "stock": show only discounted, new, or in-stock products. */
  only?: string[];
  sort?: SortKey;
  page?: number;
};

function scopeWhere(scope: ListingScope) {
  const where: SQL[] = [sellable];
  if (scope.categoryIds?.length) where.push(inArray(products.categoryId, scope.categoryIds));
  if (scope.brandId) where.push(eq(products.brandId, scope.brandId));
  if (scope.promo) where.push(isPromo);
  if (scope.isNew) where.push(eq(products.isNew, true));
  if (scope.q) {
    for (const word of scope.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5)) {
      where.push(like(products.searchText, `%${word.replace(/[%_]/g, "")}%`));
    }
  }
  return where;
}

export async function listProducts(scope: ListingScope, f: ListingFilters) {
  "use cache";
  await catalogCacheLife();
  cacheTag(CATALOG_TAG);

  const base = scopeWhere(scope);
  // A category page is already one category; elsewhere (new, promo, search) the shopper can narrow by it.
  const tree = scope.categoryIds?.length ? [] : await getCategoryTree();
  // On a main category's page the shopper narrows by its subcategories instead.
  const subs =
    (scope.categoryIds?.length ?? 0) > 1
      ? await db
          .select({ id: categories.id, slug: categories.slug, name: categories.name })
          .from(categories)
          .where(and(inArray(categories.id, scope.categoryIds!), isNotNull(categories.parentId)))
          .orderBy(asc(categories.sort), asc(categories.id))
      : [];

  // Facets are computed on the scope only, so picking one brand does not hide the others.
  const [brandFacet, originFacet, [range], perCategory, [counts]] = await Promise.all([
    db
      .select({ slug: brands.slug, name: brands.name, n: sql<number>`count(*)` })
      .from(products)
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(and(...base))
      .groupBy(brands.id)
      .orderBy(asc(brands.name)),
    db
      .select({ origin: products.origin, n: sql<number>`count(*)` })
      .from(products)
      .where(and(...base, isNotNull(products.origin)))
      .groupBy(products.origin),
    db
      .select({ min: sql<number>`coalesce(min(${effectivePrice}), 0)`, max: sql<number>`coalesce(max(${effectivePrice}), 0)` })
      .from(products)
      .where(and(...base)),
    tree.length || subs.length
      ? db
          .select({ categoryId: products.categoryId, n: sql<number>`count(*)` })
          .from(products)
          .where(and(...base))
          .groupBy(products.categoryId)
      : Promise.resolve([]),
    // How many products in the scope are discounted, new and in stock, for the "show only" filters.
    db
      .select({
        total: sql<number>`count(*)`,
        promo: sql<number>`coalesce(sum(case when ${isPromo} then 1 else 0 end), 0)`,
        fresh: sql<number>`coalesce(sum(case when ${products.isNew} then 1 else 0 end), 0)`,
        stock: sql<number>`coalesce(sum(case when ${products.stock} > 0 then 1 else 0 end), 0)`,
      })
      .from(products)
      .where(and(...base)),
  ]);

  // Subcategories roll up into their main category, in menu order.
  const countOf = new Map(perCategory.map((c) => [c.categoryId, c.n]));
  const categoryFacet = (
    subs.length
      ? subs.map((s) => ({ slug: s.slug, name: s.name, n: countOf.get(s.id) ?? 0 }))
      : tree.map((root) => ({ slug: root.slug, name: root.name, n: [root, ...root.children].reduce((sum, c) => sum + (countOf.get(c.id) ?? 0), 0) }))
  ).filter((c) => c.n > 0);

  const where = [...base];
  if (f.categories?.length && (tree.length || subs.length)) {
    const ids = subs.length
      ? subs.filter((s) => f.categories!.includes(s.slug)).map((s) => s.id)
      : tree.filter((r) => f.categories!.includes(r.slug)).flatMap((r) => [r.id, ...r.children.map((c) => c.id)]);
    where.push(inArray(products.categoryId, ids.length ? ids : [-1]));
  }
  if (f.only?.includes("promo")) where.push(isPromo);
  if (f.only?.includes("new")) where.push(eq(products.isNew, true));
  if (f.only?.includes("stock")) where.push(gt(products.stock, 0));
  if (f.brands?.length) {
    const ids = await db.select({ id: brands.id }).from(brands).where(inArray(brands.slug, f.brands));
    where.push(inArray(products.brandId, ids.length ? ids.map((b) => b.id) : [-1]));
  }
  if (f.origins?.length) where.push(inArray(products.origin, f.origins));
  if (f.min != null) where.push(gte(effectivePrice, f.min));
  if (f.max != null) where.push(lte(effectivePrice, f.max));

  const order = {
    popular: shopOrder,
    "price-asc": [asc(effectivePrice)],
    "price-desc": [desc(effectivePrice)],
    discount: [sql`(case when ${effectiveOldPrice} is null then 0 else 1.0 - 1.0 * ${effectivePrice} / ${effectiveOldPrice} end) desc`],
    name: [asc(products.name)],
  }[f.sort ?? "popular"];

  const page = Math.max(1, f.page ?? 1);
  const [items, [{ total }]] = await Promise.all([
    cards()
      .where(and(...where))
      .orderBy(...order)
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ total: sql<number>`count(*)` }).from(products).where(and(...where)),
  ]);

  return {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PER_PAGE)),
    facets: {
      categories: categoryFacet,
      /** Whether `categories` are the subcategories of the page's own category. */
      subcategories: subs.length > 0,
      brands: brandFacet,
      origins: originFacet,
      priceMin: range.min,
      priceMax: range.max,
      /** Products in the scope before any filter, and how many of them are discounted, new and in stock. */
      scopeTotal: Number(counts.total),
      promo: Number(counts.promo),
      fresh: Number(counts.fresh),
      stock: Number(counts.stock),
    },
  };
}

export async function getProduct(slug: string) {
  "use cache";
  await catalogCacheLife();
  cacheTag(CATALOG_TAG);

  const [row] = await db
    .select({ ...card, description: products.description, categoryId: products.categoryId, active: products.active })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(eq(products.slug, slug))
    .limit(1);
  if (!row) return null;

  const [category] = await db.select().from(categories).where(eq(categories.id, row.categoryId)).limit(1);
  const parent = category?.parentId
    ? (await db.select().from(categories).where(eq(categories.id, category.parentId)).limit(1))[0]
    : null;

  const related = await cards()
    .where(and(sellable, eq(products.categoryId, row.categoryId), sql`${products.id} != ${row.id}`))
    .orderBy(...shopOrder)
    .limit(10);

  return { product: row, category: category ?? null, parent: parent ?? null, related };
}

export async function searchSuggestions(q: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const where = scopeWhere({ q });
  return cards()
    .where(and(...where))
    .orderBy(...shopOrder)
    .limit(6);
}

/** Current card data for specific products, read fresh (no cache) because it decides what can be re-ordered. */
export async function getLiveCards(ids: number[]) {
  if (ids.length === 0) return [];
  return cards().where(and(inArray(products.id, ids), sellable));
}
