import { and, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { fbPosts } from "@/db/schema";
import { FB_COLLECT_DAYS, isFbExtensionRequest } from "@/lib/fb-ingest";
import { site } from "@/lib/site";

/**
 * What "collect from all posts" in the browser extension goes through: the group, the posts still being
 * collected from, and the ones the admin stopped (left out even when the extension finds them in the group).
 */
export async function GET(request: Request) {
  if (!isFbExtensionRequest(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const since = new Date(Date.now() - FB_COLLECT_DAYS * 24 * 60 * 60 * 1000);
  const [open, closed] = await Promise.all([
    db
      .select({ fbId: fbPosts.fbId, url: fbPosts.url })
      .from(fbPosts)
      .where(and(isNotNull(fbPosts.fbId), isNull(fbPosts.closedAt), gte(fbPosts.createdAt, since))),
    db.select({ fbId: fbPosts.fbId }).from(fbPosts).where(and(isNotNull(fbPosts.fbId), isNotNull(fbPosts.closedAt))),
  ]);
  return Response.json(
    { ok: true, group: site.facebookUrl, open, closed: closed.map((p) => p.fbId) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
