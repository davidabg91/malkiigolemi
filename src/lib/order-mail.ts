import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, type Order, type OrderItem } from "@/db/schema";
import { courierName } from "./couriers";
import { econtTrackingUrl } from "./econt";
import { formatPrice } from "./format";
import { escapeHtml, mailLayout, sendMail } from "./mail";
import { COMPANY, DELIVERY_METHODS, site, STORE, WITHDRAWAL_DAYS } from "./site";

/** An order as the e-mails need it; real ones come from the database, samples are made up. */
export type MailOrder = Pick<
  Order,
  "id" | "number" | "name" | "phone" | "email" | "delivery" | "courier" | "officeName" | "city" | "address" | "note" | "payment" | "shipping" | "discount" | "pointsUsed" | "total" | "trackingNumber"
> & { items: Pick<OrderItem, "name" | "qty" | "price">[] };
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
${o.items.map((i) => row(`${escapeHtml(i.name)} × ${i.qty}`, formatPrice(i.price * i.qty))).join("")}
${row("Доставка", o.shipping === 0 ? "Безплатно" : formatPrice(o.shipping))}
${o.discount > 0 ? row(`Отстъпка с ${o.pointsUsed} точки`, `−${formatPrice(o.discount)}`) : ""}
${row("Общо", formatPrice(o.total), true)}
</table>`;
}

/** Trader details and the consumer's key rights, which belong in the confirmation of a distance contract (ЗЗП чл. 51). */
function legalFooter() {
  return `<p style="${muted};margin-top:24px">Можеш да се откажеш от покупката в ${WITHDRAWAL_DAYS}-дневен срок от получаването, без да посочваш причина: ${link(`${site.url}/otkaz`, "Откажете се от договора тук")}. Стоките са с 2-годишна законова гаранция за съответствие. ${link(`${site.url}/usloviya`, "Общи условия")} · ${link(`${site.url}/poveritelnost`, "Поверителност")}</p>
<p style="${muted}">${escapeHtml(COMPANY.name)}, ЕИК ${escapeHtml(COMPANY.eik)}, ${escapeHtml(COMPANY.address)} · ${escapeHtml(site.email)} · ${escapeHtml(site.phone)}</p>`;
}

export function orderPlacedMail(o: MailOrder): Mail {
  const body = `<p>Здравей, ${escapeHtml(o.name.split(" ")[0])}! Получихме поръчка <strong>${escapeHtml(o.number)}</strong> и ще ти се обадим на ${escapeHtml(o.phone)} за потвърждение.</p>
${itemsTable(o)}
<p style="margin:0">${escapeHtml(deliveryLine(o))}<br>Плащане: ${escapeHtml(paymentLine(o))}</p>
${o.note ? `<p style="${muted}">Бележка: ${escapeHtml(o.note)}</p>` : ""}`;
  return { subject: `Поръчка ${o.number} е приета`, html: mailLayout("Благодарим за поръчката!", body, { href: `${site.url}/profil`, label: "Моите поръчки" }, legalFooter()) };
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
        o.courier === "econt" ? ` — ${link(econtTrackingUrl(o.trackingNumber), "проследи пратката")}` : ""
      }</p>`
    : "";
  const body = `<p>Здравей, ${escapeHtml(o.name.split(" ")[0])}! Поръчка <strong>${escapeHtml(o.number)}</strong> е изпратена.</p>
<p>${escapeHtml(deliveryLine(o))}</p>
${tracking}
${o.payment === "card" ? "" : `<p>При получаване плащаш ${escapeHtml(formatPrice(o.total))}. Можеш да прегледаш пратката, преди да платиш.</p>`}`;
  return { subject: `Поръчка ${o.number} е изпратена`, html: mailLayout("Поръчката ти пътува", body, { href: `${site.url}/profil`, label: "Проследи в профила" }, legalFooter()) };
}

/** "Получихме поръчката ти" to the customer, and a short note to the shop. Never throws. */
export async function sendOrderPlaced(orderId: number) {
  const o = await loadOrder(orderId).catch(() => undefined);
  if (!o) return;
  const toCustomer = orderPlacedMail(o);
  await sendMail(o.email, toCustomer.subject, toCustomer.html);
  const toShop = shopNewOrderMail(o);
  await sendMail(site.email, toShop.subject, toShop.html, o.email);
}

/** "Поръчката ти пътува", with the tracking link when there is one. Never throws. */
export async function sendOrderShipped(orderId: number) {
  const o = await loadOrder(orderId).catch(() => undefined);
  if (!o || o.delivery === "store") return;
  const mail = orderShippedMail(o);
  await sendMail(o.email, mail.subject, mail.html);
}
