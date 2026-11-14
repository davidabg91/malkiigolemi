import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Photos are resized and converted to WebP on first request (see src/lib/optimized-image.ts).
    qualities: [75, 90],
    // Keep each resized copy for a month: files in /public and uploads never change under the same name.
    minimumCacheTTL: 2678400,
    // Product photos uploaded from the admin live in Vercel Blob.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  experimental: {
    // Product photos are uploaded through a Server Action (max 3 MB each, see MAX_IMAGE_MB).
    // Keep this under Vercel's 4.5 MB request limit.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        // The service worker must never be served stale, or phones keep an old one.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
