"use client";

import { formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, type DeliveryId } from "@/lib/site";

/** Radio cards for the delivery method; shared by checkout and the profile's saved preference. */
export function DeliveryOptions({
  value,
  onChange,
  priceFor,
}: {
  value: DeliveryId;
  onChange: (id: DeliveryId) => void;
  /** Price shown on each card; omit to show the base price. */
  priceFor?: (id: DeliveryId) => number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Начин на доставка">
      {DELIVERY_METHODS.map((d) => {
        const active = d.id === value;
        const price = priceFor ? priceFor(d.id) : d.price;
        return (
          <label
            key={d.id}
            className={`relative flex cursor-pointer flex-col rounded-2xl border-2 p-4 transition ${active ? "border-forest bg-lime/25" : "border-line hover:border-ink/30"}`}
          >
            <input type="radio" name="delivery" value={d.id} checked={active} onChange={() => onChange(d.id)} className="peer sr-only" />
            <span className="font-semibold">{d.label}</span>
            <span className="mt-1 text-sm text-ink-soft">{d.hint}</span>
            <span className="mt-auto pt-3 font-bold tabular-nums">{price === 0 ? "Безплатно" : formatPrice(price)}</span>
            <span className="pointer-events-none absolute inset-0 rounded-2xl peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2" />
          </label>
        );
      })}
    </div>
  );
}
