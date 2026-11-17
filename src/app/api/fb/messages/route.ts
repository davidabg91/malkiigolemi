import { z } from "zod";
import { isFbExtensionRequest } from "@/lib/fb-ingest";
import { pendingFbMessages, reportFbMessage } from "@/lib/fb-orders";
import { site } from "@/lib/site";

/**
 * Messages for customers from the Facebook group that wait to be written in their chat ("Готова за взимане").
 * The browser extension asks for them, opens each person's profile in the group and writes there.
 */
export async function GET(request: Request) {
  if (!isFbExtensionRequest(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const group = site.facebookUrl.replace(/\/+$/, "");
  const messages = (await pendingFbMessages()).map((m) => ({
    id: m.id,
    userId: m.fbUserId,
    name: m.name,
    text: m.body,
    // The person's page inside the group: its "Съобщение" button opens the chat with them.
    profileUrl: `${group}/user/${m.fbUserId}/`,
  }));
  return Response.json({ ok: true, messages }, { headers: { "Cache-Control": "private, no-store" } });
}

const schema = z.object({
  id: z.number().int().positive(),
  /** "sent", or in a word why not ("no-button", "wrong-person", "not-sent", …). */
  outcome: z.string().regex(/^[a-z-]{2,40}$/),
});

/** The extension reports what happened to one message. */
export async function POST(request: Request) {
  if (!isFbExtensionRequest(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "bad request" }, { status: 400 });
  try {
    await reportFbMessage(parsed.data.id, parsed.data.outcome);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("fb message report failed", e);
    return Response.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
