"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { login, register, type FormState } from "@/actions/auth";
import { btn } from "@/components/ui";

function PasswordField({ autoComplete, hint }: { autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
        Парола
      </label>
      <div className="relative">
        <input id="password" name="password" type={show ? "text" : "password"} required autoComplete={autoComplete} className="field pr-12" aria-describedby={hint ? "password-hint" : undefined} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink"
          aria-label={show ? "Скрий паролата" : "Покажи паролата"}
        >
          {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
      {hint && (
        <p id="password-hint" className="mt-1.5 text-sm text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

function ErrorNote({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="rounded-2xl bg-tomato/10 px-4 py-3 text-sm font-medium text-tomato">
      {state.error}
    </p>
  );
}

function Submit({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button type="submit" disabled={pending} className={`${btn.primary} w-full`}>
      {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Имейл
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state?.fields?.email} className="field" />
      </div>
      <PasswordField autoComplete="current-password" />
      <ErrorNote state={state} />
      <Submit pending={pending}>Вход</Submit>
      <p className="text-center text-sm text-ink-soft">
        Нямаш профил?{" "}
        <Link href={next ? `/registratsiya?next=${encodeURIComponent(next)}` : "/registratsiya"} className="font-semibold text-forest hover:underline">
          Регистрирай се
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(register, undefined);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
          Име и фамилия
        </label>
        <input id="name" name="name" required autoComplete="name" defaultValue={state?.fields?.name} className="field" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Имейл
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state?.fields?.email} className="field" />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
            Телефон
          </label>
          <input id="phone" name="phone" type="tel" required autoComplete="tel" inputMode="tel" defaultValue={state?.fields?.phone} className="field" />
        </div>
      </div>
      <PasswordField autoComplete="new-password" hint="Поне 8 символа." />
      <ErrorNote state={state} />
      <Submit pending={pending}>Създай профил</Submit>
      <p className="text-center text-sm text-ink-soft">
        Вече имаш профил?{" "}
        <Link href={next ? `/vhod?next=${encodeURIComponent(next)}` : "/vhod"} className="font-semibold text-forest hover:underline">
          Влез
        </Link>
      </p>
    </form>
  );
}
