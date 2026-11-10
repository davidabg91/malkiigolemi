"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useState, type ReactNode } from "react";

/** Horizontal, swipeable shelf of cards with arrow controls. */
export function Carousel({ children, label }: { children: ReactNode; label: string }) {
  const [ref, api] = useEmblaCarousel({ align: "start", dragFree: true, containScroll: "trimSnaps" });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    if (!api) return;
    setCanPrev(api.canScrollPrev());
    setCanNext(api.canScrollNext());
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

  const arrow =
    "absolute top-[38%] z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-paper text-ink shadow-lift transition hover:bg-ink hover:text-cream disabled:pointer-events-none disabled:opacity-0 md:grid";

  return (
    <div className="relative" role="region" aria-roledescription="карусел" aria-label={label}>
      <div ref={ref} className="-mx-4 overflow-hidden px-4 py-2 sm:-mx-6 sm:px-6 xl:-mx-2 xl:px-2">
        <ul className="flex touch-pan-y gap-3 sm:gap-4">
          {Children.map(children, (child) => (
            <li className="w-[46%] shrink-0 sm:w-[31%] md:w-[23.5%] xl:w-[19%]">{child}</li>
          ))}
        </ul>
      </div>
      <button type="button" className={`${arrow} -left-4`} onClick={() => api?.scrollPrev()} disabled={!canPrev} aria-label="Назад">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" className={`${arrow} -right-4`} onClick={() => api?.scrollNext()} disabled={!canNext} aria-label="Напред">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
