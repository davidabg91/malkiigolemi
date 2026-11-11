import "server-only";

/**
 * Sends one e-mail through Resend (resend.com) when RESEND_API_KEY and MAIL_FROM are set.
 * Returns false when e-mail is not configured or the send fails, so callers can keep the message for later.
 */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) console.error("sendMail failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("sendMail failed", e);
    return false;
  }
}

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

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
