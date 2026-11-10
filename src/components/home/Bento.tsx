import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ProductVisual } from "@/components/product/PackShot";
import { btn, ShopMark } from "@/components/ui";
import type { CategoryNode, ProductCardData } from "@/lib/queries";
import { TONES } from "@/lib/site";

function plural(n: number) {
  return n === 1 ? "продукт" : "продукта";
}

/** Three overlapping packs anchored to the bottom-right corner of a tile. */
function TileArt({ products, deep }: { products: ProductCardData[]; deep: string }) {
  const [a, b, c] = products;
  const fly = "absolute drop-shadow-[0_14px_14px_rgb(20_38_28/0.18)] transition-transform duration-500 ease-out-soft";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <span
        className="absolute -bottom-[30%] -right-[12%] aspect-square w-[78%] rounded-full opacity-70 transition-transform duration-700 ease-out-soft group-hover:scale-110"
        style={{ background: deep }}
      />
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
  const tone = TONES[category.tone] ?? TONES.cream;
  return (
    <Link
      href={`/kategoria/${category.slug}`}
      className={`group relative isolate min-h-44 animate-rise overflow-hidden rounded-tile p-5 transition-shadow duration-300 hover:shadow-lift sm:p-6 ${area}`}
      style={{ background: tone.bg, color: tone.ink, animationDelay: `${80 + index * 60}ms` }}
    >
      <TileArt products={products} deep={tone.deep} />
      <div className="relative z-10 flex h-full flex-col">
        <h2 className="max-w-[11ch] font-display text-lg font-semibold leading-[1.15] tracking-tight sm:text-xl xl:text-[1.4rem]">
          {category.name}
        </h2>
        <p className="mt-1.5 text-sm font-medium opacity-70">
          {category.count} {plural(category.count)}
        </p>
        <span
          className="mt-auto grid h-11 w-11 place-items-center rounded-full bg-paper/80 backdrop-blur transition duration-300 group-hover:bg-ink group-hover:text-cream"
          aria-hidden
        >
          <ArrowUpRight className="h-5 w-5 transition-transform duration-300 group-hover:rotate-45" />
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
      <div className="relative isolate col-span-2 flex min-h-[24rem] animate-rise flex-col overflow-hidden rounded-tile bg-forest-deep p-7 text-cream sm:p-10 lg:[grid-area:intro]">
        <div className="absolute -right-12 -top-12 -z-10 h-72 w-72 rounded-full bg-cyan-500/10 p-8 blur-2xl" />
        <ShopMark className="absolute -right-10 -top-8 -z-10 h-64 w-64 text-cyan-400/20 sm:h-72 sm:w-72" />
        <span className="absolute -bottom-24 -left-20 -z-10 h-64 w-64 rounded-full bg-cyan-900/40" aria-hidden />
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-cyan-400/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300 backdrop-blur">
          Официален магазин на общността
        </p>
        <h1 className="mt-auto max-w-[14ch] pt-10 font-display text-[2.1rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl xl:text-[3.2rem]">
          Всичко за дома, <span className="text-cyan-300">за малки и големи</span>
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
