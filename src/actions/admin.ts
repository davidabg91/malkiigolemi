"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { brands, categories, ORDER_STATUSES, products, type OrderStatus } from "@/db/schema";
import { assertAdmin } from "@/lib/auth";
import { removeImage, saveImage } from "@/lib/images";
import { PACKS } from "@/lib/listing";
import { CATALOG_TAG } from "@/lib/queries";
import { ORIGIN_LABELS, TONES } from "@/lib/site";
import { searchTextOf, slugify } from "@/lib/slug";
import { CATEGORY_ICON_NAMES } from "@/lib/icons";
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
  parentId: z.string().trim(),
  tone: z.string().refine((v) => v in TONES, "Невалиден цвят."),
  icon: z.string().refine((v) => CATEGORY_ICON_NAMES.includes(v), "Невалидна икона."),
  sort: z.coerce.number().int().min(0).max(999),
});

export async function saveCategory(id: number | null, _prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const text = (k: string) => String(formData.get(k) ?? "");
  const parsed = categorySchema.safeParse({
    name: text("name"),
    description: text("description"),
    parentId: text("parentId"),
    tone: text("tone") || "butter",
    icon: text("icon") || "ShoppingBasket",
    sort: text("sort") || "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  let parentId: number | null = null;
  if (d.parentId) {
    const [parent] = await db.select().from(categories).where(eq(categories.id, Number(d.parentId))).limit(1);
    // Only two levels are supported, and a category cannot become its own child.
    if (!parent || parent.parentId !== null || parent.id === id) return { error: "Невалидна родителска категория." };
    if (id) {
      const [child] = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).limit(1);
      if (child) return { error: "Категория с подкатегории не може да стане подкатегория." };
    }
    parentId = parent.id;
  }

  const active = formData.has("active") ? formData.get("active") === "on" : true;
  const values = {
    name: d.name,
    description: d.description || null,
    parentId,
    tone: d.tone,
    icon: d.icon,
    sort: d.sort,
    active,
  };
  if (id) {
    await db.update(categories).set(values).where(eq(categories.id, id));
  } else {
    let slug = slugify(d.name) || `kategoria-${Date.now()}`;
    const [taken] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
    if (taken) slug = `${slug}-${randomBytes(2).toString("hex")}`;
    await db.insert(categories).values({ ...values, slug });
  }

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
