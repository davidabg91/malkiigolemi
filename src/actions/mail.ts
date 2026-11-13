"use server";

import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { checkSmtp, mailConfigured, mailLayout, sendMail } from "@/lib/mail";
import { sendSampleMails } from "@/lib/mail-samples";
import { site } from "@/lib/site";

export type MailTestState = { ok?: boolean; error?: string } | undefined;

/** Admin: sends a test message to the shop's own mailbox, to check the e-mail settings. */
export async function sendTestMailAction(): Promise<MailTestState> {
  await assertAdmin();
  if (!mailConfigured()) return { error: "Имейлите още не са настроени." };
  if (process.env.SMTP_USER) {
    const check = await checkSmtp();
    if (!check.ok) return { error: `Входът в пощата не успя. ${check.detail}` };
  }
  const ok = await sendMail(
    site.email,
    "Пробен имейл от сайта",
    mailLayout("Имейлите работят", "<p>Това е пробно съобщение от админ панела. Клиентите ще получават потвърждения за поръчки, изпращане и откази.</p>"),
  );
  return ok ? { ok: true } : { error: "Изпращането не успя. Провери настройките на пощата във Vercel и опитай отново." };
}

export type SamplesState = { ok?: boolean; sent?: number; total?: number; to?: string; error?: string } | undefined;

/** Admin: sends one of every customer and shop e-mail, with made-up data, to the given address. */
export async function sendSampleMailsAction(_prev: SamplesState, formData: FormData): Promise<SamplesState> {
  await assertAdmin();
  if (!mailConfigured()) return { error: "Имейлите още не са настроени." };
  const to = z.string().trim().toLowerCase().pipe(z.email()).safeParse(String(formData.get("to") ?? ""));
  if (!to.success) return { error: "Въведи валиден имейл." };
  const { sent, total } = await sendSampleMails(to.data);
  return sent === total ? { ok: true, sent, total, to: to.data } : { error: `Изпратени ${sent} от ${total}. Опитай отново след минута.` };
}
