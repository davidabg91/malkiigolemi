import { MAX_IMAGE_MB } from "./listing";

/**
 * Makes a photo small enough to upload, in the browser, before it is sent.
 *
 * The form is sent through a request that the hosting cuts off at 4.5 MB, so a 7 MB photo from a phone
 * cannot be uploaded as it is. A photo is far larger than the shop ever shows it: scaled to the size the
 * shop keeps (see `normalise` in images.ts) and saved at high quality it weighs a fraction, with no
 * difference to the eye. The server does the final tidy-up; this only gets the file through.
 */

/** Photos up to this size are sent as they are. */
const SHRINK_ABOVE = 1.5 * 1024 * 1024;
/** What a shrunk photo must fit in to pass the upload limit together with the rest of the form. */
export const UPLOAD_LIMIT = 3.6 * 1024 * 1024;
/** Longest side sent: the size the server keeps, so it can take the file as it is instead of packing it again. */
const MAX_SIDE = 2000;
const QUALITY = 0.92;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((done) => canvas.toBlob(done, type, quality));

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

/** Draws the picture at the wanted size, halving on the way down: one big jump would leave it jagged. */
function scaled(source: ImageBitmap, width: number, height: number) {
  let from: CanvasImageSource = source;
  let w = source.width;
  let h = source.height;
  while (w / 2 > width) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    const half = canvasOf(w, h);
    half.ctx.drawImage(from, 0, 0, w, h);
    from = half.canvas;
  }
  const out = canvasOf(width, height);
  out.ctx.drawImage(from, 0, 0, width, height);
  return out;
}

/** Whether any of the picture is see-through (a cut-out product on no background). */
function seeThrough(source: ImageBitmap) {
  const side = 256;
  const { ctx } = canvasOf(side, side);
  ctx.drawImage(source, 0, 0, side, side);
  const pixels = ctx.getImageData(0, 0, side, side).data;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 250) return true;
  return false;
}

export type ShrinkResult = { ok: true; file: File; shrunk: boolean } | { ok: false; error: string };

export async function shrinkImage(file: File): Promise<ShrinkResult> {
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    return { ok: false, error: `Снимката е ${(file.size / 1024 / 1024).toFixed(1)} MB. Максимумът е ${MAX_IMAGE_MB} MB.` };
  }
  if (file.size <= SHRINK_ABOVE) return { ok: true, file, shrunk: false };

  const tooBig: ShrinkResult = { ok: false, error: "Снимката не можа да бъде намалена на това устройство. Опитай с по-малка (до 3,5 MB) или от друг браузър." };
  const asItIs: ShrinkResult = file.size <= UPLOAD_LIMIT ? { ok: true, file, shrunk: false } : tooBig;

  let bitmap: ImageBitmap;
  try {
    // "from-image" turns a phone photo the right way up, as its own rotation mark says.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return asItIs;
  }
  try {
    // A cut-out keeps its see-through background (PNG); a photo becomes WebP, or JPG where the browser cannot write WebP.
    const cutOut = file.type !== "image/jpeg" && seeThrough(bitmap);
    let blob: Blob | null = null;
    for (let side = MAX_SIDE, attempt = 0; attempt < 5; attempt++, side = Math.round(side * 0.8)) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const { canvas } = scaled(bitmap, Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
      if (cutOut) {
        blob = await toBlob(canvas, "image/png");
      } else {
        blob = await toBlob(canvas, "image/webp", QUALITY);
        if (blob?.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", QUALITY);
      }
      if (blob && blob.size <= UPLOAD_LIMIT) break;
    }
    if (!blob || blob.size > UPLOAD_LIMIT) return asItIs;
    // Nothing gained (an already well-packed file): send the original.
    if (blob.size >= file.size && file.size <= UPLOAD_LIMIT) return { ok: true, file, shrunk: false };
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    return { ok: true, file: new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, { type: blob.type }), shrunk: true };
  } catch {
    return asItIs;
  } finally {
    bitmap.close();
  }
}

/** Puts `file` in a file field in place of what was chosen; false where the browser does not allow it. */
export function replaceChosenFile(input: HTMLInputElement, file: File) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    return input.files?.[0]?.size === file.size;
  } catch {
    return false;
  }
}

export const megabytes = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
