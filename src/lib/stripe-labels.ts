/**
 * What is kept about a card payment besides the columns of `stripe_payments`, and the Bulgarian words for
 * Stripe's codes. No server code here, so pages and scripts can both use it.
 */
export type PaymentDetails = {
  description?: string | null;
  /** The text the customer sees on the bank statement. */
  statement?: string | null;
  receiptUrl?: string | null;
  /** Unix seconds: when the money can be paid out to the shop's bank account. */
  availableOn?: number | null;
  fees?: { amount: number; type: string; description: string | null }[];
  /** Stripe's payment method type: card, link, revolut_pay… */
  method?: string | null;
  card?: {
    brand: string | null;
    expMonth: number;
    expYear: number;
    funding: string | null;
    country: string | null;
    network: string | null;
    issuer: string | null;
    wallet: string | null;
    /** The number of the phone's own card when paid with Apple Pay or Google Pay. */
    walletLast4: string | null;
    threeDS: string | null;
    cvc: string | null;
    postal: string | null;
  } | null;
  phone?: string | null;
  address?: string | null;
  country?: string | null;
  risk?: { level: string | null; score: number | null } | null;
  /** Why a payment did not go through. */
  failure?: { code: string | null; reason: string | null; message: string | null; bank: string | null } | null;
  refunds?: { id: string; amount: number; created: number; reason: string | null; status: string | null }[];
  dispute?: { amount: number; reason: string; status: string; created: number; dueBy: number | null } | null;
  /** The order number or the customer's note, as sent to Stripe with the payment. */
  orderNumber?: string | null;
  note?: string | null;
};

export function parseDetails(json: string): PaymentDetails {
  try {
    const d: unknown = JSON.parse(json);
    return d && typeof d === "object" ? (d as PaymentDetails) : {};
  } catch {
    return {};
  }
}

const pick = (map: Record<string, string>, code: string | null | undefined, fallback = "") => (code ? (map[code] ?? code) : fallback);

const BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  maestro: "Maestro",
  diners: "Diners Club",
  discover: "Discover",
  jcb: "JCB",
  unionpay: "UnionPay",
  cartes_bancaires: "Cartes Bancaires",
  unknown: "Карта",
};
export const cardBrand = (code: string | null | undefined) => pick(BRANDS, code, "Карта");

const WALLETS: Record<string, string> = {
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  samsung_pay: "Samsung Pay",
  link: "Link",
  masterpass: "Masterpass",
  visa_checkout: "Visa Checkout",
  amex_express_checkout: "Amex Express Checkout",
};
export const walletLabel = (code: string | null | undefined) => pick(WALLETS, code);

const METHODS: Record<string, string> = {
  card: "Карта",
  card_present: "Карта на терминал",
  link: "Link",
  revolut_pay: "Revolut Pay",
  paypal: "PayPal",
  klarna: "Klarna",
  sepa_debit: "SEPA директен дебит",
  bancontact: "Bancontact",
  ideal: "iDEAL",
  eps: "EPS",
  p24: "Przelewy24",
  blik: "BLIK",
  amazon_pay: "Amazon Pay",
};
export const methodLabel = (code: string | null | undefined) => pick(METHODS, code, "Неизвестен");

const FUNDING: Record<string, string> = { credit: "Кредитна", debit: "Дебитна", prepaid: "Предплатена", unknown: "Неизвестен вид" };
export const fundingLabel = (code: string | null | undefined) => pick(FUNDING, code);

const CHECKS: Record<string, string> = { pass: "Верен", fail: "Грешен", unavailable: "Банката не го проверява", unchecked: "Не е проверен" };
export const checkLabel = (code: string | null | undefined) => pick(CHECKS, code);

const THREE_DS: Record<string, string> = {
  authenticated: "Потвърдено от клиента",
  attempt_acknowledged: "Опит, приет от банката",
  exempted: "Освободено от потвърждение",
  failed: "Неуспешно",
  not_supported: "Картата не го поддържа",
  processing_error: "Грешка при потвърждението",
};
export const threeDSLabel = (code: string | null | undefined) => pick(THREE_DS, code);

const RISK: Record<string, string> = { normal: "Нормален", elevated: "Повишен", highest: "Висок", not_assessed: "Не е оценен", unknown: "Неизвестен" };
export const riskLabel = (code: string | null | undefined) => pick(RISK, code);

const REFUND_REASONS: Record<string, string> = {
  requested_by_customer: "По искане на клиента",
  duplicate: "Платено два пъти",
  fraudulent: "Измама",
  expired_uncaptured_charge: "Плащането изтече",
};
export const refundReason = (code: string | null | undefined) => pick(REFUND_REASONS, code);

