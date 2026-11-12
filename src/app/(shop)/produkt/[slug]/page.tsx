import { PackageCheck, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductAdminActions } from "@/components/admin/ProductAdminActions";
import { BuyBox } from "@/components/product/AddToCart";
import { Carousel } from "@/components/product/Carousel";
import { ProductVisual } from "@/components/product/PackShot";
import { Badges, ProductCard, ProductStamp } from "@/components/product/ProductCard";
import { ProductZoom } from "@/components/product/ProductZoom";
import { RecentlyViewed } from "@/components/product/Recent";
import { Reviews } from "@/components/product/Reviews";
import { ratingLabel, Stars } from "@/components/product/Stars";
import { Breadcrumbs, SectionHeading } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { discountPercent, formatPrice } from "@/lib/format";
import { getProduct } from "@/lib/queries";
import { ORIGIN_LABELS, site } from "@/lib/site";

type Props = PageProps<"/produkt/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data || !data.product.active) return { title: "Продуктът не е намерен" };
  const { product } = data;
  return {
    title: `${product.name}${product.brand ? ` ${product.brand}` : ""} ${product.unit}`.trim(),
    description: data.product.description.slice(0, 160),
  };
}

async function Content({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const [data, session] = await Promise.all([getProduct(slug), getSession()]);
  if (!data) notFound();
  const isAdmin = session?.role === "admin";
  if ((!data.product.active || data.category?.active === false || data.parent?.active === false) && !isAdmin) {
    notFound();
  }
  const { product, category, parent, related } = data;
  const { description, ...cardData } = product;
  const off = discountPercent(product.price, product.oldPrice);
  const root = parent ?? category;

  const crumbs = [
    ...(root ? [{ label: root.name, href: `/kategoria/${root.slug}` }] : []),
    ...(parent && category ? [{ label: category.name, href: `/kategoria/${parent.slug}/${category.slug}` }] : []),
    { label: product.name },
  ];

  const specs = [
    ["Марка", product.brand],
    ["Произход", product.origin ? (ORIGIN_LABELS[product.origin] ?? product.origin) : null],
    ["Разфасовка", product.unit],
    ["Артикулен №", product.sku],
  ].filter(([, v]) => v);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      price: (product.price / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: `${site.name} Market` },
    },
    aggregateRating: product.reviewCount
      ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount, bestRating: 5, worstRating: 1 }
      : undefined,
  };

  const isFull = Boolean(product.image && /\.(jpe?g|webp)$/i.test(product.image));

  return (
    <div className="space-y-16 sm:space-y-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs items={crumbs} />
          {isAdmin && <ProductAdminActions product={product} />}
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div
            className="relative isolate grid aspect-square place-items-center overflow-hidden rounded-tile lg:sticky lg:top-36 lg:aspect-[1/0.95]"
            style={{ background: isFull ? "#14261c" : `color-mix(in srgb, ${product.color} 14%, #f6f2e8)` }}
          >
            <ProductZoom label={product.name} zoomed={<ProductVisual product={product} size={1200} className="h-full w-full object-contain rounded-2xl" />}>
              <ProductVisual
                product={product}
                size={640}
                className={
                  isFull
                    ? "h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    : "h-[82%] w-[82%] animate-rise drop-shadow-[0_24px_24px_rgb(20_38_28/0.18)]"
                }
              />
            </ProductZoom>
            <div className="absolute left-5 top-5 scale-110 origin-top-left">
              <Badges product={cardData} />
            </div>
            <ProductStamp className="bottom-3 right-3 h-6 px-1.5 py-1 sm:bottom-4 sm:right-4 sm:h-7" />
          </div>

          <div className="lg:py-4">
            {product.brand && (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">{product.brand}</p>
            )}
            <h1 className="mt-2 font-display text-3xl font-semibold leading-[1.12] tracking-tight sm:text-[2.4rem]">{product.name}</h1>
            <p className="mt-3 text-lg text-ink-soft">{product.unit}</p>
            {product.reviewCount ? (
              <a href="#otzivi" className="mt-2 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
                <Stars value={product.rating ?? 0} />
                <span className="font-semibold text-ink tabular-nums">{ratingLabel(product.rating ?? 0)}</span>
                <span className="underline underline-offset-2">{product.reviewCount === 1 ? "1 отзив" : `${product.reviewCount} отзива`}</span>
              </a>
            ) : null}

            <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className={`text-4xl font-bold tabular-nums ${off ? "text-tomato" : ""}`}>{formatPrice(product.price)}</p>
              {off > 0 && product.oldPrice && (
                <p className="pb-1 text-lg text-ink-soft line-through tabular-nums">{formatPrice(product.oldPrice)}</p>
              )}
              <p className="w-full text-sm text-ink-soft">Цена с ДДС</p>
            </div>

            {product.bulkMinQty && product.bulkPrice && (
              <p className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-lime px-4 py-3 font-medium">
                <span className="grid h-9 min-w-9 place-items-center rounded-full bg-ink px-2 text-sm font-bold text-lime">{product.bulkMinQty}+</span>
                <span>
                  Вземи {product.bulkMinQty} или повече за{" "}
                  <strong className="tabular-nums">{formatPrice(product.bulkPrice)}</strong> на брой
                </span>
              </p>
            )}

            <div className="mt-7">
              <BuyBox product={cardData} />
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <span className={`h-2 w-2 rounded-full ${product.stock > 0 ? "bg-forest" : "bg-tomato"}`} aria-hidden />
              {product.stock > 0 ? "В наличност — изпращаме до 24 часа" : "Изчерпан"}
            </p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Truck, text: "Безплатна доставка с BoxNow" },
                { icon: PackageCheck, text: "Преглед преди плащане" },
                { icon: ShieldCheck, text: "Оригинален внос" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 rounded-2xl bg-paper p-4 text-sm font-medium shadow-soft sm:flex-col sm:items-start">
                  <Icon className="h-5 w-5 shrink-0 text-forest" strokeWidth={1.75} aria-hidden />
                  {text}
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <h2 className="font-display text-lg font-semibold">Описание</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-soft">{description}</p>
            </div>

            <dl className="mt-8 divide-y divide-line border-y border-line">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3 text-[0.95rem]">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-tile bg-sand" aria-hidden />}>
        <Reviews productId={product.id} slug={product.slug} />
      </Suspense>

      {related.length > 0 && (
        <section aria-labelledby="related-heading">
          <SectionHeading id="related-heading" title="Може да ти хареса още" />
          <Carousel label="Подобни продукти">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </Carousel>
        </section>
      )}

      <RecentlyViewed current={cardData} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-5 w-44 animate-pulse rounded-full bg-sand" />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="aspect-square animate-pulse rounded-tile bg-sand" />
        <div className="space-y-5 py-4">
          <div className="h-4 w-32 animate-pulse rounded-full bg-sand" />
          <div className="h-12 w-4/5 animate-pulse rounded-2xl bg-sand" />
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-sand" />
          <div className="h-12 w-full animate-pulse rounded-full bg-sand" />
        </div>
      </div>
    </div>
  );
}

export default function ProductPage({ params }: Props) {
  return (
    <div className="container-shop pt-6 sm:pt-8">
      <Suspense fallback={<Skeleton />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}
