"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { ColorDot } from "@/components/product/ColorTag";
import { parseEuro } from "@/lib/format";
import { cleanColorChoices, COLOR_PRESETS, MAX_COLOR_LENGTH, MAX_COLORS, type ColorChoice } from "@/lib/product-colors";

/**
 * The colours (or sizes) a product is sold in, in the admin's product form, each with how many there are
 * of it and, when it costs something else than the product, its own price: tap ready-made ones or type any
 * other name. Left empty, the product has no choice of colour.
 * Submitted as JSON (`[{ name, stock, price }]`, the price in cents or null) in the hidden `colors` field.
 * `onTotal` hears the sum of the quantities, or null when there are no colours, so the form can show it as
 * the product's stock.
 */
export function ColorOptions({ initial, onTotal }: { initial: ColorChoice[]; onTotal?: (total: number | null) => void }) {
  const uid = useId();
  const [colors, setColors] = useState(() => cleanColorChoices(initial));
  // The prices as typed, by colour name: "12,5" stays "12,5" while it is being written.
  const [priceText, setPriceText] = useState<Record<string, string>>(() =>
    Object.fromEntries(cleanColorChoices(initial).flatMap((c) => (c.price ? [[c.name, (c.price / 100).toFixed(2)]] : []))),
  );
  const [typed, setTyped] = useState("");
  const full = colors.length >= MAX_COLORS;
  const has = (name: string) => colors.some((c) => c.name.toLocaleLowerCase("bg") === name.toLocaleLowerCase("bg"));
  const total = colors.reduce((sum, c) => sum + c.stock, 0);

  const update = (next: ColorChoice[]) => {
    const clean = cleanColorChoices(next);
    setColors(clean);
    onTotal?.(clean.length > 0 ? clean.reduce((sum, c) => sum + c.stock, 0) : null);
  };

  const addTyped = () => {
    // Several at once, separated by commas: "червен, син, зелен".
    update([...colors, ...typed.split(/[,;]/).map((name) => ({ name, stock: 0 }))]);
    setTyped("");
  };

  return (
    <div className="sm:col-span-2">
      <input type="hidden" name="colors" value={JSON.stringify(colors)} />
      <p className="text-sm text-ink-soft">
        По желание. Ако продуктът се предлага в няколко цвята или размера, отбележи ги и срещу всеки напиши колко броя има. Клиентът избира при поръчка, а цвят с
        0 броя се показва като изчерпан и не може да се поръча. Ако някой цвят или размер е с различна цена, напиши я срещу него — празно означава цената на
        продукта. Остави списъка празен за продукт без избор.
      </p>

      {colors.length > 0 && (
        <>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line" aria-label="Избрани цветове">
            {colors.map((c) => (
              <li key={c.name} className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
                <ColorDot name={c.name} className="h-5 w-5" />
                <span className="min-w-0 flex-1 basis-24 truncate font-medium">{c.name}</span>
                {c.stock === 0 && <span className="rounded-full bg-tomato/10 px-2 py-0.5 text-xs font-semibold text-tomato">изчерпан</span>}
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <span className="sr-only">Наличност от цвят {c.name}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99999}
                    value={c.stock}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => update(colors.map((x) => (x.name === c.name ? { ...x, stock: Number(e.target.value) } : x)))}
                    className="field h-11 w-24 text-right tabular-nums"
                  />
                  бр
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <span className="sr-only">Цена за {c.name}, ако е различна от цената на продукта</span>
                  <input
                    inputMode="decimal"
                    value={priceText[c.name] ?? ""}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const text = e.target.value;
                      setPriceText((t) => ({ ...t, [c.name]: text }));
                      update(colors.map((x) => (x.name === c.name ? { ...x, price: parseEuro(text) } : x)));
                    }}
                    // The browser stops the save on something that is not a sum, instead of saving no price.
                    pattern=" *[0-9]{1,6}([.,][0-9]{1,2})? *"
                    title="Цена в евро, напр. 12,50. Остави празно за цената на продукта."
                    placeholder="цена"
                    className="field h-11 w-24 text-right tabular-nums"
                  />
                  €
                </label>
                <button
                  type="button"
                  onClick={() => update(colors.filter((x) => x.name !== c.name))}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-tomato"
                  aria-label={`Махни цвят ${c.name}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className={`mt-2 text-sm ${total === 0 ? "font-medium text-tomato" : "text-ink-soft"}`} role={total === 0 ? "alert" : undefined}>
            {total === 0
              ? "Напиши наличност срещу цветовете — с 0 навсякъде продуктът ще се показва като изчерпан."
              : `Общо ${total} бр. Това е наличността на продукта — сборът от цветовете.`}
          </p>
        </>
      )}

      <p className="mb-2 mt-4 text-sm font-medium">Добави цвят</p>
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESETS.filter((p) => !has(p.name)).map((p) => (
          <button
            key={p.name}
            type="button"
            disabled={full}
            onClick={() => update([...colors, { name: p.name, stock: 0 }])}
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
          placeholder="Друг цвят или размер, напр. Шарен, Малка, Голяма…"
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
