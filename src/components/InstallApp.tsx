"use client";

import { Check, Download, Share, SquarePlus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { btn } from "@/components/ui";
import { promptInstall, startPwa, useInstallMode } from "@/lib/pwa";

const DISMISSED_KEY = "app-hint-until";
const DAY = 86_400_000;
// Pages where an offer would get in the way of paying or signing in.
const QUIET = ["/porachka", "/plati", "/vhod", "/registratsiya", "/prilozhenie", "/kolichka"];

const read = () => {
  try {
    return Number(localStorage.getItem(DISMISSED_KEY)) || 0;
  } catch {
    return 0;
  }
};

/**
 * A small card at the bottom of a phone's screen offering to put the shop on the home screen. Shown a few
 * seconds into a visit, never inside the installed app, and not again for two weeks once it is closed.
 */
export function InstallBanner() {
  const pathname = usePathname();
  const mode = useInstallMode();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    startPwa();
    const timer = window.setTimeout(() => setReady(read() < Date.now()), 7000);
    return () => window.clearTimeout(timer);
  }, []);

  const close = (days: number) => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now() + days * DAY));
    } catch {}
    setReady(false);
  };

  if (!ready || mode === "none" || mode === "installed" || QUIET.some((p) => pathname.startsWith(p))) return null;

  return (
    <aside
      aria-label="Приложение за телефона"
      className="fixed inset-x-3 bottom-3 z-30 animate-rise rounded-3xl bg-paper p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lift md:hidden"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed icon */}
        <img src="/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl shadow-soft" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">Сложи магазина на телефона си</p>
          {mode === "prompt" && <p className="mt-0.5 text-sm text-ink-soft">Отваря се с едно докосване, на цял екран, като приложение.</p>}
          {mode === "ios" && (
            <p className="mt-0.5 text-sm text-ink-soft">
              Натисни <Share className="inline h-4 w-4 align-[-3px] text-ink" aria-label="Сподели" /> и после{" "}
              <span className="whitespace-nowrap font-medium text-ink">
                „Добави към начален екран“ <SquarePlus className="inline h-4 w-4 align-[-3px]" aria-hidden />
              </span>
              .
            </p>
          )}
          {mode === "inapp" && <p className="mt-0.5 text-sm text-ink-soft">Отвори сайта в Safari или Chrome, за да го добавиш като приложение.</p>}
        </div>
        <button type="button" onClick={() => close(14)} className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink" aria-label="Затвори">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {mode === "prompt" ? (
          <button
            type="button"
            onClick={async () => {
              // Declined in the system dialog: do not ask again for a while.
              if (!(await promptInstall())) close(14);
            }}
            className={`${btn.smPrimary} flex-1`}
          >
            <Download className="h-4 w-4" aria-hidden />
            Инсталирай
          </button>
        ) : (
          <Link href="/prilozhenie" onClick={() => close(1)} className={`${btn.sm} flex-1`}>
            Покажи ми как
          </Link>
        )}
      </div>
    </aside>
  );
}

/** The install button on the "Приложение за телефона" page; says so when there is nothing to press. */
export function InstallButton() {
  const mode = useInstallMode();
  useEffect(startPwa, []);

  if (mode === "installed") {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-sand px-4 py-3 font-medium text-ink">
        <Check className="h-5 w-5" aria-hidden />
        Приложението вече е на този телефон.
      </p>
    );
  }
  if (mode !== "prompt") return null;
  return (
    <button type="button" onClick={() => promptInstall()} className={btn.primary}>
      <Download className="h-5 w-5" aria-hidden />
      Инсталирай приложението
    </button>
  );
}
