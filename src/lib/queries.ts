import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, like, lte, or, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { brands, categories, products, type Category } from "@/db/schema";
import { PER_PAGE, type SortKey } from "./listing";

/** Every catalogue read is tagged so admin edits can invalidate it in one call. */
export const CATALOG_TAG = "catalog";

const card = {
  id: products.id,
  slug: products.slug,
  sku: products.sku,
  name: products.name,
  unit: products.unit,
  price: products.price,
  oldPrice: products.oldPrice,
  bulkMinQty: products.bulkMinQty,
  bulkPrice: products.bulkPrice,
  image: products.image,
  pack: products.pack,
  color: products.color,
  origin: products.origin,
  isNew: products.isNew,
  stock: products.stock,
  brand: brands.name,
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
};

export type CategoryNode = Category & { children: Category[]; count: number };

const cards = () => db.select(card).from(products).leftJoin(brands, eq(products.brandId, brands.id));
const isPromo = or(isNotNull(products.oldPrice), isNotNull(products.bulkPrice))!;

export async function getCategoryTree(): Promise<CategoryNode[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const all = await db.select().from(categories).orderBy(asc(categories.sort), asc(categories.id));
  const counts = await db
    .select({ categoryId: products.categoryId, n: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.active, true))
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
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const tree = await getCategoryTree();
  const out: Record<number, ProductCardData[]> = {};
  for (const root of tree) {
    const ids = [root.id, ...root.children.map((c) => c.id)];
    const rows = await cards()
      .where(and(eq(products.active, true), inArray(products.categoryId, ids)))
      .orderBy(desc(products.isFeatured), asc(products.id))
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
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const active = eq(products.active, true);
  const [promo, fresh, bulk, italy, greece, brandList] = await Promise.all([
    cards().where(and(active, isNotNull(products.oldPrice))).orderBy(desc(products.isFeatured), asc(products.id)).limit(12),
    cards().where(and(active, eq(products.isNew, true))).orderBy(desc(products.createdAt)).limit(10),
    cards().where(and(active, isNotNull(products.bulkPrice))).orderBy(desc(products.isFeatured), asc(products.id)).limit(4),
    cards().where(and(active, eq(products.origin, "IT"), eq(products.isFeatured, true))).orderBy(asc(products.id)).limit(10),
    cards().where(and(active, eq(products.origin, "GR"))).orderBy(desc(products.isFeatured), asc(products.id)).limit(10),
    db.select().from(brands).orderBy(asc(brands.name)),
  ]);
  return { promo, fresh, bulk, italy, greece, brands: brandList };
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

export type ListingScope = {
  categoryIds?: number[];
  promo?: boolean;
  isNew?: boolean;
  q?: string;
};

export type ListingFilters = {
  brands?: string[];
  origins?: string[];
  min?: number;
  max?: number;
  sort?: SortKey;
  page?: number;
};

function scopeWhere(scope: ListingScope) {
  const where: SQL[] = [eq(products.active, true)];
  if (scope.categoryIds?.length) where.push(inArray(products.categoryId, scope.categoryIds));
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
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const base = scopeWhere(scope);

  // Facets are computed on the scope only, so picking one brand does not hide the others.
  const [brandFacet, originFacet, [range]] = await Promise.all([
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
      .select({ min: sql<number>`coalesce(min(${products.price}), 0)`, max: sql<number>`coalesce(max(${products.price}), 0)` })
      .from(products)
      .where(and(...base)),
  ]);

  const where = [...base];
  if (f.brands?.length) {
    const ids = await db.select({ id: brands.id }).from(brands).where(inArray(brands.slug, f.brands));
    where.push(inArray(products.brandId, ids.length ? ids.map((b) => b.id) : [-1]));
  }
  if (f.origins?.length) where.push(inArray(products.origin, f.origins));
  if (f.min != null) where.push(gte(products.price, f.min));
  if (f.max != null) where.push(lte(products.price, f.max));

  const order = {
    popular: [desc(products.isFeatured), asc(products.id)],
    "price-asc": [asc(products.price)],
    "price-desc": [desc(products.price)],
    new: [desc(products.createdAt)],
    discount: [sql`(case when ${products.oldPrice} is null then 0 else 1.0 - 1.0 * ${products.price} / ${products.oldPrice} end) desc`],
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
    facets: { brands: brandFacet, origins: originFacet, priceMin: range.min, priceMax: range.max },
  };
}

export async function getProduct(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);

  const [row] = await db
    .select({ ...card, description: products.description, categoryId: products.categoryId, active: products.active })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(eq(products.slug, slug))
    .limit(1);
  if (!row || !row.active) return null;

  const [category] = await db.select().from(categories).where(eq(categories.id, row.categoryId)).limit(1);
  const parent = category?.parentId
    ? (await db.select().from(categories).where(eq(categories.id, category.parentId)).limit(1))[0]
    : null;

  const related = await cards()
    .where(and(eq(products.active, true), eq(products.categoryId, row.categoryId), sql`${products.id} != ${row.id}`))
    .orderBy(desc(products.isFeatured), asc(products.id))
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
    .orderBy(desc(products.isFeatured), asc(products.id))
    .limit(6);
}

/** Current card data for specific products, read fresh (no cache) because it decides what can be re-ordered. */
export async function getLiveCards(ids: number[]) {
  if (ids.length === 0) return [];
  return cards().where(and(inArray(products.id, ids), eq(products.active, true)));
}
