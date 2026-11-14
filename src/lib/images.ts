import "server-only";
import { del, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MAX_IMAGE_MB } from "./listing";

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

/**
 * The shop shows JPG and WebP photos edge to edge and treats PNG and AVIF as cut-outs with a see-through
 * background, which it shows smaller with space around. A PNG or AVIF without a single see-through pixel
 * is an ordinary photo, so it is turned into WebP and shown edge to edge like the others.
 */
async function asPhoto(data: Buffer, type: string): Promise<{ data: Buffer; type: string }> {
  if (type !== "image/png" && type !== "image/avif") return { data, type };
  try {
    if (!(await sharp(data).stats()).isOpaque) return { data, type };
    return { data: await sharp(data).webp({ quality: 90 }).toBuffer(), type: "image/webp" };
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
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`Изображението е по-голямо от ${MAX_IMAGE_MB} MB.`);
  const photo = await asPhoto(Buffer.from(await file.arrayBuffer()), file.type);
  return store(photo.data, photo.type);
}

/**
 * For a photo saved before `asPhoto` existed: if it is a PNG or AVIF with no see-through pixels, stores it
 * again as WebP, removes the old file and returns the new address. Otherwise returns the address unchanged.
 */
export async function photoIfOpaque(url: string): Promise<string> {
  const type = /\.png$/i.test(url) ? "image/png" : /\.avif$/i.test(url) ? "image/avif" : null;
  if (!type) return url;
  try {
    const local = url.match(LOCAL_URL)?.[1];
    let data: Buffer;
    if (local) data = await readFile(path.join(LOCAL_DIR, local));
    else if (BLOB_URL.test(url)) data = Buffer.from(await (await fetch(url)).arrayBuffer());
    else return url;
    const photo = await asPhoto(data, type);
    if (photo.type === type) return url;
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
