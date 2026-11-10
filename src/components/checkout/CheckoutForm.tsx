"use client";

import { Banknote, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { placeOrder } from "@/actions/checkout";
import { ProductVisual } from "@/components/product/PackShot";
import { StoreLocation } from "@/components/StoreLocation";
import { DeliveryOptions } from "./DeliveryOptions";
import { btn } from "@/components/ui";
import { formatPrice, unitPriceFor } from "@/lib/format";
import { DELIVERY_METHODS, shippingFor, type DeliveryId } from "@/lib/site";
import { cartTotals, useCart, useHydrated } from "@/lib/store";

export type CheckoutDefaults = {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  delivery: DeliveryId | null;
  signedIn: boolean;
};

const isDeliveryId = (v: string | null): v is DeliveryId => DELIVERY_METHODS.some((d) => d.id === v);

function Field({
  label,
  name,
  error,
  ...props
}: { label: string; name: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label} {props.required && <span className="text-tomato" aria-hidden>*</span>}
      </label>
      <input id={name} name={name} className="field" aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-error` : undefined} {...props} />
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-1.5 text-sm font-medium text-tomato">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutForm({ defaults }: { defaults: CheckoutDefaults }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [delivery, setDelivery] = useState<DeliveryId>(isDeliveryId(defaults.delivery) ? defaults.delivery : "office");
  // Offer to remember the details by default only when nothing is saved yet.
  const [saveAsDefault, setSaveAsDefault] = useState(defaults.signedIn && !defaults.delivery);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();
  const [placed, setPlaced] = useState(false);

  const { subtotal } = cartTotals(items);
  const shipping = shippingFor(delivery, subtotal);
  const method = DELIVERY_METHODS.find((d) => d.id === delivery)!;
  const pickup = delivery === "store";

  if (!hydrated) return <div className="h-96 animate-pulse rounded-tile bg-sand" aria-hidden />;
  if (items.length === 0 && !placed) {
    return (
      <div className="rounded-tile bg-paper px-6 py-16 text-center shadow-soft">
        <p className="font-display text-xl font-semibold">Няма продукти за поръчка</p>
        <p className="mt-2 text-ink-soft">Количката ти е празна.</p>
        <Link href="/produkti" className={`${btn.primary} mt-6`}>
          Към продуктите
        </Link>
      </div>
    );
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (k: string) => String(fd.get(k) ?? "");
    setErrors({});
    setFormError("");
    start(async () => {
      const result = await placeOrder({
        name: text("name"),
        phone: text("phone"),
        email: text("email"),
        delivery,
        city: text("city"),
        address: text("address"),
        note: text("note"),
        saveAsDefault: defaults.signedIn && saveAsDefault,
        items: items.map((i) => ({ id: i.id, qty: i.qty })),
      });
      if (result.ok) {
        setPlaced(true);
        clear();
        router.push(`/porachka/${result.number}`);
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setFormError(result.error);
      const first = Object.keys(result.fieldErrors ?? {})[0];
      if (first) document.getElementById(first)?.focus();
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid items-start gap-8 lg:grid-cols-[1fr_25rem]">
      <div className="space-y-6">
        <fieldset className="rounded-tile bg-paper p-6 shadow-soft sm:p-8">
          <legend className="float-left mb-5 font-display text-lg font-semibold">1. Данни за контакт</legend>
          <div className="clear-both grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Име и фамилия" name="name" required autoComplete="name" defaultValue={defaults.name} error={errors.name} />
            </div>
            <Field label="Телефон" name="phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="+359 88 637 8751" defaultValue={defaults.phone} error={errors.phone} />
            <Field label="Имейл" name="email" type="email" required autoComplete="email" defaultValue={defaults.email} error={errors.email} />
          </div>
        </fieldset>

        <fieldset className="rounded-tile bg-paper p-6 shadow-soft sm:p-8">
          <legend className="float-left mb-5 font-display text-lg font-semibold">2. Доставка</legend>
          <div className="clear-both">
            <DeliveryOptions value={delivery} onChange={setDelivery} priceFor={(id) => shippingFor(id, subtotal)} />
          </div>
          {pickup ? (
            <div className="mt-5">
              <StoreLocation defaultOpen />
              <p className="mt-3 text-sm text-ink-soft">Ще ти се обадим, когато поръчката е готова за вземане.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1.6fr]">
              <Field label="Населено място" name="city" required autoComplete="address-level2" defaultValue={defaults.city} error={errors.city} />
              <Field label={method.addressLabel} name="address" required autoComplete="street-address" defaultValue={defaults.address} error={errors.address} />
            </div>
          )}
          {defaults.signedIn ? (
            <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="h-5 w-5 accent-[#1f5c3f]"
              />
              Запази {pickup ? "вземането от магазина" : "този адрес"} като предпочитан за следващи поръчки
            </label>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">
              <Link href="/vhod?next=/porachka" className="font-semibold text-forest hover:underline">
                Влез в профила си
              </Link>
              , за да запазим адреса ти и да поръчваш по-бързо следващия път.
            </p>
          )}
          <div className="mt-4">
            <label htmlFor="note" className="mb-1.5 block text-sm font-medium">
              Бележка към поръчката <span className="font-normal text-ink-soft">(по желание)</span>
            </label>
            <textarea id="note" name="note" rows={3} maxLength={500} className="field h-auto py-3" />
          </div>
        </fieldset>

        <fieldset className="rounded-tile bg-paper p-6 shadow-soft sm:p-8">
          <legend className="float-left mb-5 font-display text-lg font-semibold">3. Плащане</legend>
          <div className="clear-both flex items-center gap-4 rounded-2xl border-2 border-forest bg-lime/25 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest text-white">
              <Banknote className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">{pickup ? "Плащане в магазина" : "Наложен платеж"}</p>
              <p className="text-sm text-ink-soft">
                {pickup
                  ? "Плащаш в брой или с карта, когато вземеш поръчката."
                  : "Плащаш на куриера в брой или с карта, след като прегледаш пратката."}
              </p>
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="rounded-tile bg-paper p-6 shadow-soft lg:sticky lg:top-36" aria-label="Твоята поръчка">
        <h2 className="font-display text-lg font-semibold">Твоята поръчка</h2>
        <ul className="mt-4 max-h-72 divide-y divide-line overflow-y-auto">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-sand">
                <ProductVisual product={i} className="h-11 w-11" />
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[0.68rem] font-bold text-cream">{i.qty}</span>
              </span>
              <span className="min-w-0 flex-1 text-sm leading-snug">
                <span className="line-clamp-2 font-medium">{i.name}</span>
                <span className="text-ink-soft">{i.unit}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{formatPrice(unitPriceFor(i, i.qty) * i.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[0.95rem]">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Продукти</dt>
            <dd className="font-medium tabular-nums">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Доставка · {method.label.toLowerCase()}</dt>
            <dd className="font-medium tabular-nums">{shipping === 0 ? "Безплатно" : formatPrice(shipping)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-semibold">Общо</span>
          <span className="text-3xl font-bold tabular-nums">{formatPrice(subtotal + shipping)}</span>
        </div>
        {formError && (
          <p role="alert" className="mt-4 rounded-2xl bg-tomato/10 px-4 py-3 text-sm font-medium text-tomato">
            {formError}
          </p>
        )}
        <button type="submit" disabled={pending || placed} className={`${btn.lime} mt-5 w-full`}>
          {pending || placed ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Lock className="h-[18px] w-[18px]" aria-hidden />}
          {pending || placed ? "Изпращаме поръчката…" : "Потвърди поръчката"}
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-ink-soft">
          С натискането на бутона приемаш{" "}
          <Link href="/usloviya" className="underline underline-offset-2 hover:text-ink">
            общите условия
          </Link>{" "}
          и{" "}
          <Link href="/poveritelnost" className="underline underline-offset-2 hover:text-ink">
            политиката за поверителност
          </Link>
          .
        </p>
      </aside>
    </form>
  );
}
