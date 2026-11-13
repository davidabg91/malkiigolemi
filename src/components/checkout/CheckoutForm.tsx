"use client";

import { Banknote, CreditCard, Info, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useState, useTransition, type FormEvent } from "react";
import { placeOrder } from "@/actions/checkout";
import { ProductVisual } from "@/components/product/PackShot";
import { StoreLocation } from "@/components/StoreLocation";
import { CourierOfficePicker } from "./CourierOfficePicker";
import { DeliveryOptions } from "./DeliveryOptions";
import { PaymentBrands } from "./PaymentBrands";
import { btn } from "@/components/ui";
import { formatPrice, unitPriceFor } from "@/lib/format";
import { DELIVERY_METHODS, shippingFor, STORE, type DeliveryId } from "@/lib/site";
import { liveCartData } from "@/actions/cart";
import { cartTotals, useCart, useFreshCartPrices, useHydrated } from "@/lib/store";
import type { CourierId, CourierOffice } from "@/lib/couriers";
import { pointsForGoods, redeemable, type LoyaltySettings } from "@/lib/loyalty-math";

export type CheckoutDefaults = {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  delivery: DeliveryId | null;
  courier?: CourierId | null;
  /** The saved office, already looked up on the server. */
  office?: CourierOffice | null;
  signedIn: boolean;
  /** The customer's points and the shop's rules; null for guests or when the programme is off. */
  loyalty?: { balance: number; settings: LoyaltySettings } | null;
};

type Payment = "cod" | "card";

const isDeliveryId =(v: string | null): v is DeliveryId => DELIVERY_METHODS.some((d) => d.id === v);

