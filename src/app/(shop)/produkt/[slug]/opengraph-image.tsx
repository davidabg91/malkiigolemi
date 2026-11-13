import { ImageResponse } from "next/og";
import SiteImage from "@/app/opengraph-image";
import { discountPercent, formatPrice } from "@/lib/format";
import { LOGO_RATIO, LOGO_SRC, OG_FONTS, OG_SIZE, productPhoto, tint } from "@/lib/og";
import { getProduct } from "@/lib/queries";
import { site } from "@/lib/site";

// The picture shown when a product link is shared: the product itself, its name and price, and the logo.
export const alt = `Продукт от ${site.name}`;
export const size = OG_SIZE;
export const contentType = "image/png";

const PANEL = 560;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getProduct((await params).slug);
  // A hidden product (or one in a switched-off category) is not on sale: share the shop instead.
  if (!data || !data.product.active || data.category?.active === false || data.parent?.active === false) return SiteImage();

  const p = data.product;
  const photo = p.image ? await productPhoto(p.image, 900) : null;
  const off = discountPercent(p.price, p.oldPrice);
  const logoHeight = 62;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#fbf8f1", fontFamily: "Onest" }}>
        <div style={{ position: "relative", display: "flex", width: PANEL, height: "100%", alignItems: "center", justifyContent: "center", background: tint(p.color, 0.16) }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page
            <img src={photo} alt="" style={{ maxWidth: PANEL - 80, maxHeight: 630 - 80, objectFit: "contain" }} />
          ) : (
            // No photo: the same illustrated pack the shop shows, simplified.
            <div style={{ display: "flex", width: 270, height: 360, alignItems: "center", justifyContent: "center", borderRadius: 34, background: p.color, boxShadow: "0 30px 50px rgb(20 38 28 / 0.22)" }}>
              <div style={{ display: "flex", width: 196, height: 130, alignItems: "center", justifyContent: "center", borderRadius: 18, background: "#fffdf8", padding: 14, textAlign: "center", fontSize: 26, fontWeight: 700, color: p.color }}>
                {p.brand ?? site.name}
              </div>
            </div>
          )}
          {off > 0 && (
            <div style={{ position: "absolute", left: 36, top: 36, display: "flex", borderRadius: 9999, background: "#d63a1f", padding: "10px 22px", fontSize: 30, fontWeight: 700, color: "#ffffff" }}>
              −{off}%
            </div>
          )}
        </div>

        <div style={{ display: "flex", flex: 1, flexDirection: "column", padding: "52px 56px 44px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page */}
            <img src={LOGO_SRC} width={Math.round(logoHeight * LOGO_RATIO)} height={logoHeight} alt="" />
            <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#55635a" }}>{site.domain}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
            {p.brand && <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#1f5c3f" }}>{p.brand}</div>}
            <div style={{ display: "block", marginTop: 12, fontSize: 50, fontWeight: 700, lineHeight: 1.15, color: "#14261c", lineClamp: 3 }}>{p.name}</div>
            {p.unit && <div style={{ marginTop: 14, fontSize: 28, fontWeight: 500, color: "#55635a" }}>{p.unit}</div>}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <div style={{ fontSize: 72, fontWeight: 700, color: off > 0 ? "#d63a1f" : "#14261c" }}>{formatPrice(p.price)}</div>
            {off > 0 && p.oldPrice && <div style={{ fontSize: 34, fontWeight: 500, color: "#55635a", textDecoration: "line-through" }}>{formatPrice(p.oldPrice)}</div>}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: OG_FONTS },
  );
}
