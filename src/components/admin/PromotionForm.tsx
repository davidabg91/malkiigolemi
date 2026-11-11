"use client";

import { Loader2, Search } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { savePromotion } from "@/actions/promotions";
import { btn } from "@/components/ui";
import { formatPrice } from "@/lib/format";

type Option = { id: number; label: string; price: number };
type CategoryOption = { id: number; label: string };

export type PromotionInitial = {
  name: string;
  percent: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  categoryId: number | null;
  productIds: number[];
};

export function PromotionForm({
  id,
  initial,
  products,
  categories,
}: {
  id: number | null;
  initial: PromotionInitial;
  products: Option[];
  categories: CategoryOption[];
}) {
  const [state, action, pending] = useActionState(savePromotion.bind(null, id), undefined);
  const [target, setTarget] = useState<"products" | "category">(initial.categoryId ? "category" : "products");
  const [picked, setPicked] = useState<Set<number>>(new Set(initial.productIds));
  const [query, setQuery] = useState("");
  const [percent, setPercent] = useState(initial.percent);
  const err = state?.fieldErrors ?? {};

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => p.label.toLowerCase().includes(q)) : products;
  }, [products, query]);
  const toggle = (pid: number) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });

  const label = "mb-1.5 block text-sm font-medium";
  const error = (k: string) => err[k] && <p className="mt-1.5 text-sm font-medium text-tomato">{err[k]}</p>;

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_8rem]">
        <div>
          <label htmlFor="promo-name" className={label}>
            Име <span className="font-normal text-ink-soft">(вижда се само в админа)</span>
          </label>
          <input id="promo-name" name="name" defaultValue={initial.name} placeholder="Напр. Черен петък" className="field" />
          {error("name")}
        </div>
        <div>
          <label htmlFor="promo-percent" className={label}>
            Отстъпка %
          </label>
          <input
            id="promo-percent"
            name="percent"
            type="number"
            min={1}
            max={90}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="field tabular-nums"
          />
          {error("percent")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="promo-start" className={label}>
            Начало
          </label>
          <input id="promo-start" name="startsAt" type="datetime-local" defaultValue={initial.startsAt} className="field" />
          {error("startsAt")}
        </div>
        <div>
          <label htmlFor="promo-end" className={label}>
            Край
          </label>
          <input id="promo-end" name="endsAt" type="datetime-local" defaultValue={initial.endsAt} className="field" />
          {error("endsAt")}
        </div>
      </div>
      <p className="-mt-2 text-sm text-ink-soft">Българско време. Промоцията се включва и изключва сама, до 5 минути след посочения час.</p>

      <fieldset>
        <legend className={label}>За кои продукти</legend>
        <div className="flex flex-wrap gap-2">
          {(["products", "category"] as const).map((t) => (
            <label key={t} className={`cursor-pointer rounded-full border-2 px-4 py-2 text-sm font-medium transition ${target === t ? "border-forest bg-lime/25" : "border-line"}`}>
              <input type="radio" name="target" value={t} checked={target === t} onChange={() => setTarget(t)} className="sr-only" />
              {t === "products" ? "Избрани продукти" : "Цяла категория"}
            </label>
          ))}
        </div>
      </fieldset>

      {target === "category" ? (
        <div>
          <label htmlFor="promo-category" className={label}>
            Категория
          </label>
          <select id="promo-category" name="categoryId" defaultValue={initial.categoryId ?? ""} className="field">
            <option value="">Избери…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {error("categoryId")}
        </div>
      ) : (
        <div className="rounded-2xl border border-line">
          <input type="hidden" name="categoryId" value="" />
          <div className="flex items-center gap-3 border-b border-line bg-sand/50 px-3 py-2.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Търси продукт" aria-label="Търси продукт" className="field h-10 pl-9 text-sm" />
            </div>
            <span className="shrink-0 text-sm font-semibold">{picked.size} избрани</span>
          </div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {shown.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-sand/50">
                  <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="h-5 w-5 accent-[#1f5c3f]" />
                  <span className="min-w-0 flex-1 truncate">{p.label}</span>
                  <span className="shrink-0 tabular-nums text-ink-soft">
                    {formatPrice(p.price)}
                    {percent > 0 && percent <= 90 && <span className="ml-2 font-semibold text-tomato">{formatPrice(Math.round((p.price * (100 - percent)) / 100))}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {[...picked].map((pid) => (
            <input key={pid} type="hidden" name="productIds" value={pid} />
          ))}
          {err.productIds && <p className="px-4 pb-3 text-sm font-medium text-tomato">{err.productIds}</p>}
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="enabled" defaultChecked={initial.enabled} className="h-5 w-5 accent-[#1f5c3f]" />
        Включена (изключи я, за да я спреш, без да я триеш)
      </label>

      {state?.error && (
        <p role="alert" className="rounded-2xl bg-tomato/10 px-4 py-3 text-sm font-medium text-tomato">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={btn.primary}>
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        Запази промоцията
      </button>
    </form>
  );
}
