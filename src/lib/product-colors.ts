/**
 * Colours a product is sold in. The admin lists them by name on the product ("Червен", "Син"…); a product
 * with a list makes the customer choose one before it goes in the cart, and the choice travels with the
 * order line. A product without a list is sold as before. The same list is used for sizes ("Малка",
 * "Голяма"), so each entry may have a price of its own.
 */

/** Ready-made colours for the admin's picker; the dot next to the name is painted from here. */
export const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: "Черен", hex: "#1c1c1c" },
  { name: "Бял", hex: "#ffffff" },
  { name: "Сив", hex: "#9aa0a6" },
  { name: "Сребрист", hex: "#c9ccd1" },
  { name: "Бежов", hex: "#dccbb0" },
  { name: "Кафяв", hex: "#7a5236" },
  { name: "Червен", hex: "#d6332c" },
  { name: "Бордо", hex: "#7b1e2b" },
  { name: "Розов", hex: "#f28cb1" },
  { name: "Оранжев", hex: "#f28a1e" },
  { name: "Жълт", hex: "#f5cf2e" },
  { name: "Златист", hex: "#c9a23f" },
  { name: "Зелен", hex: "#3d9a50" },
  { name: "Тъмнозелен", hex: "#1f5c3f" },
  { name: "Тюркоаз", hex: "#2bb3b1" },
  { name: "Светлосин", hex: "#8ec9f0" },
  { name: "Син", hex: "#2f6fde" },
  { name: "Тъмносин", hex: "#1d2f5e" },
  { name: "Лилав", hex: "#8a4fc7" },
];

export const MAX_COLORS = 20;
export const MAX_COLOR_LENGTH = 30;

const key = (name: string) => name.trim().toLocaleLowerCase("bg");
const HEX = new Map(COLOR_PRESETS.map((c) => [key(c.name), c.hex]));

/** The dot for a colour name; null for a name the shop has no paint for ("Шарен", "Камуфлаж"). */
export const swatchOf = (name: string) => HEX.get(key(name)) ?? null;

/** Ready-made sizes for the admin's picker, next to the colours: the same list holds both. */
export const SIZE_PRESETS = ["Малък", "Среден", "Голям"];

const SIZE_WORDS = new Set(
  "малък малка малко малки среден средна средно средни голям голяма голямо големи най-малък най-голям xxs xs s m l xl xxl xxxl 2xl 3xl 4xl".split(" "),
);

/** Whether the name is a size ("Среден", "Голяма", "XL", "Малък размер") and not a colour. */
export const isSizeName = (name: string) => SIZE_WORDS.has(key(name).replace(/\s*размер$/, ""));

/**
 * What the choice is called for the customer: "цвят" when every entry is a colour the shop has paint for,
 * "размер" when every entry is a size, otherwise "вариант" (models, a mix, colours the shop cannot tell).
 * All three words are masculine, so the sentences around them stay the same. Pass the product's whole list
 * where it is at hand, so one product is called one thing; an order line only has its own name.
 */
export function choiceWord(names: readonly string[] | null | undefined) {
  if (!names?.length || names.every((n) => swatchOf(n))) return "цвят";
  return names.every(isSizeName) ? "размер" : "вариант";
}

/** The same word with a capital letter: "Цвят", "Размер" or "Вариант". */
export function choiceTitle(names: readonly string[] | null | undefined) {
  const word = choiceWord(names);
  return word[0].toLocaleUpperCase("bg") + word.slice(1);
}

/** A tidy list out of anything: trimmed, without repeats, capitalised, within the limits. */
export function cleanColors(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const name = raw.replace(/\s+/g, " ").trim().slice(0, MAX_COLOR_LENGTH);
    if (!name || seen.has(key(name))) continue;
    seen.add(key(name));
    out.push(name[0].toLocaleUpperCase("bg") + name.slice(1));
    if (out.length === MAX_COLORS) break;
  }
  return out;
}

/** A colour with how many of it there are and, when it does not cost what the product does, its regular price in cents. */
export type ColorChoice = { name: string; stock: number; price?: number | null };

