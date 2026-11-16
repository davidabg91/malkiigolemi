import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { db } from "@/db";
import { brands, categories, products } from "@/db/schema";
import { stockState } from "./availability";
import { catalogCacheLife, pricedColumns } from "./pricing";
import { CATALOG_TAG, sellable } from "./queries";
import { COMPANY, ORIGIN_LABELS, site, WITHDRAWAL_DAYS } from "./site";

/**
 * What search engines and Google Shopping read about the shop: absolute addresses, the whole catalogue in
 * one list (sitemap, Merchant Center feed, llms.txt) and the structured data on product pages. Everything
 * comes from the database, so a product the admin adds is found without anyone touching this file.
 */

/** An absolute address on the shop's own domain. Pictures on Vercel Blob are already absolute. */
export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${site.url}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** The product's photo as an absolute address, or its share card when it has no photo of its own. */
export function productImageUrl(p: { slug: string; image: string | null }) {
  return p.image ? absoluteUrl(p.image) : absoluteUrl(`/produkt/${p.slug}/opengraph-image`);
}

/** "Име Марка 500 г": what people type into a search box. */
export function productTitle(p: { name: string; brand: string | null; unit: string }) {
  const brand = p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? ` ${p.brand}` : "";
  return `${p.name}${brand}${p.unit ? ` ${p.unit}` : ""}`.replace(/\s+/g, " ").trim();
}

/** The text a page shows in search results: the product's own description, or one built from its facts. */
export function productDescription(
  p: { name: string; brand: string | null; unit: string; description: string; origin: string | null; price: number },
  categoryName?: string | null,
) {
  const own = p.description.replace(/\s+/g, " ").trim();
  if (own.length >= 70) return clip(own, 160);
  const facts = [
    productTitle(p),
    categoryName ? `от категория ${categoryName}` : null,
    p.origin && ORIGIN_LABELS[p.origin] ? `произход ${ORIGIN_LABELS[p.origin]}` : null,
  ].filter(Boolean);
  const lead = own ? `${own} ` : "";
  return clip(`${lead}${facts.join(", ")} — ${euro(p.price)}. Поръчай онлайн с доставка до офис, адрес или автомат в цяла България.`, 160);
}

function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
}

const euro = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

/** schema.org availability for the status shown on the product. */
export function schemaAvailability(p: { stock: number; availability?: string | null; deliveryTime?: string | null }) {
  switch (stockState(p).kind) {
    case "soldout":
      return "https://schema.org/OutOfStock";
    case "expected":
      return "https://schema.org/PreOrder";
    case "delivery":
      return "https://schema.org/BackOrder";
    default:
      return "https://schema.org/InStock";
  }
}

/** The same status in the words of a Google Merchant Center feed. */
export function feedAvailability(p: { stock: number; availability?: string | null; deliveryTime?: string | null }) {
  switch (stockState(p).kind) {
    case "soldout":
      return "out_of_stock";
    case "expected":
      return "preorder";
    case "delivery":
      return "backorder";
    default:
      return "in_stock";
  }
}

/** The shop as an organisation, referenced from every product offer. */
export const organizationId = `${site.url}/#organization`;

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": organizationId,
    name: site.name,
    legalName: COMPANY.name,
    url: site.url,
    logo: absoluteUrl("/favicon.png"),
    image: absoluteUrl("/opengraph-image"),
    description: site.description,
    email: site.email,
    telephone: site.phoneHref.replace("tel:", ""),
    vatID: COMPANY.vatNumber ?? undefined,
    taxID: COMPANY.eik,
    address: {
      "@type": "PostalAddress",
      streetAddress: "ж.к. Сторгозия, бл. 13, ет. 5, ап. 26",
      addressLocality: "Плевен",
      postalCode: "5800",
      addressCountry: "BG",
    },
    areaServed: { "@type": "Country", name: "България" },
    sameAs: [site.facebookUrl],
    hasMerchantReturnPolicy: returnPolicy(),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    name: site.name,
    url: site.url,
    inLanguage: "bg",
    publisher: { "@id": organizationId },
    // Lets Google show a search box for the shop under its result.
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${site.url}/tarsene?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** 14 days to send it back, by post, at the customer's cost (ЗЗП чл. 50). */
export function returnPolicy() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "BG",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: WITHDRAWAL_DAYS,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    merchantReturnLink: absoluteUrl("/otkaz"),
  };
}

/** Cheapest delivery to a courier office, 1–3 days to send and 1–2 days on the road. */
export function shippingDetails() {
  return {
    "@type": "OfferShippingDetails",
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "BG" },
    shippingRate: { "@type": "MonetaryAmount", value: "3.50", currency: "EUR" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Начало", path: "/" }, ...items].map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.path ? absoluteUrl(item.path) : undefined,
    })),
  };
}

/** JSON-LD safe to drop into a <script> tag. */
export function jsonLdHtml(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

/** Every product on sale, with what the sitemap, the Merchant Center feed and llms.txt need. */
export async function getSeoCatalog() {
  "use cache";
  await catalogCacheLife();
  cacheTag(CATALOG_TAG);

  const parent = sql<string | null>`(select p.name from categories p where p.id = ${categories.parentId})`;
  const parentSlug = sql<string | null>`(select p.slug from categories p where p.id = ${categories.parentId})`;
  return db
    .select({
      id: products.id,
      slug: products.slug,
      sku: products.sku,
      name: products.name,
      description: products.description,
      unit: products.unit,
      image: products.image,
      origin: products.origin,
      stock: products.stock,
      availability: products.availability,
      deliveryTime: products.deliveryTime,
      colors: products.colorOptions,
      createdAt: products.createdAt,
      ...pricedColumns,
      brand: brands.name,
      category: categories.name,
      categorySlug: categories.slug,
      parentCategory: parent,
      parentSlug,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(sellable)
    .orderBy(asc(products.id));
}

export type SeoProduct = Awaited<ReturnType<typeof getSeoCatalog>>[number];

/** Categories and brands that have something on sale, for the sitemap. */
export async function getSeoListings() {
  "use cache";
  await catalogCacheLife();
  cacheTag(CATALOG_TAG);

  const cats = await db
    .select({ id: categories.id, slug: categories.slug, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.active, true));
  const roots = new Map(cats.filter((c) => c.parentId === null).map((c) => [c.id, c.slug]));
  const categoryPaths = cats.flatMap((c) => {
    if (c.parentId === null) return [`/kategoria/${c.slug}`];
    const root = roots.get(c.parentId);
    return root ? [`/kategoria/${root}/${c.slug}`] : [];
  });

  const brandRows = await db
    .selectDistinct({ slug: brands.slug })
    .from(brands)
    .innerJoin(products, and(eq(products.brandId, brands.id), sellable));
  return { categoryPaths, brandPaths: brandRows.map((b) => `/marka/${b.slug}`) };
}
