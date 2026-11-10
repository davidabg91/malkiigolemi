import { Clock, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Breadcrumbs, btn, FacebookIcon, ShopMark } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, FREE_SHIPPING_FROM, site } from "@/lib/site";

export function InfoPage({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="container-shop max-w-3xl pt-6 sm:pt-8">
      <Breadcrumbs items={[{ label: title }]} />
      <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[2.6rem]">{title}</h1>
      {lead && <p className="mt-4 text-lg text-ink-soft">{lead}</p>}
      <div className="mt-8 space-y-5 leading-relaxed text-ink-soft [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:space-y-2">
        {children}
      </div>
    </div>
  );
}

/** Marks legal copy that the shop owner still has to supply. */
export function Placeholder() {
  return (
    <p className="rounded-2xl border border-dashed border-ink/25 bg-sand px-4 py-3 text-sm">
      Примерен текст. Преди пускане на сайта го заменете с документ, изготвен за вашата фирма (данни на търговеца, ЕИК, адрес, право на отказ).
    </p>
  );
}

export function DeliveryTable() {
  return (
    <div className="overflow-hidden rounded-card bg-paper shadow-soft">
      <table className="w-full text-left text-[0.95rem]">
        <thead className="bg-sand text-sm text-ink">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">
              Начин
            </th>
            <th scope="col" className="px-5 py-3 font-semibold">
              Срок
            </th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">
              Цена
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {DELIVERY_METHODS.map((d) => (
            <tr key={d.id}>
              <th scope="row" className="px-5 py-3.5 font-medium text-ink">
                {d.label}
              </th>
              <td className="px-5 py-3.5">{d.hint}</td>
              <td className="px-5 py-3.5 text-right font-semibold text-ink tabular-nums">{formatPrice(d.price)}</td>
            </tr>
          ))}
          <tr className="bg-lime/30">
            <th scope="row" colSpan={2} className="px-5 py-3.5 font-medium text-ink">
              Поръчки над {formatPrice(FREE_SHIPPING_FROM)}
            </th>
            <td className="px-5 py-3.5 text-right font-semibold text-ink">Безплатно</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ContactCards() {
  const items: { icon: ComponentType<{ className?: string }>; label: string; value: string; href?: string; external?: boolean }[] = [
    { icon: FacebookIcon, label: "Facebook група", value: "Поръчки за малки и големи", href: site.facebookUrl, external: true },
    { icon: Phone, label: "Телефон", value: site.phone, href: site.phoneHref },
    { icon: Mail, label: "Имейл", value: site.email, href: `mailto:${site.email}` },
    { icon: MapPin, label: "Доставка", value: site.address },
    { icon: Clock, label: "Работно време", value: site.workHours },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map(({ icon: Icon, label, value, href, external }) => (
        <li key={label} className="!ml-0 !list-none rounded-card bg-paper p-5 shadow-soft">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sand text-cyan-700">
            <Icon className="h-5 w-5" />
          </span>
          <p className="mt-4 text-sm">{label}</p>
          {href ? (
            <a
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="font-semibold text-ink hover:text-cyan-700 hover:underline"
            >
              {value} {external && "➔"}
            </a>
          ) : (
            <p className="font-semibold text-ink">{value}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function NotFoundView() {
  return (
    <div className="container-shop flex flex-col items-center py-24 text-center">
      <p className="flex items-center font-display text-[5.5rem] font-bold leading-none text-forest-deep sm:text-[8rem]">
        4<ShopMark className="mx-2 h-[0.78em] w-[0.78em] text-cyan-500" />4
      </p>
      <h1 className="mt-6 font-display text-2xl font-semibold">Тази страница я няма на рафта</h1>
      <p className="mt-2 max-w-md text-ink-soft">Може да е преместена или продуктът вече да не се предлага.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className={btn.primary}>
          Към началото
        </Link>
        <Link href="/produkti" className={btn.ghost}>
          Всички продукти
        </Link>
      </div>
    </div>
  );
}
