"use client";

import { ExternalLink, MapPin, Map as MapIcon, X } from "lucide-react";
import { useState } from "react";
import { site, STORE } from "@/lib/site";

/** Store address with a map that opens on demand, so Google Maps only loads when someone asks for it. */
export function StoreLocation({ defaultOpen = false, className = "" }: { defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl border border-line bg-paper p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime/40 text-forest">
          <MapPin className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Нашият магазин</p>
          <p className="text-sm text-ink-soft">{STORE.address}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{site.workHours}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="store-map"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-4 text-sm font-semibold text-white transition hover:bg-forest-deep"
        >
          {open ? <X className="h-4 w-4" aria-hidden /> : <MapIcon className="h-4 w-4" aria-hidden />}
          {open ? "Скрий картата" : "Покажи на картата"}
        </button>
        <a
          href={STORE.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold transition hover:border-ink"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Упътване в Google Maps
        </a>
      </div>
      {open && (
        <iframe
          id="store-map"
          title={`Карта: ${STORE.address}`}
          src={STORE.embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="mt-3 aspect-[4/3] w-full rounded-xl border-0 sm:aspect-[16/9]"
        />
      )}
    </div>
  );
}
