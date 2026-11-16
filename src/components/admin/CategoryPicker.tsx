"use client";

import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type CategoryOption = { id: number; name: string; children: { id: number; name: string }[] };

type Flat = { id: number; name: string; group: string | null; label: string };

const fold = (s: string) => s.trim().toLocaleLowerCase("bg");

/**
 * Searchable category field for the product form. The admin types to filter; picking a category sets the
 * hidden `categoryId`. A name nobody has yet can be added on the spot — it goes out as `newCategory`, and the
 * server creates it as a new main category when the product is saved.
 */
export function CategoryPicker({
  categories,
  defaultValue,
  invalid,
  inputId,
}: {
  categories: CategoryOption[];
  defaultValue?: number | null;
  invalid?: boolean;
  inputId?: string;
}) {
  const genId = useId();
  const uid = inputId ?? genId;
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const flat = useMemo<Flat[]>(() => {
    const out: Flat[] = [];
    for (const c of categories) {
      out.push({ id: c.id, name: c.name, group: null, label: `${c.name} (общо)` });
      for (const s of c.children) out.push({ id: s.id, name: s.name, group: c.name, label: s.name });
    }
    return out;
  }, [categories]);

  const initial = defaultValue != null ? flat.find((f) => f.id === defaultValue) ?? null : null;
  // The chosen category (existing one) or a new name the admin typed.
  const [chosenId, setChosenId] = useState<number | null>(initial?.id ?? null);
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const chosen = chosenId != null ? flat.find((f) => f.id === chosenId) ?? null : null;
  // What the input shows: while open it holds the search; when closed, the current choice.
  const display = open ? query : chosen ? (chosen.group ? `${chosen.group} › ${chosen.name}` : chosen.name) : newName ? `${newName} (нова)` : "";

  const q = fold(query);
  const matches = q === "" ? flat : flat.filter((f) => fold(f.name).includes(q) || (f.group != null && fold(f.group).includes(q)));
  const exact = q !== "" && flat.some((f) => fold(f.name) === q);
  const canAdd = query.trim().length >= 2 && !exact;
  const total = matches.length + (canAdd ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    // Pointer events, not mouse ones: on iPhone a tap on plain page background sends no mouse events.
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const openList = () => {
    setQuery("");
    setActive(0);
    setOpen(true);
  };

  // Done choosing: the field lets go of the focus, so the next tap on it opens the list afresh
  // (and the phone's keyboard gets out of the way).
  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const pick = (f: Flat) => {
    setChosenId(f.id);
    setNewName("");
    close();
  };

  const addNew = () => {
    const name = query.trim();
    if (name.length < 2) return;
    setNewName(name);
    setChosenId(null);
    close();
  };

  const choose = (i: number) => {
    if (canAdd && i === matches.length) addNew();
    else if (matches[i]) pick(matches[i]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      else setActive((a) => Math.min(a + 1, Math.max(total - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault();
        choose(active);
      }
    } else if (e.key === "Tab") {
      // Moving on to the next field closes the list. Not done on blur: Safari (iPhone included) does not
      // focus a tapped button, so the field's blur looks like leaving and would close the list before the tap lands.
      setOpen(false);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    }
  };

  return (
    <div ref={boxRef} className="relative">
      {/* These go to the server action. Exactly one carries a value. */}
      <input type="hidden" name="categoryId" value={chosen ? chosen.id : ""} />
      <input type="hidden" name="newCategory" value={chosen ? "" : newName} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          ref={inputRef}
          id={`${uid}-search`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${uid}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          className="field pl-10 pr-10"
          placeholder="Търси или добави категория…"
          value={display}
          aria-invalid={invalid ? true : undefined}
          onFocus={openList}
          onChange={(e) => {
            if (!open) setOpen(true);
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
      </div>

      {open && (
        <ul
          id={`${uid}-list`}
          role="listbox"
          // Keeps the focus (and the phone's keyboard) in the search field while a row is tapped.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-paper p-1.5 shadow-lift"
        >
          {matches.map((f, i) => (
            <li key={f.id} role="option" aria-selected={active === i}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(f)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ${active === i ? "bg-lime/40" : ""}`}
              >
                <span className="min-w-0 truncate">
                  {f.group && <span className="text-ink-soft">{f.group} › </span>}
                  <span className={f.group ? "" : "font-medium"}>{f.group ? f.name : `${f.name} (общо)`}</span>
                </span>
                {chosen?.id === f.id && <Check className="h-4 w-4 shrink-0 text-forest" aria-hidden />}
              </button>
            </li>
          ))}

          {canAdd && (
            <li role="option" aria-selected={active === matches.length}>
              <button
                type="button"
                onMouseEnter={() => setActive(matches.length)}
                onClick={addNew}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-forest ${active === matches.length ? "bg-lime/40" : ""}`}
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Добави нова категория „{query.trim()}“
              </button>
            </li>
          )}

          {total === 0 && <li className="px-3 py-2 text-sm text-ink-soft">Няма такава категория.</li>}
        </ul>
      )}

      {newName && !chosen && (
        <p className="mt-1.5 text-xs text-forest">Ще се създаде нова главна категория „{newName}“ при запис.</p>
      )}
    </div>
  );
}
