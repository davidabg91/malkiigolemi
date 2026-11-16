"use client";

import { Check, Copy, Loader2, Package, PlugZap, ShieldCheck, TriangleAlert, Warehouse, XCircle } from "lucide-react";
import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { saveBoxNowSettingsAction, testBoxNowConnectionAction, type BoxNowConnection } from "@/actions/boxnow";
import { btn } from "@/components/ui";
import type { BoxNowSettings } from "@/lib/boxnow-settings";

/** Admin → Куриери: how the shop sends with BOX NOW (pickup warehouse, sender, parcel defaults) and the webhook state. */
export function BoxNowSettingsForm({
  initial,
  configured,
  webhookReady,
  webhookUrl,
}: {
  initial: BoxNowSettings;
  /** BOXNOW_CLIENT_ID / BOXNOW_CLIENT_SECRET are set in Vercel. */
  configured: boolean;
  /** BOXNOW_WEBHOOK_SECRET is set in Vercel. */
  webhookReady: boolean;
  webhookUrl: string;
}) {
  const [state, action, pending] = useActionState(saveBoxNowSettingsAction, undefined);
  const uid = useId();
  const err = state?.fieldErrors ?? {};
  const [checking, startCheck] = useTransition();
  const [connection, setConnection] = useState<BoxNowConnection | null>(null);
  const [origin, setOrigin] = useState({ id: initial.originId, name: initial.originName, type: initial.originType });
  const [copied, setCopied] = useState(false);
  const origins = connection?.ok ? connection.origins : [];

  const load = () =>
    startCheck(async () => {
      const result = await testBoxNowConnectionAction();
      setConnection(result);
      // Nothing chosen yet, or the saved one is gone: take the first warehouse.
      if (result.ok && !result.origins.some((o) => o.id === origin.id)) {
        const pick = result.origins.find((o) => o.type === "warehouse") ?? result.origins[0];
        if (pick) setOrigin({ id: pick.id, name: pick.name, type: pick.type });
      }
    });

  useEffect(() => {
    if (configured) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  const field = (name: "senderName" | "senderPhone" | "senderEmail" | "defaultWeight" | "dropOffLocker", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`${uid}-${name}`} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input id={`${uid}-${name}`} name={name} defaultValue={String(initial[name] ?? "")} className="field" aria-invalid={err[name] ? true : undefined} {...props} />
      {err[name] && <p className="mt-1.5 text-sm font-medium text-tomato">{err[name]}</p>}
    </div>
  );

  return (
    <form action={action} className="space-y-6">
      {configured ? (
        <p className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <span>
            <strong>Връзка с истинската система на BOX NOW.</strong> Всяка създадена пратка е истинска и се таксува по договора.
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2.5 rounded-2xl border border-sun/60 bg-sun/15 p-4 text-sm text-ink">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <span>
            <strong>Няма връзка с BOX NOW.</strong> Въведи данните от BOX NOW във Vercel като <code className="rounded bg-paper px-1">BOXNOW_CLIENT_ID</code> и{" "}
            <code className="rounded bg-paper px-1">BOXNOW_CLIENT_SECRET</code> и направи Redeploy.
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <button type="button" disabled={checking || !configured} onClick={load} className={btn.sm}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PlugZap className="h-4 w-4" aria-hidden />}
          Провери връзката с BOX NOW
        </button>
        {connection &&
          (connection.ok ? (
            <p role="status" className="flex items-start gap-2 text-sm text-forest">
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Връзката с BOX NOW работи · начини за предаване по договора: {connection.origins.length}</span>
            </p>
          ) : (
            <p role="alert" className="flex max-w-xl items-start gap-2 text-sm font-medium text-tomato">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{connection.error}</span>
            </p>
          ))}
      </div>

      <input type="hidden" name="originId" value={origin.id} />
      <input type="hidden" name="originName" value={origin.name} />
      <input type="hidden" name="originType" value={origin.type} />

      <fieldset>
        <legend className="mb-1 font-semibold">Как предаваш пратките на BOX NOW</legend>
        <p className="mb-3 text-sm text-ink-soft">Каквото позволява договорът: оставяш ги сам в автомат на BOX NOW, или техен куриер ги взема от регистриран адрес.</p>
        {origins.length > 0 ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {origins.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5 transition has-[:checked]:border-forest has-[:checked]:bg-lime/20"
              >
                <input type="radio" name="boxnowOrigin" checked={origin.id === o.id} onChange={() => setOrigin({ id: o.id, name: o.name, type: o.type })} className="mt-1 h-4 w-4 accent-[#33484b]" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    {o.type === "any-apm" ? <Package className="h-4 w-4 shrink-0 text-forest" aria-hidden /> : <Warehouse className="h-4 w-4 shrink-0 text-forest" aria-hidden />}
                    {o.type === "any-apm" ? "Оставям ги в автомат на BOX NOW" : o.name}
                  </span>
                  <span className="block text-sm text-ink-soft">
                    {o.type === "any-apm" ? "В който и да е автомат, с етикета от поръчката" : `Куриер ги взема от: ${o.address || "склад"}`} · ID {o.id}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : origin.id ? (
          <p className="rounded-2xl border border-line p-3.5 text-sm">
            Избрано: <strong>{origin.type === "any-apm" ? "оставям ги в автомат на BOX NOW" : origin.name || origin.id}</strong> (ID {origin.id})
          </p>
        ) : (
          <p className="text-sm text-ink-soft">{checking ? "Зареждане от BOX NOW…" : "След връзка с BOX NOW тук се показва какво позволява договорът."}</p>
        )}
        {err.originId && <p className="mt-1.5 text-sm font-medium text-tomato">{err.originId}</p>}
        {origin.type !== "warehouse" ? (
          <div className="mt-4 max-w-md">
            {field("dropOffLocker", "Автомат, в който оставяш пратките", { maxLength: 160, placeholder: "напр. бул. Сторгозия 30А, Плевен" })}
            <p className="mt-1.5 text-xs text-ink-soft">Само за напомняне в поръчката. BOX NOW приема пратката във всеки свой автомат.</p>
          </div>
        ) : (
          <input type="hidden" name="dropOffLocker" value={initial.dropOffLocker} />
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-semibold">Подател</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          {field("senderName", "Име", { required: true, maxLength: 100 })}
          {field("senderPhone", "Телефон", { required: true, inputMode: "tel" })}
          {field("senderEmail", "Имейл", { required: true, type: "email" })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-semibold">Пратки по подразбиране</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${uid}-size`} className="mb-1.5 block text-sm font-medium">
              Размер на клетката
            </label>
            <select id={`${uid}-size`} name="defaultSize" defaultValue={String(initial.defaultSize)} className="field">
              <option value="1">Малка (до 8 см височина)</option>
              <option value="2">Средна (до 17 см)</option>
              <option value="3">Голяма (до 36 см)</option>
            </select>
          </div>
          {field("defaultWeight", "Тегло (кг)", { inputMode: "decimal", required: true })}
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5 has-[:checked]:border-forest has-[:checked]:bg-lime/20">
          <input type="checkbox" name="allowReturn" defaultChecked={initial.allowReturn} className="mt-1 h-4 w-4 accent-[#33484b]" />
          <span>
            <span className="block font-medium">Позволи връщане през BOX NOW</span>
            <span className="text-sm text-ink-soft">Клиентът може да върне пратката от автомат (само ако договорът го включва).</span>
          </span>
        </label>
        <p className="mt-2 text-xs text-ink-soft">Клетката е 45 × 60 см; BOX NOW приема пратки до 20 кг.</p>
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-semibold">Статуси от BOX NOW (webhook)</legend>
        <p className="mb-3 text-sm text-ink-soft">BOX NOW известява сайта за всяка промяна на пратка; поръчката минава на „Изпратена“ и „Доставена“ сама.</p>
        {webhookReady ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-paper px-3 py-2 text-sm">{webhookUrl}</code>
            <button
              type="button"
              className={btn.sm}
              onClick={() => {
                navigator.clipboard?.writeText(webhookUrl).then(() => setCopied(true), () => {});
              }}
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Копирано" : "Копирай"}
            </button>
            <p className="w-full text-xs text-ink-soft">Всяка заявка трябва да носи ключа (BOXNOW_WEBHOOK_SECRET) в хедър „Authorization: Bearer …“.</p>
          </div>
        ) : (
          <p className="text-sm font-medium text-tomato">Липсва BOXNOW_WEBHOOK_SECRET във Vercel: без него сайтът отказва известията.</p>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          Запази настройките за BOX NOW
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
