"use client";

import { Check, History, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { orderFromClaim } from "@/actions/facebook";
import { CourierOfficePicker } from "@/components/checkout/CourierOfficePicker";
import { btn } from "@/components/ui";
import type { CourierId, CourierOffice } from "@/lib/couriers";
import { DELIVERY_METHODS, STORE, type DeliveryId } from "@/lib/site";

export type ClaimPrefill = {
  name: string;
  phone: string;
  email: string;
  delivery: DeliveryId;
  courier: CourierId | "";
  /** The saved office or locker, already looked up on the server. */
  office: CourierOffice | null;
  city: string;
  address: string;
  /** Where the details came from, shown to the admin. */
  from: "facebook" | "user" | "order" | null;
};

const FROM_LABELS = {
  facebook: "Попълнено както при последната поръчка от Facebook",
  user: "Попълнено от профила в сайта",
  order: "Попълнено от последната поръчка в сайта",
};

/** Contact and delivery details for one Facebook claim, then "Създай поръчка". */
export function ClaimOrderForm({ claimId, qty, prefill }: { claimId: number; qty: number; prefill: ClaimPrefill }) {
  const [state, action, pending] = useActionState(orderFromClaim.bind(null, claimId), undefined);
  const [delivery, setDelivery] = useState<DeliveryId>(prefill.delivery);
  const [courier, setCourier] = useState<CourierId>(prefill.courier || "speedy");
  const [city, setCity] = useState(prefill.office?.city ?? prefill.city);
  const [address, setAddress] = useState(prefill.delivery === "address" ? prefill.address : "");
  // The remembered office only fits the delivery type it was saved for.
  const [office, setOffice] = useState<CourierOffice | null>(prefill.office);
  const err = state?.fieldErrors ?? {};
  const pickup = delivery === "store";

  if (state?.ok) {
    return (
      <p role="status" className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-forest">
        <Check className="h-4 w-4" aria-hidden />
        Поръчка {state.orderNumber} е създадена. Данните са запомнени за следващия път.
        <Link href="/admin/porachki" className="underline">
          Към поръчките
        </Link>
      </p>
    );
  }

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
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
      {prefill.from && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-lime/40 px-3 py-1 text-xs font-semibold">
          <History className="h-3.5 w-3.5" aria-hidden />
          {FROM_LABELS[prefill.from]}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_5rem]">
        {field("name", "Име", { defaultValue: prefill.name, required: true, autoComplete: "off" })}
        {field("phone", "Телефон *", { defaultValue: prefill.phone, type: "tel", inputMode: "tel", required: true, placeholder: "08…" })}
        {field("email", "Имейл", { defaultValue: prefill.email, type: "email", placeholder: "по желание" })}
        {field("qty", "Бр", { defaultValue: qty, type: "number", min: 1, max: 99 })}
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-ink-soft">Доставка</legend>
        <div className="flex flex-wrap gap-2">
          {DELIVERY_METHODS.map((m) => (
            <label
              key={m.id}
              className={`cursor-pointer rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition ${delivery === m.id ? "border-forest bg-lime/25" : "border-line hover:border-ink/30"}`}
            >
              <input
                type="radio"
                name="delivery"
                value={m.id}
                checked={delivery === m.id}
                onChange={() => {
                  setDelivery(m.id);
                  if (m.id !== prefill.delivery) setOffice(null);
                  else setOffice(prefill.office);
                }}
                className="sr-only"
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {pickup ? (
        <p className="text-sm text-ink-soft">Взима от магазина: {STORE.address}</p>
      ) : (
        <CourierOfficePicker
          idPrefix={`claim-${claimId}-`}
          delivery={delivery as "office" | "box" | "address"}
          courier={courier}
          onCourierChange={setCourier}
          city={city}
          onCityChange={setCity}
          selectedOffice={office}
          onOfficeChange={setOffice}
          address={address}
          onAddressChange={setAddress}
          errors={err}
        />
      )}

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
