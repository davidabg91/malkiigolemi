import { ArrowUpRight, BadgePercent, CheckCircle2, MessageCircle, Users } from "lucide-react";
import Image from "next/image";
import { FacebookIcon } from "@/components/ui";
import { site } from "@/lib/site";

export function FacebookSection() {
  return (
    <section aria-labelledby="fb-community-heading" className="overflow-hidden rounded-tile border border-sky-100 bg-gradient-to-br from-sky-50/70 via-white to-cyan-50/50 p-6 shadow-soft sm:p-10 lg:p-12">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#1877F2]/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#1877F2]">
            <FacebookIcon className="h-3.5 w-3.5" />
            Официална Facebook общност
          </div>

          <h2
            id="fb-community-heading"
            className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl lg:text-4xl"
          >
            Започнахме във Facebook — <br className="hidden sm:inline" />
            <span className="text-[#1877F2]">сега сме и с модерен онлайн магазин!</span>
          </h2>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Нашата Facebook група <strong className="font-semibold text-ink">„{site.facebookGroupName}“</strong> е мястото, откъдето тръгна всичко. Досега работехме изцяло там — хиляди успешни поръчки, реални отзиви и верни клиенти. За ваше максимално удобство създадохме и този нов сайт, където поръчвате лесно и бързо 24/7!
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            <li className="flex items-center gap-2.5 rounded-xl bg-white/80 p-3 text-sm font-medium text-ink shadow-xs">
              <Users className="h-5 w-5 shrink-0 text-[#1877F2]" />
              <span>Хиляди активни членове</span>
            </li>
            <li className="flex items-center gap-2.5 rounded-xl bg-white/80 p-3 text-sm font-medium text-ink shadow-xs">
              <BadgePercent className="h-5 w-5 shrink-0 text-cyan-600" />
              <span>Ежедневни нови оферти</span>
            </li>
            <li className="flex items-center gap-2.5 rounded-xl bg-white/80 p-3 text-sm font-medium text-ink shadow-xs">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <span>100% доказано качество</span>
            </li>
            <li className="flex items-center gap-2.5 rounded-xl bg-white/80 p-3 text-sm font-medium text-ink shadow-xs">
              <MessageCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <span>Реални мнения и снимки</span>
            </li>
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={site.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[#1877F2] px-6 text-sm font-semibold text-white shadow-md shadow-[#1877F2]/25 transition hover:bg-[#166fe5] hover:shadow-lg hover:shadow-[#1877F2]/30"
            >
              <FacebookIcon className="h-4 w-4" />
              <span>Към Facebook групата</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <span className="text-xs text-ink-soft">
              Присъединете се с един клик
            </span>
          </div>
        </div>

        {/* Facebook Group Preview Card */}
        <div className="relative mx-auto w-full max-w-md">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-paper shadow-lift">
            {/* Banner / Cover with Original Photo */}
            <div className="relative h-52 w-full bg-slate-900">
              <Image
                src="/facebook-original.jpg"
                alt="Оригинална снимка на Facebook групата Поръчки за малки и големи"
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 400px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-[0.72rem] font-semibold text-white shadow-sm backdrop-blur">
                Оригинална Facebook група
              </div>
            </div>

            {/* Profile Bar */}
            <div className="p-5">
              <div className="flex items-start gap-3.5">
                <div className="relative -mt-10 grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-white bg-white shadow-md">
                  <Image
                    src="/logo-badge.png"
                    alt="Лого Поръчки за малки и големи"
                    width={56}
                    height={56}
                    className="rounded-xl object-contain p-1"
                  />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold leading-tight text-ink">
                    Поръчки за малки и големи
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Публична група · Хиляди членове
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-sand/60 p-3 text-xs leading-relaxed text-ink-soft">
                „Добре дошли в официалната група на <strong className="text-ink">Поръчки за малки и големи</strong>! Тук ще откриете качествени стоки, дрехи, козметика, храни и домашни потреби за цялото семейство.“
              </div>

              <div className="mt-4 flex gap-2">
                <a
                  href={site.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1877F2] py-2.5 text-xs font-semibold text-white transition hover:bg-[#166fe5]"
                >
                  <FacebookIcon className="h-3.5 w-3.5" />
                  Присъедини се в групата
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
