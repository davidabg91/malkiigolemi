export const SORTS = {
  popular: "Препоръчани",
  "price-asc": "Цена: ниска към висока",
  "price-desc": "Цена: висока към ниска",
  new: "Най-нови",
  discount: "Най-голяма отстъпка",
  name: "Име (А–Я)",
} as const;
export type SortKey = keyof typeof SORTS;

export const PER_PAGE = 24;

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
