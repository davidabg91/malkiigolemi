import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

/** Share-image size used by Facebook, Viber, WhatsApp, Messenger and X. */
export const OG_SIZE = { width: 1200, height: 630 };

// Read once per server instance: none of it depends on the request. Spelled-out paths let the build
// ship exactly these files with the image routes.
const [onestMedium, onestBold, unboundedBold, logo] = await Promise.all([
  readFile(join(process.cwd(), "src", "assets", "fonts", "Onest-Medium.ttf")),
  readFile(join(process.cwd(), "src", "assets", "fonts", "Onest-Bold.ttf")),
  readFile(join(process.cwd(), "src", "assets", "fonts", "Unbounded-Bold.ttf")),
  readFile(join(process.cwd(), "public", "logo.png")),
]);

/** The header logo (1036 × 291). */
export const LOGO_SRC = `data:image/png;base64,${logo.toString("base64")}`;
export const LOGO_RATIO = 1036 / 291;

/** The site's own fonts; the renderer's built-in one has no Cyrillic. */
export const OG_FONTS = [
  { name: "Onest", data: onestMedium, weight: 500 as const, style: "normal" as const },
  { name: "Onest", data: onestBold, weight: 700 as const, style: "normal" as const },
  { name: "Unbounded", data: unboundedBold, weight: 700 as const, style: "normal" as const },
];

const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;
const UPLOAD = /^\/uploads\/([a-f0-9]{24}\.(?:jpg|png|webp|avif))$/;

/**
 * A product photo as a PNG data URI the renderer can draw (it reads neither WebP nor AVIF).
 * Only the shop's own files are read: /public, admin uploads and Vercel Blob. Anything else gives null.
 */
export async function productPhoto(src: string, box: number): Promise<string | null> {
  try {
    let bytes: Buffer;
    const upload = UPLOAD.exec(src);
    if (upload) bytes = await readFile(join(process.cwd(), "data", "uploads", upload[1]));
    else if (BLOB_URL.test(src)) {
      const res = await fetch(src);
      if (!res.ok) return null;
      bytes = Buffer.from(await res.arrayBuffer());
    } else if (/^\/[\w.-]+\.(png|jpe?g|webp|avif)$/i.test(src)) bytes = await readFile(join(process.cwd(), "public", src.slice(1)));
    else return null;

    const png = await sharp(bytes).resize(box, box, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** `hex` mixed into the cream background, like the product cards' color-mix tint. */
export function tint(hex: string, amount: number, base = "#f5f5f4") {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [rgb(/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#33484b"), rgb(base)];
  return `rgb(${a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount))).join(" ")})`;
}
