"use client";

import { Check, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { btn } from "@/components/ui";
import { SORTS, type SortKey } from "@/lib/listing";
import { ORIGIN_LABELS } from "@/lib/site";

export type Facets = {
  /** Main categories; empty on a category page. */
  categories: { slug: string; name: string; n: number }[];
  brands: { slug: string; name: string; n: number }[];
  origins: { origin: string | null; n: number }[];
  /** Whole euros. */
  priceMin: number;
  priceMax: number;
};

export type Current = {
  categories: string[];
  brands: string[];
  origins: string[];
  min: number | null;
  max: number | null;
  sort: SortKey;
};

function CheckRow({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count: number }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2 text-[0.95rem] transition hover:bg-sand">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ink/25 bg-paper text-transparent transition peer-checked:border-forest peer-checked:bg-forest peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span className="flex-1">{label}</span>
      <span className="text-xs text-ink-soft tabular-nums">{count}</span>
    </label>
  );
}

function PriceRange({ lo, hi, value, onCommit }: { lo: number; hi: number; value: [number, number]; onCommit: (v: [number, number]) => void }) {
  const [v, setV] = useState(value);
  const [a, b] = v;
  const span = Math.max(1, hi - lo);
  const thumb =
    "pointer-events-none absolute inset-x-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-forest [&::-moz-range-thumb]:bg-paper [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-forest [&::-webkit-slider-thumb]:bg-paper";
  const commit = () => onCommit(v);
  return (
    <div>
      <div className="relative mx-1 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-forest"
          style={{ left: `${((a - lo) / span) * 100}%`, right: `${100 - ((b - lo) / span) * 100}%` }}
        />
        <input
          type="range"
          min={lo}
          max={hi}
          value={a}
          aria-label="Минимална цена"
          onChange={(e) => setV([Math.min(Number(e.target.value), b), b])}
          onPointerUp={commit}
          onKeyUp={commit}
          className={thumb}
        />
        <input
          type="range"
          min={lo}
          max={hi}
          value={b}
          aria-label="Максимална цена"
          onChange={(e) => setV([a, Math.max(Number(e.target.value), a)])}
          onPointerUp={commit}
          onKeyUp={commit}
          className={thumb}
        />
      </div>
      <p className="mt-2 flex justify-between text-sm font-medium tabular-nums">
        <span>{a} €</span>
        <span>{b} €</span>
      </p>
    </div>
  );
}

