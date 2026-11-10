"use client";

import { useEffect } from "react";
import { SectionHeading } from "@/components/ui";
import type { ProductCardData } from "@/lib/queries";
import { useHydrated, useRecent } from "@/lib/store";
import { Carousel } from "./Carousel";
import { ProductCard } from "./ProductCard";

/** Remembers the product in localStorage and shows the other recently viewed ones. */
export function RecentlyViewed({ current }: { current: ProductCardData }) {
  const hydrated = useHydrated();
  const items = useRecent((s) => s.items);
  const push = useRecent((s) => s.push);

  useEffect(() => {
    push(current);
  }, [current, push]);

  const others = hydrated ? items.filter((p) => p.id !== current.id) : [];
  if (others.length === 0) return null;

  return (
    <section aria-labelledby="recent-heading">
      <SectionHeading id="recent-heading" title="Последно разгледани" />
      <Carousel label="Последно разгледани продукти">
        {others.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </Carousel>
    </section>
  );
}
