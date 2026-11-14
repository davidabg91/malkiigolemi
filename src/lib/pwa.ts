import { useSyncExternalStore } from "react";

/**
 * Adding the shop to a phone's home screen. Android (Chrome) offers a real install dialog; on an iPhone
 * the customer has to do it from Safari's share menu; inside Facebook's or Google's own browser it
 * cannot be done at all, so the customer is told to open the site in the phone's browser.
 */
export type InstallMode = "prompt" | "ios" | "inapp" | "installed" | "none";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPromptEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Registers the service worker and starts listening for the browser's install offer. Safe to call often. */
export function startPwa() {
  if (started || typeof window === "undefined") return;
  started = true;
  // In development a service worker only gets in the way of reloads.
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function mode(): InstallMode {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installed || standalone) return "installed";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Messenger|GSA\/|Line\//.test(ua);
  if (inApp && (ios || /android/i.test(ua))) return "inapp";
  return ios ? "ios" : "none";
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** How this visitor can install the shop; "none" on the server and where it is not possible. */
export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, mode, () => "none");
}

/** Opens Android's install dialog. Resolves to whether the customer accepted. */
export async function promptInstall() {
  const event = deferred;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  // The browser allows one use of the event.
  deferred = null;
  if (outcome === "accepted") installed = true;
  notify();
  return outcome === "accepted";
}
