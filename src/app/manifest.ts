import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Lets phones add the shop to the home screen and open it full screen, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: "Малки и големи",
    description: site.description,
    lang: "bg",
    // Visits from the installed app show up as their own source in Админ → Посетители.
    start_url: "/?utm_source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f5f4",
    theme_color: "#2b3f42",
    categories: ["shopping"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Промоции", url: "/promo?utm_source=app" },
      { name: "Нови продукти", url: "/novi?utm_source=app" },
      { name: "Количка", url: "/kolichka?utm_source=app" },
    ],
  };
}
