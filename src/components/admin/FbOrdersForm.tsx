"use client";

import { Loader2, PackageCheck, Plus, X } from "lucide-react";
import { useActionState, useState } from "react";
import { saveFbOrders } from "@/actions/facebook";
import { btn } from "@/components/ui";
import type { FbPeriod } from "@/lib/fb-since";

type Row = { id: number; from: string; to: string };
const nextId = (rows: Row[]) => rows.reduce((max, r) => Math.max(max, r.id), -1) + 1;

/**
 * Админ → От Facebook: whether a clear claim goes into its person's order by itself, and the wording of the
 * message "Готова за взимане" sends to the person's chat.
 */
export function FbOrdersForm({ auto, message, periods }: { auto: boolean; message: string; periods: FbPeriod[] }) {
  const [state, action, pending] = useActionState(saveFbOrders, undefined);
  const [on, setOn] = useState(auto);
  // The days collecting covers, one row per period; an empty "to" is "from that day on".
  const [rows, setRows] = useState<Row[]>(() => periods.map((p, id) => ({ id, from: p.from, to: p.to ?? "" })));
  const change = (id: number, value: Partial<Row>) => setRows((all) => all.map((r) => (r.id === id ? { ...r, ...value } : r)));

  return (
    <form action={action} className="rounded-card bg-paper p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <PackageCheck className="h-5 w-5 text-forest" aria-hidden />
            Една поръчка на човек
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Всичко, което един човек поиска под различните постове, се събира в една негова поръчка за взимане от магазина. Тя се вижда в Поръчки, където може да се раздели и да се отбележи като готова за взимане.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" name="auto" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-5 w-5 accent-[#33484b]" />
          {on ? "Добавя сам" : "Само на ръка"}
        </label>
      </div>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-soft">
        <li>Сам се добавя само коментар с ясна бройка, за продукт с избран продукт от сайта, без цветове и с достатъчна наличност. Наличността се намалява веднага.</li>
        <li>Останалите заявки чакат в поста, както досега.</li>
        <li>Поръчка, отбелязана „Готова за взимане“, не приема повече продукти: следващият коментар на човека отваря нова.</li>
      </ul>

      <fieldset className="mt-5">
        <legend className="mb-1.5 text-sm font-medium">Събирай от постове, публикувани</legend>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <label htmlFor={`fb-from-${r.id}`} className="text-sm text-ink-soft">
                от
              </label>
              <input
                id={`fb-from-${r.id}`}
                type="date"
                name="from"
                value={r.from}
                max={r.to || undefined}
                onChange={(e) => change(r.id, { from: e.target.value })}
                className="field w-auto"
                aria-invalid={Boolean(state?.fieldErrors?.periods)}
              />
              <label htmlFor={`fb-to-${r.id}`} className="text-sm text-ink-soft">
                до
              </label>
              <input id={`fb-to-${r.id}`} type="date" name="to" value={r.to} min={r.from || undefined} onChange={(e) => change(r.id, { to: e.target.value })} className="field w-auto" />
              {!r.to && r.from && <span className="text-sm text-ink-soft">нататък</span>}
              <button
                type="button"
                onClick={() => setRows((all) => all.filter((x) => x.id !== r.id))}
                className="grid h-10 w-10 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-tomato"
                aria-label={`Махни период ${i + 1}`}
                title="Махни периода"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="text-sm font-medium">Няма избрани дати: събира от всички постове.</p>}
        <button type="button" onClick={() => setRows((all) => [...all, { id: nextId(all), from: "", to: "" }])} className={`${btn.sm} mt-2`}>
          <Plus className="h-4 w-4" aria-hidden />
          Добави период
        </button>
        {state?.fieldErrors?.periods && <p className="mt-1.5 text-sm font-medium text-tomato">{state.fieldErrors.periods}</p>}
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Постовете, публикувани извън тези дати, скриптът подминава, когато обхожда групата. Двете дати се включват: за един ден сложи една и съща дата в „от“ и „до“. Празно „до“ значи от началната дата нататък. Без нито един
          период събира от всички постове. Пост, който отвориш сам и натиснеш „Вземи поръчките от този пост“, се взима винаги.
        </p>
      </fieldset>

      <div className="mt-5">
        <label htmlFor="fb-pickup-message" className="mb-1.5 block text-sm font-medium">
          Съобщение при „Готова за взимане“
        </label>
        <textarea id="fb-pickup-message" name="message" defaultValue={message} rows={6} maxLength={1000} className="field h-auto py-3 leading-relaxed" />
        {state?.fieldErrors?.message && <p className="mt-1.5 text-sm font-medium text-tomato">{state.fieldErrors.message}</p>}
        <p className="mt-1.5 text-sm text-ink-soft">
          Вместо {"{име}"}, {"{продукти}"}, {"{сума}"}, {"{адрес}"} и {"{линк}"} се слагат името на човека, продуктите от поръчката, сумата, адресът на магазина и линкът към поръчката му. На този линк човекът вижда какво е поръчал
          и избира дали да я вземе от магазина, или да остави данни за доставка. Ако в текста няма {"{линк}"}, линкът се добавя накрая. Разширението го пише в чата на човека във Facebook от профила, с който си влязъл.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          Запази
        </button>
        {state?.ok && !pending && (
          <p role="status" className="text-sm font-semibold text-forest">
            Запазено
          </p>
        )}
      </div>
    </form>
  );
}
