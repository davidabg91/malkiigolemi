import { absoluteUrl, getSeoCatalog, productTitle } from "@/lib/seo";
import { site } from "@/lib/site";

// A plain-text map of the shop for AI assistants (ChatGPT, Perplexity, Gemini), see llmstxt.org.
export async function GET() {
  const catalog = await getSeoCatalog();
  const byCategory = new Map<string, string[]>();
  for (const p of catalog) {
    const key = [p.parentCategory, p.category].filter(Boolean).join(" › ");
    const line = `- [${productTitle(p)}](${absoluteUrl(`/produkt/${p.slug}`)}): ${(p.price / 100).toFixed(2)} €`;
    byCategory.set(key, [...(byCategory.get(key) ?? []), line]);
  }
  const body = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `Онлайн магазин в България (${site.domain}). Цени в евро с ДДС. Доставка с Еконт, Спиди и BOX NOW до офис, адрес или автомат; преглед преди плащане; 14 дни право на връщане.`,
    "",
    "## Информация",
    `- [Доставка и плащане](${absoluteUrl("/dostavka")})`,
    `- [Контакти](${absoluteUrl("/kontakti")}): ${site.phone}, ${site.email}`,
    `- [Общи условия](${absoluteUrl("/usloviya")})`,
    `- [Всички продукти](${absoluteUrl("/produkti")})`,
    "",
    ...[...byCategory].flatMap(([name, lines]) => [`## ${name}`, ...lines, ""]),
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
