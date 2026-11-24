import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, type Order, type OrderItem } from "@/db/schema";
import { courierName } from "./couriers";
import { boxnowTrackingUrl } from "./boxnow";
import { econtTrackingUrl } from "./econt";
import { formatPrice } from "./format";
import { escapeHtml, mailLayout, sendMail } from "./mail";
import { notifyAdminsNewOrder } from "./push";
import { COMPANY, DELIVERY_METHODS, site, STORE, WITHDRAWAL_DAYS } from "./site";
import { lineName } from "./product-colors";

/** An order as the e-mails need it; real ones come from the database, samples are made up. */
export type MailOrder = Pick<
  Order,
  "id" | "number" | "name" | "phone" | "email" | "delivery" | "courier" | "officeName" | "city" | "address" | "note" | "payment" | "shipping" | "discount" | "pointsUsed" | "total" | "trackingNumber"
> & { items: (Pick<OrderItem, "name" | "qty" | "price"> & { color?: string | null; deliveryTime?: string | null })[] };
type OrderWithItems = MailOrder;
export type Mail = { subject: string; html: string };

const loadOrder = (id: number) => db.query.orders.findFirst({ where: eq(orders.id, id), with: { items: true } });

const muted = "color:#5c5f62;font-size:13px";
const link = (href: string, text: string) => `<a href="${escapeHtml(href)}" style="color:#33484b">${escapeHtml(text)}</a>`;

function deliveryLine(o: OrderWithItems) {
  if (o.delivery === "store") return `Вземане от магазина: ${STORE.address}`;
  const method = DELIVERY_METHODS.find((d) => d.id === o.delivery)?.label ?? o.delivery;
  const courier = courierName(o.courier);
  const where = o.officeName || [o.city, o.address].filter(Boolean).join(", ");
  return `${method}${courier ? ` с ${courier}` : ""}: ${where}`;
}

function paymentLine(o: OrderWithItems) {
  if (o.delivery === "store") return "При вземане от магазина";
  return o.payment === "card" ? "С карта онлайн" : "Наложен платеж (в брой или с карта при куриера)";
}

function itemsTable(o: OrderWithItems) {
  const row = (left: string, right: string, strong = false) =>
    `<tr><td style="padding:6px 0;${strong ? "font-weight:bold" : ""}">${left}</td><td style="padding:6px 0;text-align:right;white-space:nowrap;${strong ? "font-weight:bold" : ""}">${right}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:15px;margin:12px 0">
${o.items.map((i) => row(`${escapeHtml(lineName(i.name, i.color))} × ${i.qty}${i.deliveryTime ? `<br><span style="font-size:13px;color:#5c5f62">Срок за доставка: ${escapeHtml(i.deliveryTime)}</span>` : ""}`, formatPrice(i.price * i.qty))).join("")}
${row("Доставка", o.shipping === 0 ? "Безплатно" : formatPrice(o.shipping))}
${o.discount > 0 ? row(`Отстъпка с ${o.pointsUsed} точки`, `−${formatPrice(o.discount)}`) : ""}
${row("Общо", formatPrice(o.total), true)}
</table>`;
}

const companyLine = () =>
  `<p style="${muted}">${escapeHtml(COMPANY.name)}, ЕИК ${escapeHtml(COMPANY.eik)}, ${escapeHtml(COMPANY.address)} · ${escapeHtml(site.email)} · ${escapeHtml(site.phone)}</p>`;

/** Trader details and the consumer's key rights, which belong in the confirmation of a distance contract (ЗЗП чл. 51). */
function legalFooter() {
  return `<p style="${muted};margin-top:24px">Можеш да се откажеш от покупката в ${WITHDRAWAL_DAYS}-дневен срок от получаването, без да посочваш причина: ${link(`${site.url}/otkaz`, "Откажете се от договора тук")}. Стоките са с 2-годишна законова гаранция за съответствие. ${link(`${site.url}/usloviya`, "Общи условия")} · ${link(`${site.url}/poveritelnost`, "Поверителност")}</p>
${companyLine()}`;
}

const firstName = (o: MailOrder) => escapeHtml(o.name.split(" ")[0]);
/** The order's own page: its status, the courier's tracking and the details, open without an account. */
const orderPage = (o: MailOrder, label = "Виж поръчката") => ({ href: `${site.url}/porachka/${encodeURIComponent(o.number)}`, label });

