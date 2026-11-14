"use server";

import { and, eq, inArray, isNull, like, ne, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { brands, categories, categoryRedirects, ORDER_STATUSES, products, type OrderStatus } from "@/db/schema";
import { assertAdmin } from "@/lib/auth";
import { photoIfOpaque, removeImage, saveImage } from "@/lib/images";
import { PACKS } from "@/lib/listing";
import { CATALOG_TAG } from "@/lib/queries";
import { ORIGIN_LABELS, TONES } from "@/lib/site";
import { searchTextOf, slugify } from "@/lib/slug";
import { CATEGORY_ICON_NAMES } from "@/lib/icons";
import { isTileImage, TILE_AUTO, TILE_PRESETS } from "@/lib/tile-art";
import { setActiveCouriersConfig } from "@/lib/couriers-server";
import { changeOrderStatus, changeOrdersStatus } from "@/lib/order-status";
import { notifyRestocked } from "@/lib/stock-alerts";
import type { CourierId } from "@/lib/couriers";

export type AdminFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;


/** "12,50" or "12.50" euros → cents. Empty → null. */
const money = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      ctx.addIssue({ code: "custom", message: "Невалидна сума." });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

const optionalInt = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 100000) {
      ctx.addIssue({ code: "custom", message: "Въведи цяло число." });
      return z.NEVER;
    }
    return n;
  });

const productSchema = z.object({
  name: z.string().trim().min(2, "Въведи име на продукта.").max(160),
  // Empty = the shop numbers it (see nextSku); editing with it empty keeps the current number.
  sku: z.string().trim().max(40),
  unit: z.string().trim().max(60),
  description: z.string().trim().max(4000),
  categoryId: z.coerce.number().int().positive("Избери категория."),
  brandId: z.string().trim(),
  newBrand: z.string().trim().max(80),
  price: money.refine((v) => v !== null && v > 0, "Въведи цена."),
  oldPrice: money,
  bulkMinQty: optionalInt,
  bulkPrice: money,
  stock: optionalInt,
  origin: z.string().refine((v) => v === "" || v in ORIGIN_LABELS, "Невалиден произход."),
  pack: z.string().refine((v) => v in PACKS, "Невалидна опаковка."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Невалиден цвят."),
});

/** The next free article number: one above the highest all-digit one, starting at 1001 like the catalogue. */
async function nextSku() {
  const [row] = await db
    .select({ max: sql<number | null>`max(cast(${products.sku} as integer))` })
    .from(products)
    .where(sql`${products.sku} != '' and ${products.sku} not glob '*[^0-9]*'`);
  let n = Math.max(1000, Number(row?.max ?? 0)) + 1;
  // Step past a number that is somehow already taken (e.g. typed by hand as "01002").
  while ((await db.select({ id: products.id }).from(products).where(eq(products.sku, String(n))).limit(1)).length) n++;
  return String(n);
}

export async function saveProduct(id: number | null, _prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await assertAdmin();

  const text = (k: string) => String(formData.get(k) ?? "");
  const parsed = productSchema.safeParse(Object.fromEntries(Object.keys(productSchema.shape).map((k) => [k, text(k)])));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Провери отбелязаните полета.", fieldErrors };
  }
  const d = parsed.data;

  if (d.oldPrice !== null && d.oldPrice <= d.price!) {
    return { error: "Старата цена трябва да е по-висока от текущата.", fieldErrors: { oldPrice: "Трябва да е над текущата цена." } };
  }
  if ((d.bulkMinQty === null) !== (d.bulkPrice === null)) {
    return { error: "За цена за количество попълни и броя, и цената.", fieldErrors: { bulkPrice: "Попълни двете полета или нито едно." } };
  }
  if (d.bulkPrice !== null && (d.bulkPrice >= d.price! || d.bulkMinQty! < 2)) {
    return { error: "Цената за количество трябва да е под редовната, от поне 2 броя.", fieldErrors: { bulkPrice: "Трябва да е под редовната цена." } };
  }

  const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, d.categoryId)).limit(1);
  if (!category) return { error: "Категорията не съществува.", fieldErrors: { categoryId: "Избери категория." } };

  if (!d.sku) {
    const [own] = id ? await db.select({ sku: products.sku }).from(products).where(eq(products.id, id)).limit(1) : [];
    d.sku = own?.sku || (await nextSku());
  }

  const [skuTaken] = await db
    .select({ id: products.id })
    .from(products)
    .where(id ? and(eq(products.sku, d.sku), ne(products.id, id)) : eq(products.sku, d.sku))
    .limit(1);
  if (skuTaken) return { error: "Вече има продукт с този артикулен номер.", fieldErrors: { sku: "Номерът е зает." } };

  // Brand: either an existing one or a new one typed in.
  let brandId: number | null = null;
  let brandName: string | null = null;
  if (d.newBrand) {
    const slug = slugify(d.newBrand) || `brand-${Date.now()}`;
    const [existing] = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
    const brand = existing ?? (await db.insert(brands).values({ slug, name: d.newBrand, country: d.origin || null }).returning())[0];
    brandId = brand.id;
    brandName = brand.name;
  } else if (d.brandId) {
    const [brand] = await db.select().from(brands).where(eq(brands.id, Number(d.brandId))).limit(1);
    if (brand) {
      brandId = brand.id;
      brandName = brand.name;
    }
  }

  const [current] = id ? await db.select().from(products).where(eq(products.id, id)).limit(1) : [];
  if (id && !current) return { error: "Продуктът не е намерен." };

  let image = current?.image ?? null;
  const file = formData.get("image");
  try {
    if (file instanceof File && file.size > 0) {
      const saved = await saveImage(file);
      await removeImage(image);
      image = saved;
    } else if (formData.get("removeImage") === "on") {
      await removeImage(image);
      image = null;
    } else if (image) {
      // A photo uploaded as PNG earlier: saving the product is enough to have it shown edge to edge.
      image = await photoIfOpaque(image);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Неуспешно качване на изображението.", fieldErrors: { image: "Провери файла." } };
  }

  const values = {
    name: d.name,
    sku: d.sku,
    unit: d.unit,
    description: d.description,
    searchText: searchTextOf(d.name, brandName, d.sku, d.unit),
    categoryId: d.categoryId,
    brandId,
    price: d.price!,
    oldPrice: d.oldPrice,
    bulkMinQty: d.bulkMinQty,
    bulkPrice: d.bulkPrice,
    stock: d.stock ?? 0,
    origin: d.origin || null,
    pack: d.pack,
    color: d.color,
    image,
    isNew: formData.get("isNew") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    active: formData.get("active") === "on",
  };

  if (id) {
    await db.update(products).set(values).where(eq(products.id, id));
    // Back in stock: tell everyone who asked to be notified.
    if (current && current.stock <= 0 && values.stock > 0 && values.active) await notifyRestocked([id]);
  } else {
    const slug = `${slugify(`${d.name} ${brandName ?? ""}`)}-${slugify(d.sku) || Date.now()}`;
    await db.insert(products).values({ ...values, slug });
  }

  const returnUrl = String(formData.get("returnUrl") ?? "");
  updateTag(CATALOG_TAG);
  redirect(returnUrl && returnUrl.startsWith("/") ? returnUrl : "/admin/produkti");
}

