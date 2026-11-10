"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Carousel } from "@/components/product/Carousel";
import { ProductCard } from "@/components/product/ProductCard";
import type { ProductCardData } from "@/lib/queries";

type Tab = { id: string; label: string; flag: string[]; blurb: string; products: ProductCardData[] };

function Flag({ stripes, horizontal }: { stripes: string[]; horizontal?: boolean }) {
  return (
    <span className={`flex h-4 w-6 overflow-hidden rounded-[3px] ring-1 ring-ink/10 ${horizontal ? "flex-col" : ""}`} aria-hidden>
      {stripes.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c }} />
      ))}
    </span>
  );
}

export function OriginTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!tab) return null;

  return (
    <section aria-labelledby="origin-heading">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest">По произход</p>
          <h2 id="origin-heading" className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[2rem]">
            Звездите на Средиземноморието
          </h2>
        </div>
        <div role="tablist" aria-label="Произход" className="flex rounded-full bg-sand p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab.id}
              onClick={() => setActive(t.id)}
              className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition ${t.id === tab.id ? "bg-ink text-cream shadow-soft" : "text-ink-soft hover:text-ink"}`}
            >
              <Flag stripes={t.flag} horizontal={t.id === "GR"} />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" key={tab.id} className="animate-rise">
        <Carousel label={`Продукти от ${tab.label}`}>
          {tab.products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Carousel>
        <p className="mt-4 flex flex-wrap items-center justify-between gap-3 text-ink-soft">
          {tab.blurb}
          <Link href={`/produkti?origin=${tab.id}`} className="inline-flex items-center gap-1.5 font-semibold text-forest hover:underline">
            Всички от {tab.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </p>
      </div>
    </section>
  );
}