export function orderPlacedMail(o: MailOrder): Mail {
  const body = `<p>Здравей, ${firstName(o)}! Получихме поръчка <strong>${escapeHtml(o.number)}</strong> и ще ти се обадим на ${escapeHtml(o.phone)} за потвърждение.</p>
${itemsTable(o)}
<p style="margin:0">${escapeHtml(deliveryLine(o))}<br>Плащане: ${escapeHtml(paymentLine(o))}</p>
${o.note ? `<p style="${muted}">Бележка: ${escapeHtml(o.note)}</p>` : ""}`;
  return { subject: `Поръчка ${o.number} е приета`, html: mailLayout("Благодарим за поръчката!", body, orderPage(o), legalFooter()) };
}

export function orderConfirmedMail(o: MailOrder): Mail {
  const pickup = o.delivery === "store";
  const body = `<p>Здравей, ${firstName(o)}! Потвърдихме поръчка <strong>${escapeHtml(o.number)}</strong> и я подготвяме ${pickup ? "за взимане от магазина" : "за изпращане"}.</p>
<p>${escapeHtml(deliveryLine(o))}<br>Плащане: ${escapeHtml(paymentLine(o))}</p>
<p>${pickup ? "Ще ти пишем отново, когато е готова и те чака." : "Ще ти пишем отново, когато я предадем на куриера."}</p>`;
  return { subject: `Поръчка ${o.number} е потвърдена`, html: mailLayout("Поръчката е потвърдена", body, orderPage(o), legalFooter()) };
}

/** A pickup order is ready: the shop's word for "shipped" when nothing travels. */
export function orderReadyMail(o: MailOrder): Mail {
  const body = `<p>Здравей, ${firstName(o)}! Поръчка <strong>${escapeHtml(o.number)}</strong> е готова и те чака в магазина.</p>
<p>${escapeHtml(STORE.address)} — ${link(STORE.mapsUrl, "виж на картата")}<br>Работно време: ${escapeHtml(site.workHours.replace(/\s*\(.*\)$/, ""))}</p>
${o.payment === "card" ? "" : `<p>При взимане плащаш ${escapeHtml(formatPrice(o.total))}.</p>`}`;
  return { subject: `Поръчка ${o.number} те чака в магазина`, html: mailLayout("Поръчката те чака", body, orderPage(o), legalFooter()) };
}

export function shopNewOrderMail(o: MailOrder): Mail {
  const shop = `<p><strong>${escapeHtml(o.name)}</strong> · ${escapeHtml(o.phone)} · ${escapeHtml(o.email)}</p>
${itemsTable(o)}
<p>${escapeHtml(deliveryLine(o))}<br>Плащане: ${escapeHtml(paymentLine(o))}</p>
${o.note ? `<p>Бележка: ${escapeHtml(o.note)}</p>` : ""}`;
  return {
    subject: `Нова поръчка ${o.number} — ${formatPrice(o.total)}`,
    html: mailLayout("Нова поръчка", shop, { href: `${site.url}/admin/porachki/${o.id}`, label: "Отвори поръчката" }),
  };
}

export function orderShippedMail(o: MailOrder): Mail {
  const tracking = o.trackingNumber
    ? `<p>Товарителница: <strong>${escapeHtml(o.trackingNumber)}</strong>${
        o.courier === "econt"
          ? ` — ${link(econtTrackingUrl(o.trackingNumber), "проследи пратката")}`
          : o.courier === "boxnow"
            ? ` — ${link(boxnowTrackingUrl(o.trackingNumber), "проследи пратката")}`
            : ""
      }</p>`
    : "";
  const body = `<p>Здравей, ${firstName(o)}! Поръчка <strong>${escapeHtml(o.number)}</strong> е изпратена.</p>
<p>${escapeHtml(deliveryLine(o))}</p>
${tracking}
${o.payment === "card" ? "" : `<p>При получаване плащаш ${escapeHtml(formatPrice(o.total))}. Можеш да прегледаш пратката, преди да платиш.</p>`}`;
  return { subject: `Поръчка ${o.number} е изпратена`, html: mailLayout("Поръчката ти пътува", body, orderPage(o, "Проследи поръчката"), legalFooter()) };
}

