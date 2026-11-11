import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Change against the previous period of the same length. Good news is green, bad news red, and each
 * carries an arrow, so the meaning never rests on colour alone. `lowerIsBetter` flips it for cancellations.
 */
export function Delta({ now, prev, lowerIsBetter = false }: { now: number; prev: number | null; lowerIsBetter?: boolean }) {
  if (prev == null) return null;
  if (prev === 0 && now === 0) return <p className="mt-2 text-xs text-ink-soft">Без промяна</p>;
  if (prev === 0) return <p className="mt-2 text-xs text-ink-soft">Няма данни за предходния период</p>;
  const change = (now - prev) / prev;
  const flat = Math.abs(change) < 0.005;
  const good = lowerIsBetter ? change < 0 : change > 0;
  const Icon = flat ? Minus : change > 0 ? TrendingUp : TrendingDown;
  return (
    <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${flat ? "text-ink-soft" : good ? "text-forest" : "text-tomato"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {flat ? "Без промяна" : `${change > 0 ? "+" : "−"}${Math.abs(Math.round(change * 100))}%`}
      <span className="font-normal text-ink-soft">спрямо предходния период</span>
    </p>
  );
}

export function StatTile({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: ReactNode }) {
  return (
    <li className="rounded-card bg-paper p-5 shadow-soft">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {children}
    </li>
  );
}

export type BarRow = { key: string; label: string; sub?: string; value: number; href?: string };

/** Ranked horizontal bars: one hue, the number always written out next to its bar. */
export function BarList({ rows, format = String, empty = "Няма данни за този период." }: { rows: BarRow[]; format?: (n: number) => string; empty?: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (max === 0) return <p className="py-6 text-center text-sm text-ink-soft">{empty}</p>;
  return (
    <ol className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              <span className="mr-2 text-xs tabular-nums text-ink-soft">{i + 1}.</span>
              {r.href ? (
                <Link href={r.href} className="font-medium hover:text-forest hover:underline">
                  {r.label}
                </Link>
              ) : (
                <span className="font-medium">{r.label}</span>
              )}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {format(r.value)}
              {r.sub && <span className="ml-1.5 text-xs font-normal text-ink-soft">{r.sub}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-[4px] bg-sand">
            <div className="h-2 rounded-[4px] bg-forest" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export type ColumnPoint = { key: string; label: string; value: number; tip: string };

/**
 * Vertical bars from a common baseline. Every column is a keyboard-focusable hit area as tall as the plot,
 * and shows its exact figures on hover or focus.
 */
export function Columns({ points, labelEvery, height = "h-44" }: { points: ColumnPoint[]; labelEvery?: number; height?: string }) {
  const max = Math.max(0, ...points.map((p) => p.value));
  const every = labelEvery ?? Math.max(1, Math.ceil(points.length / 6));
  return (
    <div>
      <div className={`flex items-end gap-[2px] border-b border-line ${height}`} role="list">
        {points.map((p, i) => {
          const edge = i < points.length * 0.25 ? "left-0" : i > points.length * 0.75 ? "right-0" : "left-1/2 -translate-x-1/2";
          return (
            <div key={p.key} role="listitem" tabIndex={0} aria-label={`${p.label}: ${p.tip}`} className="group relative flex h-full min-w-0 flex-1 items-end rounded-t-[4px] outline-none hover:bg-sand/70 focus-visible:bg-sand/70">
              <div
                className="w-full rounded-t-[4px] bg-forest transition-opacity group-hover:opacity-80"
                style={{ height: max > 0 && p.value > 0 ? `${Math.max(2, (p.value / max) * 100)}%` : "0%" }}
              />
              <div className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-cream shadow-lift group-hover:block group-focus-visible:block ${edge}`}>
                <span className="font-semibold">{p.label}</span> · {p.tip}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[0.7rem] text-ink-soft" aria-hidden>
        {points.map((p, i) => (
          <span key={p.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {i % every === 0 ? p.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
