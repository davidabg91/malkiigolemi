/**
 * What the shop's own phones can be told about (Админ → Известия). `on` is the setting until the admin
 * chooses otherwise: the things that need an answer or an action are on, the rest are off.
 */
export const ADMIN_NOTICES = [
  { key: "order", label: "Нова поръчка", hint: "Всяка приета поръчка, със сумата и името на клиента.", on: true },
  { key: "chat", label: "Съобщение в чата", hint: "Клиент пише в чата на сайта.", on: true },
  { key: "storePayment", label: "Плащане в магазина", hint: "Плащане с карта през QR кода на касата.", on: true },
  { key: "withdrawal", label: "Отказ от договор", hint: "Клиент подава отказ от покупка; чака потвърждение до края на деня.", on: true },
  { key: "cancel", label: "Отказана поръчка", hint: "Клиент сам отказва поръчката си от профила.", on: true },
  { key: "soldOut", label: "Изчерпан продукт", hint: "С поръчка е продадена последната бройка от продукт.", on: false },
  { key: "review", label: "Нов отзив", hint: "Клиент оставя оценка и отзив за продукт.", on: false },
  { key: "signup", label: "Нова регистрация", hint: "Някой си прави профил в магазина.", on: false },
] as const;

export type AdminNoticeKey = (typeof ADMIN_NOTICES)[number]["key"];
export type AdminNoticePrefs = Record<AdminNoticeKey, boolean>;

export const DEFAULT_ADMIN_NOTICES = Object.fromEntries(ADMIN_NOTICES.map((n) => [n.key, n.on])) as AdminNoticePrefs;