export function orderDeliveredMail(o: MailOrder): Mail {
  const pickup = o.delivery === "store";
  const body = `<p>Здравей, ${firstName(o)}! Поръчка <strong>${escapeHtml(o.number)}</strong> е ${pickup ? "взета от магазина" : "доставена"}. Благодарим ти, че пазарува от нас!</p>
<p>Ако имаш профил при нас, ще се радваме да оцениш продуктите на страниците им. А ако нещо не е наред с поръчката, пиши ни на ${escapeHtml(site.email)} или се обади на ${escapeHtml(site.phone)}.</p>`;
  return {
    subject: `Поръчка ${o.number} е ${pickup ? "взета" : "доставена"}`,
    html: mailLayout(pickup ? "Поръчката е взета" : "Поръчката е доставена", body, orderPage(o), legalFooter()),
  };
}

/**
 * `refund` says what happened to money paid by card: "done" when it has gone back, "coming" when the shop
 * still has to return it, "none" when nothing was paid.
 */
export function orderCancelledMail(o: MailOrder, refund: "done" | "coming" | "none"): Mail {
  const money =
    refund === "done"
      ? `<p>Сумата ${escapeHtml(formatPrice(o.total))} е върната по картата, с която плати. Банката я показва до няколко работни дни.</p>`
      : refund === "coming"
        ? `<p>Платената сума ${escapeHtml(formatPrice(o.total))} ще бъде върната по картата, с която плати. Пиши ни, ако не я получиш до няколко дни.</p>`
        : "";
  const body = `<p>Здравей, ${firstName(o)}! Поръчка <strong>${escapeHtml(o.number)}</strong> е отказана и няма да бъде изпратена.</p>
${money}
${o.pointsUsed > 0 ? `<p>Използваните ${o.pointsUsed} точки са върнати в профила ти.</p>` : ""}
<p>Ако това е грешка или имаш въпроси, пиши ни на ${escapeHtml(site.email)} или се обади на ${escapeHtml(site.phone)}.</p>`;
  return { subject: `Поръчка ${o.number} е отказана`, html: mailLayout("Поръчката е отказана", body, orderPage(o), `<div style="margin-top:24px">${companyLine()}</div>`) };
}

/** "Получихме поръчката ти" to the customer, and a short note (and a phone notification) to the shop. Never throws. */
export async function sendOrderPlaced(orderId: number) {
  const o = await loadOrder(orderId).catch(() => undefined);
  if (!o) return;
  const toCustomer = orderPlacedMail(o);
  await sendMail(o.email, toCustomer.subject, toCustomer.html);
  const toShop = shopNewOrderMail(o);
  await sendMail(site.email, toShop.subject, toShop.html, o.email);
  await notifyAdminsNewOrder(orderId);
}

/** The e-mail for the status the order has now, or null when that step is not announced by e-mail. */
export function orderStatusMail(o: MailOrder & Pick<Order, "status" | "source" | "paidAt" | "refundedAt">): Mail | null {
  const pickup = o.delivery === "store";
  // An order gathered from the Facebook group is followed in the group's chat; only its parcel is announced here.
  if (o.source === "facebook") return o.status === "shipped" && !pickup ? orderShippedMail(o) : null;
  switch (o.status) {
    case "confirmed":
      return orderConfirmedMail(o);
    case "shipped":
      return pickup ? orderReadyMail(o) : orderShippedMail(o);
    case "delivered":
      return orderDeliveredMail(o);
    case "cancelled":
      // A card order that was never paid got no "order received" e-mail either (it waits for the payment),
      // so its customer is not written to about an order they were never told of.
      if (o.payment === "card" && !o.paidAt) return null;
      return orderCancelledMail(o, o.refundedAt ? "done" : o.paidAt ? "coming" : "none");
    default:
      return null;
  }
}

/**
 * Tells the customer by e-mail where the order has got to: confirmed, on its way (or waiting in the shop),
 * delivered, cancelled. Call it after the status has changed (and after a refund was tried). Never throws.
 */
export async function sendOrderStatus(orderId: number) {
  const o = await loadOrder(orderId).catch(() => undefined);
  if (!o?.email) return;
  const mail = orderStatusMail(o);
  if (mail) await sendMail(o.email, mail.subject, mail.html);
}
