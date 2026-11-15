import Link from "next/link";

/** Each half of the ribbon holds at least this many names: wider than any screen, however few brands there are. */
const MIN_PER_HALF = 28;
/** Seconds a name takes to pass: the pace stays the same whether the ribbon is short or long. */
const SECONDS_PER_NAME = 5;

/**
 * The ribbon of brand names at the bottom of the home page, moving round and round without an end.
 * It is two identical halves side by side, and the whole thing moves left by exactly one half before it
 * starts over, so the restart cannot be seen. With only a few brands a half would be narrower than the
 * screen and leave a gap behind it, so the names are repeated until it is not.
 */
export function BrandMarquee({ brands }: { brands: { id: number; slug: string; name: string }[] }) {
  if (brands.length === 0) return null;
  const half = Array.from({ length: Math.ceil(MIN_PER_HALF / brands.length) }, () => brands).flat();

  return (
    <section aria-label="Марки" className="-mx-4 overflow-hidden sm:-mx-6 xl:-mx-8">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]" style={{ animationDuration: `${half.length * SECONDS_PER_NAME}s` }}>
        {[0, 1].map((copy) => (
          // The space after the last name is padding, not a gap between the halves: a half is then exactly
          // half of the ribbon. `min-w-[100vw]` covers a screen wider than even the repeated names.
          <div key={copy} className="flex min-w-[100vw] shrink-0 justify-around gap-4 pr-4">
            {half.map((b, i) => {
              // Every brand is read out and reachable by keyboard once; the repeats are for the eye only.
              const repeat = copy > 0 || i >= brands.length;
              return (
                <Link
                  key={i}
                  href={`/marka/${b.slug}`}
                  aria-hidden={repeat || undefined}
                  tabIndex={repeat ? -1 : undefined}
                  className="whitespace-nowrap rounded-full border border-line bg-paper px-6 py-3 font-display text-sm font-medium text-ink-soft transition hover:border-forest hover:bg-lime hover:text-ink"
                >
                  {b.name}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
