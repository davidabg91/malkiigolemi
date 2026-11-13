"use client";

import { Check, Loader2, Mail, Send, XCircle } from "lucide-react";
import { useActionState, useId } from "react";
import { sendSampleMailsAction, sendTestMailAction, type MailTestState, type SamplesState } from "@/actions/mail";
import { btn } from "@/components/ui";

export function MailTest({ configured, from, to }: { configured: boolean; from: string; to: string }) {
  const [state, action, pending] = useActionState<MailTestState, FormData>(() => sendTestMailAction(), undefined);
  return (
    <form action={action}>
      <p className="mt-1 text-sm text-ink-soft">
        {configured
          ? `Клиентите получават имейл при поръчка, изпращане и отказ от договора. Изпращач: ${from}; отговорите отиват на ${to}.`
          : "Не са настроени: клиентите не получават потвърждения по имейл."}
      </p>
      {configured && (
        <button type="submit" disabled={pending} className={`${btn.sm} mt-3`}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
          Изпрати пробен имейл
        </button>
      )}
      {state?.ok && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-sm text-forest">
          <Check className="h-4 w-4" aria-hidden />
          Изпратен на {to}.
        </p>
      )}
      {state?.error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-tomato">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}
    </form>
  );
}

/** Sends one of every e-mail the shop sends, with made-up data, so they can be seen as customers see them. */
export function MailSamples({ defaultTo }: { defaultTo: string }) {
  const uid = useId();
  const [state, action, pending] = useActionState<SamplesState, FormData>(sendSampleMailsAction, undefined);
  return (
    <form action={action} className="mt-4 border-t border-line pt-4">
      <label htmlFor={`${uid}-to`} className="text-sm font-semibold">
        Примерни имейли
      </label>
      <p className="mt-0.5 text-sm text-ink-soft">По един от всеки вид: поръчка, изпращане, отказ, наличност и известията до магазина.</p>
      <div className="mt-2 flex gap-2">
        <input id={`${uid}-to`} name="to" type="email" required defaultValue={defaultTo} className="field h-10 min-w-0 flex-1 text-sm" />
        <button type="submit" disabled={pending} className={`${btn.smPrimary} shrink-0`}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          Изпрати
        </button>
      </div>
      {state?.ok && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-sm text-forest">
          <Check className="h-4 w-4" aria-hidden />
          Изпратени {state.sent} имейла на {state.to}.
        </p>
      )}
      {state?.error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-tomato">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}
    </form>
  );
}
