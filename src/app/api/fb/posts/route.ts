import { and, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { fbPosts } from "@/db/schema";
import { FB_COLLECT_DAYS, isFbExtensionRequest } from "@/lib/fb-ingest";
import { getFbOrderSettings } from "@/lib/fb-orders";
import { inPeriods, periodBounds } from "@/lib/fb-since";
import { site } from "@/lib/site";

/**
 * What "collect from all posts" in the browser extension goes through: the group, the posts still being
 * collected from, and the ones the admin stopped (left out even when the extension finds them in the group).
 */
export async function GET(request: Request) {
  if (!isFbExtensionRequest(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const since = new Date(Date.now() - FB_COLLECT_DAYS * 24 * 60 * 60 * 1000);
  // Posts published outside the days collecting covers are neither followed nor opened when met in the group.
  const bounds = periodBounds((await getFbOrderSettings()).periods);
  const [followed, closed] = await Promise.all([
    db
      .select({ fbId: fbPosts.fbId, url: fbPosts.url, postedAt: fbPosts.postedAt, createdAt: fbPosts.createdAt })
      .from(fbPosts)
      .where(and(isNotNull(fbPosts.fbId), isNull(fbPosts.closedAt), gte(fbPosts.createdAt, since))),
    db.select({ fbId: fbPosts.fbId }).from(fbPosts).where(and(isNotNull(fbPosts.fbId), isNotNull(fbPosts.closedAt))),
  ]);
  const isOld = (p: (typeof followed)[number]) => !inPeriods((p.postedAt ?? p.createdAt).getTime(), bounds);
  const open = followed.filter((p) => !isOld(p)).map((p) => ({ fbId: p.fbId, url: p.url }));
  return Response.json(
    { ok: true, group: site.facebookUrl, open, closed: [...closed.map((p) => p.fbId), ...followed.filter(isOld).map((p) => p.fbId)] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
