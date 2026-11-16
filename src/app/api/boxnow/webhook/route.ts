import { webhookKeyMatches, webhookSecret } from "@/lib/boxnow";
import { recordBoxNowEvent } from "@/lib/boxnow-shipments";

/**
 * BOX NOW parcel events (Webhook-Based Parcel Tracking Guide v1.4): CloudEvents JSON, type "bg.boxnow.parcel_event_change",
 * one call per event, retried until we answer 200.
 *
 * BOX NOW sends no signature of its own; the guide says extra authentication goes in HTTP headers. So every call
 * must carry our key (BOXNOW_WEBHOOK_SECRET) as "Authorization: Bearer <key>" or "X-Webhook-Key: <key>"
 * (or, if their system cannot add headers, as ?key=<key> in the URL). Anything else gets 401.
 */
export async function POST(request: Request) {
  if (!webhookSecret()) return new Response("Webhook not configured", { status: 503 });
  const auth = request.headers.get("authorization");
  const given =
    (auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null) ??
    request.headers.get("x-webhook-key") ??
    new URL(request.url).searchParams.get("key");
  if (!webhookKeyMatches(given)) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  type Data = {
    parcelId?: string | number;
    orderNumber?: string;
    event?: string;
    parcelState?: string;
    time?: string;
    eventLocation?: { displayName?: string } | null;
  };
  const envelope = body as { subject?: string; time?: string; data?: Data };
  const data = envelope?.data ?? {};
  const parcelId = data.parcelId != null ? String(data.parcelId) : envelope?.subject ? String(envelope.subject) : "";
  // The guide: use "event", not "parcelState", to match what the customer sees on boxnow.bg.
  const event = data.event || data.parcelState || "";
  if (!parcelId || !event) return Response.json({ ok: true, ignored: "no parcel or event" });

  try {
    const known = await recordBoxNowEvent({
      parcelId,
      orderNumber: data.orderNumber ?? null,
      event,
      time: data.time || envelope.time || new Date().toISOString(),
      place: data.eventLocation?.displayName ?? null,
    });
    // A parcel we do not know (made by hand in the partner portal) is fine: answer 200 so BOX NOW stops retrying.
    return Response.json({ ok: true, matched: known });
  } catch (e) {
    console.error("BOX NOW webhook failed:", e);
    return new Response("Temporary error", { status: 500 });
  }
}

/** A quick reachability check for BOX NOW staff setting the webhook up. */
export function GET() {
  return Response.json({ ok: true, service: "BOX NOW webhook" });
}
