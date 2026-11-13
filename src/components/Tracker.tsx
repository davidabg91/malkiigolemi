"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { flush, track } from "@/lib/track";

/** Where on the page a click landed, for "къде цъкат най-много". */
function zoneOf(el: Element) {
  if (el.closest("[data-cart-drawer]")) return "Количка";
  if (el.closest("header")) return "Горно меню";
  if (el.closest("footer")) return "Футър";
  if (el.closest("form")) return "Форма";
  return "Страница";
}

/** A short, stable name for what was clicked: "Добави в количката: Спагети…" → "Добави в количката". */
function labelOf(el: Element) {
  const raw = el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || "";
  return raw.replace(/\s+/g, " ").trim().split(/[:,(]/)[0].replace(/\d[\d\s.,]*(€|бр)?/g, "").trim().slice(0, 60);
}

/**
 * Records page views, time on each page and clicks for the admin's visitor statistics.
 * Anonymous and cookieless; honours the browser's "Do Not Track".
 */
export function Tracker() {
  const pathname = usePathname();
  const query = useSearchParams().get("q");
  const landed = useRef(false);

  // One view per page (and per search), with the time it stayed on screen sent when it is left.
  useEffect(() => {
    let source: string | undefined;
    if (!landed.current) {
      landed.current = true;
      const utm = new URLSearchParams(window.location.search).get("utm_source");
      let host = "";
      try {
        host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
      } catch {}
      source = (utm || (host && host !== window.location.hostname.replace(/^www\./, "") ? host : "") || "директно").slice(0, 60);
    }
    track({ t: "view", p: pathname, l: pathname === "/tarsene" && query ? query.trim().toLowerCase().slice(0, 60) : undefined, r: source });

    let since = document.visibilityState === "visible" ? performance.now() : 0;
    let seconds = 0;
    const pause = () => {
      if (since) seconds += (performance.now() - since) / 1000;
      since = 0;
    };
    const send = () => {
      pause();
      const v = Math.min(1800, Math.round(seconds));
      seconds = 0;
      if (v >= 1) track({ t: "time", p: pathname, v });
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") since = performance.now();
      else {
        send();
        flush();
      }
    };
    const onHide = () => {
      send();
      flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      send();
    };
  }, [pathname, query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("a, button, [role=button], summary");
      if (!el) return;
      const label = labelOf(el);
      if (label) track({ t: "click", l: `${zoneOf(el)} · ${label}` });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
