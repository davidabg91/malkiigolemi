"use client";

import { Maximize2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The product photo on the product page: a click opens it full screen for a closer look.
 * `zoomed` is the same visual rendered large on the server, so photos and illustrated packs both work.
 */
export function ProductZoom({ label, zoomed, children }: { label: string; zoomed: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Увеличи снимката: ${label}`}
        className="group/zoom absolute inset-0 grid cursor-zoom-in place-items-center"
      >
        {children}
        <span className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-paper/85 text-ink opacity-80 shadow-soft backdrop-blur transition group-hover/zoom:scale-105 group-hover/zoom:opacity-100 sm:right-4 sm:top-4">
          <Maximize2 className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-md transition-all duration-300 sm:p-8"
          >
            <div
              className="relative flex aspect-square max-h-[82vh] max-w-[min(88vw,750px)] w-full items-center justify-center overflow-hidden rounded-3xl bg-neutral-900/60 p-2 shadow-2xl ring-1 ring-white/10 sm:p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-full w-full items-center justify-center [&>*]:max-h-full [&>*]:max-w-full [&>*]:object-contain">
                {zoomed}
              </div>
            </div>

            <p className="mt-3 text-center text-xs font-medium text-white/70">
              {label} · <span className="text-white/40">Натисни извън снимката или Esc, за да затвориш</span>
            </p>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Затвори"
              className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 hover:scale-105 sm:right-6 sm:top-6"
            >
              <X className="h-5 w-5" />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
