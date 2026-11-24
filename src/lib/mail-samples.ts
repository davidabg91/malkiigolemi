import "server-only";
import { sendMail } from "./mail";
import {
  type Mail,
  type MailOrder,
  orderCancelledMail,
  orderConfirmedMail,
  orderDeliveredMail,
  orderPlacedMail,
  orderReadyMail,
  orderShippedMail,
  shopNewOrderMail,
} from "./order-mail";
import { site } from "./site";
import { backInStockMail } from "./stock-alerts";
import { confirmationHtml, confirmationSubject, shopWithdrawalMail } from "./withdrawals";

/** A made-up order, close to a real one, for previewing the e-mails. */
const sampleOrder: MailOrder = {
  id: 0,
  number: "LM-PRIMER25",
  name: "Мария Иванова",
  phone: "0888 123 456",
  email: "maria@example.com",
  delivery: "office",
  courier: "econt",
  officeName: "Еконт, Плевен — Сторгозия",
  city: "Плевен",
  address: "",
  note: "Моля, обадете се преди изпращане.",
  payment: "cod",
  shipping: 350,
  discount: 100,
  pointsUsed: 100,
  total: 3460,
  trackingNumber: "1051234567890",
  items: [
    { name: "Кафе на зърна Lavazza Qualità Oro 1 кг", qty: 1, price: 2390 },
    { name: "Паста De Cecco Spaghetti №12 500 г", qty: 2, price: 410 },
  ],
};

const samplePickup: MailOrder = { ...sampleOrder, delivery: "store", courier: null, officeName: null, shipping: 0, total: 3110, trackingNumber: null };
const samplePaid: MailOrder = { ...sampleOrder, payment: "card" };

const sampleWithdrawal = {
  orderNumber: sampleOrder.number,
  name: sampleOrder.name,
  email: sampleOrder.email,
  details: "Паста De Cecco Spaghetti №12 500 г × 2",
  createdAt: new Date(),
};

/** Every e-mail the shop sends, filled with the sample data, in the order a customer would meet them. */
function samples(): Mail[] {
  const back = backInStockMail("Кафе на зърна Lavazza Qualità Oro 1 кг", `${site.url}/produkti`);
  return [
    orderPlacedMail(sampleOrder),
    orderConfirmedMail(sampleOrder),
    orderShippedMail(sampleOrder),
    { ...orderReadyMail(samplePickup), subject: `${orderReadyMail(samplePickup).subject} (при вземане от магазина)` },
    orderDeliveredMail(sampleOrder),
    orderCancelledMail(sampleOrder, "none"),
    { ...orderCancelledMail(samplePaid, "done"), subject: `${orderCancelledMail(samplePaid, "done").subject} (платена с карта)` },
    { subject: confirmationSubject(sampleWithdrawal), html: confirmationHtml(sampleWithdrawal) },
    back,
    { ...shopNewOrderMail(sampleOrder), subject: `${shopNewOrderMail(sampleOrder).subject} (до магазина)` },
    { ...shopWithdrawalMail(sampleWithdrawal, true), subject: `${shopWithdrawalMail(sampleWithdrawal, true).subject} (до магазина)` },
  ];
}

/** Sends each sample to one address, marked "[Пример]". Returns how many went out. */
export async function sendSampleMails(to: string) {
  let sent = 0;
  for (const m of samples()) {
    if (await sendMail(to, `[Пример] ${m.subject}`, m.html)) sent += 1;
  }
  return { sent, total: samples().length };
}