function Field({
  label,
  name,
  error,
  ...props
}: { label: string; name: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  // Unique per copy: a page left behind stays mounted (hidden), so a plain `name` id could repeat.
  const id = `${useId()}-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label} {props.required && <span className="text-tomato" aria-hidden>*</span>}
      </label>
      <input id={id} name={name} className="field" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-tomato">
          {error}
        </p>
      )}
    </div>
  );
}

function PaymentOption({
  active,
  disabled = false,
  onSelect,
  value,
  icon,
  title,
  text,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  value: Payment;
  icon: React.ReactNode;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={`relative flex gap-4 rounded-2xl border-2 p-4 transition ${
        disabled
          ? "cursor-not-allowed border-line/60 bg-sand/30 opacity-60"
          : active
          ? "cursor-pointer border-forest bg-lime/25"
          : "cursor-pointer border-line hover:border-ink/30"
      }`}
    >
      <input
        type="radio"
        name="payment"
        value={value}
        checked={active}
        disabled={disabled}
        onChange={disabled ? undefined : onSelect}
        className="peer sr-only"
      />
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${disabled ? "bg-sand text-ink-soft" : active ? "bg-forest text-white" : "bg-sand text-ink"}`}>{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-semibold">
          {title}
          {disabled && (
            <span className="rounded bg-tomato/10 px-1.5 py-0.5 text-[0.65rem] font-bold text-tomato">
              Недостъпно
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-ink-soft">{text}</span>
        {children}
      </span>
      {!disabled && (
        <span className="pointer-events-none absolute inset-0 rounded-2xl peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2" />
      )}
    </label>
  );
}

export function CheckoutForm({ defaults }: { defaults: CheckoutDefaults }) {
  const router = useRouter();
  const noteId = useId();
  useFreshCartPrices(liveCartData);
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [delivery, setDelivery] = useState<DeliveryId>(isDeliveryId(defaults.delivery) ? defaults.delivery : "office");
  const [courier, setCourier] = useState<CourierId>((defaults.courier as CourierId) || (defaults.delivery === "box" ? "boxnow" : "speedy"));
  const [city, setCity] = useState<string>(defaults.city || "Плевен");
  // With an office or locker saved, the stored address is the office's own, not a street address to deliver to.
  const [address, setAddress] = useState<string>(defaults.delivery === "office" || defaults.delivery === "box" ? "" : defaults.address);
  const [selectedOffice, setSelectedOffice] = useState<CourierOffice | null>(defaults.office ?? null);

  // Offer to remember the details by default only when nothing is saved yet.
  const [saveAsDefault, setSaveAsDefault] = useState(defaults.signedIn && !defaults.delivery);
  const [payment, setPayment] = useState<Payment>("cod");
  const [usePoints, setUsePoints] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();
  const [placed, setPlaced] = useState(false);

  // Next keeps this page mounted but hidden after we leave it. Without the reset, coming back for a
  // second order would find the button still stuck on "Изпращаме поръчката…".
  useLayoutEffect(
    () => () => {
      setPlaced(false);
      setErrors({});
      setFormError("");
      setPayment("cod");
    },
    [],
  );

  // "До автомат" is card only; the choice made for other deliveries is kept for when the customer switches back.
  const effectivePayment = delivery === "box" ? "card" : payment;
  const { subtotal } = cartTotals(items);
  const loyalty = defaults.loyalty;
  const redeem = loyalty ? redeemable(loyalty.balance, subtotal, loyalty.settings) : { points: 0, discount: 0 };
  const discount = usePoints ? redeem.discount : 0;
  const willEarn = loyalty ? pointsForGoods(subtotal - discount, loyalty.settings) : 0;
  const shipping = shippingFor(delivery, subtotal, courier);
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
    const form = e.currentTarget;
    const fd = new FormData(form);
    const text = (k: string) => String(fd.get(k) ?? "");
    setErrors({});
    setFormError("");
    start(async () => {
      const toOffice = delivery === "office" || delivery === "box";
      const courierVal = pickup ? undefined : ((text("courier") || courier) as CourierId);
      // Only the office code is sent; the server reads its name and address from its own list.
      const officeCodeVal = toOffice ? selectedOffice?.code : undefined;
      const finalCity = pickup ? STORE.city : (text("city") || city);
      const finalAddress = pickup ? STORE.address : toOffice ? "" : (text("address") || address);

      const result = await placeOrder({
        name: text("name"),
        phone: text("phone"),
        email: text("email"),
        delivery,
        courier: courierVal,
        officeCode: officeCodeVal,
        city: finalCity,
        address: finalAddress,
        note: text("note"),
        saveAsDefault: defaults.signedIn && saveAsDefault,
        usePoints: Boolean(defaults.loyalty) && usePoints,
        payment: effectivePayment,
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
      // By name within this form: ids carry a per-copy prefix.
      const field = first ? form.elements.namedItem(first) : null;
      if (field instanceof HTMLElement) field.focus();
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
            <Field label="Телефон" name="phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="0877 915 191" defaultValue={defaults.phone} error={errors.phone} />
            <Field label="Имейл" name="email" type="email" required autoComplete="email" defaultValue={defaults.email} error={errors.email} />
          </div>
        </fieldset>

        <fieldset className="rounded-tile bg-paper p-6 shadow-soft sm:p-8">
          <legend className="float-left mb-5 font-display text-lg font-semibold">2. Доставка</legend>
          <div className="clear-both">
            <DeliveryOptions
              value={delivery}
              onChange={(d) => {
                setDelivery(d);
                setSelectedOffice(null);
                // Lockers default to BoxNow unless the customer has a saved courier; they can still pick another.
                if (d === "box" && !defaults.courier) setCourier("boxnow");
              }}
              priceFor={(id) => shippingFor(id, subtotal, id === "box" ? courier : undefined)}
            />
          </div>
          {pickup ? (
            <div className="mt-5">
              <StoreLocation defaultOpen />
              <p className="mt-3 text-sm text-ink-soft">Ще ти се обадим, когато поръчката е готова за вземане.</p>
            </div>
          ) : (
            <div className="mt-5">
              <CourierOfficePicker
                delivery={delivery as "office" | "box" | "address"}
                courier={courier}
                onCourierChange={setCourier}
                city={city}
                onCityChange={setCity}
                selectedOffice={selectedOffice}
                onOfficeChange={setSelectedOffice}
                address={address}
                onAddressChange={setAddress}
                errors={errors}
              />
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
            <label htmlFor={noteId} className="mb-1.5 block text-sm font-medium">
              Бележка към поръчката <span className="font-normal text-ink-soft">(по желание)</span>
            </label>
            <textarea id={noteId} name="note" rows={3} maxLength={500} className="field h-auto py-3" />
          </div>
        </fieldset>

        <fieldset className="rounded-tile bg-paper p-6 shadow-soft sm:p-8">
          <legend className="float-left mb-5 font-display text-lg font-semibold">3. Плащане</legend>
          <div className="clear-both grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Начин на плащане">
            <PaymentOption
              active={effectivePayment === "cod"}
              disabled={delivery === "box"}
              onSelect={() => {
                if (delivery !== "box") setPayment("cod");
              }}
              value="cod"
              icon={<Banknote className="h-5 w-5" aria-hidden />}
              title={pickup ? "Плащане в магазина" : "Наложен платеж"}
              text={
                delivery === "box"
                  ? "Не се поддържа при доставка до автомат (автоматите не приемат пари в брой)."
                  : pickup
                  ? "Плащаш в брой или с карта, когато вземеш поръчката."
                  : "Плащаш на куриера в брой или с карта, след като прегледаш пратката."
              }
            />
            <PaymentOption
              active={effectivePayment === "card"}
              onSelect={() => setPayment("card")}
              value="card"
              icon={<CreditCard className="h-5 w-5" aria-hidden />}
              title="С карта онлайн"
              text={
                delivery === "box"
                  ? "Задължително за доставка до автомат. Плащаш сигурно с банкова карта."
                  : "Плащаш сигурно с дебитна или кредитна карта."
              }
            >
              <PaymentBrands className="mt-3" />
            </PaymentOption>
          </div>
          {delivery === "box" ? (
            <p role="status" className="mt-4 flex gap-2.5 rounded-2xl border border-lime/60 bg-lime/20 p-3.5 text-sm text-ink">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
              <span>
                <strong>Задължително плащане с карта:</strong> Автоматите на BoxNow работят напълно автоматизирано и не приемат плащане в брой. Затова за доставка до автомат поръчката се заплаща сигурно с банкова карта.
              </span>
            </p>
          ) : effectivePayment === "card" ? (
            <p role="status" className="mt-4 flex gap-2.5 rounded-2xl bg-sand px-4 py-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
              <span>
                Плащането се извършва сигурно с дебитна или кредитна карта през защитена банкова система.
              </span>
            </p>
          ) : null}
        </fieldset>
      </div>

      <aside className="rounded-tile bg-paper p-6 shadow-soft lg:sticky lg:top-36" aria-label="Твоята поръчка">
        <h2 className="font-display text-lg font-semibold">Твоята поръчка</h2>
        <ul className="mt-4 max-h-72 divide-y divide-line overflow-y-auto">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-sand">
                <ProductVisual product={i} size={96} className="h-11 w-11" />
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
          {discount > 0 && (
            <div className="flex justify-between text-forest">
              <dt>Отстъпка с {redeem.points} точки</dt>
              <dd className="font-semibold tabular-nums">−{formatPrice(discount)}</dd>
            </div>
          )}
        </dl>
        {loyalty && (
          <div className="mt-4 rounded-2xl bg-lime/25 px-4 py-3 text-sm">
            {redeem.points > 0 ? (
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f5c3f]" />
                <span>
                  Използвай <strong>{redeem.points} точки</strong> за <strong>−{formatPrice(redeem.discount)}</strong>
                  <span className="block text-ink-soft">Имаш {loyalty.balance} точки.</span>
                </span>
              </label>
            ) : (
              <p>
                Имаш <strong>{loyalty.balance} точки</strong>.{" "}
                <span className="text-ink-soft">Можеш да ги използваш от {loyalty.settings.minRedeem} точки нагоре.</span>
              </p>
            )}
            {willEarn > 0 && <p className="mt-1.5 text-ink-soft">С тази поръчка ще събереш още {willEarn} точки, когато я получиш.</p>}
          </div>
        )}
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-semibold">Общо</span>
          <span className="text-3xl font-bold tabular-nums">{formatPrice(subtotal + shipping - discount)}</span>
        </div>
        {formError && (
          <p role="alert" className="mt-4 rounded-2xl bg-tomato/10 px-4 py-3 text-sm font-medium text-tomato">
            {formError}
          </p>
        )}
        <button type="submit" disabled={pending || placed} className={`${btn.lime} mt-5 w-full`}>
          {pending || placed ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : effectivePayment === "card" ? (
            <CreditCard className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <Lock className="h-[18px] w-[18px]" aria-hidden />
          )}
          {pending || placed
            ? "Изпращаме поръчката…"
            : effectivePayment === "card"
            ? "Потвърди поръчката с карта"
            : "Потвърди поръчката"}
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
