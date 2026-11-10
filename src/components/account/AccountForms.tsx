"use client";

import { Check, Loader2 } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { changePassword, saveDeliveryPrefs, saveProfile, type AccountFormState } from "@/actions/account";
import { DeliveryOptions } from "@/components/checkout/DeliveryOptions";
import { StoreLocation } from "@/components/StoreLocation";
import { btn } from "@/components/ui";
import { DELIVERY_METHODS, type DeliveryId } from "@/lib/site";

function Input({
  label,
  name,
  error,
  hint,
  ...props
}: { label: string; name: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input id={name} name={name} className="field" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
      {error ? (
        <p id={`${name}-error`} role="alert" className="mt-1.5 text-sm font-medium text-tomato">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${name}-hint`} className="mt-1.5 text-sm text-ink-soft">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function Feedback({ state, success }: { state: AccountFormState; success: string }) {
  if (state?.ok) {
    return (
      <p role="status" className="inline-flex items-center gap-2 text-sm font-semibold text-forest">
        <Check className="h-4 w-4" aria-hidden />
        {success}
      </p>
    );
  }
  if (state?.error) {
    return (
      <p role="alert" className="text-sm font-medium text-tomato">
        {state.error}
      </p>
    );
  }
  return null;
}

function Card({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <section className="rounded-tile bg-paper p-6 shadow-soft sm:p-8">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1 text-sm text-ink-soft">{text}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Submit({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button type="submit" disabled={pending} className={btn.primary}>
      {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const isDeliveryId = (v: string | null): v is DeliveryId => DELIVERY_METHODS.some((d) => d.id === v);

export function DeliveryPrefsForm({ initial }: { initial: { delivery: string | null; city: string; address: string } }) {
  const [state, action, pending] = useActionState(saveDeliveryPrefs, undefined);
  const [delivery, setDelivery] = useState<DeliveryId>(isDeliveryId(initial.delivery) ? initial.delivery : "office");
  const method = DELIVERY_METHODS.find((d) => d.id === delivery)!;
  const errors = state?.fieldErrors ?? {};

  return (
    <Card title="Предпочитана доставка" text="Попълваме я автоматично при всяка поръчка. Винаги можеш да я смениш на момента.">
      <form action={action} className="space-y-5">
        <DeliveryOptions value={delivery} onChange={setDelivery} />
        {delivery === "store" ? (
          <StoreLocation />
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1fr_1.6fr]">
            <Input label="Населено място" name="city" autoComplete="address-level2" defaultValue={initial.city} error={errors.city} />
            <Input label={method.addressLabel} name="address" autoComplete="street-address" defaultValue={initial.address} error={errors.address} />
          </div>
        )}
        {delivery === "store" && (
          // Keep the saved courier address when switching to pickup.
          <>
            <input type="hidden" name="city" value={initial.city} />
            <input type="hidden" name="address" value={initial.address} />
          </>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Submit pending={pending}>Запази</Submit>
          <Feedback state={state} success="Запазено. Ще го попълним при следващата поръчка." />
        </div>
      </form>
    </Card>
  );
}

export function ProfileDetailsForm({ initial }: { initial: { name: string; phone: string; email: string } }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const errors = state?.fieldErrors ?? {};
  return (
    <Card title="Лични данни" text="Използваме ги при поръчка и за да се свържем с теб за доставката.">
      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Име и фамилия" name="name" required autoComplete="name" defaultValue={initial.name} error={errors.name} />
          <Input label="Телефон" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={initial.phone} error={errors.phone} />
        </div>
        <Input label="Имейл" name="email" type="email" value={initial.email} readOnly disabled hint="Имейлът е и потребителското ти име, затова не може да се сменя тук." />
        <div className="flex flex-wrap items-center gap-4">
          <Submit pending={pending}>Запази данните</Submit>
          <Feedback state={state} success="Данните са обновени." />
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const errors = state?.fieldErrors ?? {};
  return (
    <Card title="Смяна на парола">
      {/* key resets the fields after a successful change */}
      <form key={state?.ok ? "done" : "form"} action={action} className="space-y-4">
        <Input label="Текуща парола" name="current" type="password" autoComplete="current-password" required error={errors.current} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Нова парола" name="next" type="password" autoComplete="new-password" required minLength={8} error={errors.next} hint="Поне 8 символа." />
          <Input label="Повтори новата парола" name="confirm" type="password" autoComplete="new-password" required error={errors.confirm} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Submit pending={pending}>Смени паролата</Submit>
          <Feedback state={state} success="Паролата е сменена." />
        </div>
      </form>
    </Card>
  );
}
