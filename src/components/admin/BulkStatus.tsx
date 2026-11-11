"use client";

import { Check, Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { setOrdersStatus } from "@/actions/admin";
import { ORDER_STATUS_LABELS } from "@/lib/site";

export const BULK_FORM = "bulk-orders";
const STATUSES = ["confirmed", "shipped", "delivered", "cancelled"] as const;

const boxes = () => [...document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM}"][name="ids"]`)];

/**
 * The bar above the orders table. Row checkboxes live in the server-rendered table and join this form
 * through their `form` attribute, so the table itself stays a plain server component.
 */
export function BulkStatusBar() {
  const [state, action, pending] = useActionState(setOrdersStatus, undefined);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.changed === 1 ? "1 поръчка е обновена" : `${state.changed} поръчки са обновени`);
      for (const b of boxes()) b.checked = false;
      // The listener above recounts, so the bar hides again.
      document.dispatchEvent(new Event("change"));
    } else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      id={BULK_FORM}
      action={action}
      onSubmit={(e) => {
        const status = new FormData(e.currentTarget).get("status");
        if (status === "cancelled" && !confirm(`Да откажа ли ${count} поръчки? Стоката се връща в наличност.`)) e.preventDefault();
      }}
      className={`sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 shadow-soft transition ${count ? "bg-ink text-cream" : "bg-paper"}`}
    >
      <span className="text-sm font-semibold">{count ? `Избрани: ${count}` : "Избери поръчки, за да смениш статуса им наведнъж"}</span>
      {count > 0 && (
        <>
          <label htmlFor="bulk-status" className="sr-only">
            Нов статус
          </label>
          <select id="bulk-status" name="status" required defaultValue="shipped" className="h-10 rounded-full border-0 bg-cream px-4 text-sm font-medium text-ink">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                Отбележи като „{ORDER_STATUS_LABELS[s]}“
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink transition hover:bg-lime-deep">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
            Приложи
          </button>
        </>
      )}
    </form>
  );
}

export function SelectAllOrders() {
  return (
    <input
      type="checkbox"
      aria-label="Избери всички поръчки на страницата"
      className="h-5 w-5 accent-[#1f5c3f]"
      onChange={(e) => {
        for (const b of boxes()) b.checked = e.target.checked;
        document.dispatchEvent(new Event("change"));
      }}
    />
  );
}
