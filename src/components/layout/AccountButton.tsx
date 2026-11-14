"use client";

import { ArrowRight, ClipboardPaste, LayoutDashboard, MessagesSquare, QrCode, ReceiptText, Undo2, User, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { adminAlertsAction } from "@/actions/admin-alerts";
import type { AdminAlerts } from "@/lib/admin-alerts";

const iconBtn = "relative grid h-11 w-11 place-items-center rounded-full text-ink transition raised hover:brightness-[0.97] active:scale-95";

/**
 * The header's profile icon. For an admin it also carries what is waiting in the admin panel: the icon
 * turns red with a count, and a click opens a small bubble listing new orders, shop payments, withdrawals and Facebook claims.
 */
export function AccountButton({ alerts: initial }: { alerts: AdminAlerts | null }) {
  if (!initial) {
    return (
      <Link href="/profil" className={iconBtn} aria-label="Моят профил">
        <User className="h-[22px] w-[22px]" strokeWidth={1.75} />
      </Link>
    );
  }
  return <AdminAccountButton initial={initial} />;
}

function AdminAccountButton({ initial }: { initial: AdminAlerts }) {
  const [alerts, setAlerts] = useState(initial);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // A new value from the server (after a refresh) wins over the last one fetched here.
  const [synced, setSynced] = useState(initial);
  if (initial !== synced) {
    setSynced(initial);
    setAlerts(initial);
  }

  const load = async () => {
    const next = await adminAlertsAction().catch(() => null);
    if (next) setAlerts(next);
  };
  const reload = useEffectEvent(load);

  // The header stays mounted between pages, so the counts are refreshed when the tab comes back and every two minutes.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => document.visibilityState === "visible" && reload(), 120_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  const onKey = useEffectEvent((e: KeyboardEvent) => e.key === "Escape" && setOpen(false));
  const onDown = useEffectEvent((e: PointerEvent) => {
    if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
  });
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const hot = alerts.total > 0;
  const rows = [
    { href: "/admin/porachki?status=new", label: "Нови поръчки", hint: "чакат потвърждение", n: alerts.newOrders, icon: ReceiptText },
    { href: "/admin/chat", label: "Чат с клиенти", hint: "чакат отговор", n: alerts.chats, icon: MessagesSquare },
    { href: "/admin/plashtaniya", label: "Плащания в магазина", hint: "получени през QR кода", n: alerts.storePayments, icon: QrCode },
    { href: "/admin/otkazi", label: "Откази от договор", hint: "за обработка", n: alerts.withdrawals, icon: Undo2 },
    { href: "/admin/facebook", label: "Заявки от Facebook", hint: "неоформени коментари", n: alerts.fbClaims, icon: ClipboardPaste },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={hot ? `Профил и админ известия: ${alerts.total}` : "Профил и админ панел"}
        className={iconBtn}
      >
        <UserRound className="h-[22px] w-[22px]" strokeWidth={1.9} />
        {hot && (
          <span className="pointer-events-none absolute -right-1 -top-1 grid place-items-center">
            <span className="absolute h-5 w-5 rounded-full bg-tomato/60 motion-safe:animate-ping" aria-hidden />
            <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-tomato px-1 text-[0.68rem] font-bold leading-none text-white shadow-sm tabular-nums">
              {alerts.total > 99 ? "99+" : alerts.total}
            </span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            // On phones the icon sits mid-header, so the bubble spans the screen instead of hanging off its left edge.
            className="fixed inset-x-4 top-[4.9rem] z-50 rounded-3xl border border-line bg-paper p-2 shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-80"
          >
            {/* The bubble's tail, pointing at the icon. */}
            <span className="absolute -top-[7px] right-4 hidden h-3.5 w-3.5 rotate-45 sm:block rounded-tl-[4px] border-l border-t border-line bg-paper" aria-hidden />

            <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-2.5">
              <p className="font-display text-[0.95rem] font-semibold">Известия</p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${hot ? "bg-tomato/10 text-tomato" : "bg-sand text-ink-soft"}`}
              >
                {hot ? `${alerts.total} ${alerts.total === 1 ? "ново" : "нови"}` : "Всичко е наред"}
              </span>
            </div>

            <ul className="space-y-0.5">
              {rows.map(({ href, label, hint, n, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-sand"
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${n > 0 ? "bg-tomato/10 text-tomato" : "bg-sand text-ink-soft"}`}>
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{label}</span>
                      <span className="block text-xs text-ink-soft">{n > 0 ? hint : "няма нови"}</span>
                    </span>
                    <span
                      className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums ${n > 0 ? "bg-tomato text-white" : "bg-sand text-ink-soft"}`}
                    >
                      {n}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-1.5 grid grid-cols-2 gap-1.5 border-t border-line px-1 pt-2.5 pb-1">
              <Link
                href="/profil"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line text-sm font-semibold transition hover:border-ink"
              >
                <User className="h-4 w-4" aria-hidden />
                Профил
              </Link>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-forest text-sm font-semibold text-white transition hover:bg-forest-deep"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden />
                Админ
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
