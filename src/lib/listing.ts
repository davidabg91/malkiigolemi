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

/** Product photo size limit. Vercel rejects request bodies over 4.5 MB, so this leaves room for the rest of the form. */
export const MAX_IMAGE_MB = 3;

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
