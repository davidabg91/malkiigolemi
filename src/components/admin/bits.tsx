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

export const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft";
export const td = "px-4 py-3 align-middle";
