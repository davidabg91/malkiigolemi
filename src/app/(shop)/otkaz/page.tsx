import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { WithdrawalForm } from "@/components/account/WithdrawalForm";
import { InfoPage } from "@/components/InfoPage";
import { getSession } from "@/lib/auth";
import { COMPANY, site, STORE, WITHDRAWAL_DAYS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Откажете се от договора тук",
  description: `Отказ от покупка в ${WITHDRAWAL_DAYS}-дневен срок без да посочваш причина.`,
};

type Props = PageProps<"/otkaz">;

async function PrefilledForm({ searchParams }: Pick<Props, "searchParams">) {
  const [{ poruchka }, session] = await Promise.all([searchParams, getSession()]);
  return (
    <WithdrawalForm
      initial={{
        name: session?.name ?? "",
        email: session?.email ?? "",
        orderNumber: typeof poruchka === "string" ? poruchka.slice(0, 40) : "",
        details: "",
      }}
    />
  );
}

export default function Page({ searchParams }: Props) {
  return (
    <InfoPage
      title="Откажете се от договора тук"
      lead={`Можеш да се откажеш от покупката в срок от ${WITHDRAWAL_DAYS} дни от получаването на стоките, без да посочваш причина и без неустойка.`}
    >
      <Suspense fallback={<div className="h-80 animate-pulse rounded-card bg-paper shadow-soft" />}>
        <PrefilledForm searchParams={searchParams} />
      </Suspense>

      <h2>Срок за отказ</h2>
      <p>
        Срокът е {WITHDRAWAL_DAYS} дни и тече от деня, в който ти или посочено от теб лице (различно от куриера) получите стоките. Ако поръчката
        пристигне на части — от получаването на последната. Отказът е навреме, ако го изпратиш преди срокът да изтече.
      </p>

      <h2>Как да се откажеш</h2>
      <ul>
        <li>с формата по-горе — ще получиш потвърждение с датата и часа на получаване;</li>
        <li>
          по имейл на <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-2">{site.email}</a> или писмо до{" "}
          {COMPANY.name}, {COMPANY.address}, например със стандартния формуляр по-долу.
        </li>
      </ul>

      <h2>Връщане на стоките</h2>
      <p>
        Върни стоките без неоправдано забавяне и не по-късно от {WITHDRAWAL_DAYS} дни след като ни уведомиш за отказа — в магазина ни ({STORE.address}) или
        с куриер до същия адрес. Преките разходи по връщането са за твоя сметка, освен ако стоката е дефектна или не е тази, която си поръчал.
      </p>
      <p>
        Отговаряш само за намалената стойност на стоката, ако тя се дължи на използване извън необходимото, за да установиш естеството, качествата и
        функционирането ѝ.
      </p>

      <h2>Възстановяване на сумата</h2>
      <p>
        Възстановяваме всички получени суми, включително стандартната цена на доставката до теб, до {WITHDRAWAL_DAYS} дни от получаването на отказа, по
        същия начин, по който си платил, освен ако не се договорим за друг. Можем да задържим плащането, докато получим стоките или доказателство, че
        са изпратени.
      </p>

      <h2>Кога правото на отказ не се прилага</h2>
      <p>Съгласно чл. 57 от Закона за защита на потребителите правото на отказ не се прилага за:</p>
      <ul>
        <li>стоки, които бързо се развалят или имат кратък срок на годност (например някои храни);</li>
        <li>запечатани стоки, разпечатани след доставката, които не са подходящи за връщане по хигиенни или здравни причини (например козметика, бебешки продукти за хранене и грижа);</li>
        <li>стоки, които след доставката по естеството си са се смесили неразделно с други;</li>
        <li>стоки, изработени по поръчка на клиента или съобразно неговите изисквания.</li>
      </ul>
      <p>
        Правото на отказ не засяга правата ти при дефектна или несъответстваща стока — виж{" "}
        <Link href="/usloviya#garanciya" className="font-medium text-ink underline underline-offset-2">
          законова гаранция и рекламации
        </Link>
        .
      </p>

      <h2>Стандартен формуляр за отказ</h2>
      <div className="rounded-2xl border border-line bg-paper p-5 text-[0.95rem]">
        <p>
          До {COMPANY.name}, {COMPANY.address}, имейл: {site.email}
        </p>
        <p className="mt-3">
          С настоящото уведомявам/уведомяваме*, че се отказвам/отказваме* от сключения от мен/нас* договор за покупка на следните стоки*: …
        </p>
        <p className="mt-3">Поръчано на*/получено на*: …</p>
        <p>Номер на поръчката: …</p>
        <p>Име на потребителя/ите: …</p>
        <p>Адрес на потребителя/ите: …</p>
        <p>Подпис на потребителя/ите (само ако формулярът е на хартия): …</p>
        <p>Дата: …</p>
        <p className="mt-3 text-sm">* Ненужното се зачертава.</p>
      </div>
    </InfoPage>
  );
}
