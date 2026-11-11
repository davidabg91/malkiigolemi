"use client";

import { Check, Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ProductCardData } from "@/lib/queries";
import { useCart, useHydrated, useWishlist } from "@/lib/store";
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
  if (hydrated && qty > 0) {
    return <QtyStepper size="sm" qty={qty} onChange={(q) => setQty(product.id, q)} label={product.name} />;
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
      className={`grid h-10 w-10 place-items-center rounded-full bg-paper/90 text-ink shadow-soft backdrop-blur transition hover:scale-110 ${className}`}
    >
      <Heart key={String(on)} className={`h-[18px] w-[18px] ${on ? "animate-pop fill-tomato text-tomato" : ""}`} />
    </button>
  );
}

/** Full-width buy box used on the product page. */
export function BuyBox({ product }: { product: ProductCardData }) {
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const add = useCart((s) => s.add);
  const openCart = useCart((s) => s.setOpen);

  if (product.stock <= 0) return <NotifyMe productId={product.id} />;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <QtyStepper qty={qty} min={1} onChange={setQty} label={product.name} />
      <button
        type="button"
        onClick={() => {
          add(product, qty);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
          openCart(true);
        }}
        className="inline-flex h-12 min-w-56 flex-1 items-center justify-center gap-2 rounded-full bg-lime px-6 font-semibold text-ink transition hover:bg-lime-deep active:scale-[.98]"
      >
        {done ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
        {done ? "Добавено" : "Добави в количката"}
      </button>
      <WishlistButton product={product} className="h-12 w-12 border border-line shadow-none" />
    </div>
  );
}
