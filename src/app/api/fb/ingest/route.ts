import { revalidateTag } from "next/cache";
import { fbIngestSchema, ingestFbPost, isFbExtensionRequest } from "@/lib/fb-ingest";
import { CATALOG_TAG } from "@/lib/queries";

/**
 * The browser extension sends one Facebook post with its comments here (see /extension and lib/fb-ingest.ts).
 * New comments become claims under Админ → Facebook; comments sent before are left alone.
 */
export async function POST(request: Request) {
  if (!isFbExtensionRequest(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const parsed = fbIngestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: "bad request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  try {
    const result = await ingestFbPost(parsed.data);
    // Claims that went straight into an order took stock: the shop's pages show the new numbers.
    if (result.stockChanged) revalidateTag(CATALOG_TAG, "max");
    return Response.json({ ok: true, ...result, adminPath: result.postId ? `/admin/facebook/${result.postId}` : "/admin/facebook" });
  } catch (e) {
    console.error("fb ingest failed", e);
    return Response.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
