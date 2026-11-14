"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertAdmin, getSession, tooManyAttempts } from "@/lib/auth";
import { CHAT_MAX_LENGTH, deleteChatThread, loadChatThread, loadOwnChat, replyToThread, sendOwnMessage, type ChatLine } from "@/lib/chat";
import { ADMIN_NOTICES, type AdminNoticePrefs } from "@/lib/notices";
import { adminDevices, sendPush, setAdminNoticePrefs } from "@/lib/push";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "");

/** The visitor's chat: the conversation so far. `seen` is true while the chat is open on screen. */
export async function chatLoad(seen: boolean): Promise<{ lines: ChatLine[]; unread: number }> {
  return loadOwnChat(Boolean(seen));
}

export type ChatSendResult = { ok: true; line: ChatLine } | { ok: false; error: string };

/** The visitor sends a message. */
export async function chatSend(body: string, name?: string): Promise<ChatSendResult> {
  const text = clean(body, CHAT_MAX_LENGTH);
  if (!text) return { ok: false, error: "Напиши съобщение." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooManyAttempts(`chat:${ip}`, 30, 10 * 60_000)) return { ok: false, error: "Твърде много съобщения наведнъж. Изчакай малко." };
  try {
    return { ok: true, line: await sendOwnMessage(text, clean(name, 60) || null) };
  } catch (e) {
    console.error("Chat message failed", e);
    return { ok: false, error: "Съобщението не беше изпратено. Опитай отново." };
  }
}

/** Admin: the conversation, for the page that keeps itself up to date. */
export async function chatAdminLoad(threadId: number): Promise<ChatLine[]> {
  await assertAdmin();
  return (await loadChatThread(threadId, true))?.lines ?? [];
}

/** Admin: answers a customer. */
export async function chatReply(threadId: number, body: string): Promise<ChatSendResult> {
  await assertAdmin();
  const text = clean(body, CHAT_MAX_LENGTH);
  if (!text) return { ok: false, error: "Напиши отговор." };
  const sent = await replyToThread(threadId, text);
  return sent ? { ok: true, line: sent } : { ok: false, error: "Разговорът вече не съществува." };
}

/** Admin: suggests a product to the customer; it appears in the chat as a card. */
export async function chatSuggest(threadId: number, productId: number): Promise<ChatSendResult> {
  await assertAdmin();
  if (!Number.isInteger(productId) || productId <= 0) return { ok: false, error: "Избери продукт." };
  const sent = await replyToThread(threadId, "", productId);
  return sent ? { ok: true, line: sent } : { ok: false, error: "Продуктът не се продава в момента или разговорът вече не съществува." };
}

export async function chatDelete(threadId: number): Promise<void> {
  await assertAdmin();
  await deleteChatThread(threadId);
  redirect("/admin/chat");
}

/** Admin: which notifications the shop's phones get. Unticked boxes are simply absent from the form. */
export async function saveAdminNotices(formData: FormData): Promise<void> {
  await assertAdmin();
  await setAdminNoticePrefs(Object.fromEntries(ADMIN_NOTICES.map((n) => [n.key, formData.get(n.key) === "on"])) as AdminNoticePrefs);
  refresh();
}

/** Admin: a test notification to this admin's own devices. Returns how many it reached. */
export async function sendTestNotice(): Promise<number> {
  await assertAdmin();
  const session = await getSession();
  const devices = (await adminDevices()).filter((d) => d.userId === session?.uid);
  return sendPush(devices, { title: "Пробно известие", body: "Известията от магазина работят на това устройство.", url: "/admin/izvestiya", tag: "test" });
}
