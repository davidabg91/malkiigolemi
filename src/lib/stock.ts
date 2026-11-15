import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * A product sold in several colours keeps a quantity per colour (`products.colorStock`, in the same order
 * as `colorOptions`); its `stock` is then the sum of them. Everything that sells or returns goods goes
 * through here, so the two never drift apart.
 */
const at = (index: number) => `$[${index}]`;

/**
 * Takes `qty` out of stock, from one colour when the product has colours. The checks sit in the WHERE of
 * the update itself, so two orders at once cannot take the same last piece.
 * Returns how many of the product are left in total, or null when there were not enough.
 */
export async function takeStock(tx: Db | Tx, product: { id: number; colorOptions: string[] }, qty: number, color: string | null): Promise<number | null> {
  if (product.colorOptions.length === 0) {
    const [left] = await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${qty}` })
      .where(and(eq(products.id, product.id), gte(products.stock, qty)))
      .returning({ stock: products.stock });
    return left ? left.stock : null;
  }
  const index = color ? product.colorOptions.indexOf(color) : -1;
  if (index < 0) return null;
  const path = at(index);
  const [left] = await tx
    .update(products)
    .set({
      stock: sql`${products.stock} - ${qty}`,
      // Cast: a number sent with the query arrives as a decimal, and the list keeps whole numbers.
      colorStock: sql`json_set(${products.colorStock}, ${path}, cast(json_extract(${products.colorStock}, ${path}) - ${qty} as integer))`,
    })
    .where(
      and(
        eq(products.id, product.id),
        gte(products.stock, qty),
        // The colour is still where it was read a moment ago, and has enough.
        sql`json_extract(${products.colorOptions}, ${path}) = ${color}`,
        sql`json_extract(${products.colorStock}, ${path}) >= ${qty}`,
      ),
    )
    .returning({ stock: products.stock });
  return left ? left.stock : null;
}

/**
 * Puts goods back (a cancelled order: `delta` above zero) or takes them again without asking whether there
 * are enough (a cancelled order opened again: `delta` below zero); nothing goes under zero.
 * For a product with colours the line's colour gets them. A line whose colour the product no longer has
 * (or an old line from before the product had colours) changes nothing: there is no colour to count it under.
 * Returns the product's new total, or null when nothing changed.
 */
export async function moveStock(tx: Db | Tx, productId: number, delta: number, color: string | null): Promise<number | null> {
  const [product] = await tx.select({ colorOptions: products.colorOptions }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return null;
  if (product.colorOptions.length === 0) {
    const [row] = await tx
      .update(products)
      .set({ stock: sql`max(0, ${products.stock} + ${delta})` })
      .where(eq(products.id, productId))
      .returning({ stock: products.stock });
    return row ? row.stock : null;
  }
  const index = color ? product.colorOptions.indexOf(color) : -1;
  if (index < 0) return null;
  const path = at(index);
  // Both numbers move by what the colour really changed by, so the total stays the sum of the colours.
  const [row] = await tx
    .update(products)
    .set({
      stock: sql`max(0, ${products.stock} + max(${delta}, -coalesce(json_extract(${products.colorStock}, ${path}), 0)))`,
      colorStock: sql`json_set(${products.colorStock}, ${path}, cast(max(0, coalesce(json_extract(${products.colorStock}, ${path}), 0) + ${delta}) as integer))`,
    })
    .where(and(eq(products.id, productId), sql`json_extract(${products.colorOptions}, ${path}) = ${color}`))
    .returning({ stock: products.stock });
  return row ? row.stock : null;
}
