"use client";

import { ExternalLink, Loader2, Package, Printer, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { cancelBoxNowParcelAction, createBoxNowParcelAction, refreshBoxNowAction } from "@/actions/boxnow";
import { TrackingTimeline } from "@/components/TrackingTimeline";
import { btn } from "@/components/ui";
import type { BoxNowParcelOptions } from "@/lib/boxnow-shipments";
import type { TrackingEvent } from "@/lib/econt";

export type ExistingParcel = {
  parcelId: string;
  labelUrl: string;
  trackingUrl: string;
  status: string | null;
  events: TrackingEvent[];
  trackedAt: string | null;
};

/** BOX NOW's compartments; every one is 45 × 60 cm, only the height differs. */
const SIZES = [
  { id: 1, name: "Малка", height: 8 },
  { id: 2, name: "Средна", height: 17 },
  { id: 3, name: "Голяма", height: 36 },
] as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" });

/** The BOX NOW part of an order page: create the parcel, print its label, follow it, cancel it. */
export function BoxNowParcel({
  orderId,
  configured,
  existing,
  blocker,
  missingSettings,
  defaults,
  paidByCard,
  dropOff,
  dropOffLocker,
}: {
  orderId: number;
  configured: boolean;
  existing: ExistingParcel | null;
  blocker: string | null;
  missingSettings: string[];
  defaults: Omit<BoxNowParcelOptions, "size">;
  paidByCard: boolean;
  /** The shop drops parcels in a BOX NOW locker itself (origin "any-apm"); otherwise a courier collects them. */
  dropOff: boolean;
  /** The locker the shop usually uses, for the reminder. */
  dropOffLocker: string;
}) {
  const uid = useId();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"create" | "cancel" | "refresh" | null>(null);
  const [error, setError] = useState("");
  // No size is chosen beforehand: a parcel made with a guessed size does not fit the door the locker opens.
  const [size, setSize] = useState<BoxNowParcelOptions["size"] | null>(null);
  const [o, setO] = useState({ weight: String(defaults.weight), cod: defaults.cod.toFixed(2), description: defaults.description });

  const act = (kind: NonNullable<typeof busy>, work: () => Promise<{ ok: boolean; error?: string }>) => {
    setError("");
    setBusy(kind);
    start(async () => {
      const r = await work();
      if (!r.ok) setError(r.error ?? "Грешка.");
      setBusy(null);
    });
  };
  const spin = (kind: typeof busy) => (pending && busy === kind ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null);
  const errorNote = error && (
    <p role="alert" className="mt-3 rounded-xl bg-tomato/10 px-3 py-2 text-sm font-medium text-tomato">
      {error}
    </p>
  );
  const note = (children: React.ReactNode) => <div className="mt-3 rounded-xl border border-dashed border-line bg-sand/20 p-3 text-sm text-ink-soft">{children}</div>;

  if (existing) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-sand/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-ink-soft">Пратка BOX NOW</p>
            <a href={existing.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-lg font-bold text-forest hover:underline">
              {existing.parcelId}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
          <a href={existing.labelUrl} target="_blank" rel="noopener noreferrer" className={btn.smDark}>
            <Printer className="h-4 w-4" aria-hidden />
            Етикет (PDF)
          </a>
        </div>
        <div className="mt-4">
          <p className="text-sm">
            <span className="text-ink-soft">Статус: </span>
            <strong>{existing.status ?? "—"}</strong>
          </p>
          {existing.trackedAt && <p className="text-xs text-ink-soft">Обновено {when(existing.trackedAt)}</p>}
          {dropOff && existing.events.length <= 1 && (
            <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-sm">
              Разпечатай етикета, залепи го на пратката и я остави в автомат на BOX NOW{dropOffLocker ? ` — ${dropOffLocker}` : ""}. Ако вратата, която автоматът отвори, е малка за
              пратката, не я оставяй: откажи пратката оттук и я създай наново с по-голяма клетка.
            </p>
          )}
          <TrackingTimeline events={existing.events} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => act("refresh", () => refreshBoxNowAction(orderId))} className={btn.sm}>
            {spin("refresh") ?? <RefreshCw className="h-4 w-4" aria-hidden />}
            Обнови статуса
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Да откажа ли пратка ${existing.parcelId} в BOX NOW? Става само докато BOX NOW още не я е приел.`)) act("cancel", () => cancelBoxNowParcelAction(orderId));
            }}
            className={btn.smDanger}
          >
            {spin("cancel") ?? <Trash2 className="h-4 w-4" aria-hidden />}
            Откажи пратката
          </button>
        </div>
        {errorNote}
      </div>
    );
  }

  if (blocker) return note(blocker);
  if (!configured) return note("BOX NOW още не е свързан: във Vercel липсват BOXNOW_CLIENT_ID и BOXNOW_CLIENT_SECRET.");
  if (missingSettings.length) {
    return note(
      <>
        За пратки първо попълни в{" "}
        <Link href="/admin/kurieri" className="font-semibold text-forest hover:underline">
          Куриери → BOX NOW
        </Link>
        : {missingSettings.join(", ")}.
      </>,
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-sand/30 p-4">
      <p className="mb-3 font-semibold">Нова пратка BOX NOW</p>
      <p id={`${uid}-size`} className="mb-1 text-xs font-medium text-ink-soft">
        Клетка в автомата <span className="text-tomato">*</span>
      </p>
      <div role="radiogroup" aria-labelledby={`${uid}-size`} className="grid grid-cols-3 gap-2">
        {SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={size === s.id}
            onClick={() => {
              setSize(s.id);
              setError("");
            }}
            className={`rounded-xl border px-2 py-2.5 text-center transition ${size === s.id ? "border-forest bg-forest text-white" : "border-line bg-paper hover:border-ink"}`}
          >
            <span className="block text-sm font-semibold">{s.name}</span>
            <span className={`block text-xs ${size === s.id ? "text-white/85" : "text-ink-soft"}`}>до {s.height} см висока</span>
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">
        Всяка клетка е 45 × 60 см, разликата е във височината. Автоматът отваря врата точно с избрания размер и той не може да се смени след създаването.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${uid}-weight`} className="mb-1 block text-xs font-medium text-ink-soft">
            Тегло (кг)
          </label>
          <input id={`${uid}-weight`} inputMode="decimal" value={o.weight} onChange={(e) => setO({ ...o, weight: e.target.value })} className="field h-10 text-sm tabular-nums" />
        </div>
        <div>
          <label htmlFor={`${uid}-cod`} className="mb-1 block text-xs font-medium text-ink-soft">
            Наложен платеж (€)
          </label>
          <input
            id={`${uid}-cod`}
            inputMode="decimal"
            value={paidByCard ? "0.00" : o.cod}
            disabled={paidByCard}
            title={paidByCard ? "Платена с карта" : undefined}
            onChange={(e) => setO({ ...o, cod: e.target.value })}
            className="field h-10 text-sm tabular-nums"
          />
        </div>
      </div>
      <label htmlFor={`${uid}-desc`} className="mb-1 mt-3 block text-xs font-medium text-ink-soft">
        Съдържание
      </label>
      <textarea id={`${uid}-desc`} rows={2} maxLength={200} value={o.description} onChange={(e) => setO({ ...o, description: e.target.value })} className="field h-auto py-2 text-sm" />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const chosen = SIZES.find((s) => s.id === size);
            if (!chosen) return setError("Избери размер на клетката: малка, средна или голяма.");
            if (!confirm(`Да създам ли истинска пратка в BOX NOW с ${chosen.name.toUpperCase()} клетка (до ${chosen.height} см висока)? Тя се таксува по договора${dropOff ? `; после я оставяш с етикета в автомата${dropOffLocker ? ` на ${dropOffLocker}` : ""}` : " и куриер ще дойде да я вземе"}.`)) return;
            act("create", () =>
              createBoxNowParcelAction(orderId, {
                size: chosen.id,
                weight: Number(o.weight.replace(",", ".")),
                cod: paidByCard ? 0 : Number(o.cod.replace(",", ".")) || 0,
                description: o.description,
              }),
            );
          }}
          className={btn.smPrimary}
        >
          {spin("create") ?? <Package className="h-4 w-4" aria-hidden />}
          Създай пратка
        </button>
      </div>
      {errorNote}
    </div>
  );
}
