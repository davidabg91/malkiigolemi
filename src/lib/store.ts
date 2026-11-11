"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { unitPriceFor } from "./format";
import type { ProductCardData } from "./queries";

export type CartItem = ProductCardData & { qty: number };

type CartState = {
  items: CartItem[];
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (p: ProductCardData, qty?: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
};

const MAX_QTY = 99;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      setOpen: (open) => set({ open }),
      add: (p, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.id === p.id);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.id === p.id ? { ...i, ...p, qty: Math.min(MAX_QTY, i.qty + qty) } : i,
              ),
            };
          }
          return { items: [...s.items, { ...p, qty: Math.min(MAX_QTY, qty) }] };
        }),
      setQty: (id, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.id !== id)
              : s.items.map((i) => (i.id === id ? { ...i, qty: Math.min(MAX_QTY, qty) } : i)),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "limona-cart", partialize: (s) => ({ items: s.items }) },
  ),
);

export function cartTotals(items: CartItem[]) {
  let subtotal = 0;
  let count = 0;
  let savings = 0;
  for (const i of items) {
    const unit = unitPriceFor(i, i.qty);
    subtotal += unit * i.qty;
    count += i.qty;
    savings += ((i.oldPrice && i.oldPrice > i.price ? i.oldPrice : i.price) - unit) * i.qty;
  }
  return { subtotal, count, savings };
}

type ListState = {
  items: ProductCardData[];
  toggle: (p: ProductCardData) => void;
  push: (p: ProductCardData) => void;
};

export const useWishlist = create<ListState>()(
  persist(
    (set) => ({
      items: [],
      toggle: (p) =>
        set((s) => ({
          items: s.items.some((i) => i.id === p.id)
            ? s.items.filter((i) => i.id !== p.id)
            : [p, ...s.items],
        })),
      push: () => {},
    }),
    { name: "limona-wishlist" },
  ),
);

export const useRecent = create<ListState>()(
  persist(
    (set) => ({
      items: [],
      toggle: () => {},
      push: (p) => set((s) => ({ items: [p, ...s.items.filter((i) => i.id !== p.id)].slice(0, 10) })),
    }),
    { name: "limona-recent" },
  ),
);

// A tab that was opened before an order still holds the old cart in memory, and its next change would
// write that old cart back. Re-read the saved copy whenever another tab changes it.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "limona-cart") void useCart.persist.rehydrate();
    if (e.key === "limona-wishlist") void useWishlist.persist.rehydrate();
  });
}

const noop = () => () => {};

/** False on the server and during hydration, true afterwards — guards localStorage-backed UI. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
