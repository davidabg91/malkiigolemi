"use client";

import { Check, Heart, Minus, Palette, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { ProductCardData } from "@/lib/queries";
import { lineKey, useCart, useHydrated, useWishlist } from "@/lib/store";
import { ColorDot } from "./ColorTag";
import { NotifyMe } from "./NotifyMe";

export function QtyStepper({
  qty,
  onChange,
  size = "md",
  min = 0,
  label,
}: {
  qty: number;
  onChange: (qty: number) => void;
  size?: "sm" | "md";
  min?: number;
  label: string;
}) {
  const h = size === "sm" ? "h-10" : "h-12";
  const w = size === "sm" ? "w-10" : "w-12";
  return (
    <div className={`inline-flex ${h} items-center rounded-full bg-forest text-white`} role="group" aria-label={`Количество: ${label}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, qty - 1))}
        className={`grid ${h} ${w} place-items-center rounded-full transition hover:bg-forest-deep`}
        aria-label="Намали количеството"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        className={`grid ${h} ${w} place-items-center rounded-full transition hover:bg-forest-deep`}
        aria-label="Увеличи количеството"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Round "+" on product cards that turns into a stepper once the product is in the cart. */
export function CardAddButton({ product }: { product: ProductCardData }) {
  const hydrated = useHydrated();
  const qty = useCart((s) => s.items.find((i) => i.id === product.id)?.qty ?? 0);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);

  if (product.stock <= 0) {
    return <span className="rounded-full bg-sand px-3 py-2 text-xs font-medium text-ink-soft">Изчерпан</span>;
  }
  // Sold in several colours: the colour is chosen on the product's page.
  if (product.colors && product.colors.length > 0) {
    return (
      <Link
        href={`/produkt/${product.slug}`}
        className="inline-flex h-11 items-center gap-1.5 rounded-full bg-forest px-3.5 text-xs font-semibold text-white transition duration-200 hover:bg-forest-deep active:scale-95"
        aria-label={`Избери цвят: ${product.name}`}
      >
        <Palette className="h-4 w-4" aria-hidden />
        Цветове
      </Link>
    );
  }
  if (hydrated && qty > 0) {
    return <QtyStepper size="sm" qty={qty} onChange={(q) => setQty(lineKey(product), q)} label={product.name} />;
  }
  return (
    <button
      type="button"
      onClick={() => {
        add(product);
        toast.success("Добавено в количката", { description: product.name, duration: 2200 });
      }}
      className="grid h-11 w-11 place-items-center rounded-full bg-forest text-white transition duration-200 hover:scale-105 hover:bg-forest-deep active:scale-95"
      aria-label={`Добави в количката: ${product.name}`}
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}

export function WishlistButton({ product, className = "" }: { product: ProductCardData; className?: string }) {
  const hydrated = useHydrated();
  const active = useWishlist((s) => s.items.some((i) => i.id === product.id));
  const toggle = useWishlist((s) => s.toggle);
  const on = hydrated && active;
  return (
    <button
      type="button"
      onClick={() => {
        toggle(product);
        toast(on ? "Премахнато от любими" : "Добавено в любими", { duration: 1800 });
      }}
      aria-pressed={on}
      aria-label={on ? `Премахни от любими: ${product.name}` : `Добави в любими: ${product.name}`}
      className={`grid h-10 w-10 place-items-center rounded-full bg-paper/95 text-ink shadow-soft transition hover:scale-110 ${className}`}
    >
      <Heart key={String(on)} className={`h-[18px] w-[18px] ${on ? "animate-pop fill-tomato text-tomato" : ""}`} />
    </button>
  );
}

/** Full-width buy box used on the product page. */
export function BuyBox({ product }: { product: ProductCardData }) {
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const colors = product.colors ?? [];
  // With one colour there is nothing to choose; with several the customer has to.
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0] : null);
  const [missing, setMissing] = useState(false);
  const add = useCart((s) => s.add);
  const openCart = useCart((s) => s.setOpen);

  if (product.stock <= 0) return <NotifyMe productId={product.id} />;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {colors.length > 0 && (
        <fieldset className="w-full">
          <legend className="mb-2 text-sm font-medium">
            Цвят{color ? <span className="text-ink-soft">: {color}</span> : <span className="text-tomato" aria-hidden> *</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <label
                key={c}
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-medium transition hover:border-forest has-[:checked]:border-forest has-[:checked]:bg-forest has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest has-[:focus-visible]:ring-offset-2"
              >
                <input
                  type="radio"
                  name={`color-${product.id}`}
                  value={c}
                  checked={color === c}
                  onChange={() => {
                    setColor(c);
                    setMissing(false);
                  }}
                  className="sr-only"
                />
                <ColorDot name={c} className="h-4 w-4" />
                {c}
              </label>
            ))}
          </div>
          {missing && (
            <p role="alert" className="mt-2 text-sm font-medium text-tomato">
              Избери цвят, за да добавиш продукта в количката.
            </p>
          )}
        </fieldset>
      )}
      <QtyStepper qty={qty} min={1} onChange={setQty} label={product.name} />
      <button
        type="button"
        onClick={() => {
          if (colors.length > 0 && !color) {
            setMissing(true);
            return;
          }
          add(product, qty, color);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
          openCart(true);
        }}
        className="inline-flex h-12 min-w-56 flex-1 items-center justify-center gap-2 rounded-full bg-forest px-6 font-semibold text-white transition hover:bg-forest-deep active:scale-[.98]"
      >
        {done ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
        {done ? "Добавено" : "Добави в количката"}
      </button>
      <WishlistButton product={product} className="h-12 w-12 border border-line shadow-none" />
    </div>
  );
}
