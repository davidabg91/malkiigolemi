"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const AUTOPLAY_MS = 5500;

/**
 * Horizontal, swipeable shelf of cards with arrow controls.
 * With `autoplay` it pages through a screenful at a time, shows a dot per page (the current one fills up
 * until the next page) and moves on by itself. It pauses while the mouse or keyboard focus is on it,
 * while it is off screen or the tab is hidden, and never runs for people who prefer reduced motion.
 * With `rows={2}` the cards stand two high, so twice as many are on screen at once.
 */
export function Carousel({ children, label, autoplay = false, rows = 1 }: { children: ReactNode; label: string; autoplay?: boolean; rows?: 1 | 2 }) {
  // Two rows are built from columns of two cards: a column is what slides.
  const cards = Children.toArray(children);
  const columns =
    rows === 1
      ? cards.map((c) => [c])
      : cards.length < 10
        ? // Not enough for two full rows on a computer: the top row is filled first, the rest go under it.
          Array.from({ length: Math.min(5, cards.length) }, (_, i) => [cards[i], cards[i + 5]].filter((c) => c !== undefined))
        : Array.from({ length: Math.ceil(cards.length / 2) }, (_, i) => cards.slice(i * 2, i * 2 + 2));
  const [ref, api] = useEmblaCarousel(
    autoplay ? { align: "start", slidesToScroll: "auto", containScroll: "trimSnaps" } : { align: "start", dragFree: true, containScroll: "trimSnaps" },
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(0);
  // Bumped on a manual move, so the timer and the dot's fill start over even on the same page.
  const [round, setRound] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [calm, setCalm] = useState(true); // reduced motion or hidden tab; checked after mount

  const sync = useCallback(() => {
    if (!api) return;
    setCanPrev(api.canScrollPrev());
    setCanNext(api.canScrollNext());
    setPages(api.scrollSnapList().length);
    setPage(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const frame = requestAnimationFrame(sync);
    api.on("select", sync).on("reInit", sync).on("scroll", sync);
    return () => {
      cancelAnimationFrame(frame);
      api.off("select", sync).off("reInit", sync).off("scroll", sync);
    };
  }, [api, sync]);

  useEffect(() => {
    if (!autoplay || !rootRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCalm(reduce.matches || document.hidden);
    update();
    const seen = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.35 });
    seen.observe(rootRef.current);
    document.addEventListener("visibilitychange", update);
    reduce.addEventListener("change", update);
    return () => {
      seen.disconnect();
      document.removeEventListener("visibilitychange", update);
      reduce.removeEventListener("change", update);
    };
  }, [autoplay]);

  const running = autoplay && pages > 1 && onScreen && !hovered && !calm;

  // One timer per page shown: moving (by hand or by itself) restarts it.
  useEffect(() => {
    if (!running || !api) return;
    const t = setTimeout(() => (api.canScrollNext() ? api.scrollNext() : api.scrollTo(0)), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [running, api, page, round]);

  const goTo = (i: number) => {
    api?.scrollTo(i);
    setRound((r) => r + 1);
  };

  const arrow =
    "absolute z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-paper text-ink shadow-lift transition hover:bg-ink hover:text-cream disabled:pointer-events-none disabled:opacity-0 md:grid";

  return (
    <div
      ref={rootRef}
      className="relative"
      role="region"
      aria-roledescription="карусел"
      aria-label={label}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHovered(false)}
    >
      <div ref={ref} className="-mx-4 overflow-hidden px-4 py-2 sm:-mx-6 sm:px-6 xl:-mx-2 xl:px-2">
        <ul className="flex touch-pan-y gap-3 sm:gap-4">
          {columns.map((column, i) => (
            <li key={i} className="w-[46%] shrink-0 sm:w-[31%] md:w-[23.5%] xl:w-[19%]">
              {/* Equal rows, so the cards line up across columns whatever their own height. */}
              {rows === 2 ? <div className="grid h-full grid-rows-2 gap-3 sm:gap-4">{column}</div> : column}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className={`${arrow} ${rows === 2 ? "top-1/2" : "top-[38%]"} -left-4`} onClick={() => (autoplay ? goTo(page - 1) : api?.scrollPrev())} disabled={!canPrev} aria-label="Назад">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" className={`${arrow} ${rows === 2 ? "top-1/2" : "top-[38%]"} -right-4`} onClick={() => (autoplay ? goTo(page + 1) : api?.scrollNext())} disabled={!canNext} aria-label="Напред">
        <ChevronRight className="h-5 w-5" />
      </button>

      {autoplay && pages > 1 && (
        <div className="mt-4 flex justify-center gap-1 sm:mt-5">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Група ${i + 1} от ${pages}`}
              aria-current={i === page ? "true" : undefined}
              className="group/dot grid h-7 place-items-center px-1"
            >
              <span
                className={`relative block h-2 overflow-hidden rounded-full transition-all duration-300 ease-out-soft ${i === page ? "w-9 bg-ink/15" : "w-2 bg-ink/20 group-hover/dot:bg-ink/45"}`}
              >
                {i === page && (
                  <span
                    // A new key restarts the fill whenever the timer restarts.
                    key={`${page}-${round}-${running}`}
                    className="absolute inset-0 origin-left rounded-full bg-forest"
                    style={running ? { animation: `carousel-fill ${AUTOPLAY_MS}ms linear both` } : undefined}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
