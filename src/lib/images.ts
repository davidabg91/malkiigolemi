import "server-only";
import { del, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MAX_UPLOAD_MB } from "./listing";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const LOCAL_DIR = path.join(process.cwd(), "data", "uploads");
const LOCAL_URL = /^\/uploads\/([a-f0-9]{24}\.[a-z0-9]+)$/;
const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;

/** Vercel Blob is used when a store is connected (token, or store id via OIDC); otherwise files go to data/uploads. */
const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

/** The longest side a stored photo keeps. The shop never shows one larger (the zoomed view asks for 1200 px, twice that on sharp screens). */
const MAX_SIDE = 2000;
/** WebP at this quality cannot be told from the original by eye and weighs a fraction of it. */
const QUALITY = 90;
/** A WebP of the right size under this weight is taken as it is. */
const COMPACT_BYTES = 900 * 1024;

/**
 * Makes an upload into what the shop keeps: no larger than `MAX_SIDE`, turned the right way up, without
 * the camera's hidden data (place, device), and packed well.
 *
 * The shop shows JPG and WebP photos edge to edge and treats PNG and AVIF as cut-outs with a see-through
 * background, which it shows smaller with space around. So a picture with no see-through pixel becomes
 * WebP, whatever it came as, and a cut-out stays a PNG (or the AVIF it came as).
 * The original is kept when this would not make it smaller.
 */
async function normalise(data: Buffer, type: string): Promise<{ data: Buffer; type: string }> {
  try {
    const meta = await sharp(data).metadata();
    const fits = Math.max(meta.width ?? 0, meta.height ?? 0) <= MAX_SIDE;
    const upright = (meta.orientation ?? 1) === 1;
    const opaque = type === "image/jpeg" || (await sharp(data).stats()).isOpaque;
    const sized = () => sharp(data).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });

    if (opaque) {
      const out = await sized().webp({ quality: QUALITY, effort: 5 }).toBuffer();
      // Already a well-packed photo of the right size and kind (what the browser sends after shrinking a big
      // one): leave it alone rather than pack it a second time.
      const keep = fits && upright && ((type === "image/webp" && data.length <= COMPACT_BYTES) || ((type === "image/webp" || type === "image/jpeg") && out.length >= data.length));
      return keep ? { data, type } : { data: out, type: "image/webp" };
    }
    // A cut-out: PNG keeps every pixel as it is.
    if (fits && upright && (type === "image/png" || type === "image/avif")) {
      if (type === "image/avif") return { data, type };
      const out = await sharp(data).png({ compressionLevel: 9 }).toBuffer();
      return out.length < data.length ? { data: out, type } : { data, type };
    }
    return { data: await sized().png({ compressionLevel: 9 }).toBuffer(), type: "image/png" };
  } catch {
    // A file sharp cannot read is stored as it came.
    return { data, type };
  }
}

async function store(data: Buffer, type: string) {
  const name = `${randomBytes(12).toString("hex")}.${IMAGE_TYPES[type]}`;
  if (blobConfigured()) {
    const blob = await put(`products/${name}`, data, { access: "public", contentType: type });
    return blob.url;
  }
  if (process.env.VERCEL) {
    // The deployment filesystem is read-only, so without a Blob store there is nowhere to keep the file.
    throw new Error("Няма свързано хранилище за снимки (Vercel Blob). Вижте DEPLOY.md.");
  }
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, name), data);
  return `/uploads/${name}`;
}

/** Saves an uploaded product photo and returns its public URL. The extension comes from the MIME type, never the client file name. */
export async function saveImage(file: File) {
  if (!IMAGE_TYPES[file.type]) throw new Error("Позволени са само JPG, PNG, WebP и AVIF изображения.");
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`Изображението е по-голямо от ${MAX_UPLOAD_MB} MB.`);
  const photo = await normalise(Buffer.from(await file.arrayBuffer()), file.type);
  return store(photo.data, photo.type);
}

/**
 * For a photo saved before uploads were tidied (`normalise`): stores it again the way a new upload would be
 * kept, removes the old file and returns the new address. Returns the address unchanged when there is
 * nothing to gain. WebP files are skipped: everything this file stores as WebP is already tidy.
 */
export async function tidyStoredPhoto(url: string): Promise<string> {
  const type = /\.png$/i.test(url) ? "image/png" : /\.avif$/i.test(url) ? "image/avif" : /\.jpe?g$/i.test(url) ? "image/jpeg" : null;
  if (!type) return url;
  try {
    const local = url.match(LOCAL_URL)?.[1];
    let data: Buffer;
    if (local) data = await readFile(path.join(LOCAL_DIR, local));
    else if (BLOB_URL.test(url)) data = Buffer.from(await (await fetch(url)).arrayBuffer());
    else return url;
    const photo = await normalise(data, type);
    if (photo.data === data) return url;
    const saved = await store(photo.data, photo.type);
    await removeImage(url);
    return saved;
  } catch (e) {
    console.error("Photo conversion failed", url, e);
    return url;
  }
}

/** Deletes a photo previously returned by saveImage. Anything else (external URLs, typos) is left alone. */
export async function removeImage(url: string | null) {
  if (!url) return;
  if (BLOB_URL.test(url) && blobConfigured()) {
    await del(url).catch(() => {});
    return;
  }
  const name = url.match(LOCAL_URL)?.[1];
  if (name) await unlink(path.join(LOCAL_DIR, name)).catch(() => {});
}
