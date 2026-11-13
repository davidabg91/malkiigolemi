import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProductVisual } from "@/components/product/PackShot";
import { btn } from "@/components/ui";
import { optimizedImage } from "@/lib/optimized-image";
import type { CategoryNode, ProductCardData } from "@/lib/queries";

function plural(n: number) {
  return n === 1 ? "продукт" : "продукта";
}

interface ShowcaseItem {
  src: string;
  alt: string;
  className: string;
}

const CATEGORY_SHOWCASES: Record<string, ShowcaseItem[]> = {
  hrani: [
    {
      src: "/dececco-isolated.png",
      alt: "De Cecco Спагети",
      className: "bottom-[6%] right-[36%] h-[66%] w-auto -rotate-12 group-hover:-translate-x-2 group-hover:-rotate-[16deg]",
    },
    {
      src: "/food-isolated.png",
      alt: "Гурме паста с босилек",
      className: "-bottom-[3%] -right-[3%] h-[66%] w-auto rotate-3 group-hover:translate-x-1 group-hover:rotate-6 group-hover:scale-105",
    },
  ],
  "kafe-i-chai": [
    {
      src: "/kafe-2.png",
      alt: "Illy Espresso кафе",
      className: "bottom-[6%] right-[34%] h-[52%] w-auto -rotate-10 group-hover:-translate-x-2 group-hover:-rotate-[14deg]",
    },
    {
      src: "/kafe-1.png",
      alt: "Lavazza Qualità Oro кафе",
      className: "-bottom-[2%] -right-[2%] h-[72%] w-auto rotate-6 group-hover:translate-x-1 group-hover:rotate-[10deg] group-hover:scale-105",
    },
  ],
  igrachki: [
    {
      src: "/igrachki-wood.png",
      alt: "Монтесори образователна дървена пирамида",
      className: "bottom-[2%] right-[54%] h-[56%] w-auto -rotate-6 group-hover:-translate-x-3 group-hover:-rotate-[10deg]",
    },
    {
      src: "/igrachki-bear.png",
      alt: "Плюшено мече с панделка",
      className: "bottom-[3%] right-[36%] h-[68%] w-auto rotate-4 group-hover:-translate-y-2 group-hover:rotate-6",
    },
    {
      src: "/igrachki-car.png",
      alt: "Спортна състезателна количка",
      className: "bottom-[1%] right-[18%] h-[58%] w-auto -rotate-8 group-hover:-translate-x-1 group-hover:-rotate-[12deg]",
    },
    {
      src: "/igrachki-lego.png",
      alt: "LEGO строител и конструктор",
      className: "-bottom-[3%] -right-[1%] h-[78%] w-auto rotate-8 group-hover:translate-x-2 group-hover:rotate-[12deg] group-hover:scale-105",
    },
  ],
  napitki: [
    {
      src: "/napitki-juice.png",
      alt: "Натурален портокалов фреш с плодове",
      className: "bottom-[2%] right-[52%] h-[54%] w-auto -rotate-6 group-hover:-translate-x-3 group-hover:-rotate-[10deg]",
    },
    {
      src: "/napitki-evian.png",
      alt: "Evian натурална минерална вода",
      className: "bottom-[4%] right-[35%] h-[68%] w-auto rotate-3 group-hover:-translate-y-2 group-hover:rotate-6",
    },
    {
      src: "/napitki-1.png",
      alt: "San Pellegrino газирана вода",
      className: "bottom-[1%] right-[18%] h-[72%] w-auto -rotate-6 group-hover:-translate-x-1 group-hover:-rotate-[10deg]",
    },
    {
      src: "/napitki-2.png",
      alt: "Coca-Cola Classic бутилка",
      className: "-bottom-[3%] -right-[1%] h-[78%] w-auto rotate-8 group-hover:translate-x-2 group-hover:rotate-[12deg] group-hover:scale-105",
    },
  ],
  "pochistvane-i-prane": [
    {
      src: "/pochistvane-1.png",
      alt: "Ariel All-in-1 Pods капсули",
      className: "bottom-[6%] right-[32%] h-[52%] w-auto -rotate-8 group-hover:-translate-x-2 group-hover:-rotate-[12deg]",
    },
    {
      src: "/pochistvane-2.png",
      alt: "Lenor Gold Orchid омекотител",
      className: "-bottom-[2%] -right-[2%] h-[74%] w-auto rotate-6 group-hover:translate-x-1 group-hover:rotate-[10deg] group-hover:scale-105",
    },
  ],
  kozmetika: [
    {
      src: "/kozmetika-1.png",
      alt: "Nivea Creme крем",
      className: "bottom-[6%] right-[38%] h-[50%] w-auto -rotate-12 group-hover:-translate-x-2 group-hover:-rotate-[16deg]",
    },
    {
      src: "/kozmetika-2.png",
      alt: "L'Oréal Revitalift серум",
      className: "-bottom-[2%] -right-[1%] h-[70%] w-auto rotate-6 group-hover:translate-x-1 group-hover:rotate-[10deg] group-hover:scale-105",
    },
  ],
  "bebe-i-dete": [
    {
      src: "/bebe-1.png",
      alt: "Pampers Premium Care пелени",
      className: "bottom-[5%] right-[32%] h-[58%] w-auto -rotate-8 group-hover:-translate-x-2 group-hover:-rotate-[12deg]",
    },
    {
      src: "/bebe-2.png",
      alt: "Hipp Organic бебешко пюре",
      className: "-bottom-[1%] -right-[1%] h-[60%] w-auto rotate-6 group-hover:translate-x-1 group-hover:rotate-[10deg] group-hover:scale-105",
    },
  ],
  "dom-i-ofis": [
    {
      src: "/dom-2.png",
      alt: "Moleskine тефтер и Parker химикалка",
      className: "bottom-[5%] right-[32%] h-[58%] w-auto -rotate-8 group-hover:-translate-x-2 group-hover:-rotate-[12deg]",
    },
    {
      src: "/dom-1.png",
      alt: "Yankee Candle ароматна свещ",
      className: "-bottom-[2%] -right-[1%] h-[68%] w-auto rotate-4 group-hover:translate-x-1 group-hover:rotate-[8deg] group-hover:scale-105",
    },
  ],
};

/** Category showcase art with realistic 3D isolated brand products */
function CategoryArt({ slug }: { slug: string }) {
  const items = CATEGORY_SHOWCASES[slug];
  const fly = "absolute drop-shadow-[0_14px_16px_rgb(0_0_0/0.2)] transition-transform duration-500 ease-out-soft";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items?.map((item, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- sized by the tile's classes; the file itself is resized by optimizedImage
        <img
          key={i}
          {...optimizedImage(item.src, 384)}
          alt={item.alt}
          className={`${fly} ${item.className} object-contain`}
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  );
}

/** Fallback three overlapping packs anchored to the bottom-right corner of a tile. */
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
  const hasShowcase = Boolean(CATEGORY_SHOWCASES[category.slug]);

  return (
    <Link
      href={`/kategoria/${category.slug}`}
      className={`group relative isolate min-h-44 animate-rise overflow-hidden rounded-tile p-5 text-ink transition-shadow duration-300 raised hover:shadow-lift sm:p-6 ${area}`}
      style={{ animationDelay: `${80 + index * 60}ms` }}
    >
      {hasShowcase ? (
        <CategoryArt slug={category.slug} />
      ) : (
        <TileArt products={products} />
      )}
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
