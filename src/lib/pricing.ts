import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "@/db";
import { products, promotions } from "@/db/schema";

/**
 * The biggest live promotion percent for the product in the current row, or NULL.
 * "Live" is decided by SQLite's clock at query time, so promotions switch themselves on and off.
 */
export const promoPercent = sql<number | null>`(
  select max(pr.percent) from promotions pr
  where pr.enabled = 1
    and pr.starts_at <= unixepoch() and pr.ends_at > unixepoch()
    and (
      exists (select 1 from promotion_products pp where pp.promotion_id = pr.id and pp.product_id = ${products.id})
      or pr.category_id = ${products.categoryId}
      or pr.category_id = (select c.parent_id from categories c where c.id = ${products.categoryId})
    )
)`;

/** Price after a live promotion, in cents. */
export const effectivePrice = sql<number>`(case when ${promoPercent} is null then ${products.price}
  else cast(round(${products.price} * (100 - ${promoPercent}) / 100.0) as integer) end)`;

/** The crossed-out price: the regular price during a promotion, otherwise the manual "old price". */
export const effectiveOldPrice = sql<number | null>`(case when ${promoPercent} is null then ${products.oldPrice}
  else coalesce(${products.oldPrice}, ${products.price}) end)`;

// A quantity price only applies while it is still cheaper than the promotion.
export const effectiveBulkPrice = sql<number | null>`(case when ${promoPercent} is null or ${products.bulkPrice} < ${effectivePrice}
  then ${products.bulkPrice} else null end)`;
export const effectiveBulkMinQty = sql<number | null>`(case when ${promoPercent} is null or ${products.bulkPrice} < ${effectivePrice}
  then ${products.bulkMinQty} else null end)`;

/** Columns that replace the stored prices whenever a product is priced for a customer. */
export const pricedColumns = {
  price: effectivePrice,
  oldPrice: effectiveOldPrice,
  bulkPrice: effectiveBulkPrice,
  bulkMinQty: effectiveBulkMinQty,
};

/**
 * Cache lifetime for anything that shows prices: normally an hour, but never past the next moment a
 * promotion starts or ends, so a new promotion appears within minutes without anyone pressing a button.
 */
export async function catalogCacheLife() {
  const now = new Date();
  const [next] = await db
    .select({
      at: sql<number | null>`min(case when ${promotions.startsAt} > unixepoch() then ${promotions.startsAt} else ${promotions.endsAt} end)`,
    })
    .from(promotions)
    .where(and(eq(promotions.enabled, true), gt(promotions.endsAt, now)));
  const seconds = next?.at ? next.at - Math.floor(now.getTime() / 1000) : Infinity;
  // Five minutes is the shortest lifetime a prerendered page can have.
  const revalidate = Math.max(300, Math.min(3600, seconds + 5));
  cacheLife({ stale: 300, revalidate, expire: 86400 });
}
