"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Ensures that whenever navigating to a new route in the shop,
 * the scroll position is instantly and reliably reset to the very top (0, 0),
 * unless navigating to a specific hash anchor.
 */
export function RouteScrollTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname]);

  return null;
}
