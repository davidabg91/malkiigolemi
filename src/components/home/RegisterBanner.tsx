import { ArrowRight, BellRing, Coins, PackageCheck, UserPlus, Zap } from "lucide-react";
import Link from "next/link";

const PERKS = [
  {
    icon: Coins,
    title: "Бонус точки при всяка поръчка",
    text: "Трупаш точки при всяка покупка и ги ползваш като реална отстъпка директно в количката.",
  },
  {
    icon: Zap,
    title: "Поръчка с 1 клик",
    text: "Запазваш данните си за доставка и любим офис на Speedy / Econt – без повторно писане.",
  },
  {
    icon: PackageCheck,
    title: "Проследяване и история",
    text: "Виждаш статуса на пратката в реално време, товарителница и архива на предишните си покупки.",
  },
  {
    icon: BellRing,
    title: "Известия за любими артикули",
    text: "Получаваш сигнал щом изчерпан артикул се върне на склад или любим продукт бъде намален.",
  },
];

export function RegisterBanner() {
  return (
    <section
      aria-labelledby="register-banner-heading"
      className="relative isolate overflow-hidden rounded-tile border border-forest/25 bg-gradient-to-br from-forest-deep via-[#153424] to-[#0d2217] p-6 text-cream shadow-lift sm:p-8 lg:p-10"
    >
      {/* Decorative ambient gradients */}
      <span
        className="pointer-events-none absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full bg-lime/10 blur-3xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -bottom-24 -left-16 -z-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"
        aria-hidden
      />

      <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1.35fr] lg:gap-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-lime/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-lime ring-1 ring-lime/30">
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            <span>Клубни привилегии</span>
          </div>

          <h2
            id="register-banner-heading"
            className="mt-3.5 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl lg:text-[2rem] lg:leading-[1.18]"
          >
            Пазарувай по-умно с <span className="text-lime">безплатен профил</span>
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-cream/75 sm:text-base">
            Регистрирай се за 30 секунди и отключи бонус точки при всяка поръчка, светкавичен завършек без повторно въвеждане на данни и специални оферти.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              href="/registratsiya"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-lime px-6 text-sm font-bold text-ink shadow transition hover:bg-lime-deep hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Регистрирай се безплатно</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-xs text-cream/70 sm:text-sm">
              или{" "}
              <Link href="/vhod" className="font-semibold text-lime underline-offset-4 hover:underline">
                влез в профила си
              </Link>
            </span>
          </div>
        </div>

        {/* 4 compact benefit cards */}
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="group relative flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-xs transition hover:border-lime/40 hover:bg-white/[0.09]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime/15 text-lime transition group-hover:bg-lime group-hover:text-ink">
                <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-cream transition-colors group-hover:text-lime">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-cream/75">
                  {text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