const REFUND_STATUS: Record<string, string> = {
  succeeded: "Върнати",
  pending: "В процес",
  failed: "Неуспешно връщане",
  canceled: "Отменено",
  requires_action: "Чака действие",
};
export const refundStatus = (code: string | null | undefined) => pick(REFUND_STATUS, code);

const DISPUTE_STATUS: Record<string, string> = {
  needs_response: "Чака отговор от магазина",
  under_review: "Банката го разглежда",
  won: "Спечелен",
  lost: "Загубен",
  warning_needs_response: "Запитване, чака отговор",
  warning_under_review: "Запитване, разглежда се",
  warning_closed: "Запитването е затворено",
  prevented: "Предотвратен",
};
export const disputeStatus = (code: string | null | undefined) => pick(DISPUTE_STATUS, code);

const DISPUTE_REASONS: Record<string, string> = {
  fraudulent: "Клиентът казва, че не е плащал",
  product_not_received: "Стоката не е получена",
  product_unacceptable: "Стоката не е каквато се очаква",
  duplicate: "Платено два пъти",
  credit_not_processed: "Не са върнати пари",
  unrecognized: "Клиентът не разпознава плащането",
  subscription_canceled: "Отказан абонамент",
  general: "Друга причина",
};
export const disputeReason = (code: string | null | undefined) => pick(DISPUTE_REASONS, code);

const FEES: Record<string, string> = { stripe_fee: "Такса на Stripe", tax: "Данък върху таксата", application_fee: "Такса на приложение", payment_method_passthrough_fee: "Такса на картовата мрежа" };
export const feeLabel = (code: string | null | undefined) => pick(FEES, code, "Такса");

const DECLINES: Record<string, string> = {
  card_declined: "Банката отказа картата",
  generic_decline: "Банката отказа плащането, без да каже защо",
  do_not_honor: "Банката отказа плащането, без да каже защо",
  insufficient_funds: "Няма достатъчно пари по картата",
  expired_card: "Картата е с изтекъл срок",
  incorrect_cvc: "Грешен код за сигурност (CVC)",
  invalid_cvc: "Грешен код за сигурност (CVC)",
  incorrect_number: "Грешен номер на карта",
  invalid_number: "Грешен номер на карта",
  invalid_expiry_month: "Грешен срок на картата",
  invalid_expiry_year: "Грешен срок на картата",
  lost_card: "Картата е обявена за изгубена",
  stolen_card: "Картата е обявена за открадната",
  pickup_card: "Банката е спряла картата",
  restricted_card: "Картата е ограничена от банката",
  card_not_supported: "Картата не може да се ползва за такова плащане",
  currency_not_supported: "Картата не може да плаща в евро",
  transaction_not_allowed: "Банката не разрешава това плащане с картата",
  card_velocity_exceeded: "Надхвърлен е лимитът на картата",
  withdrawal_count_limit_exceeded: "Надхвърлен е лимитът на картата",
  processing_error: "Грешка при обработката, клиентът може да опита отново",
  try_again_later: "Временен отказ, клиентът може да опита отново",
  authentication_required: "Нужно е потвърждение в банковото приложение",
  payment_intent_authentication_failure: "Клиентът не потвърди плащането в банковото приложение",
  fraudulent: "Спряно като съмнително",
  highest_risk_level: "Спряно от Stripe като много рисково",
  elevated_risk_level: "Спряно от Stripe като рисково",
  rule: "Спряно от правило за сигурност в Stripe",
  merchant_blacklist: "Спряно от списъка със забранени в Stripe",
  issuer_not_available: "Банката на клиента не отговори",
  call_issuer: "Банката отказа, клиентът трябва да ѝ се обади",
  not_permitted: "Банката не разрешава плащането",
  service_not_allowed: "Банката не разрешава плащането",
  invalid_account: "Картата или сметката е невалидна",
  invalid_amount: "Банката не приема тази сума",
};

/** Why a payment failed, in plain words; falls back to Stripe's own (English) sentence. */
export function failureText(f: NonNullable<PaymentDetails["failure"]>) {
  const known = (f.reason && DECLINES[f.reason]) || (f.code && DECLINES[f.code]);
  return known || f.message || f.reason || f.code || "Неизвестна причина";
}

const regions = new Intl.DisplayNames(["bg"], { type: "region" });
export function countryName(code: string | null | undefined) {
  if (!code) return "";
  try {
    return regions.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "Visa •••• 4242 · Apple Pay", the one-line summary of how it was paid. */
export function methodSummary(last4: string | null, d: PaymentDetails) {
  if (!d.card) return d.method ? methodLabel(d.method) : "";
  const card = `${cardBrand(d.card.brand)}${last4 ? ` •••• ${last4}` : ""}`;
  const wallet = walletLabel(d.card.wallet);
  return wallet ? `${card} · ${wallet}` : card;
}
