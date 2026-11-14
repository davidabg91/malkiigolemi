"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { setCategoryIcon } from "@/actions/admin";
import { CategoryIcon } from "@/components/ui";
import { CATEGORY_ICON_GROUPS, CATEGORY_ICON_LABELS } from "@/lib/icons";

/**
 * A category's icon as a button: a click opens the whole icon pack to choose from.
 * With `categoryId` the choice is saved at once (the list of categories); without it the choice goes
 * into a hidden `icon` field of the surrounding form (a new category).
 */
export function IconPicker({ value, categoryId, categoryName }: { value: string; categoryId?: number; categoryName?: string }) {
  const [icon, setIcon] = useState(value);
  const [query, setQuery] = useState("");
  // The pack is drawn only while the picker is open: a page of categories has dozens of pickers.
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // A new value from the server (after a save elsewhere) wins over the one chosen here.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setIcon(value);
  }

  const term = query.trim().toLowerCase();
  const groups = CATEGORY_ICON_GROUPS.map((g) => ({
    title: g.title,
    icons: term ? g.icons.filter(([name, label]) => label.toLowerCase().includes(term) || name.toLowerCase().includes(term)) : g.icons,
  })).filter((g) => g.icons.length > 0);

  const choose = (name: string) => {
    dialog.current?.close();
    if (name === icon) return;
    const before = icon;
    setIcon(name);
    if (categoryId === undefined) return;
    start(async () => {
      try {
        await setCategoryIcon(categoryId, name);
        toast.success("Иконата е сменена");
      } catch {
        setIcon(before);
        toast.error("Иконата не беше сменена");
      }
    });
  };

  return (
    <>
      {categoryId === undefined && <input type="hidden" name="icon" value={icon} />}
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          // In the list the button sits inside a <summary>; opening the picker must not toggle the row.
          e.preventDefault();
          e.stopPropagation();
          setQuery("");
          setOpen(true);
          dialog.current?.showModal();
        }}
        className={
          categoryId === undefined
            ? "field flex items-center gap-2.5 text-left"
            : "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink transition raised hover:brightness-[0.96] active:scale-95"
        }
        aria-label={`Смени иконата${categoryName ? ` на ${categoryName}` : ""} (сега: ${CATEGORY_ICON_LABELS[icon] ?? icon})`}
        title="Смени иконата"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <CategoryIcon name={icon} className="h-5 w-5 shrink-0" />}
        {categoryId === undefined && <span className="truncate">{CATEGORY_ICON_LABELS[icon] ?? "Избери икона"}</span>}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        // A click on the backdrop lands on the dialog element itself.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto w-[min(44rem,calc(100vw-2rem))] rounded-3xl bg-paper p-0 text-ink shadow-lift backdrop:bg-ink/50"
      >
        {open && (
        <div className="flex max-h-[min(40rem,calc(100dvh-4rem))] flex-col">
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              Избери икона{categoryName ? ` за „${categoryName}“` : ""}
            </h2>
            <button type="button" onClick={() => dialog.current?.close()} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink" aria-label="Затвори">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="relative px-5 pt-3">
            <Search className="pointer-events-none absolute left-9 top-1/2 mt-1.5 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Enter must not submit the category form the picker sits in.
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Търси икона: кафе, обувки, подарък…"
              aria-label="Търсене на икона"
              className="field pl-11"
            />
          </div>
          <div className="mt-3 flex-1 overflow-y-auto px-5 pb-5">
            {groups.length === 0 && <p className="py-10 text-center text-ink-soft">Няма икона за „{query.trim()}“.</p>}
            {groups.map((g) => (
              <section key={g.title} className="mt-4 first:mt-1">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft">{g.title}</h3>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2">
                  {g.icons.map(([name, label]) => {
                    const current = name === icon;
                    return (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => choose(name)}
                          aria-pressed={current}
                          className={`relative flex h-[4.5rem] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center text-[0.7rem] font-medium leading-tight transition active:scale-95 ${
                            current ? "bg-forest text-white" : "text-ink raised hover:brightness-[0.96]"
                          }`}
                        >
                          <CategoryIcon name={name} className="h-6 w-6 shrink-0" />
                          <span className="line-clamp-1">{label}</span>
                          {current && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
        )}
      </dialog>
    </>
  );
}
