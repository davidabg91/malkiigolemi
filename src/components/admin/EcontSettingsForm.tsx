"use client";

import { Check, FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";
import { saveEcontSettingsAction } from "@/actions/econt";
import { btn } from "@/components/ui";
import type { EcontSettings } from "@/lib/econt-settings";

type Office = { code: string; name: string; address: string };

/** Admin → Куриери: how the shop sends with Econt (sender, office or pickup address, who pays). */
export function EcontSettingsForm({ initial, live }: { initial: EcontSettings; live: boolean }) {
  const [state, action, pending] = useActionState(saveEcontSettingsAction, undefined);
  const [mode, setMode] = useState(initial.senderMode);
  const [city, setCity] = useState(initial.senderCity);
  const [offices, setOffices] = useState<Office[] | null>(null);
  const uid = useId();
  const err = state?.fieldErrors ?? {};

  // The Econt offices in the chosen town, to pick the one parcels are taken to.
  useEffect(() => {
    if (mode !== "office" || city.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/couriers?action=offices&courier=econt&type=office&city=${encodeURIComponent(city.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { offices?: Office[] }) => setOffices(d.offices ?? []))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [mode, city]);

  const field = (name: keyof EcontSettings, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`${uid}-${name}`} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input id={`${uid}-${name}`} name={name} defaultValue={String(initial[name] ?? "")} className="field" aria-invalid={err[name] ? true : undefined} {...props} />
      {err[name] && <p className="mt-1.5 text-sm font-medium text-tomato">{err[name]}</p>}
    </div>
  );

  const radio = (name: "senderMode" | "payer" | "senderPayment", value: string, label: string, hint: string, checked: boolean, onChange?: () => void) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5 transition has-[:checked]:border-forest has-[:checked]:bg-lime/20">
      <input type="radio" name={name} value={value} defaultChecked={checked} onChange={onChange} className="mt-1 h-4 w-4 accent-[#1f5c3f]" />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-sm text-ink-soft">{hint}</span>
      </span>
    </label>
  );

  return (
    <form action={action} className="space-y-6">
      {live ? (
        <p className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <span>
            <strong>Връзка с истинската система на Еконт.</strong> Всяка товарителница се таксува по договора ти, а заявеният куриер наистина идва.
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2.5 rounded-2xl border border-sun/60 bg-sun/15 p-4 text-sm text-ink">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <span>
            <strong>Тестов режим.</strong> Сайтът е свързан с тестовата система на Еконт: товарителниците не са истински и нищо не се таксува. Щом получиш
            потребител за e-Econt, въведи го във Vercel като <code className="rounded bg-paper px-1">ECONT_USERNAME</code> и{" "}
            <code className="rounded bg-paper px-1">ECONT_PASSWORD</code>.
          </span>
        </p>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Подател</legend>
        {field("senderName", "Име на подателя (фирма)", { required: true, maxLength: 80 })}
        {field("senderPhone", "Телефон за връзка", { required: true, inputMode: "tel" })}
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-semibold">Откъде тръгват пратките</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {radio("senderMode", "office", "Нося ги в офис на Еконт", "Пратките се оставят в избран офис.", initial.senderMode === "office", () => setMode("office"))}
          {radio("senderMode", "address", "Куриер ги взема от адрес", "При създаване на товарителница можеш да заявиш куриер.", initial.senderMode === "address", () => setMode("address"))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-senderCity`} className="mb-1.5 block text-sm font-medium">
              Населено място
            </label>
            <input id={`${uid}-senderCity`} name="senderCity" value={city} onChange={(e) => setCity(e.target.value)} className="field" />
            {err.senderCity && <p className="mt-1.5 text-sm font-medium text-tomato">{err.senderCity}</p>}
          </div>
          {mode === "office" ? (
            <div>
              <label htmlFor={`${uid}-senderOfficeCode`} className="mb-1.5 block text-sm font-medium">
                Офис на Еконт
              </label>
              <select id={`${uid}-senderOfficeCode`} name="senderOfficeCode" defaultValue={initial.senderOfficeCode} key={offices?.length ?? 0} className="field">
                <option value="">{offices === null ? "Зареждане…" : offices.length ? "Избери офис…" : "Няма офиси в това място"}</option>
                {initial.senderOfficeCode && !offices?.some((o) => o.code === initial.senderOfficeCode) && (
                  <option value={initial.senderOfficeCode}>Код {initial.senderOfficeCode}</option>
                )}
                {offices?.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.name} — {o.address} (код {o.code})
                  </option>
                ))}
              </select>
              {err.senderOfficeCode && <p className="mt-1.5 text-sm font-medium text-tomato">{err.senderOfficeCode}</p>}
            </div>
          ) : (
            <>
              <input type="hidden" name="senderOfficeCode" value={initial.senderOfficeCode} />
              {field("senderAddress", "Адрес (улица, №, блок, етаж)", { maxLength: 200 })}
            </>
          )}
          {mode === "office" && <input type="hidden" name="senderAddress" value={initial.senderAddress} />}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-semibold">Кой плаща на Еконт</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {radio("payer", "sender", "Магазинът", "Клиентът вече е платил доставката с поръчката; наложеният платеж е цялата сума.", initial.payer === "sender")}
          {radio("payer", "receiver", "Клиентът при получаване", "Еконт взема цената на доставката от клиента; наложеният платеж е без доставката.", initial.payer === "receiver")}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {radio("senderPayment", "cash", "Магазинът плаща в брой", "При предаване на пратката в офиса.", initial.senderPayment === "cash")}
          {radio("senderPayment", "credit", "Магазинът плаща по договор", "Еконт фактурира по фирмения договор.", initial.senderPayment === "credit")}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Пратки и наложен платеж</legend>
        {field("defaultWeight", "Тегло на пакет по подразбиране (кг)", { inputMode: "decimal", required: true })}
        {field("codTemplate", "Споразумение за наложен платеж (от Еконт)", { placeholder: "по желание", maxLength: 60 })}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5 has-[:checked]:border-forest has-[:checked]:bg-lime/20">
          <input type="checkbox" name="inspectBeforePay" defaultChecked={initial.inspectBeforePay} className="mt-1 h-4 w-4 accent-[#1f5c3f]" />
          <span>
            <span className="block font-medium">Преглед преди плащане</span>
            <span className="text-sm text-ink-soft">Клиентът отваря пратката, преди да плати.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5 has-[:checked]:border-forest has-[:checked]:bg-lime/20">
          <input type="checkbox" name="sms" defaultChecked={initial.sms} className="mt-1 h-4 w-4 accent-[#1f5c3f]" />
          <span>
            <span className="block font-medium">SMS известие до клиента</span>
            <span className="text-sm text-ink-soft">Допълнителна услуга на Еконт (таксува се).</span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          Запази настройките за Еконт
        </button>
        {state?.ok && (
          <p role="status" className="inline-flex items-center gap-2 text-sm font-semibold text-forest">
            <Check className="h-4 w-4" aria-hidden />
            Запазено.
          </p>
        )}
        {state?.error && <p role="alert" className="text-sm font-medium text-tomato">{state.error}</p>}
      </div>
    </form>
  );
}
