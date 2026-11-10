import type { ReactNode } from "react";

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-ink-soft">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card bg-paper shadow-soft ${className}`}>{children}</div>;
}

/** Placeholder while an admin page streams its data in. */
export function AdminSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Зареждане">
      <div className="h-9 w-56 animate-pulse rounded-2xl bg-sand" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-card bg-sand" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-card bg-sand" />
    </div>
  );
}

export const th ="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft";
export const td = "px-4 py-3 align-middle";
