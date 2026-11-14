import "server-only";
import { randomBytes } from "node:crypto";
import { asc, desc, eq, gt, isNotNull, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { after } from "next/server";
import { db } from "@/db";
import { chatMessages, chatThreads, pushSubscriptions, users, type ChatThread } from "@/db/schema";
import { getSession } from "./auth";
import { currentPushDeviceId, notifyAdmins, sendPush } from "./push";
import { getLiveCards, type ProductCardData } from "./queries";

/**
 * The live chat: a visitor writes from the button on any shop page, the shop answers from Админ → Чат.
 * It is "live" by asking the server every few seconds while a chat is open; nothing is kept open in between.
 */
const COOKIE = "chat_id";
export const CHAT_MAX_LENGTH = 1000;

/** A message as both sides see it. `product` is set when the shop suggested one (and it is still on sale). */
export type ChatLine = { id: number; from: "customer" | "admin"; body: string; at: string; product?: ProductCardData };

type Row = { id: number; sender: "customer" | "admin"; body: string; createdAt: Date; productId: number | null };

const line = (m: Row, product?: ProductCardData): ChatLine => ({ id: m.id, from: m.sender, body: m.body, at: m.createdAt.toISOString(), ...(product ? { product } : {}) });

/** Messages with the suggested products' current name, price and photo. */
async function lines(rows: Row[]): Promise<ChatLine[]> {
  const ids = [...new Set(rows.map((r) => r.productId).filter((id): id is number => id !== null))];
  const cards = new Map((await getLiveCards(ids)).map((p) => [p.id, p]));
  return rows.map((r) => line(r, r.productId ? cards.get(r.productId) : undefined));
}

const excerpt = (body: string) => (body.length > 120 ? `${body.slice(0, 117)}…` : body);

/**
 * The visitor's own thread: the account's when signed in, otherwise the one named by the device's cookie.
 * A guest who signs in keeps the conversation: the thread moves to the account.
 */
async function ownThread(): Promise<ChatThread | null> {
  const [session, jar] = await Promise.all([getSession(), cookies()]);
  const token = jar.get(COOKIE)?.value;
  const byToken = token ? (await db.select().from(chatThreads).where(eq(chatThreads.token, token)).limit(1))[0] : undefined;
  if (!session) return byToken && !byToken.userId ? byToken : null;
  const [mine] = await db.select().from(chatThreads).where(eq(chatThreads.userId, session.uid)).orderBy(desc(chatThreads.id)).limit(1);
  if (mine) return mine;
  if (byToken && !byToken.userId) {
    const [moved] = await db.update(chatThreads).set({ userId: session.uid }).where(eq(chatThreads.id, byToken.id)).returning();
    return moved;
  }
  return null;
}

/** What the visitor's chat shows: the conversation so far. Opening it marks the shop's answers as seen. */
export async function loadOwnChat(markSeen: boolean): Promise<{ lines: ChatLine[]; unread: number }> {
  const thread = await ownThread();
  if (!thread) return { lines: [], unread: 0 };
  const rows = await db.select().from(chatMessages).where(eq(chatMessages.threadId, thread.id)).orderBy(asc(chatMessages.id)).limit(300);
  if (markSeen && thread.customerUnread > 0) await db.update(chatThreads).set({ customerUnread: 0 }).where(eq(chatThreads.id, thread.id));
  return { lines: await lines(rows), unread: markSeen ? 0 : thread.customerUnread };
}

/** The visitor sends a message; the first one opens the thread. The shop's phones are told. */
export async function sendOwnMessage(body: string, guestName: string | null): Promise<ChatLine> {
  const [session, deviceId] = await Promise.all([getSession(), currentPushDeviceId()]);
  let thread = await ownThread();
  if (!thread) {
    const token = randomBytes(24).toString("base64url");
    [thread] = await db
      .insert(chatThreads)
      .values({ token, userId: session?.uid ?? null, name: session ? null : guestName })
      .returning();
    (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 400 * 86_400 });
  }
  const [message] = await db.insert(chatMessages).values({ threadId: thread.id, sender: "customer", body }).returning();
  await db
    .update(chatThreads)
    .set({
      adminUnread: sql`${chatThreads.adminUnread} + 1`,
      lastBody: body,
      lastFrom: "customer",
      lastMessageAt: message.createdAt,
      // The latest device the customer wrote from is the one to tell about an answer.
      ...(deviceId ? { pushSubscriptionId: deviceId } : {}),
      ...(!session && guestName && !thread.name ? { name: guestName } : {}),
    })
    .where(eq(chatThreads.id, thread.id));

  const who = session?.name ?? thread.name ?? guestName ?? "Гост";
  const threadId = thread.id;
  // One notification per conversation: a newer message replaces the older one on the admin's phone.
  after(() => notifyAdmins("chat", { title: `Съобщение от ${who}`, body: excerpt(body), url: `/admin/chat/${threadId}`, tag: `chat-${threadId}` }));
  return line(message);
}

