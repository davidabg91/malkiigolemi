"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { discountPercent, formatPrice } from "@/lib/format";
import { colorChoices, ownColorPrice, priceRange } from "@/lib/product-colors";
import type { ProductCardData } from "@/lib/queries";

type Choice = [color: string | null, setColor: (color: string | null) => void];

const ChoiceContext = createContext<Choice | null>(null);

/** With one colour left there is nothing to choose; with several the customer has to. */
function onlyColorLeft(product: ProductCardData) {
  const available = colorChoices(product).filter((c) => c.stock > 0);
  return available.length === 1 ? available[0].name : null;
}

/**
 * The colour (or size) chosen on a product's page, shared by the buy box, where it is chosen, and the
 * price, which follows it when the colour has a price of its own.
 */
export function ColorChoiceProvider({ product, children }: { product: ProductCardData; children: ReactNode }) {
  const choice = useState<string | null>(() => onlyColorLeft(product));
  return <ChoiceContext.Provider value={choice}>{children}</ChoiceContext.Provider>;
}

/** The chosen colour and its setter; on its own (outside a product's page) a component keeps the choice itself. */
export function useColorChoice(product: ProductCardData): Choice {
  const shared = useContext(ChoiceContext);
  const own = useState<string | null>(() => onlyColorLeft(product));
  return shared ?? own;
}

/**
 * The price on a product's page. Before a colour is chosen, a product whose colours cost differently
 * shows the lowest price as "от …"; once one is chosen, that colour's price.
 */
export function ProductPrice({ product }: { product: ProductCardData }) {
  const [color] = useColorChoice(product);
  const own = ownColorPrice(product, color);
  const range = priceRange(product);
  const from = !color && range.min < range.max;
  const price = own ? own.price : from ? range.min : product.price;
  // The product's crossed-out price belongs to the product's own price, not to "от …".
  const oldPrice = own ? own.oldPrice : from ? null : product.oldPrice;
  const off = discountPercent(price, oldPrice);
  // The price for quantity is the product's; a colour with its own price is not part of it.
  const bulk = !own && product.bulkMinQty && product.bulkPrice ? { qty: product.bulkMinQty, price: product.bulkPrice } : null;

  return (
    <>
      <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-1" aria-live="polite">
        <p className={`text-4xl font-bold tabular-nums ${off ? "text-tomato" : ""}`}>
          {from && <span className="mr-2 text-lg font-medium text-ink-soft">от</span>}
          {formatPrice(price)}
        </p>
        {off > 0 && oldPrice && <p className="pb-1 text-lg text-ink-soft line-through tabular-nums">{formatPrice(oldPrice)}</p>}
        <p className="w-full text-sm text-ink-soft">{from ? "Цена с ДДС — зависи от избора по-долу" : "Цена с ДДС"}</p>
      </div>

      {bulk && (
        <p className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-lime px-4 py-3 font-medium">
          <span className="grid h-9 min-w-9 place-items-center rounded-full bg-ink px-2 text-sm font-bold text-lime">{bulk.qty}+</span>
          <span>
            Вземи {bulk.qty} или повече за <strong className="tabular-nums">{formatPrice(bulk.price)}</strong> на брой
          </span>
        </p>
      )}
    </>
  );
}
