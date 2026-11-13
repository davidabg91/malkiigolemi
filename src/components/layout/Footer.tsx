import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { FacebookIcon, Logo } from "@/components/ui";
import { getCategoryTree } from "@/lib/queries";
import { COMPANY, site } from "@/lib/site";

export const INFO_PAGES = [
  { href: "/facebook", label: "Facebook общност" },
  { href: "/za-nas", label: "За нас" },
  { href: "/kontakti", label: "Контакти" },
  { href: "/dostavka", label: "Доставка и плащане" },
  { href: "/usloviya", label: "Общи условия" },
  { href: "/poveritelnost", label: "Поверителност" },
  { href: "/otkaz", label: "Откажете се от договора тук" },
];

export async function Footer() {
  const tree = await getCategoryTree();
  const link = "text-cream/70 transition hover:text-cyan-300";
  return (
    <footer className="mt-20 rounded-t-[2.5rem] bg-forest-deep text-cream">
      <div className="container-shop grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream/70">
            Официален онлайн магазин на Facebook общността „Поръчки за малки и големи“. Любими продукти за цялото семейство с бърза и сигурна доставка.
          </p>
          <a
            href={site.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            <FacebookIcon className="h-4 w-4 text-cyan-300" />
            <span>Facebook група (30 000+ членове)</span>
          </a>
        </div>
        <nav aria-label="Категории във футъра">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Категории</h2>
          <ul className="space-y-2.5">
            {tree.map((c) => (
              <li key={c.id}>
                <Link href={`/kategoria/${c.slug}`} className={link}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Информация">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Информация</h2>
          <ul className="space-y-2.5">
            {INFO_PAGES.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className={link}>
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Връзка с нас</h2>
          <ul className="space-y-3 text-cream/80">
            <li className="flex gap-3">
              <FacebookIcon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
              <a
                href={site.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-cyan-300 hover:text-white"
              >
                Facebook група
              </a>
            </li>
            <li className="flex gap-3">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
              <a href={site.phoneHref} className="font-semibold text-cream hover:text-cyan-300">
                {site.phone}
              </a>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
              <a href={`mailto:${site.email}`} className="hover:text-cyan-300">
                {site.email}
              </a>
            </li>
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
              {site.address}
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
              {site.workHours}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10">
        <div className="container-shop flex flex-col gap-1.5 py-5 text-sm text-cream/50 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p>© 2026 {site.name}. Всички права запазени.</p>
            <p className="mt-1 text-xs">
              {COMPANY.name} · ЕИК {COMPANY.eik}
              {COMPANY.vatNumber && <> · ДДС № {COMPANY.vatNumber}</>} · {COMPANY.address}
            </p>
          </div>
          <p>
            Изработка и поддръжка:{" "}
            <a
              href="https://davidax.org"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 font-semibold text-cream/80 transition hover:text-cyan-300"
            >
              DavidaX
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
