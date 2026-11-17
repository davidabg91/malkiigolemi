import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

/**
 * The automatic answer the browser extension leaves under a comment it turned into a claim
 * ("Записвам си! Благодарим!"). Switched on and worded under Админ → От Facebook; off until the admin turns it on,
 * because the answers are posted from whichever Facebook profile is signed in where the extension runs.
 */
export type FbReplySettings = { enabled: boolean; text: string };

export const DEFAULT_FB_REPLY: FbReplySettings = { enabled: false, text: "Записвам си! Благодарим!" };

/**
 * How carefully the extension answers: a pause between two answers, at most this many in one run (the rest wait
 * for the next run), and only comments younger than this, so turning the switch on does not answer last month's posts.
 */
export const FB_REPLY_LIMITS = { pauseMs: 8000, perRun: 20, maxAgeHours: 48 };

const KEY = "fb_auto_reply";

export async function getFbReplySettings(): Promise<FbReplySettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  if (!row) return { ...DEFAULT_FB_REPLY };
  try {
    return { ...DEFAULT_FB_REPLY, ...(JSON.parse(row.value) as Partial<FbReplySettings>) };
  } catch {
    return { ...DEFAULT_FB_REPLY };
  }
}

export async function saveFbReplySettings(value: FbReplySettings) {
  const json = JSON.stringify(value);
  await db
    .insert(settings)
    .values({ key: KEY, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: new Date() } });
}

// How old a comment is, from the short date Facebook shows next to it: kept with the other date reading.
export { stampAgeHours as commentAgeHours } from "./fb-since";
