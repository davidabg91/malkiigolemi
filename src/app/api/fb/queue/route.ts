import { z } from "zod";
import { fbQueue, isFbExtensionRequest } from "@/lib/fb-ingest";

const schema = z.object({
  /** The posts the extension met on the first screens of the group, with the date each one shows ("16 ч", "3 д"). */
  posts: z
    .array(
      z.object({
        fbId: z.string().regex(/^\d{5,32}$/),
        url: z.string().max(300).regex(/^https:\/\/(www\.|web\.)?facebook\.com\/groups\//),
        stamp: z.string().max(80).default(""),
      }),
    )
    .max(200),
});

/**
 * "Collect from all posts": the extension says which posts it met in the group, and the site answers which ones
 * to open: without the stopped ones and the ones from before the day collecting starts, plus the ones it still follows.
 */
export async function POST(request: Request) {
  if (!isFbExtensionRequest(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "bad request" }, { status: 400 });
  try {
    return Response.json({ ok: true, ...(await fbQueue(parsed.data.posts)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("fb queue failed", e);
    return Response.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
