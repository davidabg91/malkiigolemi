import type { Metadata, Viewport } from "next";
import { Onest, Unbounded } from "next/font/google";
import { Toaster } from "sonner";
import { site } from "@/lib/site";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: site.title, template: `%s · ${site.name}` },
  description: site.description,
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.png",
    apple: "/logo-badge.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#123a28",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bg" className={`${onest.variable} ${unbounded.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              borderRadius: "999px",
              background: "#14261c",
              color: "#fbf8f1",
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
