"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useIsAdmin } from "@/lib/admin-flag";

/** Back in the tab after at least this long away: ask the server again. */
const AWAY_MS = 15_000;

/**
 * Keeps a page from showing old data when someone comes back to it. The browser's Back and Forward
 * buttons bring a page back exactly as it was left, so a product deleted in the meantime would still be
 * listed there; this asks the server for the page again as soon as it is shown. For admins (always in the
 * admin panel, and in the shop when signed in as one) it also refreshes when the tab is returned to after a
 * while, so a change made on another device shows up without reloading.
 */
export function FreshOnReturn({ always = false }: { always?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const isAdmin = useIsAdmin();
  const cameBack = useRef(false);
  const watchTab = always || isAdmin;

  useEffect(() => {
    let timer = 0;
    const onPop = () => {
      cameBack.current = true;
      // The router may already have switched pages by the time this event arrives; then the effect below
      // has run without knowing about it, so the refresh is asked for from here.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!cameBack.current) return;
        cameBack.current = false;
        router.refresh();
      }, 80);
    };
    // A page restored whole from the browser's back/forward cache.
    const onShow = (e: PageTransitionEvent) => e.persisted && router.refresh();
    window.addEventListener("popstate", onPop);
    window.addEventListener("pageshow", onShow);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pageshow", onShow);
    };
  }, [router]);

  // The address changed because of Back or Forward: the page now on screen is an old copy.
  useEffect(() => {
    if (!cameBack.current) return;
    cameBack.current = false;
    router.refresh();
  }, [pathname, search, router]);

  useEffect(() => {
    if (!watchTab) return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [watchTab, router]);

  return null;
}
