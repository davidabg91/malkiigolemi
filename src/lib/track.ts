/**
 * Browser side of the anonymous visit statistics (see `events` in the schema). Events are queued and
 * sent in small batches to /api/track; nothing is stored on the device.
 */
type TrackEvent = { t: "view" | "time" | "click" | "cart_add"; p: string; l?: string; id?: number; v?: number; r?: string };

const queue: TrackEvent[] = [];
let timer: number | undefined;

const off = () => typeof navigator === "undefined" || navigator.doNotTrack === "1";

export function flush() {
  if (timer) window.clearTimeout(timer);
  timer = undefined;
  if (queue.length === 0) return;
  const body = JSON.stringify({ d: window.innerWidth < 768 ? "mobile" : "desktop", e: queue.splice(0, 40) });
  // sendBeacon survives the page being closed; fetch is the fallback.
  if (!navigator.sendBeacon?.("/api/track", body)) fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
}

export function track(event: Omit<TrackEvent, "p"> & { p?: string }) {
  if (off()) return;
  queue.push({ ...event, p: event.p ?? window.location.pathname });
  if (queue.length >= 20) flush();
  else timer ??= window.setTimeout(flush, 4000);
}
