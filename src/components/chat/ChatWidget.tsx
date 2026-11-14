"use client";

import { ChevronDown, Loader2, MessageCircle, SendHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatLoad, chatSend } from "@/actions/chat";
import { PushToggle } from "@/components/PushToggle";
import type { ChatLine } from "@/lib/chat";

/** Set once the visitor has written: only then does the closed button ask the server about answers. */
const STARTED_KEY = "chat-started";
// Pages where the button would sit on top of a payment or sign-in step.
const QUIET = ["/plati", "/porachka", "/vhod", "/registratsiya"];

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });

const started = () => {
  try {
    return localStorage.getItem(STARTED_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * The live chat for visitors: a small round button in the corner that opens a panel (a sheet from the
 * bottom on a phone). Nothing is loaded until the visitor opens it or has written before; while it is
 * open it asks for new answers every few seconds, and a dot on the button shows an unread answer.
 */
export function ChatWidget({ publicKey, signedIn }: { publicKey: string; signedIn: boolean }) {
  const pathname = usePathname();
  // A notification about an answer opens the shop with ?chat=1: go straight to the conversation.
  const [open, setOpen] = useState(useSearchParams().has("chat"));
  const [lines, setLines] = useState<ChatLine[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (seen: boolean) => {
    try {
      const res = await chatLoad(seen);
      setLines((old) => (old && old.length === res.lines.length && old.at(-1)?.id === res.lines.at(-1)?.id ? old : res.lines));
      setUnread(res.unread);
    } catch {}
  }, []);

  // Open: every few seconds. Closed: now and then, and only for someone who has a conversation.
  useEffect(() => {
    if (!open && !started()) return;
    const tick = () => document.visibilityState === "visible" && load(open);
    tick();
    const timer = window.setInterval(tick, open ? 4000 : 45_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [open, load]);

  // Keep the newest message in view.
  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, lines]);

  // On a phone the keyboard covers the bottom of the screen: lift the sheet above it and keep it within what is visible.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const fit = () => {
      const el = panelRef.current;
      if (!el) return;
      el.style.setProperty("--kb", `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
      el.style.setProperty("--vh", `${vv.height}px`);
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const res = await chatSend(body, name).catch(() => ({ ok: false as const, error: "Няма връзка. Опитай отново." }));
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    try {
      localStorage.setItem(STARTED_KEY, "1");
    } catch {}
    setText("");
    setLines((old) => [...(old ?? []), res.line]);
  };

  if (QUIET.some((p) => pathname.startsWith(p))) return null;

  const empty = lines !== null && lines.length === 0;

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="button"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-4 right-4 z-20 grid h-12 w-12 place-items-center rounded-full text-ink raised hover:brightness-[0.97] active:scale-95 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
            aria-label={unread > 0 ? `Чат с магазина, ${unread} нови отговора` : "Чат с магазина"}
          >
            <MessageCircle className="h-[22px] w-[22px] sm:h-6 sm:w-6" strokeWidth={1.75} aria-hidden />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-tomato px-1 text-[0.68rem] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            {/* On a phone the page behind is dimmed; a tap on it closes the chat. */}
            <motion.div key="shade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-ink/30 sm:hidden" onClick={() => setOpen(false)} />
            <motion.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-label="Чат с магазина"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="fixed inset-x-0 bottom-[var(--kb,0px)] z-50 flex h-[min(34rem,calc(var(--vh,100dvh)*0.82))] flex-col overflow-hidden rounded-t-[1.75rem] border border-line bg-paper shadow-lift sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(34rem,calc(100dvh-8rem))] sm:w-[23rem] sm:rounded-[1.75rem]"
            >
              <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest text-white">
                  <MessageCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">Чат с магазина</p>
                  <p className="text-xs text-ink-soft">Пиши ни, отговаряме възможно най-бързо.</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink" aria-label="Затвори чата">
                  <ChevronDown className="h-5 w-5" aria-hidden />
                </button>
              </header>

              <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto overscroll-contain bg-cream px-4 py-4" aria-live="polite">
                {lines === null ? (
                  <p className="grid h-full place-items-center text-ink-soft">
                    <Loader2 className="h-5 w-5 animate-spin" aria-label="Зареждане" />
                  </p>
                ) : empty ? (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <p className="font-semibold">Здравей!</p>
                      <p className="mt-1 max-w-[16rem] text-sm text-ink-soft">Имаш въпрос за продукт, доставка или поръчка? Напиши го тук.</p>
                    </div>
                  </div>
                ) : (
                  lines.map((m) => (
                    <div key={m.id} className={`flex ${m.from === "customer" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[0.95rem] leading-snug ${
                          m.from === "customer" ? "rounded-br-md bg-forest text-white" : "rounded-bl-md bg-paper text-ink shadow-soft"
                        }`}
                      >
                        {m.body}
                        <span className={`mt-0.5 block text-right text-[0.65rem] ${m.from === "customer" ? "text-white/70" : "text-ink-soft"}`}>{timeOf(m.at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="border-t border-line bg-paper px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5"
              >
                {!signedIn && empty && (
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    autoComplete="given-name"
                    placeholder="Твоето име (по желание)"
                    aria-label="Твоето име"
                    className="field mb-2 h-10"
                  />
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends on a computer; on a phone it makes a new line and the button sends.
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={1}
                    maxLength={1000}
                    placeholder="Напиши съобщение…"
                    aria-label="Съобщение"
                    // 16px text: a smaller size makes iPhones zoom the page when the field is focused.
                    className="field h-auto max-h-28 min-h-11 flex-1 resize-none py-2.5 text-base [field-sizing:content]"
                  />
                  <button type="submit" disabled={sending || !text.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest text-white transition hover:bg-forest-deep active:scale-95 disabled:opacity-40" aria-label="Изпрати">
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <SendHorizontal className="h-5 w-5" aria-hidden />}
                  </button>
                </div>
                {error && (
                  <p role="alert" className="mt-1.5 text-sm font-medium text-tomato">
                    {error}
                  </p>
                )}
                {publicKey && lines !== null && lines.length > 0 && <PushToggle publicKey={publicKey} audience="chat" compact className="mt-2" />}
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
