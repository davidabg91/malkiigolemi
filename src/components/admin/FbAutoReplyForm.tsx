"use client";

import { Loader2, MessageCircleReply } from "lucide-react";
import { useActionState, useState } from "react";
import { saveFbAutoReply } from "@/actions/facebook";
import { btn } from "@/components/ui";

/**
 * The switch and the wording of the answer the extension leaves under a comment it took as an order.
 * `pauseSeconds`, `perRun` and `maxAgeHours` are shown so the admin knows how carefully it answers (lib/fb-reply.ts).
 */
export function FbAutoReplyForm({ enabled, text, pauseSeconds, perRun, maxAgeHours }: { enabled: boolean; text: string; pauseSeconds: number; perRun: number; maxAgeHours: number }) {
  const [state, action, pending] = useActionState(saveFbAutoReply, undefined);
  const [on, setOn] = useState(enabled);

  return (
    <form action={action} className="rounded-card bg-paper p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <MessageCircleReply className="h-5 w-5 text-forest" aria-hidden />
            Автоматичен отговор под коментара
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            След като разширението вземе заявка, то отговаря под коментара във Facebook. Отговорът излиза от профила, с който си влязъл във Facebook в този Chrome.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" name="enabled" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-5 w-5 accent-[#33484b]" />
          {on ? "Включен" : "Изключен"}
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="fb-reply-text" className="mb-1.5 block text-sm font-medium">
            Текст на отговора
          </label>
          <input id="fb-reply-text" name="text" defaultValue={text} maxLength={200} className="field" />
          {state?.fieldErrors?.text && <p className="mt-1.5 text-sm font-medium text-tomato">{state.fieldErrors.text}</p>}
        </div>
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          Запази
        </button>
        {state?.ok && !pending && (
          <p role="status" className="pb-3 text-sm font-semibold text-forest">
            Запазено
          </p>
        )}
      </div>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-soft">
        <li>Отговаря само на заявки с ясна бройка, за които има наличност, по реда на коментарите.</li>
        <li>Не отговаря на коментар, под който вече има отговор, нито на коментар по-стар от {maxAgeHours} часа.</li>
        <li>При продукт с цветове не отговаря: цветът се уточнява от човек.</li>
        <li>
          Изчаква {pauseSeconds} секунди между два отговора и дава най-много {perRun} на едно пускане. Останалите получават отговор при следващото.
        </li>
        <li>Много еднакви отговори за кратко време може да накарат Facebook временно да спре коментарите от профила. Ако това стане, изключи отговора.</li>
      </ul>
    </form>
  );
}
