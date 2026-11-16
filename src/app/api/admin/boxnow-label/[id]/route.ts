import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { BoxNowError, parcelLabel } from "@/lib/boxnow";

/** The BOX NOW label of an order's parcel as a PDF, for a signed-in admin (BOX NOW serves it only with our token). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  if ((await getSession())?.role !== "admin") return new Response(null, { status: 404 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response(null, { status: 404 });
  const [order] = await db.select({ number: orders.number, parcelId: orders.trackingNumber, courier: orders.courier }).from(orders).where(eq(orders.id, id)).limit(1);
  if (!order?.parcelId || order.courier !== "boxnow") return new Response("Поръчката няма пратка в BOX NOW.", { status: 404 });
  try {
    const pdf = await parcelLabel(order.parcelId);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="boxnow-${order.number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const text = e instanceof BoxNowError ? e.message : "Неочаквана грешка при връзката с BOX NOW.";
    return new Response(text, { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
