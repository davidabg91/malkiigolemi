"use client";

import { ShoppingBag, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect } from "react";
import { QtyStepper } from "@/components/product/AddToCart";
import { ProductVisual } from "@/components/product/PackShot";
import { btn } from "@/components/ui";
import { formatPrice, unitPriceFor } from "@/lib/format";
import { cartTotals, useCart, useHydrated, type CartItem } from "@/lib/store";

export function CartLine({ item, onNavigate }: { item: CartItem; onNavigate?: () => void }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const unit = unitPriceFor(item, item.qty);
  return (
    <li className="flex gap-3 py-4">
      <Link
        href={`/produkt/${item.slug}`}
        onClick={onNavigate}
        className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl"
        style={{ background: `color-mix(in srgb, ${item.color} 4%, #efefed)` }}
        tabIndex={-1}
        aria-hidden
      >
        <ProductVisual product={item} size={96} className="h-16 w-16" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/produkt/${item.slug}`} onClick={onNavigate} className="line-clamp-2 text-sm font-medium leading-snug hover:text-forest">
            {item.name}
          </Link>
          <button type="button" onClick={() => remove(item.id)} className="-mr-2 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-tomato" aria-label={`Премахни ${item.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-ink-soft">
          {item.brand} · {item.unit}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <QtyStepper size="sm" qty={item.qty} onChange={(q) => setQty(item.id, q)} label={item.name} />
          <div className="text-right leading-tight">
            <p className="font-bold tabular-nums">{formatPrice(unit * item.qty)}</p>
            {unit < item.price && <p className="text-xs font-medium text-forest">цена за количество</p>}
          </div>
        </div>
      </div>
    </li>
  );
}

export function CartDrawer() {
  const hydrated = useHydrated();
  const open = useCart((s) => s.open);
  const setOpen = useCart((s) => s.setOpen);
  const items = useCart((s) => s.items);
  const { subtotal, count } = cartTotals(items);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {hydrated && open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Количка" data-cart-drawer>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink/50" onClick={close} />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%", transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream sm:rounded-l-[2rem]"
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5 sm:px-6">
              <h2 className="font-display text-xl font-semibold">
                Количка{count > 0 && <span className="ml-2 text-base font-normal text-ink-soft">({count})</span>}
              </h2>
              <button type="button" onClick={close} className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand" aria-label="Затвори количката">
                <X className="h-5 w-5" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-lime">
                  <ShoppingBag className="h-8 w-8" strokeWidth={1.5} />
                </span>
                <p className="font-display text-lg font-semibold">Количката е празна</p>
                <p className="text-ink-soft">Добави нещо вкусно и ще го видиш тук.</p>
                <Link href="/promo" onClick={close} className={btn.primary}>
                  Виж промоциите
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 sm:px-6">
                  <ul className="divide-y divide-line">
                    {items.map((i) => (
                      <CartLine key={i.id} item={i} onNavigate={close} />
                    ))}
                  </ul>
                </div>
                <div className="space-y-3 border-t border-line bg-paper px-5 py-5 sm:rounded-bl-[2rem] sm:px-6">
                  <div className="flex items-baseline justify-between">
                    <span className="text-ink-soft">Междинна сума</span>
                    <span className="text-2xl font-bold tabular-nums">{formatPrice(subtotal)}</span>
                  </div>
                  <Link href="/porachka" onClick={close} className={`${btn.primary} w-full`}>
                    Към поръчка
                  </Link>
                  <Link href="/kolichka" onClick={close} className="block text-center text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                    Виж количката
                  </Link>
                </div>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
