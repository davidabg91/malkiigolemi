import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { FacebookIcon } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "За нас" };

export default function Page() {
  return (
    <InfoPage
      title="За нас"
      lead="„Поръчки за малки и големи“ започна като любима Facebook група, а днес вече е вашият модерен онлайн магазин за качествени стоки за цялото семейство."
    >
      <p>
        Всичко започна в нашата Facebook общност с проста цел: да осигурим достъп до качествени продукти, вносни стоки, дрехи, козметика, храни и домашни потреби на честни цени. Благодарение на невероятната подкрепа и доверие от хиляди доволни членове, общността ни се разрасна до едно голямо семейство.
      </p>

      <div className="my-6 rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1877F2] text-white">
              <FacebookIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-ink">Нашата Facebook група</p>
              <p className="text-xs text-ink-soft">Над 30 000+ реални членове и ежедневни поръчки</p>
            </div>
          </div>
          <a
            href={site.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#166fe5]"
          >
            <span>Посетете групата</span>
          </a>
        </div>
      </div>

      <p>
        Създадохме този онлайн магазин, за да направим вашето пазаруване още по-лесно, бързо и сигурно. Вече не е необходимо да чакате одобрение на коментари — можете да поръчате любимите си артикули денонощно с няколко клика.
      </p>

      <h2>Какво ни отличава</h2>
      <ul>
        <li>
          <strong>Проверено качество</strong> — подбираме само артикули, които сме изпробвали и препоръчваме с чисто сърце.
        </li>
        <li>
          <strong>Бърза доставка</strong> — изпращаме в деня на поръчката, а пратката пристига до 24–48 часа до офис или адрес.
        </li>
        <li>
          <strong>Преглед и тест преди плащане</strong> — спокойствие и сигурност при всяка поръчка.
        </li>
        <li>
          <strong>Лично отношение</strong> — познавате ни от Facebook групата и знаете, че сме винаги насреща за съдействие.
        </li>
      </ul>
    </InfoPage>
  );
}