const wholeNumber = (v: unknown) => Math.min(99_999, Math.max(0, Math.floor(Number(v) || 0)));

/** A price of its own in cents, or null: nothing, zero and anything that is not a sum mean "as the product". */
const ownPrice = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 10_000_000 ? v : null);

/** A product's colours with their quantities and own prices. A colour without a recorded quantity counts as none left. */
export function colorChoices(p: {
  colors?: readonly string[] | null;
  colorStock?: readonly number[] | null;
  colorPrices?: readonly (number | null)[] | null;
}): ColorChoice[] {
  return (p.colors ?? []).map((name, i) => ({ name, stock: wholeNumber(p.colorStock?.[i]), price: ownPrice(p.colorPrices?.[i]) }));
}

/** The product form's list (`[{ name, stock, price }]`), tidied the way `cleanColors` tidies names. */
export function cleanColorChoices(input: unknown): ColorChoice[] {
  if (!Array.isArray(input)) return [];
  const rows = input.filter(
    (r): r is { name: string; stock?: unknown; price?: unknown } => typeof r === "object" && r !== null && typeof (r as { name?: unknown }).name === "string",
  );
  const first = new Map<string, { stock: number; price: number | null }>();
  for (const r of rows) {
    const k = key(r.name.replace(/\s+/g, " ").trim().slice(0, MAX_COLOR_LENGTH));
    if (!first.has(k)) first.set(k, { stock: wholeNumber(r.stock), price: ownPrice(r.price) });
  }
  return cleanColors(rows.map((r) => r.name)).map((name) => ({ name, stock: first.get(key(name))?.stock ?? 0, price: first.get(key(name))?.price ?? null }));
}

/** What the price helpers need of a product: a card (`colors`) or a row of the table (`colorOptions`). */
type Priced = {
  /** As the customer pays it now: a live promotion is already taken off. */
  price: number;
  oldPrice?: number | null;
  colors?: readonly string[] | null;
  colorOptions?: readonly string[] | null;
  colorPrices?: readonly (number | null)[] | null;
  promoPercent?: number | null;
};

/**
 * A colour's own price as the customer pays it now, or null when the colour costs what the product does.
 * A live promotion comes off it by the same percent as off the product (and with the same rounding as in
 * lib/pricing.ts); the product's hand-written "old price" and its price for quantity do not apply to it.
 */
export function ownColorPrice(p: Priced, color: string | null | undefined): { price: number; oldPrice: number | null } | null {
  if (!color) return null;
  const index = (p.colors ?? p.colorOptions ?? []).findIndex((c) => key(c) === key(color));
  const own = index < 0 ? null : ownPrice(p.colorPrices?.[index]);
  if (own === null) return null;
  const percent = p.promoPercent ?? 0;
  return percent > 0 ? { price: Math.round((own * (100 - percent)) / 100), oldPrice: own } : { price: own, oldPrice: null };
}

/** The cheapest and the dearest the product can be bought for across its colours; the same number twice when they all cost the same. */
export function priceRange(p: Priced): { min: number; max: number } {
  const prices = (p.colors ?? p.colorOptions ?? []).map((c) => ownColorPrice(p, c)?.price ?? p.price);
  return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: p.price, max: p.price };
}

/** The colour as the product lists it, whatever the letter case it was asked in; null when it has none such. */
export const matchColor = (options: readonly string[] | null | undefined, wanted: string | null | undefined) =>
  (wanted && options?.find((c) => key(c) === key(wanted))) || null;

/** Ready-made delivery times for the admin's product form; any other text can be typed. */
export const DELIVERY_TIME_PRESETS = ["7 дни", "10 дни", "14 дни", "2–3 работни дни", "3–5 работни дни", "5–7 работни дни", "7–10 работни дни", "10–14 работни дни", "до 30 дни"];
export const MAX_DELIVERY_TIME_LENGTH = 60;

/** An order line's name with its colour: "Тениска M — Червен". */
export const lineName = (name: string, color: string | null | undefined) => (color ? `${name} — ${color}` : name);
