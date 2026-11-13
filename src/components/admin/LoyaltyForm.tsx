"use client";

import { Check, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { updateLoyaltySettings } from "@/actions/loyalty";
import { btn } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import type { LoyaltySettings } from "@/lib/loyalty-math";

export function LoyaltyForm({ initial }: { initial: LoyaltySettings }) {
  const [state, action, pending] = useActionState(updateLoyaltySettings, undefined);
  const [perEuro, setPerEuro] = useState(initial.pointsPerEuro);
  const [value100, setValue100] = useState((initial.centsPer100 / 100).toFixed(2).replace(".", ","));
  const err = state?.fieldErrors ?? {};
  const cents = Math.round(Number(value100.replace(",", ".")) * 100) || 0;
  // What a customer gets back for every 100 € of goods.
  const backPer100 = Math.floor((100 * perEuro * cents) / 100);

  const field = (name: string, label: string, hint: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label htmlFor={`loy-${name}`} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input id={`loy-${name}`} name={name} className="field tabular-nums" {...props} />
      {err[name] ? <p className="mt-1.5 text-sm font-medium text-tomato">{err[name]}</p> : <p className="mt-1.5 text-sm text-ink-soft">{hint}</p>}
    </div>
  );

  return (
    <form action={action} className="space-y-5">
      <label className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-sand/60 px-4 py-3 font-medium">
        <input type="checkbox" name="enabled" defaultChecked={initial.enabled} className="h-5 w-5 accent-[#33484b]" />
        Програмата е включена
        <span className="text-sm font-normal text-ink-soft">Изключена: не се трупат и не се използват точки; събраните остават.</span>
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        {field("pointsPerEuro", "Точки за всяко 1 €", "От стойността на продуктите, без доставката.", {
          type: "number",
          min: 1,
          max: 100,
          value: perEuro,
          onChange: (e) => setPerEuro(Number(e.target.value)),
        })}
        {field("value100", "Стойност на 100 точки (€)", "Колко отстъпка дават 100 точки.", {
          inputMode: "decimal",
          value: value100,
          onChange: (e) => setValue100(e.target.value),
        })}
        {field("minRedeem", "Най-малко точки за използване", "Под това число точките чакат да се натрупат.", { type: "number", min: 1, defaultValue: initial.minRedeem })}
        {field("maxPercent", "Точките плащат до (%)", "Каква част от продуктите в една поръчка може да се плати с точки.", {
          type: "number",
          min: 1,
          max: 100,
          defaultValue: initial.maxPercent,
        })}
      </div>
      <p className="rounded-2xl bg-lime/25 px-4 py-3 text-sm">
        При тези настройки клиентът получава обратно <strong>{formatPrice(backPer100)}</strong> за всеки 100 € покупки ({(backPer100 / 100).toFixed(1).replace(".", ",")}%).
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          Запази
        </button>
        {state?.ok && (
          <p role="status" className="inline-flex items-center gap-2 text-sm font-semibold text-forest">
            <Check className="h-4 w-4" aria-hidden />
            Запазено
          </p>
        )}
        {state?.error && (
          <p role="alert" className="text-sm font-medium text-tomato">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
