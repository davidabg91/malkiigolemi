import {
  Baby,
  Coffee,
  Flower2,
  Gamepad2,
  GlassWater,
  Lamp,
  ShoppingBasket,
  SprayCan,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50";

export const btn = {
  primary: `${base} h-12 bg-forest px-6 text-white hover:bg-forest-deep`,
  lime: `${base} h-12 bg-lime px-6 text-ink hover:bg-lime-deep`,
  ghost: `${base} h-12 border border-line bg-paper px-6 text-ink hover:border-ink`,
  dark: `${base} h-12 bg-ink px-6 text-cream hover:bg-forest-deep`,
  outlineLight: `${base} h-12 border border-cream/30 px-6 text-cream hover:border-cream hover:bg-cream/10`,
  sm: `${base} h-10 border border-line bg-paper px-4 text-sm text-ink hover:border-ink`,
};

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Coffee,
  GlassWater,
  Gamepad2,
  SprayCan,
  Flower2,
  Baby,
  Lamp,
  ShoppingBasket,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = CATEGORY_ICONS[name] ?? ShoppingBasket;
  return <Icon className={className} aria-hidden strokeWidth={1.75} />;
}

import { site } from "@/lib/site";

/** Official storefront emblem from the logo */
export function ShopMark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-emblem.png"
      alt="Поръчки за малки и големи"
      className={`inline-block select-none object-contain ${className}`}
      aria-hidden
    />
  );
}

/** Backward-compatible alias for places that previously referenced LemonMark */
export const LemonMark = ShopMark;

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  if (light) {
    return (
      <Link
        href="/"
        aria-label={`${site.name} — начало`}
        className={`group/logo inline-flex items-center rounded-2xl bg-white px-3.5 py-1.5 shadow-sm transition hover:bg-white/95 hover:scale-[1.02] ${className}`}
      >
        <LogoArt className="h-8 w-auto min-[400px]:h-9 sm:h-10" />
      </Link>
    );
  }

  return (
    <Link
      href="/"
      aria-label={`${site.name} — начало`}
      className={`group/logo inline-flex items-center transition-transform duration-300 hover:scale-[1.02] ${className}`}
    >
      <LogoArt className="h-9 w-auto min-[400px]:h-10 sm:h-11" />
    </Link>
  );
}

/**
 * The official store logo.
 */
export function LogoArt({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small fixed logo, sized by the caller
    <img
      src="/logo.png"
      alt="Поръчки за малки и големи"
      width={1036}
      height={291}
      className={`select-none object-contain ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
  id,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest">{eyebrow}</p>
        )}
        <h2 id={id} className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[2rem]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Навигационна пътека" className="text-sm text-ink-soft">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link href="/" className="hover:text-ink">
            Начало
          </Link>
        </li>
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            <span aria-hidden>/</span>
            {it.href ? (
              <Link href={it.href} className="hover:text-ink">
                {it.label}
              </Link>
            ) : (
              <span className="text-ink" aria-current="page">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
