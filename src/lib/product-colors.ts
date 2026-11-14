/**
 * Colours a product is sold in. The admin lists them by name on the product ("Червен", "Син"…); a product
 * with a list makes the customer choose one before it goes in the cart, and the choice travels with the
 * order line. A product without a list is sold as before.
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

/** The colour as the product lists it, whatever the letter case it was asked in; null when it has none such. */
export const matchColor = (options: readonly string[] | null | undefined, wanted: string | null | undefined) =>
  (wanted && options?.find((c) => key(c) === key(wanted))) || null;

/** An order line's name with its colour: "Тениска M — Червен". */
export const lineName = (name: string, color: string | null | undefined) => (color ? `${name} — ${color}` : name);
