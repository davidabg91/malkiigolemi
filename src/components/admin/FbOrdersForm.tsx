"use client";

import { Loader2, PackageCheck } from "lucide-react";
import { useActionState, useState } from "react";
import { saveFbOrders } from "@/actions/facebook";
import { btn } from "@/components/ui";

/**
 * Админ → От Facebook: whether a clear claim goes into its person's order by itself, and the wording of the
 * message "Готова за взимане" sends to the person's chat.
 */
export function FbOrdersForm({ auto, message, since }: { auto: boolean; message: string; since: string | null }) {
  const [state, action, pending] = useActionState(saveFbOrders, undefined);
  const [on, setOn] = useState(auto);

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

      <div className="mt-5">
        <label htmlFor="fb-since" className="mb-1.5 block text-sm font-medium">
          Събирай от постове, публикувани от
        </label>
        <input id="fb-since" type="date" name="since" defaultValue={since ?? ""} className="field w-auto" aria-invalid={Boolean(state?.fieldErrors?.since)} />
        {state?.fieldErrors?.since && <p className="mt-1.5 text-sm font-medium text-tomato">{state.fieldErrors.since}</p>}
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          По-старите постове скриптът подминава, когато обхожда групата: поръчките от тях вече са записани на ръка. Остави празно, за да събира от всички. Пост, който отвориш сам и натиснеш „Вземи поръчките от този пост“, се взима
          винаги.
        </p>
      </div>

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
