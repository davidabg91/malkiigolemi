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
            className="fixed inset-0 z-[100] grid animate-pop cursor-zoom-out place-items-center bg-[#f6f2e8]/95 p-4 backdrop-blur-sm sm:p-10"
          >
            <div className="grid h-full max-h-[min(92dvh,1100px)] w-full max-w-[min(92vw,1100px)] place-items-center [&>*]:max-h-full [&>*]:max-w-full">
              {zoomed}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Затвори"
              className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-ink text-cream shadow-lift transition hover:scale-105"
            >
              <X className="h-5 w-5" />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
