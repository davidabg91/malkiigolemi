import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { Toaster } from "sonner";
import { site } from "@/lib/site";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  // Share images and links need absolute addresses.
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { type: "website", siteName: site.name, locale: "bg_BG", title: site.title, description: site.description },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  // On an iPhone's home screen the shop opens full screen under this name.
  appleWebApp: { capable: true, title: "Малки и големи", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#2b3f42",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bg" className={`${onest.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              borderRadius: "999px",
              background: "#171717",
              color: "#f5f5f4",
              border: "none",
              fontFamily: "var(--font-onest)",
            },
            // Sonner's default description colour is dark grey, which disappears on the dark toast.
            classNames: { description: "text-cream/80!" },
          }}
        />
      </body>
    </html>
  );
}