/** A thread with whose it is, for the admin. */
export type AdminChatThread = ChatThread & { userName: string | null; userEmail: string | null };

const withUser = () =>
  db
    .select({ thread: chatThreads, userName: users.name, userEmail: users.email })
    .from(chatThreads)
    .leftJoin(users, eq(users.id, chatThreads.userId));

/** Conversations with at least one message, the latest first. */
export async function listChatThreads(): Promise<AdminChatThread[]> {
  const rows = await withUser().where(isNotNull(chatThreads.lastMessageAt)).orderBy(desc(chatThreads.lastMessageAt)).limit(200);
  return rows.map((r) => ({ ...r.thread, userName: r.userName, userEmail: r.userEmail }));
}

/** One conversation for the admin. Opening it marks the customer's messages as read. */
export async function loadChatThread(id: number, markRead: boolean): Promise<{ thread: AdminChatThread; lines: ChatLine[] } | null> {
  const [row] = await withUser().where(eq(chatThreads.id, id)).limit(1);
  if (!row) return null;
  const rows = await db.select().from(chatMessages).where(eq(chatMessages.threadId, id)).orderBy(asc(chatMessages.id)).limit(500);
  if (markRead && row.thread.adminUnread > 0) await db.update(chatThreads).set({ adminUnread: 0 }).where(eq(chatThreads.id, id));
  return { thread: { ...row.thread, userName: row.userName, userEmail: row.userEmail }, lines: await lines(rows) };
}

/**
 * The shop answers, with words or by suggesting a product (then `body` is the product's name, which is what
 * the notification and the list of conversations show). The customer's devices with notifications on are
 * told; a tap opens the chat.
 */
export async function replyToThread(id: number, body: string, productId: number | null = null): Promise<ChatLine | null> {
  const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, id)).limit(1);
  if (!thread) return null;
  const [product] = productId ? await getLiveCards([productId]) : [];
  if (productId && !product) return null;
  if (product) body = product.name;
  const [message] = await db.insert(chatMessages).values({ threadId: id, sender: "admin", body, productId: product?.id ?? null }).returning();
  await db
    .update(chatThreads)
    .set({ customerUnread: sql`${chatThreads.customerUnread} + 1`, adminUnread: 0, lastBody: body, lastFrom: "admin", lastMessageAt: message.createdAt })
    .where(eq(chatThreads.id, id));

  after(async () => {
    const where = [thread.pushSubscriptionId ? eq(pushSubscriptions.id, thread.pushSubscriptionId) : undefined, thread.userId ? eq(pushSubscriptions.userId, thread.userId) : undefined].filter((c) => c !== undefined);
    if (where.length === 0) return;
    const devices = await db.select().from(pushSubscriptions).where(or(...where));
    await sendPush(devices, { title: product ? "Магазинът ти предлага" : "Отговор от магазина", body: excerpt(body), url: "/?chat=1", tag: "chat-reply" });
  });
  return line(message, product);
}

export async function deleteChatThread(id: number) {
  await db.delete(chatThreads).where(eq(chatThreads.id, id));
}

/** How many conversations wait for the shop's answer, for the admin's badges. */
export async function countUnreadChats() {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(chatThreads).where(gt(chatThreads.adminUnread, 0));
  return Number(row.n);
}
