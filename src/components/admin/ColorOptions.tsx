"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { ColorDot } from "@/components/product/ColorTag";
import { cleanColors, COLOR_PRESETS, MAX_COLOR_LENGTH, MAX_COLORS } from "@/lib/product-colors";

/**
 * The colours a product is sold in, in the admin's product form: tap ready-made ones or type any other name.
 * Left empty, the product has no choice of colour. Submitted as JSON in the hidden `colors` field.
 */
export function ColorOptions({ initial }: { initial: string[] }) {
  const uid = useId();
  const [colors, setColors] = useState(() => cleanColors(initial));
  const [typed, setTyped] = useState("");
  const full = colors.length >= MAX_COLORS;
  const has = (name: string) => colors.some((c) => c.toLocaleLowerCase("bg") === name.toLocaleLowerCase("bg"));

  const addTyped = () => {
    // Several at once, separated by commas: "червен, син, зелен".
    setColors((old) => cleanColors([...old, ...typed.split(/[,;]/)]));
    setTyped("");
  };

  return (
    <div className="sm:col-span-2">
      <input type="hidden" name="colors" value={JSON.stringify(colors)} />
      <p className="text-sm text-ink-soft">
        По желание. Ако продуктът се предлага в няколко цвята, отбележи ги и клиентът ще избира цвят при поръчка. Остави празно за продукт без избор на цвят.
      </p>

      {colors.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Избрани цветове">
          {colors.map((c) => (
            <li key={c} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest pl-3.5 pr-1 text-sm font-medium text-white">
              <ColorDot name={c} className="h-4 w-4" />
              {c}
              <button
                type="button"
                onClick={() => setColors((old) => old.filter((x) => x !== c))}
                className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/20"
                aria-label={`Махни цвят ${c}`}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mb-2 mt-4 text-sm font-medium">Добави цвят</p>
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESETS.filter((p) => !has(p.name)).map((p) => (
          <button
            key={p.name}
            type="button"
            disabled={full}
            onClick={() => setColors((old) => cleanColors([...old, p.name]))}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-3.5 text-sm font-medium transition hover:border-forest disabled:opacity-40"
          >
            <ColorDot name={p.name} className="h-4 w-4" />
            {p.name}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <label htmlFor={`${uid}-typed`} className="sr-only">
          Друг цвят
        </label>
        <input
          id={`${uid}-typed`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            // Enter must add the colour, not save the whole product.
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (typed.trim()) addTyped();
          }}
          maxLength={MAX_COLOR_LENGTH * 4}
          disabled={full}
          placeholder="Друг цвят, напр. Шарен, Мента…"
          className="field flex-1"
        />
        <button
          type="button"
          onClick={addTyped}
          disabled={full || !typed.trim()}
          className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-sand px-4 text-sm font-semibold transition hover:brightness-95 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Добави
        </button>
      </div>
      {full && <p className="mt-2 text-xs text-ink-soft">Най-много {MAX_COLORS} цвята на продукт.</p>}
    </div>
  );
}
