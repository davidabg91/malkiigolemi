"use client";

import { BellRing, Check, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { subscribeStockAlert } from "@/actions/stock-alerts";

/** Shown instead of "add to cart" when a product is sold out. */
export function NotifyMe({ productId }: { productId: number }) {
  const [state, action, pending] = useActionState(subscribeStockAlert.bind(null, productId), undefined);

  if (state?.ok) {
    return (
      <p role="status" className="flex items-start gap-3 rounded-2xl bg-lime/30 px-5 py-4">
        <Check className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
        <span>
          Готово! Ще пишем на <strong>{state.email}</strong>, щом продуктът е наличен отново.
        </span>
      </p>
    );
  }

  return (
    <form action={action} className="rounded-2xl bg-sand px-5 py-4">
      <p className="font-medium">В момента продуктът е изчерпан.</p>
      <p className="mt-1 text-sm text-ink-soft">Остави имейл и ще ти пишем веднага щом го заредим.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label htmlFor={`notify-${productId}`} className="sr-only">
          Имейл
        </label>
        <input id={`notify-${productId}`} name="email" type="email" autoComplete="email" placeholder="твоят@имейл.bg" className="field min-w-0 flex-1 bg-paper" />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-forest px-5 font-semibold text-white transition hover:bg-forest-deep disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <BellRing className="h-5 w-5" aria-hidden />}
          Уведоми ме
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-tomato">
          {state.error}
        </p>
      )}
    </form>
  );
}