export function ListingShell({
  basePath,
  preserve,
  facets,
  current,
  total,
  nav,
  children,
}: {
  basePath: string;
  /** Extra query params that must survive filtering, e.g. the search term. */
  preserve?: Record<string, string>;
  facets: Facets;
  current: Current;
  total: number;
  nav?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState(false);
  // Unique per copy: a listing page left behind stays mounted (hidden) after navigating to the next one.
  const sortId = useId();

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  const go = (next: Partial<Current>) => {
    const c = { ...current, ...next };
    const qs = new URLSearchParams(preserve);
    if (c.categories.length) qs.set("cat", c.categories.join(","));
    if (c.brands.length) qs.set("brand", c.brands.join(","));
    if (c.origins.length) qs.set("origin", c.origins.join(","));
    if (c.min != null && c.min > facets.priceMin) qs.set("min", String(c.min));
    if (c.max != null && c.max < facets.priceMax) qs.set("max", String(c.max));
    if (c.sort !== "popular") qs.set("sort", c.sort);
    const s = qs.toString();
    start(() => router.push(s ? `${basePath}?${s}` : basePath, { scroll: false }));
  };

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const activeCount = current.categories.length + current.brands.length + current.origins.length + (current.min != null || current.max != null ? 1 : 0);
  const hasPrice = facets.priceMax > facets.priceMin;

  const filters = (
    <div className="space-y-7">
      {nav}
      {(facets.categories.length > 1 || current.categories.length > 0) && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]">Категория</legend>
          {facets.categories.map((c) => (
            <CheckRow
              key={c.slug}
              label={c.name}
              count={c.n}
              checked={current.categories.includes(c.slug)}
              onChange={() => go({ categories: toggle(current.categories, c.slug) })}
            />
          ))}
        </fieldset>
      )}
      {hasPrice && (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold uppercase tracking-[0.14em]">Цена</legend>
          <PriceRange
            key={`${current.min}-${current.max}-${facets.priceMin}-${facets.priceMax}`}
            lo={facets.priceMin}
            hi={facets.priceMax}
            value={[current.min ?? facets.priceMin, current.max ?? facets.priceMax]}
            onCommit={([min, max]) => {
              if (min !== (current.min ?? facets.priceMin) || max !== (current.max ?? facets.priceMax)) go({ min, max });
            }}
          />
        </fieldset>
      )}
      {facets.origins.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]">Произход</legend>
          {facets.origins.map(
            (o) =>
              o.origin && (
                <CheckRow
                  key={o.origin}
                  label={ORIGIN_LABELS[o.origin] ?? o.origin}
                  count={o.n}
                  checked={current.origins.includes(o.origin)}
                  onChange={() => go({ origins: toggle(current.origins, o.origin!) })}
                />
              ),
          )}
        </fieldset>
      )}
      {facets.brands.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]">Марка</legend>
          <div>
            {facets.brands.map((b) => (
              <CheckRow
                key={b.slug}
                label={b.name}
                count={b.n}
                checked={current.brands.includes(b.slug)}
                onChange={() => go({ brands: toggle(current.brands, b.slug) })}
              />
            ))}
          </div>
        </fieldset>
      )}
      {activeCount > 0 && (
        <button type="button" onClick={() => go({ categories: [], brands: [], origins: [], min: null, max: null })} className={`${btn.sm} w-full`}>
          <X className="h-4 w-4" />
          Изчисти филтрите
        </button>
      )}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[16.5rem_1fr]">
      <aside className="hidden lg:block" aria-label="Филтри">
        {/* Taller than the screen once categories, origins and brands add up: it scrolls on its own then. */}
        <div className="sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain rounded-card bg-paper p-5 shadow-soft">{filters}</div>
      </aside>

      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-soft" aria-live="polite">
            <strong className="font-semibold text-ink tabular-nums">{total}</strong> {total === 1 ? "продукт" : "продукта"}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSheet(true)} className={`${btn.sm} lg:hidden`}>
              <SlidersHorizontal className="h-4 w-4" />
              Филтри
              {activeCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1 text-xs text-white">{activeCount}</span>}
            </button>
            <label className="sr-only" htmlFor={sortId}>
              Подреждане
            </label>
            <select
              id={sortId}
              value={current.sort}
              onChange={(e) => go({ sort: e.target.value as SortKey })}
              className="h-10 rounded-full border border-line bg-paper pl-4 pr-9 text-sm font-medium outline-none transition hover:border-ink focus-visible:border-forest"
            >
              {Object.entries(SORTS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={`transition-opacity duration-200 ${pending ? "opacity-50" : ""}`} aria-busy={pending}>
          {children}
        </div>
      </div>

      <AnimatePresence>
        {sheet && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Филтри">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink/50" onClick={() => setSheet(false)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%", transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="absolute inset-x-0 bottom-0 flex max-h-[86dvh] flex-col rounded-t-[2rem] bg-cream"
            >
              <div className="flex items-center justify-between px-6 pb-2 pt-5">
                <h2 className="font-display text-lg font-semibold">Филтри</h2>
                <button type="button" onClick={() => setSheet(false)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand" aria-label="Затвори филтрите">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-4">{filters}</div>
              <div className="border-t border-line bg-paper p-4">
                <button type="button" onClick={() => setSheet(false)} className={`${btn.primary} w-full`}>
                  Покажи {total} {total === 1 ? "продукт" : "продукта"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
