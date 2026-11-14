import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProductVisual } from "@/components/product/PackShot";
import { btn } from "@/components/ui";
import { optimizedImage } from "@/lib/optimized-image";
import type { CategoryNode, ProductCardData } from "@/lib/queries";
import { isTileImage, TILE_FRAMES, TILE_PRESETS } from "@/lib/tile-art";

function plural(n: number) {
  return n === 1 ? "продукт" : "продукта";
}

/** One of the ready-made illustrations: realistic isolated products in the tile's corner. */
function CategoryArt({ preset }: { preset: string }) {
  const items = TILE_PRESETS[preset];
  const frame = TILE_FRAMES[preset];
  const fly = "absolute max-w-none drop-shadow-[0_14px_16px_rgb(0_0_0/0.2)] transition-transform duration-500 ease-out-soft";
  const art = items?.map((item, i) => (
    // eslint-disable-next-line @next/next/no-img-element -- sized by the tile's classes; the file itself is resized by optimizedImage
    <img
      key={i}
      {...optimizedImage(item.src, 384)}
      alt={item.alt}
      className={`${fly} ${item.className} object-contain`}
      loading="lazy"
      decoding="async"
    />
  ));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {frame ? <div className={frame}>{art}</div> : art}
    </div>
  );
}

/** A picture the admin uploaded for the tile, in its bottom-right corner. */
function UploadedArt({ src }: { src: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- sized by the tile's classes; the file itself is resized by optimizedImage */}
      <img
        {...optimizedImage(src, 640)}
        alt=""
        className="absolute -bottom-[2%] -right-[2%] h-[76%] w-auto max-w-[72%] object-contain object-right-bottom drop-shadow-[0_14px_16px_rgb(0_0_0/0.2)] transition-transform duration-500 ease-out-soft group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

/** "Automatic": three of the category's own products, overlapping in the bottom-right corner of a tile. */
function TileArt({ products }: { products: ProductCardData[] }) {
  const [a, b, c] = products;
  const fly = "absolute drop-shadow-[0_14px_14px_rgb(0_0_0/0.16)] transition-transform duration-500 ease-out-soft";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {c && (
        <ProductVisual product={c} className={`${fly} bottom-[4%] right-[44%] h-[46%] w-auto -rotate-12 group-hover:-translate-x-2 group-hover:-rotate-[16deg]`} />
      )}
      {b && (
        <ProductVisual product={b} className={`${fly} bottom-[2%] right-[22%] h-[58%] w-auto -rotate-3 group-hover:-translate-y-2`} />
      )}
      {a && (
        <ProductVisual product={a} className={`${fly} -bottom-[2%] -right-[1%] h-[68%] w-auto rotate-[9deg] group-hover:translate-x-1 group-hover:rotate-[13deg]`} />
      )}
    </div>
  );
}

function CategoryTile({
  category,
  products,
  area,
  index,
}: {
  category: CategoryNode;
  products: ProductCardData[];
  area: string;
  index: number;
}) {
  const tile = category.tile;

  return (
    <Link
      href={`/kategoria/${category.slug}`}
      className={`group relative isolate min-h-44 animate-rise overflow-hidden rounded-tile p-5 text-ink transition-shadow duration-300 raised hover:shadow-lift sm:p-6 ${area}`}
      style={{ animationDelay: `${80 + index * 60}ms` }}
    >
      {isTileImage(tile) ? <UploadedArt src={tile} /> : tile && TILE_PRESETS[tile] ? <CategoryArt preset={tile} /> : <TileArt products={products} />}
      <div className="relative z-10 flex h-full flex-col">
        <h2 className="max-w-[12ch] font-display text-[1.3rem] font-bold leading-[1.1] sm:text-2xl">
          {category.name}
        </h2>
        {/* No room for the count on a phone-sized tile. */}
        <p className="mt-1.5 hidden text-sm font-medium opacity-70 sm:block">
          {category.count} {plural(category.count)}
        </p>
        <span
          className="ml-auto mt-auto grid h-10 w-10 place-items-center rounded-full bg-paper shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_4px_10px_-2px_rgb(0_0_0/0.22)] transition duration-300 group-hover:bg-ink group-hover:text-cream"
          aria-hidden
        >
          <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

// Grid areas for up to seven categories; anything beyond flows into extra rows.
const AREAS = [
  "lg:[grid-area:c1]",
  "lg:[grid-area:c2]",
  "col-span-2 lg:[grid-area:c3]",
  "lg:[grid-area:c4]",
  "lg:[grid-area:c5]",
  "lg:[grid-area:c6]",
  "lg:[grid-area:c7]",
];

export function Bento({
  tree,
  showcase,
  total,
}: {
  tree: CategoryNode[];
  showcase: Record<number, ProductCardData[]>;
  total: number;
}) {
  return (
    <section
      aria-label="Категории"
      className="bento grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
    >
      <div className="relative isolate col-span-2 hidden animate-rise flex-col overflow-hidden rounded-tile bg-forest-deep p-7 text-cream sm:p-10 lg:flex lg:min-h-[24rem] lg:[grid-area:intro]">
        <div className="absolute -right-12 -top-12 -z-10 h-72 w-72 rounded-full bg-white/10 p-8 blur-2xl" />
        <span className="absolute -bottom-24 -left-20 -z-10 h-64 w-64 rounded-full bg-black/15" aria-hidden />
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cream/90 backdrop-blur">
          Официален магазин на общността
        </p>
        <h1 className="mt-auto max-w-[14ch] pt-10 font-display text-[2.1rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl xl:text-[3.2rem]">
          Всичко за дома, <span className="text-cream/70">за малки и големи</span>
        </h1>
        <p className="mt-4 max-w-md text-cream/75 sm:text-lg">
          {total > 0 ? `${total} подбрани продукта` : "Подбрани качествени стоки"} — любими предложения от доверената Facebook общност с бърза доставка за 24 часа.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/promo" className={btn.lime}>
            Виж промоциите
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
          <Link href="/produkti" className={btn.outlineLight}>
            Всички продукти
          </Link>
        </div>
      </div>

      {tree.slice(0, 7).map((c, i) => (
        <CategoryTile key={c.id} category={c} products={showcase[c.id] ?? []} area={AREAS[i]} index={i} />
      ))}
      {tree.slice(7).map((c, i) => (
        <CategoryTile key={c.id} category={c} products={showcase[c.id] ?? []} area="" index={7 + i} />
      ))}
    </section>
  );
}
