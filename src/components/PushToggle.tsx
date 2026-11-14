"use client";

import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { subscribePush, unsubscribePush } from "@/actions/push";
import { btn } from "@/components/ui";

/** What this device can do about notifications right now. */
type State = "checking" | "unsupported" | "needs-install" | "off" | "on" | "blocked";

const toKey = (base64: string) => {
  const raw = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const registration = async () => (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });

/**
 * Turns notifications about orders on and off for this device. Asks the phone for permission only after
 * the customer presses the button. On an order's page the device is also tied to that order, so someone
 * who ordered without an account is told when it is confirmed, shipped and delivered.
 */
export function PushToggle({
  publicKey,
  orderNumber,
  className = "",
  audience = "customer",
  compact = false,
}: {
  publicKey: string;
  orderNumber?: string;
  className?: string;
  /** Who the wording is for: a customer following an order, or the shop's admin. */
  audience?: "customer" | "admin" | "chat";
  /** One small line with a button instead of a card (inside the chat). */
  compact?: boolean;
}) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let next: State;
      if (!supported) {
        // An iPhone offers notifications only to a site that is on the home screen.
        next = ios && !standalone ? "needs-install" : "unsupported";
      } else if (Notification.permission === "denied") {
        next = "blocked";
      } else {
        const existing = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription().catch(() => null);
        next = existing && Notification.permission === "granted" ? "on" : "off";
        // Checking in keeps the device tied to the account and to this order.
        if (existing && next === "on") void subscribePush(existing.toJSON() as Parameters<typeof subscribePush>[0], { orderNumber }).catch(() => {});
      }
      if (live) setState(next);
    })();
    return () => {
      live = false;
    };
  }, [orderNumber]);

  const turnOn = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
      const { ok } = await subscribePush(sub.toJSON() as Parameters<typeof subscribePush>[0], { orderNumber, welcome: true });
      if (!ok) throw new Error("not saved");
      setState("on");
      toast.success("Известията са включени");
    } catch {
      toast.error("Известията не можаха да се включат. Опитай отново.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Известията са изключени");
    } catch {
      toast.error("Известията не можаха да се изключат.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "checking" || state === "unsupported") return null;

  const text = {
    customer: {
      ask: "Искаш ли известие, когато поръчката тръгне?",
      askHint: "Ще ти казваме на телефона, когато е потвърдена, изпратена и доставена. Без реклами.",
      on: "Ще ти кажем, когато поръчката бъде потвърдена, изпратена и доставена.",
      install: "Известия за поръчката на телефона",
    },
    admin: {
      ask: "Включи известията на това устройство",
      askHint: "Телефонът ще звъни за нови поръчки, съобщения в чата и всичко, което си избрал по-долу.",
      on: "Това устройство получава известията, избрани по-долу.",
      install: "Известия от магазина на телефона",
    },
    chat: {
      ask: "Извести ме, когато отговорите",
      askHint: "",
      on: "Ще получиш известие, когато отговорим.",
      install: "Известие при отговор",
    },
  }[audience];

  if (compact) {
    if (state === "needs-install" || state === "blocked") return null;
    return state === "on" ? (
      <p className={`flex items-center gap-1.5 text-xs text-ink-soft ${className}`}>
        <BellRing className="h-3.5 w-3.5 shrink-0 text-forest" aria-hidden />
        {text.on}
      </p>
    ) : (
      <button type="button" onClick={turnOn} disabled={busy} className={`inline-flex items-center gap-1.5 text-xs font-semibold text-forest underline-offset-2 hover:underline ${className}`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Bell className="h-3.5 w-3.5" aria-hidden />}
        {text.ask}
      </button>
    );
  }

  const box = `flex flex-wrap items-center gap-x-4 gap-y-3 rounded-tile bg-paper p-5 shadow-soft sm:p-6 ${className}`;
  const icon = "grid h-11 w-11 shrink-0 place-items-center rounded-2xl";

  if (state === "needs-install") {
    return (
      <div className={box}>
        <span className={`${icon} bg-sand text-ink`}>
          <Bell className="h-5 w-5" aria-hidden />
        </span>
        <p className="min-w-48 flex-1 text-[0.95rem]">
          <span className="font-semibold">{text.install}</span>
          <span className="block text-sm text-ink-soft">На iPhone работят, след като добавиш магазина на началния екран.</span>
        </p>
        <Link href="/prilozhenie" className={btn.sm}>
          Покажи ми как
        </Link>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div className={box}>
        <span className={`${icon} bg-sand text-ink-soft`}>
          <BellOff className="h-5 w-5" aria-hidden />
        </span>
        <p className="min-w-48 flex-1 text-[0.95rem]">
          <span className="font-semibold">Известията са спрени за този сайт</span>
          <span className="block text-sm text-ink-soft">Разреши ги от настройките на телефона или браузъра, за да получаваш известия оттук.</span>
        </p>
      </div>
    );
  }

  if (state === "on") {
    return (
      <div className={box}>
        <span className={`${icon} bg-forest text-white`}>
          <BellRing className="h-5 w-5" aria-hidden />
        </span>
        <p className="min-w-48 flex-1 text-[0.95rem]">
          <span className="font-semibold">Известията са включени на това устройство</span>
          <span className="block text-sm text-ink-soft">{text.on}</span>
        </p>
        <button type="button" onClick={turnOff} disabled={busy} className={btn.sm}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Изключи
        </button>
      </div>
    );
  }

  return (
    <div className={`${box} border-2 border-forest`}>
      <span className={`${icon} bg-sand text-ink`}>
        <Bell className="h-5 w-5" aria-hidden />
      </span>
      <p className="min-w-48 flex-1 text-[0.95rem]">
        <span className="font-semibold">{text.ask}</span>
        <span className="block text-sm text-ink-soft">{text.askHint}</span>
      </p>
      <button type="button" onClick={turnOn} disabled={busy} className={btn.smPrimary}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
        Включи известията
      </button>
    </div>
  );
}