export async function deleteProduct(id: number) {
  await assertAdmin();
  const [row] = await db.delete(products).where(eq(products.id, id)).returning({ image: products.image });
  await removeImage(row?.image ?? null);
  updateTag(CATALOG_TAG);
  refresh();
}

export type BulkDeleteState = { ok?: boolean; deleted?: number; error?: string } | undefined;

/** "Изтрий избраните" above the products table: removes every ticked product and its photo. */
export async function deleteProducts(_prev: BulkDeleteState, formData: FormData): Promise<BulkDeleteState> {
  await assertAdmin();
  const ids = [...new Set(formData.getAll("ids").map(Number))].filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  if (ids.length === 0) return { error: "Не са избрани продукти." };
  const rows = await db.delete(products).where(inArray(products.id, ids)).returning({ image: products.image });
  await Promise.all(rows.map((r) => removeImage(r.image ?? null)));
  updateTag(CATALOG_TAG);
  refresh();
  return { ok: true, deleted: rows.length };
}

/** A product's place before a change, so the change can be taken back. */
export type ProductRank = { id: number; rank: number | null };

const orderIds = z.array(z.number().int().positive()).min(1).max(100);

/**
 * The admin dragged the products of a listing into a new order. The products swap the places they already
 * hold among themselves, so everything that is not on the page stays where it was. Returns the old places.
 */
