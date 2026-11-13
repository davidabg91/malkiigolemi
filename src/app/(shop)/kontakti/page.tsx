import type { Metadata } from "next";
import { CompanyDetails, ContactCards, InfoPage } from "@/components/InfoPage";
import { StoreLocation } from "@/components/StoreLocation";

export const metadata: Metadata = { title: "Контакти" };

export default function Page() {
  return (
    <InfoPage title="Контакти" lead="Пиши ни или се обади — отговаряме в рамките на работния ден.">
      <ContactCards />
      <h2>Магазин в Плевен</h2>
      <p>Можеш да вземеш поръчката си лично от нашия магазин — избери „От магазина“ при поръчка и доставката е безплатна.</p>
      <StoreLocation />
      <h2>Данни за търговеца</h2>
      <CompanyDetails />
      <h2>Обемни поръчки</h2>
      <p>За заведения, офиси и търговци на едро подготвяме индивидуална оферта. Обади се или ни изпрати списък с продуктите на имейл.</p>
    </InfoPage>
  );
}
