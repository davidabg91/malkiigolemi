import { formatTimestamp } from "./format";
import { escapeHtml, mailLayout } from "./mail";
import { COMPANY, site, STORE, WITHDRAWAL_DAYS } from "./site";

export type WithdrawalStatement = { orderNumber: string; name: string; email: string; details: string | null; createdAt: Date };

/** The statement in the consumer's own words, as it is shown back and kept on record. */
export function statementText(w: WithdrawalStatement) {
  const scope = w.details?.trim() ? `следните стоки: ${w.details.trim()}` : "всички стоки";
  return `С настоящото уведомявам, че се отказвам от сключения договор за покупка на ${scope} по поръчка № ${w.orderNumber}.`;
}

export function confirmationSubject(w: Pick<WithdrawalStatement, "orderNumber">) {
  return `Потвърждение за получен отказ от договор – поръчка ${w.orderNumber}`;
}

/** Plain-text confirmation, used for the admin's "send by e-mail" link when automatic e-mail is not set up. */
export function confirmationText(w: WithdrawalStatement) {
  return [
    `Здравейте, ${w.name},`,
    "",
    `Потвърждаваме, че получихме Вашето изявление за отказ от договора на ${formatTimestamp(w.createdAt)} ч.`,
    "",
    "Съдържание на изявлението:",
    statementText(w),
    `Име: ${w.name}`,
    `Имейл: ${w.email}`,
    "",
    `Моля, върнете стоките до ${WITHDRAWAL_DAYS} дни на адрес: ${STORE.address}, или се свържете с нас на ${site.phone} за друг начин на връщане.`,
    `Ще възстановим платената сума до ${WITHDRAWAL_DAYS} дни от получаване на изявлението, след като получим стоките или доказателство, че са изпратени.`,
    "",
    `${COMPANY.name}, ЕИК ${COMPANY.eik}`,
    `${site.name} · ${site.email} · ${site.phone}`,
  ].join("\n");
}

export function confirmationHtml(w: WithdrawalStatement) {
  const body = `<p>Здравейте, ${escapeHtml(w.name)},</p>
<p>Потвърждаваме, че получихме Вашето изявление за отказ от договора на <strong>${escapeHtml(formatTimestamp(w.createdAt))} ч.</strong></p>
<p style="background:#f6f2e8;border-radius:12px;padding:14px 16px;margin:16px 0"><strong>Съдържание на изявлението:</strong><br>${escapeHtml(statementText(w))}<br>Име: ${escapeHtml(w.name)}<br>Имейл: ${escapeHtml(w.email)}</p>
<p>Моля, върнете стоките до ${WITHDRAWAL_DAYS} дни на адрес: ${escapeHtml(STORE.address)}, или се свържете с нас на ${escapeHtml(site.phone)} за друг начин на връщане.</p>
<p>Ще възстановим платената сума до ${WITHDRAWAL_DAYS} дни от получаване на изявлението, след като получим стоките или доказателство, че са изпратени.</p>
<p style="font-size:13px;color:#5b6b60">${escapeHtml(COMPANY.name)}, ЕИК ${escapeHtml(COMPANY.eik)}, ${escapeHtml(COMPANY.address)}</p>`;
  return mailLayout("Получихме отказа ти от договора", body);
}

/** The note to the shop about a new withdrawal; says so when the customer still needs a confirmation by hand. */
export function shopWithdrawalMail(w: WithdrawalStatement, emailed: boolean) {
  return {
    subject: `Отказ от договор – поръчка ${w.orderNumber}`,
    html: mailLayout(
      "Нов отказ от договор",
      `<p>${escapeHtml(statementText(w))}</p><p>Име: ${escapeHtml(w.name)}<br>Имейл: ${escapeHtml(w.email)}</p>${
        emailed ? "" : "<p><strong>Потвърждението до клиента не е изпратено автоматично — изпрати го от Админ → Откази днес.</strong></p>"
      }`,
      { href: `${site.url}/admin/otkazi`, label: "Към отказите" },
    ),
  };
}

/** A ready "mailto:" link so the shop can send the confirmation from its own mailbox. */
export function confirmationMailto(w: WithdrawalStatement) {
  return `mailto:${encodeURIComponent(w.email).replace("%40", "@")}?subject=${encodeURIComponent(confirmationSubject(w))}&body=${encodeURIComponent(confirmationText(w))}`;
}

/**
 * Whether a customer's order still shows the withdrawal link: sent or delivered, and recent enough
 * (14 days from receipt, plus time on the road). The link in the footer stays available regardless.
 */
export function withdrawalOpen(order: { status: string; createdAt: Date }) {
  return (order.status === "shipped" || order.status === "delivered") && Date.now() - order.createdAt.getTime() < 45 * 24 * 60 * 60_000;
}
