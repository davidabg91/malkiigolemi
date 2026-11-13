"use client";

import { Calculator, ExternalLink, FlaskConical, Loader2, Printer, RefreshCw, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { createWaybillAction, deleteWaybillAction, quoteWaybillAction, refreshTrackingAction } from "@/actions/econt";
import { TrackingTimeline } from "@/components/TrackingTimeline";
import { btn } from "@/components/ui";
import type { EcontLabelResult, TrackingEvent } from "@/lib/econt";
import { formatPrice } from "@/lib/format";
import type { WaybillOptions } from "@/lib/shipments";

export type ExistingWaybill = {
  number: string;
  pdfUrl: string | null;
  trackingUrl: string;
  status: string | null;
  events: TrackingEvent[];
  trackedAt: string | null;
  /** What Econt charges the shop, in cents. */
  cost: number | null;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" });

export function EcontWaybill({
  orderId,
  live,
  existing,
  blocker,
  missingSettings,
  defaults,
  pickupPossible,
}: {
  orderId: number;
  live: boolean;
  existing: ExistingWaybill | null;
  /** Why this order cannot get a waybill (wrong courier, cancelled…), or null. */
  blocker: string | null;
  /** Econt settings still to fill in before the first waybill. */
  missingSettings: string[];
  defaults: WaybillOptions;
  /** The shop sends from its address, so a courier can be booked with the waybill. */
  pickupPossible: boolean;
}) {
  const uid = useId();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"quote" | "create" | "delete" | "refresh" | null>(null);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<EcontLabelResult | null>(null);
  const [o, setO] = useState({ ...defaults, weight: String(defaults.weight), packCount: String(defaults.packCount), cod: defaults.cod.toFixed(2) });
  const [pickup, setPickup] = useState(false);
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("17:00");

  const options = (): WaybillOptions => ({
    weight: Number(o.weight.replace(",", ".")),
    packCount: Number(o.packCount),
    cod: Number(o.cod.replace(",", ".")) || 0,
    description: o.description,
    pickup: pickupPossible && pickup ? { from, to } : null,
  });

  const act = (kind: NonNullable<typeof busy>, work: () => Promise<{ ok: boolean; error?: string } & Partial<{ label: EcontLabelResult }>>) => {
    setError("");
    setBusy(kind);
    start(async () => {
      const r = await work();
      if (!r.ok) setError(r.error ?? "Грешка.");
      else if (kind === "quote" && r.label) setQuote(r.label);
      setBusy(null);
    });
  };

  const spin = (kind: typeof busy) => (pending && busy === kind ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null);
  const testBadge = !live && (
    <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-sun/30 px-2.5 py-1 text-xs font-semibold">
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      Тестов режим — товарителниците не са истински
    </p>
  );
  const errorNote = error && (
    <p role="alert" className="mt-3 rounded-xl bg-tomato/10 px-3 py-2 text-sm font-medium text-tomato">
      {error}
    </p>
  );

  if (existing) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-sand/30 p-4">
        {testBadge}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-ink-soft">Товарителница Еконт</p>
            <a href={existing.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-lg font-bold text-forest hover:underline">
              {existing.number}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            {existing.cost != null && <p className="text-xs text-ink-soft">Цена за магазина: {formatPrice(existing.cost)}</p>}
          </div>
          {existing.pdfUrl && (
            <a href={existing.pdfUrl} target="_blank" rel="noopener noreferrer" className={`${btn.sm} bg-ink text-cream hover:bg-forest-deep`}>
              <Printer className="h-4 w-4" aria-hidden />
              Печат (PDF)
            </a>
          )}
        </div>

        <div className="mt-4">
          <p className="text-sm">
            <span className="text-ink-soft">Статус: </span>
            <strong>{existing.status ?? "—"}</strong>
          </p>
          {existing.trackedAt && <p className="text-xs text-ink-soft">Проверено {when(existing.trackedAt)}</p>}
          <TrackingTimeline events={existing.events} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => act("refresh", () => refreshTrackingAction(orderId))} className={btn.sm}>
            {spin("refresh") ?? <RefreshCw className="h-4 w-4" aria-hidden />}
            Обнови статуса
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Да изтрия ли товарителница ${existing.number} в Еконт? Става само докато пратката не е предадена.`)) act("delete", () => deleteWaybillAction(orderId));
            }}
            className={`${btn.sm} text-tomato hover:border-tomato`}
          >
            {spin("delete") ?? <Trash2 className="h-4 w-4" aria-hidden />}
            Изтрий товарителницата
          </button>
        </div>
        {errorNote}
      </div>
    );
  }

  if (blocker) return <p className="mt-3 rounded-xl border border-dashed border-line bg-sand/20 p-3 text-sm text-ink-soft">{blocker}</p>;

  if (missingSettings.length) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-line bg-sand/20 p-3 text-sm text-ink-soft">
        За товарителници първо попълни в{" "}
        <Link href="/admin/kurieri" className="font-semibold text-forest hover:underline">
          Куриери → Еконт
        </Link>
        : {missingSettings.join(", ")}.
      </p>
    );
  }

  const input = (key: "weight" | "packCount" | "cod", label: string, mode: "decimal" | "numeric") => (
    <div>
      <label htmlFor={`${uid}-${key}`} className="mb-1 block text-xs font-medium text-ink-soft">
        {label}
      </label>
      <input
        id={`${uid}-${key}`}
        inputMode={mode}
        value={o[key]}
        onChange={(e) => {
          setO({ ...o, [key]: e.target.value });
          setQuote(null);
        }}
        className="field h-10 text-sm tabular-nums"
      />
    </div>
  );

  return (
    <div className="mt-4 rounded-xl border border-line bg-sand/30 p-4">
      {testBadge}
      <p className="mb-3 font-semibold">Нова товарителница</p>
      <div className="grid grid-cols-3 gap-2">
        {input("weight", "Тегло (кг)", "decimal")}
        {input("packCount", "Пакети", "numeric")}
        {input("cod", "Наложен платеж (€)", "decimal")}
      </div>
      <label htmlFor={`${uid}-desc`} className="mb-1 mt-3 block text-xs font-medium text-ink-soft">
        Съдържание
      </label>
      <textarea
        id={`${uid}-desc`}
        rows={2}
        maxLength={200}
        value={o.description}
        onChange={(e) => setO({ ...o, description: e.target.value })}
        className="field h-auto py-2 text-sm"
      />

      {pickupPossible && (
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="h-4 w-4 accent-[#1f5c3f]" />
            Заяви куриер да вземе пратката
          </label>
          {pickup && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              между
              <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="field h-9 w-28 text-sm" aria-label="От час" />
              и
              <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="field h-9 w-28 text-sm" aria-label="До час" />
            </div>
          )}
        </div>
      )}

      {quote && (
        <div className="mt-3 rounded-xl bg-paper p-3 text-sm">
          <p className="flex justify-between font-semibold">
            <span>Цена при Еконт</span>
            <span className="tabular-nums">
              {quote.price.toFixed(2)} {quote.currency === "EUR" ? "€" : quote.currency}
            </span>
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
            {quote.services.map((s, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{s.description}</span>
                <span className="tabular-nums">{s.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-ink-soft">
            Плаща магазинът: {quote.senderDue.toFixed(2)} · клиентът: {quote.receiverDue.toFixed(2)}
            {quote.expectedDelivery && ` · очаквана доставка ${quote.expectedDelivery.toLocaleDateString("bg-BG")}`}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => act("quote", () => quoteWaybillAction(orderId, options()))} className={btn.sm}>
          {spin("quote") ?? <Calculator className="h-4 w-4" aria-hidden />}
          Изчисли цена
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (live && !confirm("Да създам ли истинска товарителница в Еконт? Тя ще се таксува по договора ти.")) return;
            act("create", () => createWaybillAction(orderId, options()));
          }}
          className={`${btn.sm} border-forest bg-forest text-white hover:bg-forest-deep`}
        >
          {spin("create") ?? <Truck className="h-4 w-4" aria-hidden />}
          Създай товарителница
        </button>
      </div>
      {errorNote}
    </div>
  );
}
