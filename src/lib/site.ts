/** Everything brand-specific lives here so the shop can be re-skinned for the client in one place. */
export const site = {
  name: "Поръчки за малки и големи",
  tagline: "онлайн магазин",
  /** The shop's own domain, as shown to people (share images and the like). */
  domain: "malkiigolemi.com",
  /** Public address used in e-mails and links. Set SITE_URL when the shop moves to its own domain. */
  url: (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://malkiigolemi.vercel.app")).replace(/\/$/, ""),
  title: "Поръчки за малки и големи — Онлайн магазин за цялото семейство",
  description:
    "Официален онлайн магазин на Facebook общността „Поръчки за малки и големи“. Разнообразие от качествени стоки, дрехи, козметика, хранителни продукти и всичко за дома с бърза и сигурна доставка.",
  phone: "0877 915 191",
  phoneHref: "tel:+359877915191",
  email: "porachkizamalkiigolemi@gmail.com",
  address: "България · Доставка до всяка точка на страната",
  workHours: "Пон – Пет, 9:00 – 18:00 (Поръчки денонощно)",
  announcement: "Официален сайт на Facebook групата „Поръчки за малки и големи“",
  facebookUrl: "https://www.facebook.com/groups/322039525838054",
  facebookGroupName: "Поръчки за малки и големи",
} as const;

/**
 * The trader behind the shop, as the law asks it to be shown (ЗЕТ чл. 4, ЗЗП чл. 47): footer, contacts,
 * terms, privacy policy and the withdrawal confirmation all read it from here.
 */
export const COMPANY = {
  name: "КРИСОНИ ОНЛАЙН ЕООД",
  eik: "208246034",
  /** ДДС номер; null while the company is not VAT-registered. */
  vatNumber: null as string | null,
  manager: "Иванка Петкова",
  address: "гр. Плевен 5800, ж.к. Сторгозия, бл. 13, ет. 5, ап. 26",
} as const;

/** Public bodies a customer can turn to; named in the terms and the privacy policy. */
export const AUTHORITIES = {
  kzp: {
    name: "Комисия за защита на потребителите (КЗП)",
    address: "гр. София 1000, пл. „Славейков“ № 4А",
    phone: "0700 111 22",
    url: "https://kzp.bg",
  },
  kzld: {
    name: "Комисия за защита на личните данни (КЗЛД)",
    address: "гр. София 1592, бул. „Проф. Цветан Лазаров“ № 2",
    url: "https://www.cpdp.bg",
  },
} as const;

/** Days a consumer has to withdraw from a distance contract (ЗЗП чл. 50). */
export const WITHDRAWAL_DAYS = 14;

export const DELIVERY_METHODS = [
  {
    id: "box",
    label: "До автомат",
    hint: "Безплатно с BoxNow · 24/7",
    price: 0,
    addressLabel: "Автомат (име или адрес)",
  },
  {
    id: "office",
    label: "До офис на куриер",
    hint: "Еконт или Спиди, 1–2 работни дни",
    price: 350,
    addressLabel: "Офис на куриер",
  },
  {
    id: "address",
    label: "До адрес",
    hint: "Куриерът носи до вратата",
    price: 490,
    addressLabel: "Улица, номер, вход, етаж",
  },
  {
    id: "store",
    label: "От магазина",
    hint: "Взимаш сам от нашия магазин в Плевен",
    price: 0,
    addressLabel: "Магазин",
  },
] as const;

/** Physical shop used for the "pick up from the store" delivery option. */
const STORE_QUERY = "ул. Анастасия Димитрова 22, ж.к. Сторгозия, Плевен";
export const STORE = {
  city: "Плевен",
  address: "ж.к. Сторгозия, ул. „Анастасия Димитрова“ 22, Плевен",
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_QUERY)}`,
  embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(STORE_QUERY)}&z=16&output=embed`,
} as const;

export type DeliveryId = (typeof DELIVERY_METHODS)[number]["id"];

export function shippingFor(delivery: string, subtotal: number, courier?: string | null) {
  if (delivery === "store") return 0;
  if (delivery === "box" && (!courier || courier === "boxnow")) return 0;
  return DELIVERY_METHODS.find((d) => d.id === delivery)?.price ?? DELIVERY_METHODS[1].price;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Нова",
  confirmed: "Потвърдена",
  shipped: "Изпратена",
  delivered: "Доставена",
  cancelled: "Отказана",
};

/** Flag stripes for the "by origin" tabs; `vertical` for flags striped side by side. */
export const ORIGIN_FLAGS: Record<string, { stripes: string[]; vertical?: boolean }> = {
  IT: { stripes: ["#1B8A4B", "#FFFFFF", "#D63A1F"], vertical: true },
  FR: { stripes: ["#1F3F99", "#FFFFFF", "#D63A2F"], vertical: true },
  GR: { stripes: ["#1F6FB5", "#FFFFFF", "#1F6FB5", "#FFFFFF", "#1F6FB5"] },
  BG: { stripes: ["#FFFFFF", "#00966E", "#D62612"] },
  DE: { stripes: ["#111111", "#DD0000", "#FFCE00"] },
  ES: { stripes: ["#AA151B", "#F1BF00", "#F1BF00", "#AA151B"] },
};

export const ORIGIN_LABELS: Record<string, string> = {
  IT: "Италия",
  GR: "Гърция",
  BG: "България",
  DE: "Германия",
  ES: "Испания",
  FR: "Франция",
};

/** Background / ink pairs for category tiles and pack illustrations. */
export const TONES: Record<string, { bg: string; ink: string; deep: string }> = {
  butter: { bg: "#FFE7A0", ink: "#4A3500", deep: "#F5C73D" },
  mint: { bg: "#CDEBD3", ink: "#0F3D26", deep: "#7CC796" },
  sky: { bg: "#CDE5F6", ink: "#0C3350", deep: "#7DB9E3" },
  peach: { bg: "#FFD6BF", ink: "#5A2408", deep: "#F59A68" },
  lilac: { bg: "#E2D8F7", ink: "#2F1F5C", deep: "#A891E0" },
  rose: { bg: "#FAD3DB", ink: "#5C1226", deep: "#EE8CA1" },
  lime: { bg: "#DDF27A", ink: "#2A3A00", deep: "#B4D334" },
  tomato: { bg: "#FFCDBE", ink: "#5E1404", deep: "#F0532D" },
  cream: { bg: "#F1EDE2", ink: "#14261C", deep: "#D9D2BF" },
};
