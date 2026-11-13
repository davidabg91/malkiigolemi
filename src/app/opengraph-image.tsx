import { ImageResponse } from "next/og";
import { LOGO_RATIO, LOGO_SRC, OG_FONTS, OG_SIZE } from "@/lib/og";
import { site } from "@/lib/site";

// The picture shown when the shop (or any page without its own) is shared on Facebook, Viber, Messenger…
export const alt = site.name;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const logoWidth = 820;
  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f5f5f4", fontFamily: "Onest" }}>
        <div style={{ position: "absolute", right: -140, top: -160, width: 460, height: 460, borderRadius: 9999, background: "#ebebe8", opacity: 0.55 }} />
        <div style={{ position: "absolute", left: -180, bottom: -220, width: 520, height: 520, borderRadius: 9999, background: "#2b3f42", opacity: 0.08 }} />
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page */}
        <img src={LOGO_SRC} width={logoWidth} height={Math.round(logoWidth / LOGO_RATIO)} alt="" />
        <div style={{ marginTop: 34, fontSize: 38, fontWeight: 500, color: "#5c5f62" }}>Онлайн магазин за цялото семейство</div>
        <div style={{ position: "absolute", bottom: 40, display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 700, color: "#2b3f42" }}>
          <div style={{ display: "flex", borderRadius: 9999, background: "#ebebe8", padding: "8px 22px" }}>Безплатна доставка с BoxNow</div>
          <div style={{ display: "flex", color: "#5c5f62", fontWeight: 500 }}>{site.domain}</div>
        </div>
      </div>
    ),
    { ...size, fonts: OG_FONTS },
  );
}
