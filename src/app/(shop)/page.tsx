import { ArrowRight, BadgePercent, Headset, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { Bento } from "@/components/home/Bento";
import { FacebookSection } from "@/components/home/FacebookSection";
import { OriginTabs } from "@/components/home/OriginTabs";
import { PromoRibbon } from "@/components/home/PromoRibbon";
import { RegisterBanner } from "@/components/home/RegisterBanner";
import { Carousel } from "@/components/product/Carousel";
import { ProductVisual } from "@/components/product/PackShot";
import { ProductCard } from "@/components/product/ProductCard";
import { btn, SectionHeading } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { getCategoryShowcase, getCategoryTree, getHomeData } from "@/lib/queries";
import { ORIGIN_FLAGS, ORIGIN_LABELS } from "@/lib/site";

const BENEFITS = [
  { icon: Truck, title: "Доставка за 24 часа", text: "Изпращаме в деня на поръчката до офис, адрес или автомат." },
  { icon: PackageCheck, title: "Преглед преди плащане", text: "Отваряш пратката и плащаш само ако всичко е наред." },
  { icon: ShieldCheck, title: "Подбрана селекция", text: "Работим директно с производители от Италия и Гърция." },
  { icon: BadgePercent, title: "Цени за количество", text: "Купуваш повече — плащаш по-малко на брой." },
  { icon: Headset, title: "Жив човек на телефона", text: "Помагаме при въпроси и обемни поръчки за офиса." },
];

// Shown on phones too: there the header has no "Нови продукти" link, so this is the way in.
const seeAll = "inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-forest hover:underline sm:gap-1.5 sm:text-base";

export default async function HomePage() {
  const [tree, showcase, home] = await Promise.all([
    getCategoryTree(),
    getCategoryShowcase(),
    getHomeData(),
  ]);
  const total = tree.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="container-shop space-y-16 pt-4 sm:space-y-24 sm:pt-6">
      <Bento tree={tree} showcase={showcase} total={total} />

      <PromoRibbon products={home.promo} />

      {home.bulk.length > 0 && (
        <section className="relative isolate overflow-hidden rounded-tile bg-forest-deep px-6 py-10 text-cream sm:px-10 sm:py-14" aria-labelledby="bulk-heading">
          <span className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-forest" aria-hidden />
          <span className="absolute -bottom-32 left-1/3 -z-10 h-72 w-72 rounded-full bg-lime/10" aria-hidden />
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-lime">Зареди за месеца</p>
              <h2 id="bulk-heading" className="font-display text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
                Купи повече, <span className="text-lime">плати по-малко</span>
              </h2>
              <p className="mt-4 max-w-md text-cream/75">
                Любимите продукти идват с по-добра цена, когато вземеш няколко броя. Отстъпката се прилага автоматично в количката.
              </p>
              <Link href="/promo" className={`${btn.lime} mt-7`}>
                Виж всички оферти
                <ArrowRight className="h-[18px] w-[18px]" />
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {home.bulk.map((p) => (
                <li key={p.id}>
                  <Link href={`/produkt/${p.slug}`} className="group flex h-full flex-col rounded-3xl bg-cream/[0.07] p-4 ring-1 ring-cream/10 backdrop-blur transition hover:bg-cream/[0.12]">
                    <ProductVisual product={p} size={128} className="mx-auto h-32 w-28 transition-transform duration-500 ease-out-soft group-hover:-rotate-3 group-hover:scale-105" />
                    <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug">{p.name}</p>
                    <p className="mt-auto pt-3 text-xs text-cream/60">от {p.bulkMinQty} бр</p>
                    <p className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-lime tabular-nums">{formatPrice(p.bulkPrice ?? p.price)}</span>
                      <span className="text-xs text-cream/50 line-through tabular-nums">{formatPrice(p.price)}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {home.fresh.length > 0 && (
        <section aria-labelledby="new-heading">
          <SectionHeading
            id="new-heading"
            eyebrow="Току-що пристигнали"
            title="Ново в магазина"
            action={
              <Link href="/novi" className={seeAll}>
                Всички нови <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          <Carousel label="Нови продукти" autoplay>
            {home.fresh.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </Carousel>
        </section>
      )}

      <OriginTabs
        tabs={home.byOrigin.map((o) => ({
          id: o.origin,
          label: ORIGIN_LABELS[o.origin] ?? o.origin,
          flag: ORIGIN_FLAGS[o.origin] ?? null,
          blurb: `${o.count} ${o.count === 1 ? "продукт" : "продукта"} с произход ${ORIGIN_LABELS[o.origin] ?? o.origin}.`,
          products: o.products,
        }))}
      />

      <RegisterBanner />

      <FacebookSection />

      <section aria-labelledby="why-heading">
        <SectionHeading id="why-heading" eyebrow="Поръчки за малки и големи" title="Пазаруване без изненади" />
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
          {BENEFITS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className={`rounded-card p-6 ${i === 0 ? "bg-lime" : "bg-paper shadow-soft"}`}>
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${i === 0 ? "bg-ink text-lime" : "bg-sand text-forest"}`}>
                <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="mt-5 font-semibold leading-snug">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {home.brands.length > 0 && (
        <section aria-label="Марки" className="-mx-4 overflow-hidden sm:-mx-6 xl:-mx-8">
          <div className="flex w-max animate-marquee gap-4 hover:[animation-play-state:paused]">
            {/* The list runs twice for a seamless loop; the second copy is hidden from screen readers and the tab order. */}
            {[...home.brands, ...home.brands].map((b, i) => (
              <Link
                key={`${b.id}-${i}`}
                href={`/marka/${b.slug}`}
                aria-hidden={i >= home.brands.length || undefined}
                tabIndex={i >= home.brands.length ? -1 : undefined}
                className="whitespace-nowrap rounded-full border border-line bg-paper px-6 py-3 font-display text-sm font-medium text-ink-soft transition hover:border-forest hover:bg-lime hover:text-ink"
              >
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
