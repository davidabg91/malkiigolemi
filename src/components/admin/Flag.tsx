import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { FlaggedContact } from "@/db/schema";
import { formatDate } from "@/lib/format";

/** Small marker for lists: this customer did not collect a parcel before. */
export function FlagBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-tomato px-2 py-0.5 text-[0.7rem] font-bold text-white ${className}`}>
      <AlertTriangle className="h-3 w-3" aria-hidden />
      Некоректен
    </span>
  );
}

/** Full-width warning shown on top of an order or a customer profile. */
export function FlagBanner({ flag, children }: { flag: FlaggedContact; children?: React.ReactNode }) {
  return (
    <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-tomato bg-tomato/10 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-tomato" aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="text-base font-semibold text-ink">Клиентът е отбелязан като некоректен</p>
        <p className="mt-1 text-ink-soft">
          Отбелязан на {formatDate(flag.createdAt)}
          {flag.note ? ` · ${flag.note}` : ""}
        </p>
        {children}
      </div>
    </div>
  );
}

/**
 * Mark / clear control. `mark` and `clear` are server actions already bound to the customer or order,
 * so the form works the same on both pages.
 */
export function FlagPanel({
  flag,
  mark,
  clear,
}: {
  flag: FlaggedContact | null;
  mark: (formData: FormData) => Promise<void>;
  clear?: () => Promise<void>;
}) {
  if (flag) {
    return (
      <div>
        <h2 className="font-display text-lg font-semibold">Некоректен клиент</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Отбелязан на {formatDate(flag.createdAt)}. При всяка нова поръчка със същия имейл или телефон излиза предупреждение.
        </p>
        {flag.note && <p className="mt-3 whitespace-pre-line rounded-xl bg-sand/70 px-3.5 py-2.5 text-sm">{flag.note}</p>}
        {clear && (
          <form action={clear} className="mt-4">
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold transition hover:border-ink">
              <ShieldCheck className="h-4 w-4 text-forest" aria-hidden />
              Премахни отметката
            </button>
          </form>
        )}
      </div>
    );
  }
  return (
    <form action={mark}>
      <h2 className="font-display text-lg font-semibold">Некоректен клиент</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Отбележи клиента, ако не си е взел пратка. При следваща поръчка със същия имейл или телефон ще излезе предупреждение.
      </p>
      <label htmlFor="flag-note" className="mb-1.5 mt-4 block text-sm font-medium">
        Бележка <span className="font-normal text-ink-soft">(по желание)</span>
      </label>
      <textarea id="flag-note" name="note" rows={2} maxLength={300} placeholder="Напр. не взе пратката от офиса" className="field h-auto py-2.5" />
      <button
        type="submit"
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-tomato bg-paper px-4 text-sm font-semibold text-tomato transition hover:bg-tomato hover:text-white"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden />
        Отбележи като некоректен
      </button>
    </form>
  );
}
