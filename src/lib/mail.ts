import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Mail goes out over SMTP — by default the shop's own Gmail with an app password, which is free up to
 * 500 messages a day (SMTP_USER + SMTP_PASS; SMTP_HOST/SMTP_PORT for any other provider). MAIL_FROM is
 * the sender shown to customers; with Gmail it must be the same mailbox. RESEND_API_KEY still works instead.
 */
const smtp = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return user && pass ? { host: process.env.SMTP_HOST || "smtp.gmail.com", port: Number(process.env.SMTP_PORT || 465), user, pass } : null;
};

let transporter: Transporter | undefined;

async function viaSmtp(from: string, to: string, subject: string, html: string) {
  const cfg = smtp()!;
  transporter ??= nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transporter.sendMail({ from, to, subject, html });
  return true;
}

async function viaResend(key: string, from: string, to: string, subject: string, html: string) {
  const send = () =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
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
 * keep the message for later; never throws.
 */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const key = process.env.RESEND_API_KEY;
  if (!from || (!smtp() && !key)) return false;
  try {
    return smtp() ? await viaSmtp(from, to, subject, html) : await viaResend(key!, from, to, subject, html);
  } catch (e) {
    console.error("sendMail failed", e);
    return false;
  }
}

export const mailConfigured = () => Boolean(smtp() || (process.env.RESEND_API_KEY && process.env.MAIL_FROM));

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A plain, readable e-mail in the shop's colours. */
export function mailLayout(title: string, body: string, cta?: { href: string; label: string }) {
  return `<!doctype html><html lang="bg"><body style="margin:0;background:#f6f2e8;font-family:Arial,sans-serif;color:#14261c">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-weight:bold;font-size:18px;margin:0 0 24px">Поръчки за малки и големи</p>
<div style="background:#ffffff;border-radius:20px;padding:28px">
<h1 style="font-size:22px;margin:0 0 12px">${escape(title)}</h1>
<div style="font-size:16px;line-height:1.6">${body}</div>
${cta ? `<p style="margin:24px 0 0"><a href="${escape(cta.href)}" style="display:inline-block;background:#1f5c3f;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${escape(cta.label)}</a></p>` : ""}
</div></div></body></html>`;
}

export { escape as escapeHtml };
