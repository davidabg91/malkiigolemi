"use client";

import { ArrowRight, Heart, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { CartLine } from "@/components/layout/CartDrawer";
import { ProductGrid } from "@/components/product/ProductCard";
import { btn } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { liveCartData } from "@/actions/cart";
import { cartTotals, useCart, useFreshCartPrices, useHydrated, useWishlist } from "@/lib/store";

function Empty({ icon: Icon, title, text }: { icon: typeof Heart; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-tile bg-paper px-6 py-20 text-center shadow-soft">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-lime">
        <Icon className="h-8 w-8" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="mt-6 font-display text-xl font-semibold">{title}</p>
      <p className="mt-2 max-w-sm text-ink-soft">{text}</p>
      <Link href="/produkti" className={`${btn.primary} mt-7`}>
        Към продуктите
      </Link>
    </div>
  );
}

function Loading() {
  return <div className="h-80 animate-pulse rounded-tile bg-sand" aria-hidden />;
}

export function CartPage() {
  useFreshCartPrices(liveCartData);
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const { subtotal, savings, count } = cartTotals(items);

  if (!hydrated) return <Loading />;
  if (items.length === 0) {
    return <Empty icon={ShoppingBag} title="Количката е празна" text="Разгледай промоциите или добави любимите си продукти." />;
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="rounded-tile bg-paper px-5 py-2 shadow-soft sm:px-7">
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <CartLine key={i.id} item={i} />
          ))}
        </ul>
        <div className="border-t border-line py-4 text-right">
          <button type="button" onClick={clear} className="text-sm font-medium text-ink-soft underline-offset-4 hover:text-tomato hover:underline">
            Изпразни количката
          </button>
        </div>
      </div>

      <aside className="space-y-4 rounded-tile bg-paper p-6 shadow-soft lg:sticky lg:top-36" aria-label="Обобщение">
        <h2 className="font-display text-lg font-semibold">Обобщение</h2>
        <dl className="space-y-2 text-[0.95rem]">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Продукти ({count})</dt>
            <dd className="font-medium tabular-nums">{formatPrice(subtotal)}</dd>
          </div>
          {savings > 0 && (
            <div className="flex justify-between text-forest">
              <dt>Спестяваш</dt>
              <dd className="font-medium tabular-nums">−{formatPrice(savings)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-soft">Доставка</dt>
            <dd className="text-ink-soft">изчислява се на следващата стъпка</dd>
          </div>
        </dl>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-semibold">Междинна сума</span>
          <span className="text-2xl font-bold tabular-nums">{formatPrice(subtotal)}</span>
        </div>
        <Link href="/porachka" className={`${btn.lime} w-full`}>
          Към поръчка
          <ArrowRight className="h-[18px] w-[18px]" />
        </Link>
      </aside>
    </div>
  );
}

export function WishlistPage() {
  const hydrated = useHydrated();
  const items = useWishlist((s) => s.items);
  if (!hydrated) return <Loading />;
  if (items.length === 0) {
    return <Empty icon={Heart} title="Още нямаш любими" text="Натисни сърцето върху продукт, за да го запазиш тук за по-късно." />;
  }
  return <ProductGrid products={items} />;
}
