import { useId, type ReactNode } from "react";
import { optimizedImage } from "@/lib/optimized-image";

/**
 * Illustrated product packaging. Used whenever a product has no uploaded photo,
 * so the catalogue looks complete from day one.
 */

function mix(hex: string, target: number, amount: number) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    return Math.round(v + (target - v) * amount);
  };
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`;
}
const lighten = (hex: string, a: number) => mix(hex, 255, a);
const darken = (hex: string, a: number) => mix(hex, 0, a);

type Box = { x: number; y: number; w: number; h: number };
type Shape = { label: Box; shadow?: [cx: number, rx: number]; draw: (c: Paint) => ReactNode };
type Paint = { body: string; dark: string; light: string; deep: string; base: string };

const SHAPES: Record<string, Shape> = {
  bag: {
    label: { x: 62, y: 92, w: 76, h: 78 },
    draw: (c) => (
      <>
        <path d="M58 34h84l5 12 9 162q1 10-9 10H53q-10 0-9-10l9-162z" fill={c.body} />
        <rect x="55" y="24" width="90" height="13" rx="3" fill={c.dark} />
        <path d="M60 30h80" stroke={c.light} strokeWidth="1.5" strokeDasharray="3 3" opacity=".6" />
        <circle cx="100" cy="64" r="7" fill={c.deep} opacity=".55" />
      </>
    ),
  },
  bottle: {
    label: { x: 68, y: 118, w: 64, h: 62 },
    shadow: [100, 44],
    draw: (c) => (
      <>
        <path d="M90 32h20v22c0 14 28 18 28 44v110q0 10-10 10H72q-10 0-10-10V98c0-26 28-30 28-44z" fill={c.body} />
        <rect x="87" y="14" width="26" height="20" rx="4" fill={c.dark} />
        <path d="M70 100c2-14 14-22 22-30" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".35" fill="none" />
      </>
    ),
  },
  jar: {
    label: { x: 58, y: 108, w: 84, h: 66 },
    shadow: [100, 56],
    draw: (c) => (
      <>
        <rect x="48" y="74" width="104" height="144" rx="20" fill={c.body} />
        <rect x="56" y="50" width="88" height="28" rx="7" fill={c.dark} />
        <path d="M56 62h88" stroke={c.deep} strokeWidth="2" />
        <path d="M58 100v84" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".3" />
      </>
    ),
  },
  can: {
    label: { x: 54, y: 92, w: 92, h: 84 },
    shadow: [100, 52],
    draw: (c) => (
      <>
        <rect x="54" y="50" width="92" height="168" rx="12" fill={c.body} />
        <ellipse cx="100" cy="52" rx="46" ry="9" fill={c.light} />
        <ellipse cx="100" cy="52" rx="36" ry="5.5" fill={c.dark} opacity=".35" />
        <path d="M54 74h92M54 196h92" stroke={c.deep} strokeWidth="2" opacity=".6" />
      </>
    ),
  },
  box: {
    label: { x: 58, y: 96, w: 82, h: 80 },
    shadow: [106, 62],
    draw: (c) => (
      <>
        <path d="M150 50l16-10v164l-16 14z" fill={c.deep} />
        <path d="M46 50l16-10h104l-16 10z" fill={c.light} />
        <rect x="46" y="50" width="104" height="168" rx="3" fill={c.body} />
        <circle cx="98" cy="74" r="8" fill={c.light} opacity=".7" />
      </>
    ),
  },
  carton: {
    label: { x: 66, y: 112, w: 68, h: 70 },
    shadow: [100, 46],
    draw: (c) => (
      <>
        <path d="M60 78l40-34 40 34z" fill={c.light} />
        <path d="M100 44l40 34" stroke={c.deep} strokeWidth="2" />
        <rect x="60" y="78" width="80" height="140" rx="3" fill={c.body} />
        <circle cx="118" cy="66" r="7" fill={c.dark} />
        <path d="M60 92h80" stroke={c.deep} strokeWidth="1.5" opacity=".5" />
      </>
    ),
  },
  tin: {
    label: { x: 62, y: 100, w: 76, h: 84 },
    shadow: [100, 52],
    draw: (c) => (
      <>
        <path d="M78 58c0-22 44-22 44 0" stroke={c.dark} strokeWidth="5" fill="none" strokeLinecap="round" />
        <rect x="114" y="46" width="20" height="14" rx="3" fill={c.dark} />
        <rect x="52" y="58" width="96" height="160" rx="7" fill={c.body} />
        <rect x="52" y="58" width="96" height="10" rx="5" fill={c.light} opacity=".7" />
        <rect x="52" y="208" width="96" height="10" rx="5" fill={c.deep} opacity=".7" />
      </>
    ),
  },
  bar: {
    label: { x: 64, y: 104, w: 72, h: 62 },
    shadow: [100, 50],
    draw: (c) => (
      <g transform="rotate(-6 100 136)">
        <rect x="54" y="56" width="92" height="160" rx="7" fill={c.body} />
        <path d="M54 76h92M54 196h92" stroke={c.light} strokeWidth="1.5" opacity=".7" />
        <path d="M60 60l8 10M72 60l8 10M84 60l8 10M96 60l8 10M108 60l8 10M120 60l8 10M132 60l8 10" stroke={c.deep} strokeWidth="1.5" opacity=".5" />
      </g>
    ),
  },
  pack: {
    label: { x: 58, y: 104, w: 84, h: 72 },
    shadow: [100, 66],
    draw: (c) => (
      <>
        <rect x="36" y="66" width="128" height="152" rx="18" fill={c.body} />
        <path d="M50 66v152M150 66v152" stroke={c.deep} strokeWidth="1.5" opacity=".5" />
        <rect x="76" y="78" width="48" height="12" rx="6" fill={c.light} opacity=".8" />
        <path d="M44 88c0-10 4-14 12-16" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".35" fill="none" />
      </>
    ),
  },
  roll: {
    label: { x: 60, y: 126, w: 80, h: 52 },
    shadow: [100, 70],
    draw: (c) => (
      <>
        {[38, 82, 126].map((x) => (
          <g key={x}>
            <rect x={x} y="60" width="40" height="158" rx="12" fill="#fff" />
            <ellipse cx={x + 20} cy="66" rx="20" ry="7" fill="#F3EEE3" />
            <ellipse cx={x + 20} cy="66" rx="7" ry="2.6" fill={c.deep} opacity=".6" />
            <path d={`M${x} 114h40M${x} 166h40`} stroke="#E9E2D3" strokeWidth="1.5" strokeDasharray="2 4" />
          </g>
        ))}
        <rect x="32" y="112" width="140" height="80" rx="10" fill={c.body} opacity=".92" />
      </>
    ),
  },
  tube: {
    label: { x: 70, y: 66, w: 60, h: 86 },
    shadow: [100, 30],
    draw: (c) => (
      <>
        <path d="M56 26h88l-22 172H78z" fill={c.body} />
        <rect x="54" y="18" width="92" height="12" rx="3" fill={c.dark} />
        <rect x="84" y="196" width="32" height="24" rx="5" fill={c.dark} />
        <path d="M84 204h32" stroke={c.light} strokeWidth="1.5" opacity=".5" />
      </>
    ),
  },
  spray: {
    label: { x: 72, y: 126, w: 56, h: 64 },
    shadow: [100, 44],
    draw: (c) => (
      <>
        <path d="M64 108q0-18 18-18h36q18 0 18 18v100q0 10-10 10H74q-10 0-10-10z" fill={c.body} />
        <rect x="86" y="70" width="28" height="22" rx="3" fill={c.deep} />
        <path d="M74 38h52q8 0 8 8v24H88v-8H72q-6 0-6-6v-6q0-12 8-12z" fill={c.dark} />
        <path d="M90 70l-14 24h9l13-24z" fill={c.dark} />
        <rect x="58" y="44" width="10" height="8" rx="2" fill={c.deep} />
      </>
    ),
  },
  jug: {
    label: { x: 62, y: 124, w: 62, h: 64 },
    shadow: [100, 52],
    draw: (c) => (
      <>
        <path d="M56 78q0-14 14-14h42l26 22q8 7 8 16v106q0 10-10 10H66q-10 0-10-10z" fill={c.body} />
        <rect x="70" y="34" width="40" height="32" rx="5" fill={c.dark} />
        <path d="M70 46h40" stroke={c.light} strokeWidth="1.5" opacity=".5" />
        <rect x="124" y="100" width="12" height="46" rx="6" fill={c.deep} />
      </>
    ),
  },
  pump: {
    label: { x: 68, y: 116, w: 64, h: 66 },
    shadow: [100, 46],
    draw: (c) => (
      <>
        <rect x="58" y="86" width="84" height="132" rx="20" fill={c.body} />
        <rect x="84" y="70" width="32" height="18" rx="4" fill={c.dark} />
        <rect x="96" y="42" width="8" height="30" fill={c.deep} />
        <path d="M70 30h44q8 0 8 8v6H70z" fill={c.dark} />
        <path d="M68 110v70" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".3" />
      </>
    ),
  },
};

function labelLines(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 11) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  return lines.slice(0, 3);
}

export function PackShot({
  pack,
  color,
  label,
  className,
  title,
}: {
  pack: string;
  color: string;
  label?: string | null;
  className?: string;
  title?: string;
}) {
  const uid = useId();
  const shape = SHAPES[pack] ?? SHAPES.box;
  const gradient = `g${uid}`;
  const paint: Paint = {
    body: `url(#${gradient})`,
    base: color,
    dark: darken(color, 0.38),
    deep: darken(color, 0.2),
    light: lighten(color, 0.35),
  };
  const l = shape.label;
  const lines = label ? labelLines(label) : [];
  const fontSize = lines.some((t) => t.length > 9) ? 9.5 : 11;
  const lineHeight = fontSize + 2.5;
  const textTop = l.y + l.h / 2 - ((lines.length - 1) * lineHeight) / 2 - 4;
  const [shadowCx, shadowRx] = shape.shadow ?? [100, 58];

  return (
    <svg
      viewBox="0 0 200 240"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={gradient} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={lighten(color, 0.22)} />
          <stop offset=".38" stopColor={color} />
          <stop offset="1" stopColor={darken(color, 0.24)} />
        </linearGradient>
      </defs>
      <ellipse cx={shadowCx} cy="224" rx={shadowRx} ry="7" fill="#14261C" opacity=".12" />
      {shape.draw(paint)}
      <rect x={l.x} y={l.y} width={l.w} height={l.h} rx="6" fill="#FFFDF7" />
      <rect x={l.x + 5} y={l.y + 5} width={l.w - 10} height={l.h - 10} rx="3" fill="none" stroke={paint.deep} strokeWidth="1" opacity=".45" />
      {lines.map((t, i) => (
        <text
          key={i}
          x={l.x + l.w / 2}
          y={textTop + i * lineHeight}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight="800"
          fill={paint.dark}
          style={{ fontFamily: "var(--font-onest), sans-serif", letterSpacing: "-0.01em" }}
        >
          {t}
        </text>
      ))}
      <rect x={l.x + l.w / 2 - 10} y={l.y + l.h - 14} width="20" height="3" rx="1.5" fill={color} />
    </svg>
  );
}

/** Uploaded photo when there is one, otherwise the illustrated pack. */
export function ProductVisual({
  product,
  className,
  size = 256,
}: {
  product: { image: string | null; pack: string; color: string; brand: string | null; name: string };
  className?: string;
  /** Roughly how wide the photo is drawn, in CSS pixels. Picks which resized copy is downloaded. */
  size?: number;
}) {
  if (product.image) {
    const isFullPhoto = /\.(jpe?g|webp)$/i.test(product.image);
    // Multiply blends a studio photo's white backdrop into the tinted card behind it.
    // Full lifestyle photos (JPG) cover the panel with their own natural background without multiply.
    // eslint-disable-next-line @next/next/no-img-element -- sized by the caller's classes; the file itself is resized by optimizedImage
    return (
      <img
        {...optimizedImage(product.image, size)}
        alt={product.name}
        loading="lazy"
        decoding="async"
        className={`${className ?? ""} ${isFullPhoto ? "object-cover" : "object-contain mix-blend-multiply"}`}
      />
    );
  }
  return <PackShot pack={product.pack} color={product.color} label={product.brand} className={className} title={product.name} />;
}
