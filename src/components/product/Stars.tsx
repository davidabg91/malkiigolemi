import { Star } from "lucide-react";

/** Read-only star row; the number is written out next to it, so the stars are decoration. */
export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block">
            <Star className={`${className} text-line`} fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${className} text-[#e8a317]`} fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export const ratingLabel = (n: number) => n.toFixed(1).replace(".", ",");
