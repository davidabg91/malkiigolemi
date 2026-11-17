import { z } from "zod";
import { isFbExtensionRequest, markFbReplied } from "@/lib/fb-ingest";

const schema = z.object({
  fbId: z.string().regex(/^\d{5,32}$/),
  /** Comments that now have their answer: the ones the extension just answered, and ones it found answered already. */
  ids: z.array(z.string().regex(/^\d{5,40}$/)).max(500),
});

/** The browser extension reports the comments it answered on Facebook, so they are not answered again. */
export async function POST(request: Request) {
  if (!isFbExtensionRequest(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "bad request" }, { status: 400 });
  try {
    await markFbReplied(parsed.data.fbId, parsed.data.ids);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("fb replied failed", e);
    return Response.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
