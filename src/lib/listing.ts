export const SORTS = {
  // The default: the admin's own arrangement where there is one, otherwise the newest first.
  popular: "Най-нови",
  "price-asc": "Цена: ниска към висока",
  "price-desc": "Цена: висока към ниска",
  discount: "Най-голяма отстъпка",
  name: "Име (А–Я)",
} as const;
export type SortKey = keyof typeof SORTS;

export const PER_PAGE = 24;

/**
 * The largest photo the admin may choose. Vercel rejects request bodies over 4.5 MB, so anything bigger
 * than that is made smaller in the browser before it is sent (see shrink-image.ts).
 */
export const MAX_IMAGE_MB = 10;
/** The largest photo the server takes: what fits in one request next to the rest of the form. */
export const MAX_UPLOAD_MB = 4;

export const PACKS = {
  bag: "Плик / пакет",
  bottle: "Бутилка",
  jar: "Буркан",
  can: "Консерва / кен",
  box: "Кутия",
  carton: "Картонена опаковка",
  tin: "Тенекия",
  bar: "Блокче",
  pack: "Мека опаковка",
  roll: "Рула",
  tube: "Туба",
  spray: "Спрей",
  jug: "Туба с дръжка",
  pump: "Помпа",
} as const;
export type PackKind = keyof typeof PACKS;
