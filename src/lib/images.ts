import "server-only";
import { del, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
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

/** Saves an uploaded product photo and returns its public URL. The extension comes from the MIME type, never the client file name. */
export async function saveImage(file: File) {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Позволени са само JPG, PNG, WebP и AVIF изображения.");
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`Изображението е по-голямо от ${MAX_IMAGE_MB} MB.`);
  const name = `${randomBytes(12).toString("hex")}.${ext}`;

  if (blobConfigured()) {
    const blob = await put(`products/${name}`, file, { access: "public", contentType: file.type });
    return blob.url;
  }
  if (process.env.VERCEL) {
    // The deployment filesystem is read-only, so without a Blob store there is nowhere to keep the file.
    throw new Error("Няма свързано хранилище за снимки (Vercel Blob). Вижте DEPLOY.md.");
  }
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
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
