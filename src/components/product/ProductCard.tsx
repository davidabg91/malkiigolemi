import Link from "next/link";
import { ViewCount } from "@/components/admin/ProductViews";
import { LogoArt } from "@/components/ui";
import { discountPercent, formatPrice } from "@/lib/format";
import { priceRange } from "@/lib/product-colors";
import type { ProductCardData } from "@/lib/queries";
import { CardAddButton, WishlistButton } from "./AddToCart";
import { ProductVisual } from "./PackShot";
import { ratingLabel, Stars } from "./Stars";
import { StockPill } from "./StockPill";

export function Badges({ product }: { product: ProductCardData }) {
  const off = discountPercent(product.price, product.oldPrice);
  return (
    <div className="pointer-events-none flex flex-col items-start gap-1.5">
      {off > 0 && (
        <span className="rounded-full bg-tomato px-2.5 py-1 text-xs font-bold text-white">−{off}%</span>
      )}
      {product.bulkMinQty && product.bulkPrice && (
        <span className="rounded-full bg-lime px-2.5 py-1 text-xs font-semibold text-ink">
          от {product.bulkMinQty} бр · {formatPrice(product.bulkPrice)}
        </span>
      )}
      {product.isNew && (
        <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-cream">Ново</span>
      )}
    </div>
  );
}

/**
 * The shop's badge in the bottom-right corner of a product photo, like a big chain's stamp. It sits on the
 * photo frame rather than in the file, so every photo gets it, uploads included, and small thumbnails stay clean.
 */
export function ProductStamp({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute z-[1] rounded-full bg-white/95 shadow-[0_2px_8px_rgb(15_23_42/0.12)] ring-1 ring-black/5 ${className}`}>
      <LogoArt className="h-full w-auto" />
    </span>
  );
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const range = priceRange(product);
  const href = `/produkt/${product.slug}`;
  const isFull = Boolean(product.image && /\.(jpe?g|webp)$/i.test(product.image));
  return (
    <article className="group relative flex h-full min-w-0 flex-col rounded-card bg-paper p-2.5 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-3">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="relative block aspect-square overflow-hidden rounded-2xl"
        style={{ background: isFull ? "#efefed" : `color-mix(in srgb, ${product.color} 4%, #efefed)` }}
      >
        <ProductVisual
          product={product}
          className={`absolute inset-0 m-auto ${
            isFull
              ? "h-full w-full transition-transform duration-500 ease-out-soft group-hover:scale-105"
              : "h-[88%] w-[88%] transition-transform duration-500 ease-out-soft group-hover:-rotate-3 group-hover:scale-[1.07]"
          }`}
        />
        <ProductStamp className="bottom-1.5 right-1.5 h-4 px-1 py-0.5 sm:h-[1.1rem]" />
        {/* Admins only: how many times the product was opened. */}
        <ViewCount id={product.id} className="absolute bottom-1.5 left-1.5 z-[1]" />
      </Link>
      <div className="absolute left-4 top-4 z-10 sm:left-5 sm:top-5">
        <Badges product={product} />
      </div>
      <WishlistButton product={product} className="absolute right-4 top-4 z-10 sm:right-5 sm:top-5" />

      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
        {product.brand && (
          <p className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">{product.brand}</p>
        )}
        <h3 className="mt-1 line-clamp-2 min-h-[2.6em] text-[0.95rem] font-medium leading-snug">
          <Link href={href} className="after:absolute after:inset-0 after:rounded-card hover:text-forest">
            {product.name}
          </Link>
        </h3>
        {/* One line: a long "unit" (some are whole sentences) would make this card, and with it every card
            in its row or carousel, much taller than the rest. The product's page shows it in full. */}
        <p className="mt-0.5 truncate text-sm text-ink-soft">{product.unit}</p>
        <p className="mt-1.5 flex">
          <StockPill product={product} />
        </p>
        {product.reviewCount ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
            <Stars value={product.rating ?? 0} className="h-3.5 w-3.5" />
            <span className="tabular-nums">
              {ratingLabel(product.rating ?? 0)} ({product.reviewCount})
            </span>
          </p>
        ) : null}
        <div className="relative z-10 mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="leading-tight">
            {range.min < range.max ? (
              // Colours (or sizes) that cost differently: the lowest price, as on the product's page.
              <p className="text-lg font-bold tabular-nums">
                <span className="mr-1 text-xs font-medium text-ink-soft">от</span>
                {formatPrice(range.min)}
              </p>
            ) : (
              <>
                {product.oldPrice && product.oldPrice > product.price && (
                  <p className="text-xs text-ink-soft line-through tabular-nums">{formatPrice(product.oldPrice)}</p>
                )}
                <p className={`text-lg font-bold tabular-nums ${product.oldPrice ? "text-tomato" : ""}`}>{formatPrice(product.price)}</p>
              </>
            )}
          </div>
          <CardAddButton product={product} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
