import {
  Baby,
  Coffee,
  GlassWater,
  Lamp,
  ShoppingBasket,
  Sparkles,
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
  SprayCan,
  Sparkles,
  Baby,
  Lamp,
  ShoppingBasket,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = CATEGORY_ICONS[name] ?? ShoppingBasket;
  return <Icon className={className} aria-hidden strokeWidth={1.75} />;
}

import { site } from "@/lib/site";

/** Modern storefront mark inspired by the Facebook group's original shop icon */
export function ShopMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      {/* Roof sign */}
      <rect x="13" y="4" width="14" height="6.5" rx="1.5" fill="currentColor" />
      <text x="20" y="8.8" textAnchor="middle" fill="#ffffff" fontSize="3.3" fontWeight="900" fontFamily="sans-serif" letterSpacing="0.3">SHOP</text>
      <line x1="16" y1="10.5" x2="16" y2="12.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="24" y1="10.5" x2="24" y2="12.5" stroke="currentColor" strokeWidth="1.2" />
      {/* Storefront building */}
      <rect x="7" y="16" width="26" height="19" rx="2" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Window */}
      <rect x="9.5" y="20" width="12" height="11" rx="1.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1" />
      <circle cx="13.5" cy="27" r="1.5" fill="currentColor" opacity="0.8" />
      <rect x="17" y="25" width="3" height="4" rx="0.5" fill="currentColor" opacity="0.6" />
      {/* Door */}
      <rect x="23.5" y="20" width="7" height="15" rx="1" stroke="currentColor" strokeWidth="1" />
      <circle cx="25" cy="28" r="0.7" fill="currentColor" />
      {/* Canopy / Awning */}
      <path
        d="M5 12.5 H35 L33.5 17.5 C33.5 18.5 32 19 31 18 C30 19 28.5 19 27.5 18 C26.5 19 25 19 24 18 C23 19 21.5 19 20.5 18 C19.5 19 18 19 17 18 C16 19 14.5 19 13.5 18 C12.5 19 11 19 10 18 C9 19 7.5 18.5 7.5 17.5 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Awning stripes accent */}
      <line x1="11" y1="13" x2="11.5" y2="17.5" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" />
      <line x1="15" y1="13" x2="15" y2="17.5" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" />
      <line x1="19" y1="13" x2="19" y2="17.5" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" />
      <line x1="23" y1="13" x2="23" y2="17.5" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" />
      <line x1="27" y1="13" x2="27" y2="17.5" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" />
      {/* Ground line */}
      <rect x="4" y="35" width="32" height="1.8" rx="0.9" fill="currentColor" />
    </svg>
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
  return (
    <Link
      href="/"
      aria-label={`${site.name} — начало`}
      className={`group/logo inline-flex items-center gap-2.5 transition ${className}`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all duration-300 group-hover/logo:scale-105 group-hover/logo:shadow-md ${
          light
            ? "bg-gradient-to-br from-cyan-400 to-sky-600 text-white shadow-cyan-900/30 ring-1 ring-white/20"
            : "bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-sky-500/20"
        }`}
      >
        <ShopMark className="h-6 w-6" />
      </span>
      <span className="flex flex-col text-left leading-tight">
        <span
          className={`font-display text-[1.15rem] font-extrabold tracking-tight transition ${
            light ? "text-cream group-hover/logo:text-white" : "text-ink group-hover/logo:text-cyan-700"
          }`}
        >
          Поръчки
        </span>
        <span
          className={`text-[0.68rem] font-bold uppercase tracking-wider transition ${
            light ? "text-cyan-300" : "text-cyan-600 group-hover/logo:text-cyan-700"
          }`}
        >
          за малки и големи
        </span>
      </span>
    </Link>
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
