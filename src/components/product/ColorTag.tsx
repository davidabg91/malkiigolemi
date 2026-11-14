import { swatchOf } from "@/lib/product-colors";

/** A colour's dot; colours the shop has no paint for get a neutral striped one. */
export function ColorDot({ name, className = "h-3.5 w-3.5" }: { name: string; className?: string }) {
  const hex = swatchOf(name);
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full border border-ink/20 ${className}`}
      style={{ background: hex ?? "repeating-linear-gradient(45deg, #d9d9d6 0 3px, #f5f5f4 3px 6px)" }}
    />
  );
}

/** "● Цвят: Червен" — the chosen colour next to a product in the cart or in an order. */
export function ColorTag({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-ink ${className}`}>
      <ColorDot name={name} />
      <span>
        <span className="text-ink-soft">Цвят:</span> {name}
      </span>
    </span>
  );
}
