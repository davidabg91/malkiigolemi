"use client";

import { AlertTriangle, ClipboardPaste, Loader2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { importFbPost } from "@/actions/facebook";
import { btn } from "@/components/ui";
import { parseComments } from "@/lib/fb-parse";

type ProductOption = { id: number; label: string; stock: number };
type Row = { name: string; qty: number; comment: string; include: boolean; sure: boolean };

export function FbImport({ products }: { products: ProductOption[] }) {
  const [state, action, pending] = useActionState(importFbPost, undefined);
  const [productId, setProductId] = useState("");
  const [raw, setRaw] = useState("");
  // Edits made in the preview, keyed by the comment's position; re-pasting starts over.
  const [edits, setEdits] = useState<Record<number, Partial<Row>>>({});

  const rows: Row[] = useMemo(
    () => parseComments(raw).map((c, i) => ({ name: c.name, qty: c.qty, comment: c.comment, sure: c.sure, include: c.qty > 0, ...edits[i] })),
    [raw, edits],
  );
  const chosen = rows.filter((r) => r.include && r.qty > 0);
  const total = chosen.reduce((s, r) => s + r.qty, 0);
  const product = products.find((p) => String(p.id) === productId);
  const edit = (i: number, patch: Partial<Row>) => setEdits((e) => ({ ...e, [i]: { ...e[i], ...patch } }));

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="fb-product" className="mb-1.5 block text-sm font-medium">
            Продукт от поста <span className="text-tomato">*</span>
          </label>
          <select id="fb-product" name="productId" required value={productId} onChange={(e) => setProductId(e.target.value)} className="field">
            <option value="">Избери продукт…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.stock} бр
              </option>
            ))}
          </select>
          {state?.fieldErrors?.productId && <p className="mt-1.5 text-sm font-medium text-tomato">{state.fieldErrors.productId}</p>}
        </div>
        <div>
          <label htmlFor="fb-url" className="mb-1.5 block text-sm font-medium">
            Линк към поста <span className="font-normal text-ink-soft">(по желание)</span>
          </label>
          <input id="fb-url" name="url" type="url" inputMode="url" placeholder="https://www.facebook.com/groups/…" className="field" />
          {state?.fieldErrors?.url && <p className="mt-1.5 text-sm font-medium text-tomato">{state.fieldErrors.url}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="fb-raw" className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          <ClipboardPaste className="h-4 w-4 text-forest" aria-hidden />
          Коментари от поста
        </label>
        <textarea
          id="fb-raw"
          rows={8}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setEdits({});
          }}
          placeholder={"Отвори коментарите под поста, маркирай ги (или Ctrl+A) и ги копирай тук.\n\nMariq Georgieva\n ·\n1 брой за мен\nСподеляне\n…"}
          className="field h-auto py-3 font-mono text-sm"
        />
        <p className="mt-1.5 text-sm text-ink-soft">Имената и бройките се разпознават сами. Провери ги отдолу, поправи каквото трябва и запази.</p>
      </div>

      {rows.length > 0 && (
        <div className="rounded-2xl border border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-sand/50 px-4 py-3 text-sm">
            <p>
              <strong>{chosen.length}</strong> заявки за <strong>{total} бр</strong>
              {rows.length > chosen.length && <span className="text-ink-soft"> · {rows.length - chosen.length} пропуснати</span>}
            </p>
            {product && total > product.stock && (
              <p className="inline-flex items-center gap-1.5 font-semibold text-tomato">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Заявени {total} бр, налични {product.stock}
              </p>
            )}
          </div>
          <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {rows.map((r, i) => (
              <li key={i} className={`grid grid-cols-[auto_1fr_5rem] items-center gap-3 px-4 py-2.5 sm:grid-cols-[auto_14rem_1fr_5rem] ${r.include ? "" : "opacity-55"}`}>
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => edit(i, { include: e.target.checked, qty: e.target.checked && r.qty === 0 ? 1 : r.qty })}
                  aria-label={`Включи ${r.name}`}
                  className="h-5 w-5 accent-[#1f5c3f]"
                />
                <input value={r.name} onChange={(e) => edit(i, { name: e.target.value })} aria-label="Име" className="field h-10 text-sm" />
                <p className="col-span-3 col-start-2 row-start-2 text-sm text-ink-soft sm:col-span-1 sm:col-start-3 sm:row-start-1">
                  „{r.comment}“
                  {!r.sure && r.include && <span className="ml-1.5 rounded bg-sun/50 px-1.5 py-0.5 text-[0.7rem] font-semibold text-ink">провери</span>}
                </p>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={r.qty}
                  onChange={(e) => {
                    const qty = Math.max(0, Math.min(99, Number(e.target.value) || 0));
                    edit(i, { qty, include: qty > 0 });
                  }}
                  aria-label={`Бройки за ${r.name}`}
                  className="field h-10 text-right text-sm tabular-nums"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <input type="hidden" name="claims" value={JSON.stringify(chosen.map(({ name, qty, comment }) => ({ name: name.trim(), qty, comment })))} />
      {state?.error && !state.fieldErrors?.productId && !state.fieldErrors?.url && (
        <p role="alert" className="rounded-2xl bg-tomato/10 px-4 py-3 text-sm font-medium text-tomato">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending || chosen.length === 0 || !productId} className={btn.primary}>
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        Запази {chosen.length > 0 ? `${chosen.length} заявки` : "заявките"}
      </button>
    </form>
  );
}
