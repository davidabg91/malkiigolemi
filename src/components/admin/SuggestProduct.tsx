"use client";

import { Loader2, PackagePlus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductVisual } from "@/components/product/PackShot";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/lib/queries";

/**
 * The "suggest a product" button next to the admin's reply box: opens a search over the shop's products;
 * choosing one sends it to the customer as a card.
 */
export function SuggestProduct({ onPick, disabled }: { onPick: (product: ProductCardData) => void; disabled?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductCardData[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounced search through the same suggestions the shop's own search box uses.
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const term = q.trim();

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setQ("");
          setResults(null);
          setOpen(true);
          dialog.current?.showModal();
        }}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink transition raised hover:brightness-[0.96] active:scale-95 disabled:opacity-40"
        aria-label="Предложи продукт"
        title="Предложи продукт на клиента"
      >
        <PackagePlus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        aria-label="Предложи продукт"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl bg-paper p-0 text-ink shadow-lift backdrop:bg-ink/50"
      >
        {open && (
          <div className="flex max-h-[min(36rem,calc(100dvh-4rem))] flex-col">
            <div className="flex items-center justify-between gap-3 px-5 pt-5">
              <h2 className="font-display text-lg font-semibold">Предложи продукт</h2>
              <button type="button" onClick={() => dialog.current?.close()} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink" aria-label="Затвори">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="relative px-5 pt-3">
              <Search className="pointer-events-none absolute left-9 top-1/2 mt-1.5 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
                placeholder="Търси по име или марка…"
                aria-label="Търсене на продукт"
                className="field pl-11 text-base"
              />
            </div>
            <div className="mt-3 flex-1 overflow-y-auto px-3 pb-4">
              {term.length < 2 ? (
                <p className="px-2 py-8 text-center text-sm text-ink-soft">Напиши поне две букви от името на продукта.</p>
              ) : results === null || loading ? (
                <p className="grid place-items-center py-8 text-ink-soft">
                  <Loader2 className="h-5 w-5 animate-spin" aria-label="Търсене" />
                </p>
              ) : results.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-ink-soft">Няма продукт за „{term}“.</p>
              ) : (
                <ul>
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          dialog.current?.close();
                          onPick(p);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-sand"
                      >
                        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-sand">
                          <ProductVisual product={p} size={96} className="h-12 w-12" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-ink-soft">
                            {p.brand ?? "без марка"} · {p.unit} · {p.stock > 0 ? `${p.stock} в наличност` : "изчерпан"}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums">{formatPrice(p.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
