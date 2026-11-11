import "server-only";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products, stockAlerts } from "@/db/schema";
import { escapeHtml, mailLayout, sendMail } from "./mail";
import { site } from "./site";

/**
 * Tells everyone waiting for these products that they are back. E-mails go out when e-mail is set up;
 * an alert is marked done only once its e-mail was sent, so nothing is lost if sending is not configured yet.
 * Signed-in customers also see the product in their profile, which needs no e-mail at all.
 */
export async function notifyRestocked(productIds: number[]) {
  if (productIds.length === 0) return;
  const waiting = await db
    .select({ alert: stockAlerts, name: products.name, unit: products.unit, slug: products.slug })
    .from(stockAlerts)
    .innerJoin(products, eq(products.id, stockAlerts.productId))
    .where(and(inArray(stockAlerts.productId, productIds), isNull(stockAlerts.notifiedAt), gt(products.stock, 0), eq(products.active, true)));

  for (const w of waiting) {
    const name = `${w.name} ${w.unit}`.trim();
    const url = `${site.url}/produkt/${w.slug}`;
    const sent = await sendMail(
      w.alert.email,
      `${name} е отново наличен`,
      mailLayout(`${name} е отново наличен`, `<p>Здравей! Продуктът, който чакаше, отново е в наличност: <strong>${escapeHtml(name)}</strong>.</p><p>Побързай, преди да свърши пак.</p>`, {
        href: url,
        label: "Виж продукта",
      }),
    );
    if (sent) await db.update(stockAlerts).set({ notifiedAt: new Date() }).where(eq(stockAlerts.id, w.alert.id));
  }
}
