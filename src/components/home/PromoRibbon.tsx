"use client";

import { ArrowRight, Flame, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CardAddButton } from "@/components/product/AddToCart";
import { ProductVisual } from "@/components/product/PackShot";
import { ProductCard, ProductStamp } from "@/components/product/ProductCard";
import { btn } from "@/components/ui";
import { discountPercent, formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/lib/queries";

/** From this many promotions on, the row moves by itself; with fewer, every product is shown once and stands still. */
const MOVING_FROM = 6;

const cardWidth = "w-[220px] shrink-0 sm:w-[260px] md:w-[275px]";

/** A single promotion gets the whole row: a large picture with the price and the saving next to it. */
function Spotlight({ product }: { product: ProductCardData }) {
  const href = `/produkt/${product.slug}`;
  const off = discountPercent(product.price, product.oldPrice);
  const saved = product.oldPrice && product.oldPrice > product.price ? product.oldPrice - product.price : 0;
  const isFull = Boolean(product.image && /\.(jpe?g|webp)$/i.test(product.image));
  return (
    <article className="relative grid overflow-hidden rounded-tile bg-paper shadow-soft sm:grid-cols-[minmax(0,20rem)_1fr] lg:grid-cols-[minmax(0,24rem)_1fr]">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="group relative block aspect-[4/3] overflow-hidden sm:aspect-auto sm:min-h-72"
        style={{ background: isFull ? "#efefed" : `color-mix(in srgb, ${product.color} 4%, #efefed)` }}
      >
        <ProductVisual
          product={product}
          size={512}
          className={`absolute inset-0 m-auto transition-transform duration-500 ease-out-soft group-hover:scale-105 ${isFull ? "h-full w-full" : "h-[84%] w-[84%]"}`}
        />
        <ProductStamp className="bottom-2 right-2 h-5 px-1.5 py-0.5" />
        {off > 0 && <span className="absolute left-4 top-4 rounded-full bg-tomato px-3 py-1.5 text-sm font-bold text-white">−{off}%</span>}
      </Link>
      <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
        {product.brand && <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">{product.brand}</p>}
        <h3 className="mt-1.5 font-display text-2xl font-semibold leading-tight sm:text-3xl">
          <Link href={href} className="hover:text-forest">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-ink-soft">{product.unit}</p>
        <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={`font-display text-4xl font-bold tabular-nums ${saved ? "text-tomato" : ""}`}>{formatPrice(product.price)}</span>
          {saved > 0 && <span className="text-lg text-ink-soft line-through tabular-nums">{formatPrice(product.oldPrice!)}</span>}
        </p>
        {saved > 0 && <p className="mt-1 text-sm font-semibold text-forest">Спестяваш {formatPrice(saved)}</p>}
        {product.bulkMinQty && product.bulkPrice && (
          <p className="mt-1 text-sm text-ink-soft">
            От {product.bulkMinQty} бр: <span className="font-semibold text-ink tabular-nums">{formatPrice(product.bulkPrice)}</span> за брой
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href={href} className={btn.primary}>
            Виж продукта
            <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
          </Link>
          <CardAddButton product={product} />
        </div>
      </div>
    </article>
  );
}

/** A finger or the mouse has to travel this far sideways before it counts as moving the ribbon, not as a tap. */
const DRAG_FROM_PX = 6;
/** How quickly a push fades back into the ribbon's own pace, in milliseconds. */
const SETTLE_MS = 325;

/**
 * The moving ribbon: the products twice in a row, going round without a seam. It moves by itself and can
 * be taken with a finger (or the mouse) and pushed either way; let go and it glides on, then falls back
 * into its own pace. It stands still while the mouse is over it, while it is paused, for people who
 * prefer reduced motion, and off screen. Up and down the page still scrolls as usual.
 */
function Ribbon({ products, paused }: { products: ProductCardData[]; paused: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  // What the animation reads and writes on every frame; as state it would re-render sixty times a second.
  const motion = useRef({
    /** How far the ribbon has moved to the left, in px, always within one copy's width. */
    x: 0,
    /** Its speed, px per millisecond. */
    v: 0,
    /** The width of one copy: moving by this much changes nothing on screen. */
    period: 0,
    auto: true,
    /** A tap that turned into a drag must not also open the product under the finger. */
    moved: false,
    drag: null as { id: number; startX: number; from: number; active: boolean; lastX: number; lastT: number; v: number } | null,
  });
  // The same pace as before the ribbon could be dragged: one copy every `seconds`.
  const seconds = Math.max(28, products.length * 4.2);

  useEffect(() => {
    motion.current.auto = !paused && !hovered;
  }, [paused, hovered]);

  useEffect(() => {
    const el = track.current;
    const half = first.current;
    const box = frame.current;
    if (!el || !half || !box) return;
    const m = motion.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const measure = () => {
      m.period = half.offsetWidth;
    };
    measure();
    const sizes = new ResizeObserver(measure);
    sizes.observe(half);

    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      if (!m.drag?.active) {
        const own = m.auto && !reduce.matches && m.period ? m.period / (seconds * 1000) : 0;
        // Whatever speed it was let go with eases into its own.
        m.v = own + (m.v - own) * Math.exp(-dt / SETTLE_MS);
        m.x += m.v * dt;
      }
      if (m.period) m.x = ((m.x % m.period) + m.period) % m.period;
      el.style.transform = `translate3d(${-m.x}px,0,0)`;
      raf = requestAnimationFrame(step);
    };
    const seen = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      last = 0;
      if (entry.isIntersecting) raf = requestAnimationFrame(step);
    });
    seen.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      seen.disconnect();
      sizes.disconnect();
    };
  }, [seconds]);

  // The second copy is for the eye only: hidden from screen readers and skipped by the Tab key, but it
  // can be tapped like the first. Its buttons change as products go in and out of the cart, hence the watch.
  useEffect(() => {
    const el = copy.current;
    if (!el) return;
    const quiet = () => {
      for (const node of el.querySelectorAll<HTMLElement>("a, button, input, select, textarea")) {
        if (node.tabIndex !== -1) node.tabIndex = -1;
      }
    };
    quiet();
    const watch = new MutationObserver(quiet);
    watch.observe(el, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const m = motion.current;
    m.moved = false;
    m.drag = { id: e.pointerId, startX: e.clientX, from: m.x, active: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const m = motion.current;
    const d = m.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.active) {
      if (Math.abs(dx) < DRAG_FROM_PX) return;
      d.active = true;
      m.moved = true;
      // From here on the ribbon follows the pointer even when it leaves the ribbon.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone: the drag simply ends with it.
      }
    }
    m.x = d.from - dx;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) {
      d.v = 0.7 * ((d.lastX - e.clientX) / dt) + 0.3 * d.v;
      d.lastX = e.clientX;
      d.lastT = e.timeStamp;
    }
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const m = motion.current;
    const d = m.drag;
    if (!d || d.id !== e.pointerId) return;
    // Let go while moving: it glides on. Held still first: it just carries on by itself.
    if (d.active) m.v = e.timeStamp - d.lastT > 90 ? 0 : Math.max(-3, Math.min(3, d.v));
    m.drag = null;
  };

  return (
    <div
      ref={frame}
      className="relative overflow-hidden py-2"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
    >
      {/* Left and right fade gradient overlays for smooth edge transition */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-cream to-transparent sm:w-16 lg:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-cream to-transparent sm:w-16 lg:w-24" />

      {/* `touch-pan-y`: the browser keeps scrolling the page up and down; sideways movement comes to us. */}
      <div
        ref={track}
        className="flex w-max cursor-grab touch-pan-y select-none will-change-transform active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (!motion.current.moved) return;
          motion.current.moved = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {[0, 1].map((n) => (
          // The space after the last card is padding inside the copy, so the two copies are exactly equal.
          <div key={n} ref={n === 0 ? first : copy} className="flex shrink-0 gap-4 pr-4" aria-hidden={n === 1 || undefined}>
            {products.map((product) => (
              <div key={product.id} className={cardWidth}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * "Промоции на седмицата" on the home page. One promotion is shown large; a few stand side by side;
 * only a full row's worth moves as an endless ribbon, so a product is never repeated next to itself.
 */
export function PromoRibbon({ products }: { products: ProductCardData[] }) {
  const [isPaused, setIsPaused] = useState(false);

  if (products.length === 0) return null;
  const moving = products.length >= MOVING_FROM;

  return (
    <section aria-labelledby="promo-heading" className="relative -mx-4 overflow-hidden sm:-mx-6 xl:-mx-8">
      {/* Section Header */}
      <div className="container-shop mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tomato/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-tomato">
              <Flame className="h-3.5 w-3.5 fill-current" />
              Само тази седмица
            </span>
            {moving && (
              <span className="hidden items-center gap-1.5 text-xs text-ink-soft sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Промо лента
              </span>
            )}
          </div>
          <h2 id="promo-heading" className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[2rem]">
            Промоции на седмицата
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {moving && (
            <button
              type="button"
              onClick={() => setIsPaused((v) => !v)}
              className="hidden items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-sand hover:text-ink md:inline-flex"
              aria-label={isPaused ? "Пусни лентата" : "Спри лентата"}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
              <span>{isPaused ? "Пусни" : "Пауза"}</span>
            </button>
          )}

          <Link
            href="/promo"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-forest hover:underline sm:text-base"
          >
            <span>Всички промоции</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {products.length === 1 ? (
        <div className="container-shop py-2">
          <Spotlight product={products[0]} />
        </div>
      ) : !moving ? (
        // A few promotions: each once, side by side, centred; on a phone the row is swiped.
        <div className="no-scrollbar overflow-x-auto py-2">
          <ul className="mx-auto flex w-max gap-4 px-4 sm:px-6 xl:px-8">
            {products.map((product) => (
              <li key={product.id} className={cardWidth}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Ribbon products={products} paused={isPaused} />
      )}
    </section>
  );
}
