"use client";

import { Check, Link2, Mail, MessageCircle, Phone, Share2 } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FacebookIcon } from "@/components/ui";

/** Puts text on the clipboard, also in browsers (and in-app browsers) without the clipboard API. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    field.remove();
    return ok;
  }
}

const row = "flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 text-left text-[0.95rem] font-medium transition hover:bg-sand focus-visible:bg-sand";

/** The button as it looks on a light page; a caller on another background passes its own look. */
const pill = "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink transition hover:border-ink active:scale-95";

function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white" style={{ background: color }} aria-hidden>
      {children}
    </span>
  );
}

/** What is being sent: the given address, or the page the person is looking at right now. */
function target(url?: string, title?: string) {
  const { origin, pathname, search } = window.location;
  return {
    link: !url ? origin + pathname + search : url.startsWith("/") ? origin + url : url,
    name: title ?? document.title,
  };
}

/**
 * „Сподели“: sends the address of a page. A phone opens its own share sheet (the person's apps and
 * contacts); on a computer, and wherever the browser has no share sheet, a small menu offers Facebook,
 * Viber, WhatsApp, e-mail and copying the link. The link's preview comes from the page's own tags.
 *
 * Without `url` it shares the page it stands on, filters and search words included: in the installed app
 * there is no address bar to copy from. `url` may be a full address or a path of the shop.
 */
export function ShareButton({
  url,
  title,
  label = "Сподели",
  className = "",
  buttonClassName = pill,
  menuClassName = "right-0 top-full mt-2",
}: {
  url?: string;
  title?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  /** Where the menu opens, relative to the button. */
  menuClassName?: string;
}) {
  // The menu is open while it has something to send.
  const [sent, setSent] = useState<{ link: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const open = sent !== null;

  // The page stays mounted (hidden) after it is left; the menu must not be open when it is shown again.
  useLayoutEffect(() => () => setSent(null), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setSent(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSent(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const share = async () => {
    if (open) return setSent(null);
    const now = target(url, title);
    // On a computer the browser's own share window offers little, so the menu is shown there instead.
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: now.name, text: now.name, url: now.link });
        return;
      } catch (e) {
        // Closed without sharing: nothing more to do. Anything else: fall back to the menu.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    setSent(now);
  };

  const copy = async () => {
    if (!sent) return;
    if (await copyText(sent.link)) {
      setCopied(true);
      toast.success("Линкът е копиран", { duration: 2000 });
      window.setTimeout(() => {
        setCopied(false);
        setSent(null);
      }, 900);
    } else {
      toast.error("Линкът не можа да се копира", { description: sent.link });
    }
  };

  const enc = encodeURIComponent;
  const withLink = sent ? enc(`${sent.name} ${sent.link}`) : "";
  const targets = sent
    ? [
        { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(sent.link)}`, color: "#1877f2", icon: <FacebookIcon className="h-4 w-4" />, newTab: true },
        { label: "Viber", href: `viber://forward?text=${withLink}`, color: "#7360f2", icon: <Phone className="h-4 w-4" />, newTab: false },
        { label: "WhatsApp", href: `https://wa.me/?text=${withLink}`, color: "#25d366", icon: <MessageCircle className="h-4 w-4" />, newTab: true },
        { label: "Имейл", href: `mailto:?subject=${enc(sent.name)}&body=${enc(sent.link)}`, color: "#57534e", icon: <Mail className="h-4 w-4" />, newTab: false },
      ]
    : [];

  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" onClick={share} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} className={buttonClassName}>
        <Share2 className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={`absolute z-30 w-60 rounded-2xl border border-line bg-paper p-2 text-ink shadow-lift ${menuClassName}`}>
          {targets.map((t) => (
            <a
              key={t.label}
              role="menuitem"
              href={t.href}
              target={t.newTab ? "_blank" : undefined}
              rel={t.newTab ? "noopener noreferrer" : undefined}
              onClick={() => setSent(null)}
              className={row}
            >
              <Badge color={t.color}>{t.icon}</Badge>
              {t.label}
            </a>
          ))}
          <button type="button" role="menuitem" onClick={copy} className={row}>
            <Badge color={copied ? "#14693a" : "#33484b"}>{copied ? <Check className="h-4 w-4" strokeWidth={3} /> : <Link2 className="h-4 w-4" />}</Badge>
            {copied ? "Копирано" : "Копирай линка"}
          </button>
        </div>
      )}
    </div>
  );
}
