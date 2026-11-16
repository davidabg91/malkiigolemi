import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Everything public may be crawled. Private pages (cart, checkout, profile) carry their own noindex instead,
// because a page blocked here can still turn up in Google without a description.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
