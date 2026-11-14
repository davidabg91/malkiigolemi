"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteProducts } from "@/actions/admin";

export const BULK_PRODUCTS_FORM = "bulk-products";

const boxes = () => [...document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_PRODUCTS_FORM}"][name="ids"]`)];

/**
 * The bar above the products table. Row checkboxes live in the server-rendered table and join this form
 * through their `form` attribute, so the table itself stays a plain server component.
 */
export function BulkProductsBar() {
  const [state, action, pending] = useActionState(deleteProducts, undefined);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.deleted === 1 ? "1 продукт е изтрит" : `${state.deleted} продукта са изтрити`);
      for (const b of boxes()) b.checked = false;
      // The listener above recounts, so the bar hides again.
      document.dispatchEvent(new Event("change"));
    } else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      id={BULK_PRODUCTS_FORM}
      action={action}
      onSubmit={(e) => {
        const what = count === 1 ? "1 продукт" : `${count} продукта`;
        if (!confirm(`Изтриване на ${what}? Действието е необратимо.`)) e.preventDefault();
      }}
      className={`sticky top-0 z-20 mb-3 flex min-h-16 flex-wrap items-center gap-3 rounded-2xl px-4 py-3 shadow-soft transition ${count ? "bg-ink text-cream" : "bg-paper"}`}
    >
      <span className="text-sm font-semibold">{count ? `Избрани: ${count}` : "Отбележи продукти, за да ги изтриеш наведнъж"}</span>
      {count > 0 && (
        <button type="submit" disabled={pending} className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-tomato px-5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
          Изтрий избраните
        </button>
      )}
    </form>
  );
}

export function SelectAllProducts() {
  return (
    <input
      type="checkbox"
      aria-label="Избери всички продукти на страницата"
      className="h-5 w-5 accent-[#33484b]"
      onChange={(e) => {
        for (const b of boxes()) b.checked = e.target.checked;
        document.dispatchEvent(new Event("change"));
      }}
    />
  );
}
