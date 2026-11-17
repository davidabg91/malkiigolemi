import { isFbExtensionRequest } from "@/lib/fb-ingest";
import { fbReportSchema, saveFbReport } from "@/lib/fb-monitor";

/**
 * The browser extension tells the site how it is doing: its version and automatic collecting (whenever they
 * change, and before each run), and what every finished run did. Админ → От Facebook shows it as the script's diary.
 */
export async function POST(request: Request) {
  if (!isFbExtensionRequest(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const parsed = fbReportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "bad request" }, { status: 400 });
  try {
    await saveFbReport(parsed.data);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("fb report failed", e);
    return Response.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
