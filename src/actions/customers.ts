"use server";

import { eq, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { flaggedContacts, orders, users } from "@/db/schema";
import { assertAdmin } from "@/lib/auth";
import { normalizePhone } from "@/lib/flags";

const noteOf = (formData: FormData) => String(formData.get("note") ?? "").trim().slice(0, 300) || null;

/** Marks a registered customer as "некоректен" by account, e-mail and phone. */
export async function flagUser(userId: number, formData: FormData): Promise<void> {
  await assertAdmin();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;
  // One mark per account: marking again only replaces the note.
  await db.delete(flaggedContacts).where(eq(flaggedContacts.userId, user.id));
  await db.insert(flaggedContacts).values({
    userId: user.id,
    email: user.email.toLowerCase(),
    phone: normalizePhone(user.phone) || null,
    note: noteOf(formData),
  });
  refresh();
}

/** Marks whoever placed this order, so guests who never registered can be marked too. */
export async function flagOrderContact(orderId: number, formData: FormData): Promise<void> {
  await assertAdmin();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;
  await db.insert(flaggedContacts).values({
    userId: order.userId,
    email: order.email.trim().toLowerCase(),
    phone: normalizePhone(order.phone) || null,
    note: noteOf(formData) ?? `Поръчка ${order.number}`,
  });
  refresh();
}

/** Removes a mark together with any other mark for the same account, e-mail or phone, so the customer is fully cleared. */
export async function removeFlag(flagId: number): Promise<void> {
  await assertAdmin();
  const [flag] = await db.select().from(flaggedContacts).where(eq(flaggedContacts.id, flagId)).limit(1);
  if (!flag) return;
  await db
    .delete(flaggedContacts)
    .where(
      or(
        eq(flaggedContacts.id, flag.id),
        flag.userId != null ? eq(flaggedContacts.userId, flag.userId) : undefined,
        flag.email ? eq(flaggedContacts.email, flag.email) : undefined,
        flag.phone ? eq(flaggedContacts.phone, flag.phone) : undefined,
      ),
    );
  refresh();
}
