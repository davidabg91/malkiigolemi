import { Suspense } from "react";
import { ChatMount } from "@/components/chat/ChatMount";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { RouteScrollTop } from "@/components/layout/RouteScrollTop";
import { FreshOnReturn } from "@/components/FreshOnReturn";
import { InstallBanner } from "@/components/InstallApp";
import { Tracker } from "@/components/Tracker";

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={null}>
        <RouteScrollTop />
        <Tracker />
        <FreshOnReturn />
        <InstallBanner />
      </Suspense>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-cream"
      >
        Към съдържанието
      </a>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <CartDrawer />
      <Suspense fallback={null}>
        <ChatMount />
      </Suspense>
    </>
  );
}
