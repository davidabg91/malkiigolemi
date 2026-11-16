import type { MetadataRoute } from "next";
import { absoluteUrl, getSeoCatalog, getSeoListings, productImageUrl } from "@/lib/seo";

// Built from the database on request (and cached with the catalogue), so a product the admin adds is in it
// as soon as it is saved. Each product lists its photo, which is how pictures get into Google Images.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, { categoryPaths, brandPaths }] = await Promise.all([getSeoCatalog(), getSeoListings()]);
  const newest = catalog.reduce<Date | undefined>((d, p) => (!d || p.createdAt > d ? p.createdAt : d), undefined);

  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: newest, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/produkti"), lastModified: newest, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/novi"), lastModified: newest, changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/promo"), changeFrequency: "daily", priority: 0.8 },
    ...["/za-nas", "/kontakti", "/dostavka", "/facebook", "/prilozhenie", "/usloviya", "/poveritelnost", "/otkaz"].map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];

  return [
    ...pages,
    ...categoryPaths.map((path) => ({ url: absoluteUrl(path), changeFrequency: "daily" as const, priority: 0.8 })),
    ...brandPaths.map((path) => ({ url: absoluteUrl(path), changeFrequency: "weekly" as const, priority: 0.5 })),
    ...catalog.map((p) => ({
      url: absoluteUrl(`/produkt/${p.slug}`),
      lastModified: p.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: [productImageUrl(p)],
    })),
  ];
}
