"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { saveCategory } from "@/actions/admin";
import { btn } from "@/components/ui";
import type { Category } from "@/db/schema";
import { CATEGORY_ICON_LABELS, CATEGORY_ICON_NAMES, TONE_LABELS } from "@/lib/icons";

export function CategoryForm({ category, roots }: { category?: Category; roots: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(saveCategory.bind(null, category?.id ?? null), undefined);
  const uid = category?.id ?? "new";
  const label = "mb-1.5 block text-sm font-medium";

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <div className="lg:col-span-2">
        <label htmlFor={`name-${uid}`} className={label}>
          Име
        </label>
        <input id={`name-${uid}`} name="name" required maxLength={80} defaultValue={category?.name} className="field" />
      </div>
      <div className="lg:col-span-2">
        <label htmlFor={`parent-${uid}`} className={label}>
          Родител
        </label>
        <select id={`parent-${uid}`} name="parentId" defaultValue={category?.parentId ?? ""} className="field">
          <option value="">— основна категория —</option>
          {roots
            .filter((r) => r.id !== category?.id)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label htmlFor={`tone-${uid}`} className={label}>
          Цвят на плочката
        </label>
        <select id={`tone-${uid}`} name="tone" defaultValue={category?.tone ?? "butter"} className="field">
          {Object.entries(TONE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`icon-${uid}`} className={label}>
          Икона
        </label>
        <select id={`icon-${uid}`} name="icon" defaultValue={category?.icon ?? "ShoppingBasket"} className="field">
          {CATEGORY_ICON_NAMES.map((k) => (
            <option key={k} value={k}>
              {CATEGORY_ICON_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <label htmlFor={`description-${uid}`} className={label}>
          Кратко описание <span className="font-normal text-ink-soft">(по желание)</span>
        </label>
        <input id={`description-${uid}`} name="description" maxLength={300} defaultValue={category?.description ?? ""} className="field" />
      </div>
      <div>
        <label htmlFor={`sort-${uid}`} className={label}>
          Подредба
        </label>
        <input id={`sort-${uid}`} name="sort" inputMode="numeric" defaultValue={category?.sort ?? 0} className="field" />
      </div>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className={`${btn.primary} w-full`}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          {category ? "Запази" : "Добави"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-2xl bg-tomato/10 px-4 py-3 text-sm font-medium text-tomato sm:col-span-2 lg:col-span-6">
          {state.error}
        </p>
      )}
    </form>
  );
}
