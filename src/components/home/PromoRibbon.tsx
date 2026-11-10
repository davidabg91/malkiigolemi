"use client";

import { ArrowRight, Flame, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import type { ProductCardData } from "@/lib/queries";

export function PromoRibbon({ products }: { products: ProductCardData[] }) {
  const [isPaused, setIsPaused] = useState(false);

  if (products.length === 0) return null;

  // Build two identical halves to ensure smooth, seamless infinite scrolling
  const minItemsPerHalf = 8;
  const repeatHalf = Math.max(1, Math.ceil(minItemsPerHalf / products.length));
  const half: ProductCardData[] = [];
  for (let i = 0; i < repeatHalf; i++) {
    half.push(...products);
  }
  const allItems = [...half, ...half];

  // Dynamic animation duration based on total length
  const durationSeconds = Math.max(28, half.length * 4.2);

  return (
    <section aria-labelledby="promo-heading" className="relative -mx-4 overflow-hidden sm:-mx-6 xl:-mx-8">
      {/* Section Header */}
      <div className="container-shop mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tomato/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-tomato">
              <Flame className="h-3.5 w-3.5 fill-current" />
              Само тази седмица
            </span>
            <span className="hidden items-center gap-1.5 text-xs text-ink-soft sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Промо лента
            </span>
          </div>
          <h2 id="promo-heading" className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[2rem]">
            Промоции на седмицата
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPaused((v) => !v)}
            className="hidden items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-sand hover:text-ink md:inline-flex"
            aria-label={isPaused ? "Пусни лентата" : "Спри лентата"}
          >
            {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
            <span>{isPaused ? "Пусни" : "Пауза"}</span>
          </button>

          <Link
            href="/promo"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-forest hover:underline sm:text-base"
          >
            <span>Всички промоции</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Moving Track Container with gradient fade edges */}
      <div className="relative py-2">
        {/* Left and right fade gradient overlays for smooth edge transition */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-cream to-transparent sm:w-16 lg:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-cream to-transparent sm:w-16 lg:w-24" />

        {/* The Continuous Infinite Marquee Ribbon */}
        <div
          className="flex w-max gap-4 px-4 hover:[animation-play-state:paused]"
          style={{
            animation: `marquee ${durationSeconds}s linear infinite`,
            animationPlayState: isPaused ? "paused" : undefined,
          }}
        >
          {allItems.map((product, index) => (
            <div
              key={`${product.id}-${index}`}
              className="w-[220px] shrink-0 sm:w-[260px] md:w-[275px]"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
