import { getImageProps } from "next/image";

const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;

/**
 * `src`/`srcSet` for a plain <img> that keeps its own CSS sizing but downloads a resized WebP
 * instead of the original file (a 1 MB PNG becomes a few dozen KB). `width` is roughly how wide
 * the image is drawn, in CSS pixels; screens with a higher pixel density get the 2x version.
 *
 * Works for anything in /public, admin uploads and Vercel Blob. Other URLs are returned untouched.
 */
export function optimizedImage(src: string, width: number): { src: string; srcSet?: string } {
  if (!(src.startsWith("/") || BLOB_URL.test(src))) return { src };
  const { props } = getImageProps({ src, alt: "", width, height: width, quality: 90 });
  return { src: props.src, srcSet: props.srcSet };
}
