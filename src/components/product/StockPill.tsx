import { stockState, type StockState } from "@/lib/availability";

/** Pill and dot colours: green for on hand, pale orange for a delivery time, blue for goods on their way. */
const STYLES: Record<StockState, { pill: string; dot: string }> = {
  available: { pill: "bg-[#e4f6ea] text-[#14693a]", dot: "glow-dot text-[#22c55e]" },
  delivery: { pill: "bg-[#ffedd5] text-[#9a4a06]", dot: "text-[#f59e0b]" },
  expected: { pill: "bg-[#e3eeff] text-[#1e4fbf]", dot: "glow-dot text-[#3b82f6]" },
  soldout: { pill: "bg-sand text-ink-soft", dot: "text-ink-soft/60" },
};

/**
 * A product's status for the customer: "Налично", "Доставка 7 дни", "Очаква се" or "Изчерпан", with a dot
 * that glows for the first and the third (and pulses on the large pill of a product's page).
 * `notable` shows it only when there is something to know beyond "on hand" (the cart, the checkout);
 * `large` is the product page's version, where `children` may replace the short label.
 */
export function StockPill({
  product,
  notable = false,
  large = false,
  className = "",
  children,
}: {
  product: { stock: number; availability?: string | null; deliveryTime?: string | null };
  notable?: boolean;
  large?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const { kind, label } = stockState(product);
  if (notable && (kind === "available" || kind === "soldout")) return null;
  const style = STYLES[kind];
  return (
    <span
      className={`inline-flex max-w-full items-center font-semibold ${style.pill} ${
        // The small one is as round as a pill on one line and still looks right when a long delivery time
        // takes two on a narrow card: the time is the point, so it wraps instead of being cut off.
        large ? "gap-2.5 rounded-2xl px-4 py-2.5 text-sm" : "gap-1.5 rounded-xl px-2 py-0.5 text-xs leading-snug"
      } ${className}`}
    >
      <span
        className={`relative shrink-0 rounded-full bg-current ${style.dot} ${large ? `h-2.5 w-2.5 ${style.dot.includes("glow-dot") ? "glow-pulse" : ""}` : "h-2 w-2"}`}
        aria-hidden
      />
      {/* A word joiner after the dash keeps a range such as "5–7" on one line. */}
      <span className={large ? "" : "min-w-0 text-balance [overflow-wrap:anywhere]"}>
        {children ?? label.replace(/([–—-])(?=\d)/g, "$1⁠")}
      </span>
    </span>
  );
}
