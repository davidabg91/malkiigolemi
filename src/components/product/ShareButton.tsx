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

function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white" style={{ background: color }} aria-hidden>
      {children}
    </span>
  );
}

/**
 * „Сподели“ on a product's page. A phone opens its own share sheet (the person's apps and contacts); on a
 * computer, and wherever the browser has no share sheet, a small menu offers Facebook, Viber, WhatsApp,
 * e-mail and copying the link. The link's preview (picture, name, price) comes from the page's own tags.
 */
export function ShareButton({ url, title, className = "" }: { url: string; title: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // The page stays mounted (hidden) after it is left; the menu must not be open when it is shown again.
  useLayoutEffect(() => () => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const share = async () => {
    // On a computer the browser's own share window offers little, so the menu is shown there instead.
    if (!open && typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch (e) {
        // Closed without sharing: nothing more to do. Anything else: fall back to the menu.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    if (await copyText(url)) {
      setCopied(true);
      toast.success("Линкът е копиран", { duration: 2000 });
      window.setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 900);
    } else {
      toast.error("Линкът не можа да се копира", { description: url });
    }
  };

  const enc = encodeURIComponent;
  const withLink = enc(`${title} ${url}`);
  const targets = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, color: "#1877f2", icon: <FacebookIcon className="h-4 w-4" />, newTab: true },
    { label: "Viber", href: `viber://forward?text=${withLink}`, color: "#7360f2", icon: <Phone className="h-4 w-4" />, newTab: false },
    { label: "WhatsApp", href: `https://wa.me/?text=${withLink}`, color: "#25d366", icon: <MessageCircle className="h-4 w-4" />, newTab: true },
    { label: "Имейл", href: `mailto:?subject=${enc(title)}&body=${enc(url)}`, color: "#57534e", icon: <Mail className="h-4 w-4" />, newTab: false },
  ];

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={share}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink transition hover:border-ink active:scale-95"
      >
        <Share2 className="h-4 w-4" aria-hidden />
        Сподели
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Сподели продукта" className="absolute right-0 top-full z-30 mt-2 w-60 rounded-2xl border border-line bg-paper p-2 shadow-lift">
          {targets.map((t) => (
            <a
              key={t.label}
              role="menuitem"
              href={t.href}
              target={t.newTab ? "_blank" : undefined}
              rel={t.newTab ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
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
