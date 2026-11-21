"use client";

import { Check, Loader2, Store, Truck } from "lucide-react";
import { useActionState, useState } from "react";
import { chooseDelivery } from "@/actions/order-delivery";
import { CourierOfficePicker } from "@/components/checkout/CourierOfficePicker";
import { btn } from "@/components/ui";
import type { CourierId, CourierOffice } from "@/lib/couriers";
import { formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, STORE, type DeliveryId } from "@/lib/site";

export type DeliveryNow = {
  delivery: DeliveryId;
  courier: CourierId | "";
  /** The office or locker the order is going to now, already looked up on the server. */
  office: CourierOffice | null;
  city: string;
  address: string;
  name: string;
  phone: string;
};

const BY_COURIER = DELIVERY_METHODS.filter((m) => m.id !== "store");

/**
 * On the order's public page, for an order gathered from the Facebook group: the customer says whether they
 * take it from the shop or want it sent by courier, and leaves the name, phone and place for that.
 */
export function OrderDeliveryChoice({ number, now }: { number: string; now: DeliveryNow }) {
  const [state, action, pending] = useActionState(chooseDelivery.bind(null, number), undefined);
  const [byCourier, setByCourier] = useState(now.delivery !== "store");
  const [delivery, setDelivery] = useState<DeliveryId>(now.delivery === "store" ? "office" : now.delivery);
  const [courier, setCourier] = useState<CourierId>(now.courier || "speedy");
  const [city, setCity] = useState(now.delivery === "store" ? "" : (now.office?.city ?? now.city));
  const [address, setAddress] = useState(now.delivery === "address" ? now.address : "");
  const [office, setOffice] = useState<CourierOffice | null>(now.office);
  const err = state?.fieldErrors ?? {};
  // Nothing to save while the choice on the screen is the one the order already has.
  const unchanged = !byCourier && now.delivery === "store";

  const option = (active: boolean, onPick: () => void, Icon: typeof Store, title: string, hint: string) => (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${active ? "border-forest bg-lime/25" : "border-line hover:border-ink/30"}`}>
      <input type="radio" name="how" checked={active} onChange={onPick} className="sr-only" />
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? "bg-forest text-cream" : "bg-sand text-ink-soft"}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-ink-soft">{hint}</span>
      </span>
    </label>
  );

  return (
    <form action={action} className="mt-6 rounded-tile bg-paper p-6 shadow-soft sm:p-8">
      <h2 className="font-display text-lg font-semibold">Как искате да получите поръчката?</h2>
      <p className="mt-1 text-sm text-ink-soft">Изберете едното. Може да го промените, докато поръчката не е изпратена.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {option(!byCourier, () => setByCourier(false), Store, "Ще я взема от магазина", `Безплатно · ${STORE.address}`)}
        {option(byCourier, () => setByCourier(true), Truck, "Искам доставка с куриер", "До офис, автомат или до адрес · плащате при получаване")}
      </div>
      <input type="hidden" name="delivery" value={byCourier ? delivery : "store"} />

      {byCourier && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="delivery-name" className="mb-1.5 block text-sm font-medium">
                Име и фамилия на получателя
              </label>
              <input id="delivery-name" name="name" defaultValue={now.name} required autoComplete="name" className="field" aria-invalid={err.name ? true : undefined} />
              {err.name && <p className="mt-1.5 text-sm font-medium text-tomato">{err.name}</p>}
            </div>
            <div>
              <label htmlFor="delivery-phone" className="mb-1.5 block text-sm font-medium">
                Телефон
              </label>
              <input id="delivery-phone" name="phone" defaultValue={now.phone} required type="tel" inputMode="tel" autoComplete="tel" placeholder="08…" className="field" aria-invalid={err.phone ? true : undefined} />
              {err.phone && <p className="mt-1.5 text-sm font-medium text-tomato">{err.phone}</p>}
            </div>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Доставка</legend>
            <div className="flex flex-wrap gap-2">
              {BY_COURIER.map((m) => (
                <label key={m.id} className={`cursor-pointer rounded-full border-2 px-4 py-2 text-sm font-medium transition ${delivery === m.id ? "border-forest bg-lime/25" : "border-line hover:border-ink/30"}`}>
                  <input
                    type="radio"
                    name="kind"
                    checked={delivery === m.id}
                    onChange={() => {
                      setDelivery(m.id);
                      setOffice(m.id === now.delivery ? now.office : null);
                    }}
                    className="sr-only"
                  />
                  {m.label}
                  {m.price > 0 && <span className="ml-1.5 text-ink-soft">от {formatPrice(m.price)}</span>}
                </label>
              ))}
            </div>
          </fieldset>

          <CourierOfficePicker
            idPrefix="order-delivery-"
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
          <p className="text-sm text-ink-soft">Точната цена на доставката ще се покаже в поръчката, след като запазите. Плащате на куриера при получаване.</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || unchanged} className={btn.primary}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          {byCourier ? "Запази данните за доставка" : "Ще я взема от магазина"}
        </button>
        {state?.ok && !pending && (
          <p role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest">
            <Check className="h-4 w-4" aria-hidden />
            Записано. Благодарим!
          </p>
        )}
        {state?.error && (
          <p role="alert" className="text-sm font-medium text-tomato">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
