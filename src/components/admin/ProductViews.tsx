"use client";

import { Eye } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { create } from "zustand";

/** How many times each product's page was opened, by product id; null until an admin's browser has asked. */
const useViews = create<{ views: Record<number, number> | null }>(() => ({ views: null }));

/**
 * For a signed-in admin only (the header renders it): fetches the view counts, again on every page, so
 * the eyes on the products are fresh while the admin looks around the shop. Customers never ask for them.
 */
export function AdminViewsLoader() {
  const pathname = usePathname();
  useEffect(() => {
    let current = true;
    fetch("/api/admin/views")
      .then((r) => (r.ok ? r.json() : null))
      .then((views) => {
        if (current && views) useViews.setState({ views });
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [pathname]);
  return null;
}

/**
 * An eye with how many times the product was opened. The shop's pages are the same for everyone, so this
 * draws nothing until the counts have been fetched, which only happens for an admin.
 */
export function ViewCount({ id, className = "", words = false }: { id: number; className?: string; words?: boolean }) {
  const views = useViews((s) => s.views?.[id]);
  if (views === undefined) return null;
  return (
    <span
      className={`pointer-events-none inline-flex items-center gap-1 rounded-full bg-ink/85 font-semibold text-white tabular-nums ${
        words ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-[0.7rem]"
      } ${className}`}
      title="Гледания на продукта — вижда се само от админ"
    >
      <Eye className={words ? "h-4 w-4" : "h-3 w-3"} aria-hidden />
      {views}
      {words ? (views === 1 ? " гледане" : " гледания") : <span className="sr-only"> гледания</span>}
    </span>
  );
}
