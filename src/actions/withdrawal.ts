"use server";

import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { orders, withdrawals } from "@/db/schema";
import { assertAdmin, getSession, tooManyAttempts } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { site } from "@/lib/site";
import { confirmationHtml, confirmationSubject, shopWithdrawalMail, statementText } from "@/lib/withdrawals";

const schema = z.object({
  name: z.string().trim().min(3, "Въведи име и фамилия.").max(120),
  orderNumber: z.string().trim().min(1, "Въведи номера на поръчката.").max(40),
  email: z.string().trim().toLowerCase().pipe(z.email("Въведи валиден имейл.")),
  details: z.string().trim().max(1000),
});

export type WithdrawalInput = z.input<typeof schema>;
export type WithdrawalResult =
  | { ok: true; createdAt: string; statement: string; emailed: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Records a consumer's withdrawal statement (ЗЗП чл. 52а) and confirms it by e-mail. */
export async function submitWithdrawal(input: WithdrawalInput): Promise<WithdrawalResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Провери отбелязаните полета.", fieldErrors };
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooManyAttempts(`withdrawal:${ip}`, 10, 60 * 60_000)) {
    return { ok: false, error: `Твърде много заявки. Опитай по-късно или ни пиши на ${site.email}.` };
  }

  const session = await getSession();
  const data = parsed.data;
  // Numbers are matched loosely (case, spaces) so a typo in spacing still links the order.
  const wanted = data.orderNumber.replace(/\s+/g, "").toUpperCase();
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(sql`upper(replace(${orders.number}, ' ', ''))`, wanted))
    .limit(1);

  const [row] = await db
    .insert(withdrawals)
    .values({
      orderId: order?.id ?? null,
      orderNumber: data.orderNumber,
      name: data.name,
      email: data.email,
      details: data.details || null,
      userId: session?.uid ?? null,
    })
    .returning();

  const statement = statementText(row);
  const emailed = await sendMail(row.email, confirmationSubject(row), confirmationHtml(row));
  if (emailed) await db.update(withdrawals).set({ confirmedAt: new Date() }).where(eq(withdrawals.id, row.id));

  // Let the shop know at once; the admin list shows it either way.
  after(() => {
    const notice = shopWithdrawalMail(row, emailed);
    return sendMail(site.email, notice.subject, notice.html, row.email);
  });

  return { ok: true, createdAt: row.createdAt.toISOString(), statement, emailed };
}

/** Admin: the confirmation was sent by hand from the shop's mailbox. */
export async function markWithdrawalConfirmed(id: number) {
  await assertAdmin();
  await db.update(withdrawals).set({ confirmedAt: new Date() }).where(eq(withdrawals.id, id));
  refresh();
}

/** Admin: goods are back and the money refunded (or the case is otherwise closed); toggles back on a second click. */
export async function toggleWithdrawalHandled(id: number, handled: boolean) {
  await assertAdmin();
  await db.update(withdrawals).set({ handledAt: handled ? new Date() : null }).where(eq(withdrawals.id, id));
  refresh();
}
