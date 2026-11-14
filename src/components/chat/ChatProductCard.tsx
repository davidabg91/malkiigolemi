import Link from "next/link";
import type { ReactNode } from "react";
import { ProductVisual } from "@/components/product/PackShot";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/lib/queries";

/**
 * A product the shop suggested in the chat: its photo, name and price, opening the product's page.
 * `action` is what stands next to the price (the customer's add-to-cart button).
 */
export function ChatProductCard({ product, action, onOpen }: { product: ProductCardData; action?: ReactNode; onOpen?: () => void }) {
  const href = `/produkt/${product.slug}`;
  const discounted = Boolean(product.oldPrice && product.oldPrice > product.price);
  return (
    <div className="w-60 max-w-full overflow-hidden rounded-2xl bg-paper text-ink shadow-soft">
      <Link href={href} onClick={onOpen} className="group relative block aspect-[4/3] overflow-hidden bg-[#efefed]" tabIndex={-1} aria-hidden>
        <ProductVisual product={product} size={256} className="absolute inset-0 m-auto h-full w-full transition-transform duration-500 ease-out-soft group-hover:scale-105" />
      </Link>
      <div className="p-3">
        {product.brand && <p className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">{product.brand}</p>}
        <Link href={href} onClick={onOpen} className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug hover:text-forest">
          {product.name}
        </Link>
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="leading-tight">
            {discounted && <span className="block text-xs text-ink-soft line-through tabular-nums">{formatPrice(product.oldPrice!)}</span>}
            <span className={`text-base font-bold tabular-nums ${discounted ? "text-tomato" : ""}`}>{formatPrice(product.price)}</span>
          </p>
          {action}
        </div>
      </div>
    </div>
  );
}
