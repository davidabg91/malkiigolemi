import { pruneEvents } from "@/lib/analytics";
import { syncShipments } from "@/lib/shipments";

/**
 * Daily check of every open Econt shipment (see vercel.json). Vercel sends CRON_SECRET as a bearer token;
 * without the secret set, nobody can trigger it. Page views refresh tracking in between (syncShipmentsIfStale).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // The same daily run clears visit statistics older than 90 days.
  await pruneEvents().catch((e) => console.error("pruneEvents failed:", e));
  try {
    const checked = await syncShipments();
    return Response.json({ ok: true, checked });
  } catch (e) {
    console.error("Econt cron sync failed:", e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 502 });
  }
}
