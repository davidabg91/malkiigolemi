"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { orderFromClaim } from "@/actions/facebook";
import { btn } from "@/components/ui";
import { COURIERS, type CourierId } from "@/lib/couriers";
import { DELIVERY_METHODS, type DeliveryId } from "@/lib/site";

export type ClaimPrefill = {
  name: string;
  phone: string;
  email: string;
  delivery: DeliveryId;
  courier: CourierId | "";
  city: string;
  address: string;
};

const COURIER_IDS = Object.keys(COURIERS) as CourierId[];

/** Contact and delivery details for one Facebook claim, then "Създай поръчка". */
export function ClaimOrderForm({ claimId, qty, prefill }: { claimId: number; qty: number; prefill: ClaimPrefill }) {
  const [state, action, pending] = useActionState(orderFromClaim.bind(null, claimId), undefined);
  const [delivery, setDelivery] = useState<DeliveryId>(prefill.delivery);
  const err = state?.fieldErrors ?? {};
  const pickup = delivery === "store";

  if (state?.ok) {
    return (
      <p role="status" className="inline-flex items-center gap-2 text-sm font-semibold text-forest">
        <Check className="h-4 w-4" aria-hidden />
        Поръчка {state.orderNumber} е създадена.
        <Link href="/admin/porachki" className="underline">
          Към поръчките
        </Link>
      </p>
    );
  }

  const field = (name: keyof ClaimPrefill | "qty", label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label htmlFor={`${name}-${claimId}`} className="mb-1 block text-xs font-medium text-ink-soft">
        {label}
      </label>
      <input id={`${name}-${claimId}`} name={name} className="field h-10 text-sm" aria-invalid={err[name] ? true : undefined} {...props} />
      {err[name] && <p className="mt-1 text-xs font-medium text-tomato">{err[name]}</p>}
    </div>
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_5rem]">
        {field("name", "Име", { defaultValue: prefill.name, required: true, autoComplete: "off" })}
        {field("phone", "Телефон *", { defaultValue: prefill.phone, type: "tel", inputMode: "tel", required: true, placeholder: "08…" })}
        {field("email", "Имейл", { defaultValue: prefill.email, type: "email", placeholder: "по желание" })}
        {field("qty", "Бр", { defaultValue: qty, type: "number", min: 1, max: 99 })}
      </div>
      <div className={`grid gap-3 ${pickup ? "sm:grid-cols-[12rem]" : "sm:grid-cols-[12rem_10rem_1fr_1.4fr]"}`}>
        <div>
          <label htmlFor={`delivery-${claimId}`} className="mb-1 block text-xs font-medium text-ink-soft">
            Доставка
          </label>
          <select id={`delivery-${claimId}`} name="delivery" value={delivery} onChange={(e) => setDelivery(e.target.value as DeliveryId)} className="field h-10 text-sm">
            {DELIVERY_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {!pickup && (
          <>
            <div>
              <label htmlFor={`courier-${claimId}`} className="mb-1 block text-xs font-medium text-ink-soft">
                Куриер
              </label>
              <select id={`courier-${claimId}`} name="courier" defaultValue={prefill.courier} className="field h-10 text-sm">
                <option value="">Избери…</option>
                {COURIER_IDS.map((id) => (
                  <option key={id} value={id}>
                    {COURIERS[id].name}
                  </option>
                ))}
              </select>
              {err.courier && <p className="mt-1 text-xs font-medium text-tomato">{err.courier}</p>}
            </div>
            {field("city", "Населено място", { defaultValue: prefill.city })}
            {field("address", delivery === "address" ? "Адрес" : "Офис / автомат", { defaultValue: prefill.address, placeholder: delivery === "address" ? "ул., №, бл." : "име или код на офиса" })}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn.sm}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Създай поръчка
        </button>
        {state?.error && (
          <p role="alert" className="text-sm font-medium text-tomato">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
