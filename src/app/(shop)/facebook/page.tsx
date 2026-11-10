import { ArrowUpRight, CheckCircle2, MessageCircle, Tag, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { Breadcrumbs, FacebookIcon } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Facebook страница и група — Поръчки за малки и големи",
  description:
    "Официалната Facebook група на „Поръчки за малки и големи“. Присъединете се към хилядите доволни клиенти за ежедневни промоции, съвместни поръчки и реални отзиви.",
};

export default function FacebookPage() {
  return (
    <div className="container-shop max-w-4xl pt-6 sm:pt-8">
      <Breadcrumbs items={[{ label: "Facebook общност" }]} />

      <div className="mt-6 overflow-hidden rounded-tile border border-sky-100 bg-paper shadow-lift">
        {/* Cover Header with Original Photo */}
        <div className="relative h-60 w-full sm:h-80 bg-slate-900">
          <Image
            src="/facebook-original.jpg"
            alt="Оригинална снимка на Facebook групата Поръчки за малки и големи"
            fill
            priority
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

          <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-3 text-white sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="flex items-center gap-4">
              <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-white bg-white shadow-md sm:h-20 sm:w-20">
                <Image
                  src="/logo-badge.svg"
                  alt="Лого на групата"
                  width={72}
                  height={72}
                  className="rounded-xl"
                />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2] px-2.5 py-0.5 text-xs font-semibold">
                  <FacebookIcon className="h-3 w-3" />
                  Официална общност
                </span>
                <h1 className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                  {site.facebookGroupName}
                </h1>
                <p className="text-xs text-white/80 sm:text-sm">
                  Оригиналната Facebook група · Хиляди доволни семейства
                </p>
              </div>
            </div>

            <a
              href={site.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1877F2] px-5 text-sm font-semibold text-white shadow-md transition hover:bg-[#166fe5]"
            >
              <FacebookIcon className="h-4 w-4" />
              <span>Отвори във Facebook</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-10">
          <h2 className="font-display text-2xl font-bold text-ink">
            Добре дошли в официалната общност на „Поръчки за малки и големи“
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            Това е пространството, където започна цялото ни пътешествие. Досега работихме единствено чрез Facebook страницата и групата, където изградихме сплотена общност от хиляди доволни семейства в цяла България.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-sand/40 p-5">
              <div className="flex items-center gap-3 text-[#1877F2]">
                <Users className="h-6 w-6" />
                <h3 className="font-semibold text-ink">Реална общност и отзиви</h3>
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                В групата споделяме реални снимки на продуктите при получаване, разопаковане, отзиви от клиенти и мнения за размери и качество.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-sand/40 p-5">
              <div className="flex items-center gap-3 text-cyan-600">
                <Tag className="h-6 w-6" />
                <h3 className="font-semibold text-ink">Ежедневни ексклузивни оферти</h3>
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                Публикуваме промоции за ограничени бройки, лимитирани серии и сезонни намаления, преди да достигнат до сайта.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-sand/40 p-5">
              <div className="flex items-center gap-3 text-emerald-600">
                <MessageCircle className="h-6 w-6" />
                <h3 className="font-semibold text-ink">Директна комуникация</h3>
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                Отговаряме бързо на всяко запитване. Можете да зададете въпрос под публикация или на лично съобщение в Messenger.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-sand/40 p-5">
              <div className="flex items-center gap-3 text-amber-600">
                <CheckCircle2 className="h-6 w-6" />
                <h3 className="font-semibold text-ink">Сигурност и удобство</h3>
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                Всички поръчки се изпращат с опция за преглед и тест преди плащане, а сега чрез новия ни сайт поръчвате още по-бързо!
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl bg-gradient-to-r from-sky-50 to-cyan-50 p-6 text-center sm:p-8">
            <h3 className="font-display text-xl font-bold text-ink">
              Готови ли сте да се присъедините?
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-ink-soft">
              Натиснете бутона по-долу, за да посетите официалната група във Facebook и да станете част от нашата общност:
            </p>
            <div className="mt-5 flex justify-center">
              <a
                href={site.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[#1877F2] px-8 text-base font-semibold text-white shadow-md transition hover:bg-[#166fe5]"
              >
                <FacebookIcon className="h-5 w-5" />
                <span>Към Facebook групата: {site.facebookGroupName}</span>
                <ArrowUpRight className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
