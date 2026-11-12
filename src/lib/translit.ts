/**
 * Bulgarian <-> Latin transliteration and search matching utilities.
 * Based on the official Bulgarian Transliteration Act (Закон за транслитерацията)
 * with bidirectional phonetic mapping for fuzzy search matching.
 */

const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};

const LAT_MULTI: [string, string][] = [
  ["sht", "щ"],
  ["tch", "ч"],
  ["sh", "ш"],
  ["ch", "ч"],
  ["zh", "ж"],
  ["ts", "ц"],
  ["tz", "ц"],
  ["yu", "ю"],
  ["ya", "я"],
  ["iu", "ю"],
  ["ia", "я"],
  ["qu", "кв"],
  ["dj", "дж"],
  ["ck", "к"],
];

const LAT_SINGLE: Record<string, string> = {
  a: "а", b: "б", c: "ц", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "й",
  k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "я", r: "р", s: "с", t: "т",
  u: "у", v: "в", w: "в", x: "кс", y: "й", z: "з",
};

export const capitalize = (s: string) =>
  s.replace(/(^|\s)(\S)/g, (_, gap: string, c: string) => gap + c.toUpperCase());

/**
 * Transliterates Cyrillic text to Latin.
 * Returns primary official transliteration and common spelling variants
 * (e.g. ц -> ts / c, ъ -> a / u, ю -> yu / iu, я -> ya / ia).
 */
export function cyrillicToLatinVariants(text: string): string[] {
  const lower = text.toLowerCase();
  let primary = "";
  let variant = "";
  let hasVariant = false;

  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (ch in CYR_TO_LAT) {
      const lat = CYR_TO_LAT[ch];
      primary += lat;
      if (ch === "ц") {
        variant += "c";
        hasVariant = true;
      } else if (ch === "ъ") {
        variant += "u";
        hasVariant = true;
      } else if (ch === "я") {
        variant += "ia";
        hasVariant = true;
      } else if (ch === "ю") {
        variant += "iu";
        hasVariant = true;
      } else {
        variant += lat;
      }
    } else {
      primary += ch;
      variant += ch;
    }
  }

  const results = [primary];
  if (hasVariant && variant !== primary) {
    results.push(variant);
  }
  return results;
}

/**
 * Transliterates Latin text to Cyrillic.
 * Handles digraphs/trigraphs (sht, sh, ch, zh, ts, tz, yu, ya) and common phonetic variants.
 */
export function latinToCyrillicVariants(text: string): string[] {
  const lower = text.toLowerCase();
  let primary = "";
  let i = 0;
  while (i < lower.length) {
    let matched = false;
    for (const [latin, cyr] of LAT_MULTI) {
      if (lower.startsWith(latin, i)) {
        primary += cyr;
        i += latin.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const ch = lower[i];
      primary += LAT_SINGLE[ch] ?? ch;
      i++;
    }
  }

  const results = new Set<string>([primary]);

  // Variant: 'c' as 'к' when not 'ch', 'ck', or 'tz' (e.g. "cristian", "cosmetics")
  if (/[^t]c[^hk]|^c[^hk]/i.test(lower)) {
    const withK = primary.replace(/ц/g, "к");
    if (withK !== primary) results.add(withK);
  }

  // Variant: Bulgarian names ending in -ar often have -ър in Bulgarian (димитър, петър, божидар)
  if (/([тпд])ар($|[^\p{L}])/u.test(primary)) {
    results.add(primary.replace(/([тпд])ар($|[^\p{L}])/gu, "$1ър$2"));
  }

  return [...results];
}

/**
 * Generates all casing and transliteration forms for search matching.
 * SQLite's LIKE is case-insensitive for ASCII [a-z], but case-sensitive for Cyrillic,
 * so we provide lower, UPPER, and Capitalized forms for all variants.
 */
export function searchVariants(raw: string): string[] {
  const text = raw.trim().replace(/[%_]/g, "");
  if (!text) return [];

  const rawVariants = new Set<string>();
  rawVariants.add(text.toLowerCase());

  const hasCyrillic = /[\u0400-\u04FF]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);

  if (hasCyrillic) {
    for (const v of cyrillicToLatinVariants(text)) {
      rawVariants.add(v.toLowerCase());
    }
  }

  if (hasLatin) {
    for (const v of latinToCyrillicVariants(text)) {
      rawVariants.add(v.toLowerCase());
    }
  }

  const forms = new Set<string>();
  for (const v of rawVariants) {
    if (!v) continue;
    forms.add(v);
    forms.add(v.toUpperCase());
    forms.add(capitalize(v));
  }

  return [...forms];
}

/**
 * Checks if target strings contain the query in either Cyrillic or Latin script.
 * Useful for in-memory array filtering (e.g. in /admin/potrebiteli).
 */
export function matchesSearch(targets: (string | null | undefined)[], query: string): boolean {
  const q = query.trim().replace(/[%_]/g, "");
  if (!q) return true;
  const forms = searchVariants(q).map((f) => f.toLowerCase());
  const uniqueForms = [...new Set(forms)];
  const haystack = targets.filter(Boolean).join(" ").toLowerCase();
  return uniqueForms.some((f) => haystack.includes(f));
}
