"use client";

import { Check, Loader2, Mail, XCircle } from "lucide-react";
import { useActionState } from "react";
import { sendTestMailAction, type MailTestState } from "@/actions/mail";
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