export async function saveProductOrder(ids: number[]): Promise<ProductRank[]> {
  await assertAdmin();
  const wanted = [...new Set(orderIds.parse(ids))];
  const rows = await db.select({ id: products.id, rank: products.rank, createdAt: products.createdAt }).from(products).where(inArray(products.id, wanted));
  const known = new Set(rows.map((r) => r.id));
  const order = wanted.filter((id) => known.has(id));
  // A product without a place counts as minus its creation time (see `rank` in the schema).
  const places = rows.map((r) => r.rank ?? -Math.floor(r.createdAt.getTime() / 1000)).sort((a, b) => a - b);
  // Products added together share a creation time; places must differ for the order to hold.
  for (let i = 1; i < places.length; i++) places[i] = Math.max(places[i], places[i - 1] + 1);
  await db.transaction(async (tx) => {
    for (const [i, id] of order.entries()) await tx.update(products).set({ rank: places[i] }).where(eq(products.id, id));
  });
  updateTag(CATALOG_TAG);
  refresh();
  return rows.map((r) => ({ id: r.id, rank: r.rank }));
}

/** Puts products back where they were before `saveProductOrder` or `resetProductOrder`. */
export async function restoreProductOrder(previous: ProductRank[]): Promise<void> {
  await assertAdmin();
  const rows = z.array(z.object({ id: z.number().int().positive(), rank: z.number().int().nullable() })).min(1).max(100).parse(previous);
  await db.transaction(async (tx) => {
    for (const r of rows) await tx.update(products).set({ rank: r.rank }).where(eq(products.id, r.id));
  });
  updateTag(CATALOG_TAG);
  refresh();
}

/** Drops the hand-made order of these products: they go back to "newest first". Returns the old places. */
export async function resetProductOrder(ids: number[]): Promise<ProductRank[]> {
  await assertAdmin();
  const wanted = orderIds.parse(ids);
  const rows = await db.select({ id: products.id, rank: products.rank }).from(products).where(inArray(products.id, wanted));
  await db.update(products).set({ rank: null }).where(inArray(products.id, wanted));
  updateTag(CATALOG_TAG);
  refresh();
  return rows;
}

export async function toggleProduct(id: number) {
  await assertAdmin();
  await db
    .update(products)
    .set({ active: sql`not ${products.active}` })
    .where(eq(products.id, id));
  updateTag(CATALOG_TAG);
  refresh();
}

export async function setOrderStatus(id: number, formData: FormData) {
  await assertAdmin();
  const status = String(formData.get("status")) as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) throw new Error("Невалиден статус.");

  await changeOrderStatus(id, status);
  updateTag(CATALOG_TAG);
  refresh();
}

export type BulkStatusState = { ok?: boolean; changed?: number; error?: string } | undefined;

