import { db } from "@/db";
import { products } from "@/db/schema";
import { getSession } from "@/lib/auth";

/** How many times each product's page was opened, by product id. For a signed-in admin only. */
export async function GET() {
  if ((await getSession())?.role !== "admin") return new Response(null, { status: 404 });
  const rows = await db.select({ id: products.id, views: products.views }).from(products);
  return Response.json(Object.fromEntries(rows.map((r) => [r.id, r.views])), { headers: { "Cache-Control": "private, no-store" } });
}
