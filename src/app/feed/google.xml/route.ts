import { absoluteUrl, feedAvailability, getSeoCatalog, productDescription, productImageUrl, productTitle } from "@/lib/seo";
import { site } from "@/lib/site";

/**
 * Product feed for Google Merchant Center (free listings in Google Shopping and the Shopping tab).
 * Add https://<domain>/feed/google.xml in Merchant Center → Products → Feeds as a scheduled fetch;
 * every product on sale is in it, new ones included, with its current price and availability.
 */
export async function GET() {
  const catalog = await getSeoCatalog();
  const items = catalog.map((p) => {
    const onSale = p.oldPrice && p.oldPrice > p.price;
    const type = [p.parentCategory, p.category].filter(Boolean).join(" > ");
    const fields: [string, string | null | undefined][] = [
      ["g:id", p.sku || String(p.id)],
      ["g:title", productTitle(p).slice(0, 150)],
      ["g:description", (p.description.trim() || productDescription(p, p.category)).slice(0, 5000)],
      ["g:link", absoluteUrl(`/produkt/${p.slug}`)],
      ["g:image_link", productImageUrl(p)],
      ["g:availability", feedAvailability(p)],
      ["g:price", money(onSale ? p.oldPrice! : p.price)],
      ["g:sale_price", onSale ? money(p.price) : null],
      ["g:brand", p.brand ?? site.name],
      ["g:condition", "new"],
      ["g:identifier_exists", "no"],
      ["g:product_type", type],
      ["g:color", p.colors.length ? p.colors.slice(0, 3).join("/") : null],
    ];
    return `<item>${fields
      .filter(([, v]) => v)
      .map(([k, v]) => `<${k}>${xml(v!)}</${k}>`)
      .join("")}<g:shipping><g:country>BG</g:country><g:price>3.50 EUR</g:price></g:shipping></item>`;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${xml(site.name)}</title>
<link>${site.url}</link>
<description>${xml(site.description)}</description>
${items.join("\n")}
</channel>
</rss>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}

const money = (cents: number) => `${(cents / 100).toFixed(2)} EUR`;

function xml(s: string) {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