/** "Отбележи избраните като изпратени": the same rules as one order at a time, applied to each. */
export async function setOrdersStatus(_prev: BulkStatusState, formData: FormData): Promise<BulkStatusState> {
  await assertAdmin();
  const status = String(formData.get("status")) as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return { error: "Избери статус." };
  const ids = [...new Set(formData.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (ids.length === 0) return { error: "Не са избрани поръчки." };
  const changed = await changeOrdersStatus(ids, status);
  updateTag(CATALOG_TAG);
  refresh();
  return { ok: true, changed };
}

const categorySchema = z.object({
  name: z.string().trim().min(2, "Въведи име.").max(80),
  description: z.string().trim().max(300),
  parent: z.string().trim().max(80),
  tone: z.string().refine((v) => v in TONES, "Невалиден цвят."),
  icon: z.string().refine((v) => CATEGORY_ICON_NAMES.includes(v), "Невалидна икона."),
});

/** `base` if no category has it, otherwise `base-2`, `base-3` and so on. */
async function freeCategorySlug(base: string) {
  const rows = await db.select({ slug: categories.slug }).from(categories).where(like(categories.slug, `${base}%`));
  const taken = new Set(rows.map((c) => c.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function saveCategory(id: number | null, _prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const text = (k: string) => String(formData.get(k) ?? "");
  const parsed = categorySchema.safeParse({
    name: text("name"),
    description: text("description"),
    parent: text("parent"),
    tone: text("tone") || "butter",
    icon: text("icon") || "ShoppingBasket",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  // The parent is typed by name. Empty means a main category; a name nobody has yet becomes a new main category.
  let parentId: number | null = null;
  if (d.parent) {
    const same = (a: string) => a.trim().toLocaleLowerCase("bg") === d.parent.toLocaleLowerCase("bg");
    if (same(d.name)) return { error: "Категорията не може да е родител на себе си." };
    if (id) {
      const [child] = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).limit(1);
      if (child) return { error: "Категория с подкатегории не може да стане подкатегория." };
    }
    const roots = await db.select().from(categories).where(isNull(categories.parentId));
    // Only two levels are supported, and a category cannot become its own child.
    const parent = roots.find((r) => same(r.name) && r.id !== id);
    if (parent) parentId = parent.id;
    else {
      const [made] = await db
        .insert(categories)
        .values({ name: d.parent, slug: await freeCategorySlug(slugify(d.parent) || `kategoria-${Date.now()}`), sort: roots.length, tile: TILE_AUTO })
        .returning({ id: categories.id });
      parentId = made.id;
    }
  }

  const [current] = id ? await db.select().from(categories).where(eq(categories.id, id)).limit(1) : [];
  if (id && !current) return { error: "Категорията не съществува." };

  // The picture on the tile: "auto", a ready-made illustration, or an uploaded picture (kept unless a new one comes).
  const choice = text("tile") || TILE_AUTO;
  const upload = formData.get("tileImage");
  const old = current?.tile ?? null;
  let tile: string;
  if (choice === "image") {
    if (upload instanceof File && upload.size > 0) {
      try {
        tile = await saveImage(upload);
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Снимката не можа да се качи." };
      }
    } else if (isTileImage(old)) tile = old;
    else return { error: "Избери снимка за плочката." };
  } else if (choice === TILE_AUTO || choice in TILE_PRESETS) tile = choice;
  else return { error: "Невалидна картинка за плочката." };
  if (isTileImage(old) && old !== tile) await removeImage(old);

  const active = formData.has("active") ? formData.get("active") === "on" : true;
  const values = {
    name: d.name,
    description: d.description || null,
    parentId,
    tone: d.tone,
    icon: d.icon,
    active,
    tile,
  };
  // The address follows the name. A slug that already is the name, or the name with a number, is left alone.
  const wanted = slugify(d.name) || `kategoria-${Date.now()}`;
  const keep = current && (current.slug === wanted || new RegExp(`^${wanted}-\\d+$`).test(current.slug));
  const slug = keep ? current.slug : await freeCategorySlug(wanted);
  if (current) {
    await db.update(categories).set({ ...values, slug }).where(eq(categories.id, current.id));
    // Links to the old address keep working: it now leads here.
    if (slug !== current.slug) {
      await db
        .insert(categoryRedirects)
        .values({ slug: current.slug, categoryId: current.id })
        .onConflictDoUpdate({ target: categoryRedirects.slug, set: { categoryId: current.id } });
    }
  } else {
    // A new category goes last among its neighbours; the arrows in the list move it from there.
    const [last] = await db
      .select({ sort: sql<number>`coalesce(max(${categories.sort}), -1)` })
      .from(categories)
      .where(parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId));
    await db.insert(categories).values({ ...values, slug, sort: Number(last.sort) + 1 });
  }
  // An address in use by a category is no longer an old address of another one.
  await db.delete(categoryRedirects).where(eq(categoryRedirects.slug, slug));

  updateTag(CATALOG_TAG);
  refresh();
  return undefined;
}

/** The icon picker in the list of categories: saves the chosen icon at once. */
export async function setCategoryIcon(id: number, icon: string): Promise<void> {
  await assertAdmin();
  if (!CATEGORY_ICON_NAMES.includes(icon)) throw new Error("Невалидна икона.");
  await db.update(categories).set({ icon }).where(eq(categories.id, id));
  updateTag(CATALOG_TAG);
  refresh();
}

export async function toggleCategoryActive(id: number): Promise<void> {
  await assertAdmin();
  await db
    .update(categories)
    .set({ active: sql`not ${categories.active}` })
    .where(eq(categories.id, id));
  updateTag(CATALOG_TAG);
  refresh();
}

export async function deleteCategory(id: number): Promise<void> {
  await assertAdmin();
  const [[child], [product]] = await Promise.all([
    db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).limit(1),
    db.select({ id: products.id }).from(products).where(eq(products.categoryId, id)).limit(1),
  ]);
  // The UI only offers delete for empty categories; this guards against a forged call.
  if (child || product) throw new Error("Категорията не е празна.");
  await db.delete(categories).where(eq(categories.id, id));
  updateTag(CATALOG_TAG);
  refresh();
}

export async function reorderCategories(orderedIds: number[]): Promise<void> {
  await assertAdmin();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(categories).set({ sort: i }).where(eq(categories.id, orderedIds[i]));
  }
  updateTag(CATALOG_TAG);
  refresh();
}

export async function updateCourierSettings(formData: FormData) {
  await assertAdmin();
  const config: Record<CourierId, boolean> = {
    econt: formData.get("econt") === "on",
    speedy: formData.get("speedy") === "on",
    boxnow: formData.get("boxnow") === "on",
    pigeon: formData.get("pigeon") === "on",
  };
  await setActiveCouriersConfig(config);
  refresh();
}
