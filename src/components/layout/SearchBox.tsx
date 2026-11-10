"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ProductVisual } from "@/components/product/PackShot";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/lib/queries";

export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ProductCardData[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const inputId = useId();

  // Debounced suggestions; stale responses are dropped via the abort controller.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        /* aborted */
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const term = q.trim();
  const showPanel = open && term.length >= 2 && results !== null;

  return (
    <div ref={box} className={`relative ${className}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (!term) return;
          setOpen(false);
          router.push(`/tarsene?q=${encodeURIComponent(term)}`);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Търсене на продукти
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          id={inputId}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Търси кафе, зехтин, препарати…"
          autoComplete="off"
          className="h-12 w-full rounded-full border border-transparent bg-sand pl-11 pr-11 text-[0.95rem] outline-none transition placeholder:text-ink-soft/80 focus:border-forest focus:bg-paper focus:shadow-[0_0_0_4px_rgb(212_242_90/0.55)] [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setResults(null);
            }}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink"
            aria-label="Изчисти търсенето"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-3xl border border-line bg-paper p-2 shadow-lift">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-soft">
              Няма резултати за „{term}“. Опитай с друга дума.
            </p>
          ) : (
            <>
              <ul>
                {results.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/produkt/${p.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-sand"
                    >
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sand">
                        <ProductVisual product={p} className="h-10 w-10" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-ink-soft">
                          {p.brand} · {p.unit}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums">{formatPrice(p.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/tarsene?q=${encodeURIComponent(term)}`}
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-2xl bg-sand px-4 py-3 text-center text-sm font-semibold hover:bg-lime"
              >
                Виж всички резултати
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
