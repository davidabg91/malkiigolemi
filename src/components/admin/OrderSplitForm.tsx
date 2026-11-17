"use client";

import { Loader2, Scissors, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { editOrderItems } from "@/actions/facebook";
import { btn } from "@/components/ui";

type Line = { id: number; name: string; qty: number; color: string | null };

/**
 * "Раздели поръчката" under an order's products: tick what to take out, then either move it into a new order
 * of the same customer (e.g. the goods that have arrived) or remove it and return it to stock.
 */
export function OrderSplitForm({ orderId, lines }: { orderId: number; lines: Line[] }) {
  const [state, action, pending] = useActionState(editOrderItems.bind(null, orderId), undefined);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const any = lines.some((l) => picked[l.id]);

  return (
    <details className="border-t border-line">
      <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-semibold text-ink-soft hover:text-ink">
        <Scissors className="h-4 w-4" aria-hidden />
        Раздели поръчката или махни продукт
      </summary>
      <form action={action} className="px-5 pb-5">
        <p className="text-sm text-ink-soft">
          Отбележи продуктите (и колко броя от тях). „Отдели“ ги мести в нова поръчка на същия клиент, например стоката, която вече е дошла. „Махни“ ги изважда от поръчката и ги връща в наличност.
        </p>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name="item"
                  value={l.id}
                  checked={Boolean(picked[l.id])}
                  onChange={(e) => setPicked((p) => ({ ...p, [l.id]: e.target.checked }))}
                  className="h-5 w-5 shrink-0 accent-[#33484b]"
                />
                <span className="min-w-0 text-[0.95rem]">
                  {l.name}
                  {l.color && <span className="text-ink-soft"> · {l.color}</span>}
                </span>
              </label>
              {l.qty > 1 ? (
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <input type="number" name={`qty-${l.id}`} min={1} max={l.qty} defaultValue={l.qty} aria-label={`Колко броя от ${l.name}`} className="field h-10 w-20 text-center" />
                  от {l.qty} бр
                </label>
              ) : (
                <>
                  <input type="hidden" name={`qty-${l.id}`} value={1} />
                  <span className="text-sm text-ink-soft">1 бр</span>
                </>
              )}
            </li>
          ))}
        </ul>
        {state?.error && (
          <p role="alert" className="mt-3 text-sm font-medium text-tomato">
            {state.error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" name="do" value="split" disabled={pending || !any} className={btn.primary}>
            {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Scissors className="h-5 w-5" aria-hidden />}
            Отдели в нова поръчка
          </button>
          <button type="submit" name="do" value="remove" disabled={pending || !any} className={btn.ghost}>
            <Trash2 className="h-5 w-5" aria-hidden />
            Махни от поръчката
          </button>
        </div>
      </form>
    </details>
  );
}
