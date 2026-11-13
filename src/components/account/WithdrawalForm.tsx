"use client";

import { ArrowLeft, Check, Loader2, Printer, Undo2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { submitWithdrawal, type WithdrawalInput } from "@/actions/withdrawal";
import { btn } from "@/components/ui";
import { formatTimestamp } from "@/lib/format";
import { site } from "@/lib/site";

type Step = "form" | "review" | { createdAt: string; statement: string; emailed: boolean };

/**
 * The „Откажете се от договора тук“ function (ЗЗП чл. 52а): name, order and e-mail, then a second
 * „Потвърждавам отказа“ step, then the confirmation with the date and time it was received.
 */
export function WithdrawalForm({ initial }: { initial: WithdrawalInput }) {
  const uid = useId();
  const [values, setValues] = useState<WithdrawalInput>(initial);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const set = (k: keyof WithdrawalInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const res = await submitWithdrawal(values);
      if (res.ok) {
        setStep(res);
        return;
      }
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      if (res.fieldErrors) setStep("form");
    });

  if (typeof step === "object") {
    return (
      <div role="status" className="rounded-card bg-paper p-6 shadow-soft sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-lime text-ink">
          <Check className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        </span>
        <h2 className="!mt-4">Получихме отказа ти от договора</h2>
        <p className="mt-2">
          Получено на <strong>{formatTimestamp(new Date(step.createdAt))} ч.</strong>
        </p>
        <div className="mt-4 rounded-2xl bg-sand p-4 text-[0.95rem] text-ink">
          <p className="font-semibold">Съдържание на изявлението</p>
          <p className="mt-1">{step.statement}</p>
          <p className="mt-1">Име: {values.name.trim()}</p>
          <p>Имейл: {values.email.trim()}</p>
        </div>
        <p className="mt-4 text-sm">
          {step.emailed
            ? `Изпратихме потвърждение и на ${values.email.trim()}.`
            : `Ще изпратим потвърждение на ${values.email.trim()} до края на работния ден. Можеш да запазиш или разпечаташ тази страница.`}{" "}
          Ще се свържем с теб за връщането на стоките.
        </p>
        <button type="button" onClick={() => window.print()} className={`${btn.sm} mt-5`}>
          <Printer className="h-4 w-4" aria-hidden />
          Разпечатай
        </button>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="rounded-card bg-paper p-6 shadow-soft sm:p-8">
        <h2 className="!mt-0">Провери и потвърди</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-[0.95rem] sm:grid-cols-[auto_1fr]">
          <dt>Име</dt>
          <dd className="font-medium text-ink">{values.name}</dd>
          <dt>Поръчка №</dt>
          <dd className="font-medium text-ink">{values.orderNumber}</dd>
          <dt>Имейл за потвърждение</dt>
          <dd className="font-medium text-ink break-all">{values.email}</dd>
          <dt>Отказ от</dt>
          <dd className="font-medium text-ink">{values.details.trim() || "Цялата поръчка"}</dd>
        </dl>
        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-tomato/10 px-4 py-3 text-sm font-medium text-tomato">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={confirm} disabled={pending} className={btn.primary}>
            {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Check className="h-5 w-5" aria-hidden />}
            Потвърждавам отказа
          </button>
          <button type="button" onClick={() => setStep("form")} disabled={pending} className={btn.ghost}>
            <ArrowLeft className="h-5 w-5" aria-hidden />
            Назад
          </button>
        </div>
      </div>
    );
  }

  const field = (k: "name" | "orderNumber" | "email", label: string, extra: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={`${uid}-${k}`}
        value={values[k]}
        onChange={set(k)}
        required
        aria-invalid={Boolean(fieldErrors[k])}
        aria-describedby={fieldErrors[k] ? `${uid}-${k}-error` : undefined}
        className="field"
        {...extra}
      />
      {fieldErrors[k] && (
        <p id={`${uid}-${k}-error`} className="mt-1 text-sm font-medium text-tomato">
          {fieldErrors[k]}
        </p>
      )}
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFieldErrors({});
        setError(null);
        setStep("review");
      }}
      className="rounded-card bg-paper p-6 shadow-soft sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Име и фамилия", { autoComplete: "name", maxLength: 120 })}
        {field("orderNumber", "Номер на поръчката", { maxLength: 40, placeholder: "напр. LM-7K2Q9XHD" })}
        <div className="sm:col-span-2">
          {field("email", "Имейл за потвърждение", { type: "email", autoComplete: "email", inputMode: "email" })}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-details`} className="mb-1.5 block text-sm font-medium text-ink">
            От кои продукти се отказваш <span className="font-normal text-ink-soft">(по желание)</span>
          </label>
          <textarea id={`${uid}-details`} value={values.details} onChange={set("details")} rows={3} maxLength={1000} className="field h-auto py-3" />
          <p className="mt-1 text-sm">Остави празно, ако се отказваш от цялата поръчка. Не е нужно да посочваш причина.</p>
        </div>
      </div>
      <button type="submit" className={`${btn.primary} mt-6`}>
        <Undo2 className="h-5 w-5" aria-hidden />
        Продължи
      </button>
      <p className="mt-3 text-sm">
        Проблем с формата? Пиши ни на{" "}
        <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-2">
          {site.email}
        </a>
        .
      </p>
    </form>
  );
}
