import type { Metadata } from "next";
import { InfoPage, ContactCards } from "@/components/InfoPage";

export const metadata: Metadata = { title: "Контакти" };

export default function Page() {
  return (
    <InfoPage title="Контакти" lead="Пиши ни или се обади — отговаряме в рамките на работния ден.">
      <ContactCards />
      <h2>Обемни поръчки</h2>
      <p>За заведения, офиси и търговци на едро подготвяме индивидуална оферта. Обади се или ни изпрати списък с продуктите на имейл.</p>
    </InfoPage>
  );
}
