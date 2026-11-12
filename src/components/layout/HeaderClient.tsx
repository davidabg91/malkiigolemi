"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, Heart, LayoutGrid, Loader2, Menu, Phone, ShoppingBag, Sparkles, User, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { checkIsAdmin, reorderCategories } from "@/actions/admin";
import { CategoryIcon, FacebookIcon, Logo } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { site, TONES } from "@/lib/site";
import { cartTotals, useCart, useHydrated, useWishlist } from "@/lib/store";
import { arrayMove, CategoryNav } from "./CategoryNav";
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

function CountBadge({ n, className = "-right-0.5 -top-0.5" }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={`absolute grid h-5 min-w-5 place-items-center rounded-full bg-tomato px-1 text-[0.68rem] font-bold text-white shadow-sm pointer-events-none ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function HeaderClient({ tree }: { tree: MenuCategory[] }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [catItems, setCatItems] = useState<MenuCategory[]>(tree);
  const [isReordering, setIsReordering] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [savedToast, setSavedToast] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

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
    checkIsAdmin().then((res) => {
      if (res) setIsAdmin(true);
    });
  }, []);

  useEffect(() => {
    if (!isReordering) {
      setCatItems(tree);
    }
  }, [tree, isReordering]);

  const catLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catStartPos = useRef<{ x: number; y: number } | null>(null);
  const catHasLongPressed = useRef(false);

  const handleCatPointerDown = (e: React.PointerEvent) => {
    if (!isAdmin) return;
    catHasLongPressed.current = false;
    catStartPos.current = { x: e.clientX, y: e.clientY };
    catLongPressTimer.current = setTimeout(() => {
      catHasLongPressed.current = true;
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([45, 30, 45]);
        } catch {}
      }
      setMega(true);
      setIsReordering(true);
    }, 450);
  };

  const handleCatPointerMove = (e: React.PointerEvent) => {
    if (!catStartPos.current || !catLongPressTimer.current) return;
    const dx = Math.abs(e.clientX - catStartPos.current.x);
    const dy = Math.abs(e.clientY - catStartPos.current.y);
    if (dx > 8 || dy > 8) {
      clearTimeout(catLongPressTimer.current);
      catLongPressTimer.current = null;
    }
  };

  const handleCatPointerUp = () => {
    if (catLongPressTimer.current) {
      clearTimeout(catLongPressTimer.current);
      catLongPressTimer.current = null;
    }
  };

  const handleCatClick = () => {
    if (catHasLongPressed.current) {
      catHasLongPressed.current = false;
      return;
    }
    setMega((v) => !v);
  };

  const handleSaveAndExit = () => {
    startTransition(async () => {
      try {
        await reorderCategories(catItems.map((c) => c.id));
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3000);
      } catch (err) {
        console.error("Failed to reorder categories:", err);
      } finally {
        setIsReordering(false);
        setDraggingId(null);
        setDragOverId(null);
      }
    });
  };

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
            onClick={handleCatClick}
            onPointerDown={handleCatPointerDown}
            onPointerMove={handleCatPointerMove}
            onPointerUp={handleCatPointerUp}
            onPointerCancel={handleCatPointerUp}
            aria-expanded={mega}
            aria-controls="mega-menu"
            className={`ml-2 hidden h-12 items-center gap-2 rounded-full px-5 font-semibold transition lg:inline-flex ${
              isReordering
                ? "bg-forest-deep ring-2 ring-lime text-lime shadow-lift"
                : mega
                ? "bg-ink text-cream"
                : "bg-forest text-white hover:bg-forest-deep"
            }`}
          >
            {isReordering ? (
              <Sparkles className="h-[18px] w-[18px] text-lime animate-pulse" />
            ) : mega ? (
              <X className="h-[18px] w-[18px]" />
            ) : (
              <LayoutGrid className="h-[18px] w-[18px]" />
            )}
            Категории
          </button>

          <SearchBox className="hidden flex-1 md:block" />

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
              <span className="relative inline-flex">
                <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={1.75} />
                <CountBadge n={count} className="-right-2.5 -top-2.5" />
              </span>
              <span className="hidden text-sm tabular-nums sm:inline">{formatPrice(subtotal)}</span>
            </button>
          </div>
        </div>

        <SearchBox className="pb-3 md:hidden" />

        <CategoryNav
          tree={tree}
          items={catItems}
          setItems={setCatItems}
          isEditing={isReordering}
          setIsEditing={setIsReordering}
          isAdmin={isAdmin}
        />
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
            <div className="container-shop py-8">
              {/* Admin reordering banner */}
              {isReordering && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-forest-deep px-5 py-3.5 text-cream shadow-lift animate-rise">
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className="grid h-7 w-7 place-items-center rounded-xl bg-lime text-ink">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <span className="font-bold text-lime">Режим на подреждане:</span>
                      <span className="ml-2 text-xs text-cream/80 sm:text-sm">
                        Хвани и премести с мишката или използвай стрелките ‹ ›.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAndExit}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-full bg-lime px-5 py-2 text-xs font-bold text-ink shadow transition hover:bg-lime-deep hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    <span>{isPending ? "Запазване..." : "Готово"}</span>
                  </button>
                </div>
              )}

              {/* Saved toast */}
              {savedToast && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-white shadow-soft animate-rise">
                  <Check className="h-4 w-4 text-lime" />
                  <span>Новата подредба на категориите е запазена успешно и се показва на всички!</span>
                </div>
              )}

              <div className="grid grid-cols-4 gap-x-8 gap-y-7">
                {catItems.map((c, index) => {
                  const tone = TONES[c.tone] ?? TONES.cream;
                  const isOdd = index % 2 !== 0;
                  const isCurrentDragging = draggingId === c.id;
                  const isOver = dragOverId === c.id && draggingId !== c.id;
                  const wiggleClass = isReordering
                    ? isOdd
                      ? "animate-[ios-jiggle_0.28s_ease-in-out_infinite_alternate]"
                      : "animate-[ios-jiggle-alt_0.31s_ease-in-out_infinite_alternate]"
                    : "";

                  return (
                    <div
                      key={c.id}
                      draggable={isReordering}
                      onDragStart={(e) => {
                        if (!isReordering) return;
                        setDraggingId(c.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(c.id));
                      }}
                      onDragOver={(e) => {
                        if (!isReordering || draggingId === null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverId !== c.id) setDragOverId(c.id);
                      }}
                      onDrop={(e) => {
                        if (!isReordering || draggingId === null) return;
                        e.preventDefault();
                        const fromIndex = catItems.findIndex((x) => x.id === draggingId);
                        const toIndex = catItems.findIndex((x) => x.id === c.id);
                        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                          setCatItems((prev) => arrayMove(prev, fromIndex, toIndex));
                        }
                        setDraggingId(null);
                        setDragOverId(null);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverId(null);
                      }}
                      className={`relative rounded-2xl transition-all ${wiggleClass} ${
                        isCurrentDragging ? "opacity-30 scale-95" : ""
                      } ${isOver ? "ring-2 ring-lime ring-offset-4 bg-sand/40 p-2" : ""}`}
                    >
                      {isReordering ? (
                        <div className="rounded-2xl border border-forest/20 bg-cream/70 p-3 shadow-soft">
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <button
                              type="button"
                              onClick={() => setCatItems((prev) => arrayMove(prev, index, index - 1))}
                              disabled={index === 0}
                              className="grid h-6 w-6 place-items-center rounded-full bg-sand text-ink hover:bg-forest hover:text-white disabled:opacity-20"
                              title="Премести наляво"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-xs font-mono font-bold text-ink-soft">#{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => setCatItems((prev) => arrayMove(prev, index, index + 1))}
                              disabled={index === catItems.length - 1}
                              className="grid h-6 w-6 place-items-center rounded-full bg-sand text-ink hover:bg-forest hover:text-white disabled:opacity-20"
                              title="Премести надясно"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                              style={{ background: tone.bg, color: tone.ink }}
                            >
                              <CategoryIcon name={c.icon} className="h-5 w-5" />
                            </span>
                            <span className="font-semibold text-ink">{c.name}</span>
                          </div>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile drawer. Rendered into <body>: the header's backdrop blur would otherwise make "fixed"
          mean "inside the header", squeezing the drawer to the header's height. */}
      {hydrated &&
        createPortal(
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
                      {catItems.map((c) => {
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
                      className="flex items-center justify-center gap-2.5 rounded-2xl bg-[#1877F2] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#166fe5]"
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
          </AnimatePresence>,
          document.body,
        )}
    </header>
  );
}
