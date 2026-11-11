import { Gift, PackageSearch, RotateCcw, Star, Timer, Zap, type LucideIcon } from "lucide-react";
import { getLoyaltySettings } from "@/lib/loyalty";

type Perk = { icon: LucideIcon; title: string; text: string; tone: string };

/** What an account gives. Only things the shop really does; points only while the programme is on. */
async function perks(): Promise<Perk[]> {
  const loyalty = await getLoyaltySettings();
  return [
    ...(loyalty.enabled
      ? [{ icon: Gift, title: "Точки с всяка поръчка", text: "Трупаш точки и ги ползваш за отстъпка следващия път.", tone: "bg-lime text-ink" }]
      : []),
    { icon: Zap, title: "Поръчка с два клика", text: "Адресът, телефонът и офисът на куриера са запазени.", tone: "bg-sun text-ink" },
    { icon: PackageSearch, title: "Следиш поръчката", text: "Виждаш на какъв етап е — от приемането до доставката.", tone: "bg-forest text-cream" },
    { icon: RotateCcw, title: "Поръчай отново", text: "Любимата поръчка — повторена с едно натискане.", tone: "bg-[#0ea5e9] text-white" },
    { icon: Star, title: "Твоят глас", text: "Оценяваш купеното и помагаш на другите да изберат.", tone: "bg-tomato text-white" },
    { icon: Timer, title: "Профил за минута", text: "Без излишни въпроси и без спам.", tone: "bg-[#8b5cf6] text-white" },
  ];
}

// Hand-placed so the bubbles look scattered: horizontal nudge, tilt, and where the float starts.
const LEFT = ["ml-4 -rotate-3", "ml-auto mr-2 rotate-2", "ml-0 -rotate-1"];
const RIGHT = ["mr-6 ml-auto rotate-3", "ml-2 -rotate-2", "ml-auto mr-0 rotate-1"];
const DELAYS = ["0s", "-2.1s", "-4.3s", "-1.2s", "-3.4s", "-5.2s"];

function Bubble({ perk, side, index }: { perk: Perk; side: "left" | "right"; index: number }) {
  const Icon = perk.icon;
  return (
    <li className="animate-rise" style={{ animationDelay: `${0.15 + index * 0.08}s` }}>
      <div
        className={`relative flex w-fit max-w-[16.5rem] items-start gap-3 rounded-[1.6rem] bg-paper p-4 pr-5 shadow-lift ring-1 ring-ink/5 motion-safe:animate-float ${(side === "left" ? LEFT : RIGHT)[index % 3]}`}
        style={{ animationDelay: DELAYS[index % DELAYS.length] }}
      >
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${perk.tone}`}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <span>
          <span className="block font-semibold leading-snug">{perk.title}</span>
          <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{perk.text}</span>
        </span>
        {/* The bubble's tail, pointing at the sign-in panel. */}
        <span className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 rounded-[3px] bg-paper ${side === "left" ? "-right-1.5" : "-left-1.5"}`} aria-hidden />
      </div>
    </li>
  );
}

/** Floating bubbles on both sides of the panel (wide screens). */
export async function AuthPerksSide({ side }: { side: "left" | "right" }) {
  const all = await perks();
  const half = Math.ceil(all.length / 2);
  const mine = side === "left" ? all.slice(0, half) : all.slice(half);
  return (
    <ul className={`hidden flex-col gap-9 xl:flex ${side === "left" ? "pr-4" : "pl-4 pt-10"}`} aria-label={side === "left" ? "Защо да си направиш профил" : undefined}>
      {mine.map((p, i) => (
        <Bubble key={p.title} perk={p} side={side} index={side === "left" ? i : i + half} />
      ))}
    </ul>
  );
}

/** The same perks as a tidy grid under the panel (phones, tablets, small laptops). */
export async function AuthPerksList() {
  const all = await perks();
  return (
    <section className="mx-auto mt-8 max-w-md xl:hidden" aria-labelledby="perks-heading">
      <h2 id="perks-heading" className="mb-3 text-center text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft">
        С профил получаваш
      </h2>
      <ul className="grid grid-cols-2 gap-2.5">
        {all.map((p) => {
          const Icon = p.icon;
          return (
            <li key={p.title} className="flex items-start gap-2.5 rounded-2xl bg-paper p-3 shadow-soft">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${p.tone}`}>
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <span className="text-[0.8rem] font-semibold leading-snug">{p.title}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
