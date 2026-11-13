import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { site } from "./site";

/**
 * Mail goes out over SMTP: SMTP_USER + SMTP_PASS, with SMTP_HOST/SMTP_PORT for the provider (Gmail when
 * unset; Brevo's free relay is smtp-relay.brevo.com:587). MAIL_FROM is the sender shown to customers, e.g. an
 * address on the shop's domain. Replies go to the shop's mailbox (site.email), since the domain itself has
 * no inbox. RESEND_API_KEY still works instead of SMTP.
 */
const smtp = () => {
  const user = process.env.SMTP_USER?.trim();
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  // Google shows app passwords as "abcd efgh ijkl mnop"; pasted with the spaces, quotes or a stray line break they are rejected.
  const raw = process.env.SMTP_PASS?.trim().replace(/^["'](.*)["']$/, "$1");
  const pass = host === "smtp.gmail.com" ? raw?.replace(/\s+/g, "") : raw;
  return user && pass ? { host, port: Number(process.env.SMTP_PORT || 465), user, pass } : null;
};

let transporter: Transporter | undefined;

async function viaSmtp(from: string, to: string, subject: string, html: string, replyTo: string) {
  const cfg = smtp()!;
  transporter ??= nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transporter.sendMail({ from, to, subject, html, replyTo });
  return true;
}

async function viaResend(key: string, from: string, to: string, subject: string, html: string, replyTo: string) {
  const send = () =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, reply_to: replyTo }),
    });
  let res = await send();
  // Resend allows a few requests a second; marking many orders shipped at once can hit that.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await send();
  }
  if (!res.ok) console.error("sendMail failed", res.status, await res.text().catch(() => ""));
  return res.ok;
}

/**
 * Sends one e-mail. Returns false when e-mail is not configured or the send fails, so callers can
 * keep the message for later; never throws. `replyTo` defaults to the shop's mailbox.
 */
export async function sendMail(to: string, subject: string, html: string, replyTo: string = site.email): Promise<boolean> {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const key = process.env.RESEND_API_KEY;
  if (!from || (!smtp() && !key)) return false;
  try {
    return smtp() ? await viaSmtp(from, to, subject, html, replyTo) : await viaResend(key!, from, to, subject, html, replyTo);
  } catch (e) {
    console.error("sendMail failed", e);
    return false;
  }
}

/** The sender customers see, e.g. "Поръчки за малки и големи <porachki@malkiigolemi.com>". */
export const mailSender = () => process.env.MAIL_FROM || process.env.SMTP_USER || "";

export const mailConfigured = () => Boolean(smtp() || (process.env.RESEND_API_KEY && process.env.MAIL_FROM));

/**
 * For the admin's test button: logs in to the SMTP server without sending, and describes the settings
 * without revealing the password (only its length and whether it looks like a Gmail app password).
 */
export async function checkSmtp(): Promise<{ ok: boolean; detail: string }> {
  const cfg = smtp();
  if (!cfg) return { ok: false, detail: "Липсва SMTP_USER или SMTP_PASS." };
  const shape =
    cfg.host === "smtp.gmail.com"
      ? /^[a-z]{16}$/.test(cfg.pass)
        ? ", прилича на парола за приложение"
        : ", НЕ прилича на парола за приложение (трябват 16 малки латински букви)"
      : "";
  const settings = `Акаунт: ${cfg.user} · сървър: ${cfg.host}:${cfg.port} · парола: ${cfg.pass.length} знака${shape}.`;
  try {
    await nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.port === 465, auth: { user: cfg.user, pass: cfg.pass } }).verify();
    return { ok: true, detail: settings };
  } catch (e) {
    const message = e instanceof Error ? e.message.split("\n")[0].replace(/https?:\/\/\S+/g, "").trim() : "";
    const reason = message || (e as { code?: string }).code || String(e);
    return { ok: false, detail: `${settings} Отговор на сървъра: ${reason}` };
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A plain, readable e-mail in the shop's colours, with the logo on top; `footer` (small print) goes under the button. */
export function mailLayout(title: string, body: string, cta?: { href: string; label: string }, footer = "") {
  return `<!doctype html><html lang="bg"><body style="margin:0;background:#f5f5f4;font-family:Arial,sans-serif;color:#171717">
<div style="max-width:520px;margin:0 auto;padding:28px 20px 32px">
<a href="${escape(site.url)}" style="display:inline-block;margin:0 0 20px"><img src="${escape(site.url)}/mail-logo.png" width="200" height="56" alt="Поръчки за малки и големи" style="display:block;border:0;height:auto;max-width:200px"></a>
<div style="background:#ffffff;border-radius:20px;padding:28px">
<h1 style="font-size:22px;margin:0 0 12px">${escape(title)}</h1>
<div style="font-size:16px;line-height:1.6">${body}</div>
${cta ? `<p style="margin:24px 0 0"><a href="${escape(cta.href)}" style="display:inline-block;background:#33484b;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${escape(cta.label)}</a></p>` : ""}
${footer}
</div></div></body></html>`;
}

export { escape as escapeHtml };
