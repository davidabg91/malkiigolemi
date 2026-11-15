"use client";

import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type EmblaCarouselType = NonNullable<UseEmblaCarouselType[1]>;

const AUTOPLAY_MS = 5500;
/** How long a move may wait for the next group's photos before going anyway. */
const WAIT_FOR_PHOTOS_MS = 900;

/** The photos of the cards that make up one page (one stop of the carousel). */
function pagePhotos(api: EmblaCarouselType, index: number) {
  const slides = api.slideNodes();
  return (api.internalEngine().slideRegistry[index] ?? []).flatMap((i) => Array.from(slides[i]?.querySelectorAll("img") ?? []));
}

/**
 * Has a page's photos downloaded and decoded before it slides in. Cards off screen load their photos
 * lazily; left alone they would arrive in the middle of the movement, and painting them then is what makes
 * a carousel stutter. Resolves when they are ready, or after `capMs` at the latest.
 */
function warm(api: EmblaCarouselType, index: number, capMs = 0) {
  const photos = pagePhotos(api, index);
  for (const img of photos) img.loading = "eager";
  const ready = Promise.all(photos.map((img) => img.decode().catch(() => undefined)));
  return capMs > 0 ? Promise.race([ready, new Promise((done) => setTimeout(done, capMs))]) : ready;
}

/**
 * Horizontal, swipeable shelf of cards with arrow controls.
 * With `autoplay` it pages through a screenful at a time, shows a dot per page (the current one fills up
 * until the next page) and moves on by itself, round and round in one direction. It pauses while the mouse
 * or keyboard focus is on it, while a finger holds it, while it is off screen or the tab is hidden, and
 * never runs for people who prefer reduced motion.
 * With `rows={2}` the cards stand two high, so twice as many are on screen at once.
 */
export function Carousel({ children, label, autoplay = false, rows = 1 }: { children: ReactNode; label: string; autoplay?: boolean; rows?: 1 | 2 }) {
  // Two rows are built from columns of two cards: a column is what slides.
  const columns = useMemo(() => {
    const cards = Children.toArray(children);
    return rows === 1
      ? cards.map((c) => [c])
      : cards.length < 10
        ? // Not enough for two full rows on a computer: the top row is filled first, the rest go under it.
          Array.from({ length: Math.min(5, cards.length) }, (_, i) => [cards[i], cards[i + 5]].filter((c) => c !== undefined))
        : Array.from({ length: Math.ceil(cards.length / 2) }, (_, i) => cards.slice(i * 2, i * 2 + 2));
  }, [children, rows]);
  const [ref, api] = useEmblaCarousel(
    autoplay
      ? // `loop` keeps it going forwards for ever instead of racing back to the start; when everything
        // fits on one screen the carousel drops it by itself. A longer `duration` is a calmer glide.
        { align: "start", slidesToScroll: "auto", loop: true, containScroll: "trimSnaps", duration: 34 }
      : { align: "start", dragFree: true, containScroll: "trimSnaps" },
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(0);
  // Bumped on a manual move, so the timer and the dot's fill start over even on the same page.
  const [round, setRound] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [held, setHeld] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [calm, setCalm] = useState(true); // reduced motion or hidden tab; checked after mount

  const sync = useCallback(() => {
    if (!api) return;
    setCanPrev(api.canScrollPrev());
    setCanNext(api.canScrollNext());
    setPages(api.scrollSnapList().length);
    setPage(api.selectedScrollSnap());
  }, [api]);

  // Only when the page changes or the layout is measured again — never on every frame of a movement.
  useEffect(() => {
    if (!api) return;
    const frame = requestAnimationFrame(sync);
    const hold = () => setHeld(true);
    const release = () => {
      setHeld(false);
      setRound((r) => r + 1);
    };
    api.on("select", sync).on("reInit", sync).on("pointerDown", hold).on("pointerUp", release);
    return () => {
      cancelAnimationFrame(frame);
      api.off("select", sync).off("reInit", sync).off("pointerDown", hold).off("pointerUp", release);
    };
  }, [api, sync]);

  useEffect(() => {
    if (!rootRef.current) return;
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
  }, []);

  // Once the shelf is looked at, the pages next to the one on screen get their photos ahead of time
  // (every page of a shelf that is dragged freely), so whatever slides in is already painted.
  useEffect(() => {
    if (!api || !onScreen || pages === 0) return;
    const ahead = autoplay ? [(page + 1) % pages, (page - 1 + pages) % pages] : Array.from({ length: pages }, (_, i) => i);
    for (const i of ahead) void warm(api, i);
  }, [api, onScreen, autoplay, page, pages]);

  const running = autoplay && pages > 1 && onScreen && !hovered && !held && !calm;

  // One timer per page shown: moving (by hand or by itself) restarts it.
  useEffect(() => {
    if (!running || !api) return;
    let live = true;
    const t = setTimeout(async () => {
      const forward = api.canScrollNext();
      await warm(api, forward ? (api.selectedScrollSnap() + 1) % api.scrollSnapList().length : 0, WAIT_FOR_PHOTOS_MS);
      if (!live) return;
      if (forward) api.scrollNext();
      else api.scrollTo(0);
    }, AUTOPLAY_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [running, api, page, round]);

  const move = (act: (api: EmblaCarouselType) => void) => {
    if (!api) return;
    act(api);
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
        {/*
          The space between cards is each slide's own left padding (taken back by the row's negative margin),
          not a flex gap: a looping row needs the space to travel with the slide. The carousel moves the
          row with a 3D transform, which already gives it its own layer; no `will-change` here, because that
          would change what the carousel measures the slides against.
        */}
        <ul className="-ml-3 flex touch-pan-y sm:-ml-4">
          {columns.map((column, i) => (
            <li key={i} className="w-[48%] shrink-0 pl-3 sm:w-[32%] sm:pl-4 md:w-1/4 xl:w-1/5">
              {/*
                Equal rows, so the cards line up across columns whatever their own height. The one column is
                spelled out (`grid-cols-1` is `minmax(0, 1fr)`): left to itself it grows to the widest thing
                in a card that cannot wrap, and the cards then stick out over their neighbours.
              */}
              {rows === 2 ? <div className="grid h-full grid-cols-1 grid-rows-2 gap-3 sm:gap-4">{column}</div> : column}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className={`${arrow} ${rows === 2 ? "top-1/2" : "top-[38%]"} -left-4`} onClick={() => move((a) => a.scrollPrev())} disabled={!canPrev} aria-label="Назад">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" className={`${arrow} ${rows === 2 ? "top-1/2" : "top-[38%]"} -right-4`} onClick={() => move((a) => a.scrollNext())} disabled={!canNext} aria-label="Напред">
        <ChevronRight className="h-5 w-5" />
      </button>

      {autoplay && pages > 1 && (
        <div className="mt-4 flex justify-center gap-1 sm:mt-5">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => move((a) => a.scrollTo(i))}
              aria-label={`Група ${i + 1} от ${pages}`}
              aria-current={i === page ? "true" : undefined}
              className="group/dot grid h-7 place-items-center px-1"
            >
              <span
                className={`relative block h-2 overflow-hidden rounded-full transition-[width,background-color] duration-300 ease-out-soft ${i === page ? "w-9 bg-ink/15" : "w-2 bg-ink/20 group-hover/dot:bg-ink/45"}`}
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
