import { recordBatch, visitorOf } from "@/lib/analytics";
import { getSession } from "@/lib/auth";

/** Receives the browser's anonymous visit events (see components/Tracker). Always answers 204. */
export async function POST(request: Request) {
  const done = new Response(null, { status: 204 });
  const visitor = visitorOf(request.headers);
  if (!visitor) return done;
  const text = await request.text().catch(() => "");
  if (!text || text.length > 20_000) return done;
  // The shop's own staff would only distort the numbers.
  if ((await getSession())?.role === "admin") return done;
  try {
    await recordBatch(visitor, JSON.parse(text));
  } catch {
    // Malformed or a database hiccup: statistics are never worth an error to the visitor.
  }
  return done;
}
