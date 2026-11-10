"use client";

import { ChevronDown, Heart, LayoutGrid, Menu, Phone, ShoppingBag, User, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CategoryIcon, FacebookIcon, Logo } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { site, TONES } from "@/lib/site";
import { cartTotals, useCart, useHydrated, useWishlist } from "@/lib/store";
import { SearchBox } from "./SearchBox";

export type MenuCategory = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  tone: string;
  count: number;
  children: { slug: string; name: string }[];
};

function useLockScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-tomato px-1 text-[0.68rem] font-bold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function HeaderClient({ tree }: { tree: MenuCategory[] }) {
  const [mega, setMega] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const megaRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const openCart = useCart((s) => s.setOpen);
  const wishCount = useWishlist((s) => s.items.length);
  const { count, subtotal } = cartTotals(hydrated ? items : []);

  useLockScroll(drawer);

  useEffect(() => {
    if (!mega) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMega(false);
    const onDown = (e: PointerEvent) => {
      if (!megaRef.current?.contains(e.target as Node)) setMega(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [mega]);

  const iconBtn =
    "relative grid h-11 w-11 place-items-center rounded-full text-ink transition hover:bg-sand";

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/90 backdrop-blur-md" ref={megaRef}>
      <div className="container-shop">
        <div className="flex h-[4.5rem] items-center gap-2 sm:gap-4">
          <button type="button" className={`${iconBtn} -ml-2 lg:hidden`} onClick={() => setDrawer(true)} aria-label="Отвори менюто">
            <Menu className="h-6 w-6" />
          </button>

          <span className="group/logo">
            <Logo />
          </span>

          <button
            type="button"
            onClick={() => setMega((v) => !v)}
            aria-expanded={mega}
            aria-controls="mega-menu"
            className={`ml-2 hidden h-12 items-center gap-2 rounded-full px-5 font-semibold transition lg:inline-flex ${mega ? "bg-ink text-cream" : "bg-forest text-white hover:bg-forest-deep"}`}
          >
            {mega ? <X className="h-[18px] w-[18px]" /> : <LayoutGrid className="h-[18px] w-[18px]" />}
            Категории
          </button>

          <SearchBox className="hidden flex-1 md:block" />

          <a
            href={site.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 whitespace-nowrap rounded-full bg-cyan-50/80 px-3.5 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100/90 lg:inline-flex"
            title="Facebook група: Поръчки за малки и големи"
          >
            <FacebookIcon className="h-4 w-4 text-[#1877F2]" />
            <span>Facebook група</span>
          </a>

          <a href={site.phoneHref} className="hidden items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold hover:bg-sand xl:inline-flex">
            <Phone className="h-4 w-4 text-forest" aria-hidden />
            {site.phone}
          </a>

          <div className="ml-auto flex items-center gap-0.5 md:ml-0">
            <Link href="/profil" className={iconBtn} aria-label="Моят профил">
              <User className="h-[22px] w-[22px]" strokeWidth={1.75} />
            </Link>
            <Link href="/lyubimi" className={iconBtn} aria-label={`Любими продукти (${hydrated ? wishCount : 0})`}>
              <Heart className="h-[22px] w-[22px]" strokeWidth={1.75} />
              <CountBadge n={hydrated ? wishCount : 0} />
            </Link>
            <button
              type="button"
              onClick={() => openCart(true)}
              className="relative ml-1 inline-flex h-12 items-center gap-2.5 rounded-full bg-lime pl-4 pr-4 font-semibold text-ink transition hover:bg-lime-deep sm:pr-5"
              aria-label={`Количка, ${count} продукта`}
            >
              <span className="relative">
                <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={1.75} />
                <CountBadge n={count} />
              </span>
              <span className="hidden text-sm tabular-nums sm:inline">{formatPrice(subtotal)}</span>
            </button>
          </div>
        </div>

        <SearchBox className="pb-3 md:hidden" />

        <nav aria-label="Категории" className="no-scrollbar -mx-2 hidden gap-1 overflow-x-auto pb-2.5 lg:flex">
          {tree.map((c) => (
            <Link key={c.id} href={`/kategoria/${c.slug}`} className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-ink">
              {c.name}
            </Link>
          ))}
          <span className="mx-1 my-1.5 w-px bg-line" aria-hidden />
          <Link href="/promo" className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold text-tomato transition hover:bg-tomato/10">
            Промоции
          </Link>
          <Link href="/novi" className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold text-forest transition hover:bg-forest/10">
            Нови продукти
          </Link>
        </nav>
      </div>

      {/* Desktop mega menu */}
      <AnimatePresence>
        {mega && (
          <motion.div
            id="mega-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-full hidden border-b border-line bg-paper shadow-lift lg:block"
          >
            <div className="container-shop grid grid-cols-4 gap-x-8 gap-y-7 py-8">
              {tree.map((c) => {
                const tone = TONES[c.tone] ?? TONES.cream;
                return (
                  <div key={c.id}>
                    <Link href={`/kategoria/${c.slug}`} onClick={() => setMega(false)} className="group flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition group-hover:scale-105" style={{ background: tone.bg, color: tone.ink }}>
                        <CategoryIcon name={c.icon} className="h-5 w-5" />
                      </span>
                      <span className="font-semibold group-hover:text-forest">{c.name}</span>
                    </Link>
                    <ul className="mt-3 space-y-1.5 pl-14">
                      {c.children.map((s) => (
                        <li key={s.slug}>
                          <Link href={`/kategoria/${c.slug}/${s.slug}`} onClick={() => setMega(false)} className="text-sm text-ink-soft hover:text-ink hover:underline">
                            {s.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              <div className="flex flex-col gap-3">
                <Link href="/promo" onClick={() => setMega(false)} className="rounded-2xl bg-tomato px-5 py-4 font-semibold text-white transition hover:brightness-95">
                  Промоции
                  <span className="mt-0.5 block text-sm font-normal text-white/85">Намаления и цени за количество</span>
                </Link>
                <Link href="/novi" onClick={() => setMega(false)} className="rounded-2xl bg-lime px-5 py-4 font-semibold text-ink transition hover:bg-lime-deep">
                  Нови продукти
                  <span className="mt-0.5 block text-sm font-normal text-ink/75">Току-що пристигнали</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Меню">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/50"
              onClick={() => setDrawer(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%", transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-cream"
            >
              <div className="flex h-[4.5rem] items-center justify-between border-b border-line px-5">
                <Logo />
                <button type="button" className={iconBtn} onClick={() => setDrawer(false)} aria-label="Затвори менюто">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <div className="mb-3 grid grid-cols-2 gap-2 px-2">
                  <Link href="/promo" onClick={() => setDrawer(false)} className="rounded-2xl bg-tomato px-4 py-3 text-sm font-semibold text-white">
                    Промоции
                  </Link>
                  <Link href="/novi" onClick={() => setDrawer(false)} className="rounded-2xl bg-lime px-4 py-3 text-sm font-semibold text-ink">
                    Нови продукти
                  </Link>
                </div>
                <ul>
                  {tree.map((c) => {
                    const tone = TONES[c.tone] ?? TONES.cream;
                    const isOpen = expanded === c.id;
                    return (
                      <li key={c.id} className="border-b border-line/70 last:border-0">
                        <div className="flex items-center">
                          <Link href={`/kategoria/${c.slug}`} onClick={() => setDrawer(false)} className="flex min-h-14 flex-1 items-center gap-3 px-2 font-medium">
                            <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: tone.bg, color: tone.ink }}>
                              <CategoryIcon name={c.icon} className="h-5 w-5" />
                            </span>
                            {c.name}
                          </Link>
                          <button
                            type="button"
                            className={iconBtn}
                            aria-expanded={isOpen}
                            aria-label={`Подкатегории на ${c.name}`}
                            onClick={() => setExpanded(isOpen ? null : c.id)}
                          >
                            <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                        {isOpen && (
                          <ul className="pb-3 pl-[3.75rem]">
                            {c.children.map((s) => (
                              <li key={s.slug}>
                                <Link href={`/kategoria/${c.slug}/${s.slug}`} onClick={() => setDrawer(false)} className="flex min-h-11 items-center text-ink-soft">
                                  {s.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="border-t border-line p-4 space-y-2">
                <a
                  href={site.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 rounded-2xl bg-[#1877F2] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#166fe5]"
                >
                  <FacebookIcon className="h-4 w-4" />
                  <span>Facebook общност ({site.facebookGroupName})</span>
                </a>
                <a href={site.phoneHref} className="flex items-center justify-center gap-2.5 rounded-2xl bg-sand py-2.5 text-sm font-semibold text-ink">
                  <Phone className="h-4 w-4 text-forest" aria-hidden />
                  {site.phone}
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}
