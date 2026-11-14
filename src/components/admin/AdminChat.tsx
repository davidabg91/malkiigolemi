"use client";

import { Loader2, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { chatAdminLoad, chatReply } from "@/actions/chat";
import type { ChatLine } from "@/lib/chat";

const stamp = (iso: string) => new Date(iso).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** One conversation in the admin panel: the messages, kept up to date every few seconds, and the reply box. */
export function AdminChat({ threadId, initial }: { threadId: number; initial: ChatLine[] }) {
  const [lines, setLines] = useState(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const next = await chatAdminLoad(threadId).catch(() => null);
      if (next) setLines((old) => (old.length === next.length && old.at(-1)?.id === next.at(-1)?.id ? old : next));
    };
    const timer = window.setInterval(tick, 4000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [threadId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [lines]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const res = await chatReply(threadId, body).catch(() => ({ ok: false as const, error: "Няма връзка. Опитай отново." }));
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setText("");
    setLines((old) => [...old, res.line]);
  };

  return (
    <div className="flex h-[calc(100dvh-15rem)] min-h-80 flex-col overflow-hidden rounded-card bg-paper shadow-soft lg:h-[calc(100dvh-12rem)]">
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto overscroll-contain bg-cream px-4 py-4" aria-live="polite">
        {lines.map((m) => (
          <div key={m.id} className={`flex ${m.from === "admin" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[0.95rem] leading-snug ${
                m.from === "admin" ? "rounded-br-md bg-forest text-white" : "rounded-bl-md bg-paper text-ink shadow-soft"
              }`}
            >
              {m.body}
              <span className={`mt-0.5 block text-right text-[0.65rem] ${m.from === "admin" ? "text-white/70" : "text-ink-soft"}`}>{stamp(m.at)}</span>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-line p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Напиши отговор…"
            aria-label="Отговор"
            className="field h-auto max-h-32 min-h-11 flex-1 resize-none py-2.5 text-base [field-sizing:content]"
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
      </form>
    </div>
  );
}
