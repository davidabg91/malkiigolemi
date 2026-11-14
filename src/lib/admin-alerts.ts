import "server-only";
import { eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { countUnreadChats } from "./chat";
import { fbClaims, orders, storePayments, withdrawals } from "@/db/schema";

/** Things waiting for the admin: shown as badges in the admin menu and on the shop header's profile icon. */
export type AdminAlerts = { newOrders: number; withdrawals: number; fbClaims: number; storePayments: number; chats: number; total: number };

export async function getAdminAlerts(): Promise<AdminAlerts> {
  const count = sql<number>`count(*)`;
  const [[o], [w], [f], [p], chats] = await Promise.all([
    db.select({ n: count }).from(orders).where(eq(orders.status, "new")),
    db.select({ n: count }).from(withdrawals).where(isNull(withdrawals.handledAt)),
    db.select({ n: count }).from(fbClaims).where(eq(fbClaims.status, "pending")),
    db.select({ n: count }).from(storePayments).where(isNull(storePayments.seenAt)),
    countUnreadChats(),
  ]);
  const a = { newOrders: Number(o.n), withdrawals: Number(w.n), fbClaims: Number(f.n), storePayments: Number(p.n), chats };
  return { ...a, total: a.newOrders + a.withdrawals + a.fbClaims + a.storePayments + a.chats };
}
