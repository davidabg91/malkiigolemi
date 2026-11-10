import { Check } from "lucide-react";

/** Step tracker for an order; pickup orders end with "Взета" instead of "Доставена". */
export function OrderProgress({ status, pickup }: { status: string; pickup: boolean }) {
  if (status === "cancelled") return null;
  const steps = [
    { id: "new", label: "Приета" },
    { id: "confirmed", label: "Потвърдена" },
    { id: "shipped", label: pickup ? "Готова за вземане" : "Изпратена" },
    { id: "delivered", label: pickup ? "Взета" : "Доставена" },
  ];
  const current = Math.max(0, steps.findIndex((s) => s.id === status));

  return (
    <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Статус на поръчката">
      {steps.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s.id} className="flex flex-col gap-1.5" aria-current={i === current ? "step" : undefined}>
            <span className={`h-1.5 rounded-full ${done ? "bg-forest" : "bg-line"}`} aria-hidden />
            <span className={`flex items-center gap-1 text-[0.72rem] leading-tight sm:text-xs ${done ? "font-semibold text-ink" : "text-ink-soft"}`}>
              {done && <Check className="h-3 w-3 shrink-0 text-forest" aria-hidden />}
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
