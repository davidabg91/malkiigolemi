"use server";

import { assertAdmin } from "@/lib/auth";
import { mailConfigured, mailLayout, sendMail } from "@/lib/mail";
import { site } from "@/lib/site";

export type MailTestState = { ok?: boolean; error?: string } | undefined;

/** Admin: sends a test message to the shop's own mailbox, to check the e-mail settings. */
export async function sendTestMailAction(): Promise<MailTestState> {
  await assertAdmin();
  if (!mailConfigured()) return { error: "Имейлите още не са настроени." };
  const ok = await sendMail(
    site.email,
    "Пробен имейл от сайта",
    mailLayout("Имейлите работят", "<p>Това е пробно съобщение от админ панела. Клиентите ще получават потвърждения за поръчки, изпращане и откази.</p>"),
  );
  return ok ? { ok: true } : { error: "Изпращането не успя. Провери паролата за приложение и опитай отново." };
}
