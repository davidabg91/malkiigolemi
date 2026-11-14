"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getSession, tooManyAttempts } from "@/lib/auth";
import { pushConfigured, removePushDevice, savePushDevice, sendPush } from "@/lib/push";

const subscription = z.object({
  // Push services are always reached over https; anything else is not a subscription.
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

export type PushSubscribeInput = z.input<typeof subscription>;

/**
 * A device turned notifications on, or is checking in again (`welcome: false`). It is tied to the account
 * signed in on it and, on an order's page, to that order, so an order placed without an account is followed too.
 */
export async function subscribePush(input: PushSubscribeInput, opts: { orderNumber?: string; welcome?: boolean } = {}): Promise<{ ok: boolean }> {
  if (!pushConfigured()) return { ok: false };
  const parsed = subscription.safeParse(input);
  if (!parsed.success) return { ok: false };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooManyAttempts(`push:${ip}`, 60, 10 * 60_000)) return { ok: false };

  const session = await getSession();
  const device = await savePushDevice({ endpoint: parsed.data.endpoint, ...parsed.data.keys }, session?.uid ?? null);
  // Whoever has the order's page has its number; that is all the page itself asks for.
  if (opts.orderNumber) await db.update(orders).set({ pushSubscriptionId: device.id }).where(eq(orders.number, opts.orderNumber.slice(0, 40)));
  if (opts.welcome) {
    const sent = await sendPush([device], {
      title: "Известията са включени",
      body: "Ще ти казваме тук, когато поръчката ти бъде потвърдена, изпратена и доставена.",
      url: opts.orderNumber ? `/porachka/${opts.orderNumber}` : "/profil",
      tag: "welcome",
    });
    return { ok: sent > 0 };
  }
  return { ok: true };
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return;
  await removePushDevice(endpoint);
}
