"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { payInStore } from "@/actions/store-pay";
import { btn } from "@/components/ui";
import { formatPrice, parseEuro } from "@/lib/format";

/** The customer's side of a payment at the till: the sum, an optional note, then on to Stripe. */
export function StorePayForm() {
  const uid = useId();
  const [state, action, pending] = useActionState(payInStore, null);
  const [amount, setAmount] = useState("");
  const cents = parseEuro(amount);

  return (
    <form action={action} className="rounded-card bg-paper p-6 shadow-soft sm:p-8">
      <label htmlFor={`${uid}-amount`} className="block text-sm font-medium text-ink">
        Сума за плащане
      </label>
      <div className="relative mt-2">
        <input
          id={`${uid}-amount`}
          name="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          required
          maxLength={10}
          placeholder="0,00"
          aria-invalid={Boolean(state?.error)}
          aria-describedby={state?.error ? `${uid}-error` : `${uid}-hint`}
          className="field h-20 px-14 text-center font-display text-4xl font-semibold tabular-nums"
        />
        <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-display text-3xl font-semibold text-ink-soft" aria-hidden>
          €
        </span>
      </div>
      {state?.error ? (
        <p id={`${uid}-error`} role="alert" className="mt-2 text-sm font-medium text-tomato">
          {state.error}
        </p>
      ) : (
        <p id={`${uid}-hint`} className="mt-2 text-sm text-ink-soft">
          Въведи сумата, която ти казаха на касата.
        </p>
      )}

      <label htmlFor={`${uid}-note`} className="mt-5 block text-sm font-medium text-ink">
        Бележка <span className="font-normal text-ink-soft">(по желание)</span>
      </label>
      <input id={`${uid}-note`} name="note" maxLength={120} placeholder="напр. твоето име" autoComplete="off" className="field mt-2" />

      <button type="submit" disabled={pending} className={`${btn.primary} mt-6 w-full`}>
        {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <CreditCard className="h-5 w-5" aria-hidden />}
        {cents ? `Плати ${formatPrice(cents)}` : "Продължи към плащане"}
      </button>
      <p className="mt-3 text-center text-sm text-ink-soft">Apple Pay, Google Pay или карта. Плащането минава през защитената страница на Stripe.</p>
    </form>
  );
}
