import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { InstallButton } from "@/components/InstallApp";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Приложение за телефона",
  description: "Добави магазина на началния екран на телефона си и го отваряй като приложение, без App Store и Google Play.",
};

export default function Page() {
  return (
    <InfoPage
      title="Приложение за телефона"
      lead="Добави магазина на началния екран и го отваряй с едно докосване, на цял екран. Не се тегли от App Store или Google Play и не заема място."
    >
      <InstallButton />

      <h2>iPhone и iPad</h2>
      <ol className="space-y-2 [&>li]:!list-decimal">
        <li>
          Отвори <strong>{site.domain}</strong> в <strong>Safari</strong>.
        </li>
        <li>
          Натисни бутона <strong>„Сподели“</strong> (квадратче със стрелка нагоре) в лентата на браузъра.
        </li>
        <li>
          Избери <strong>„Добави към начален екран“</strong> и после <strong>„Добави“</strong>.
        </li>
      </ol>

      <h2>Android</h2>
      <ol className="space-y-2 [&>li]:!list-decimal">
        <li>
          Отвори <strong>{site.domain}</strong> в <strong>Chrome</strong>.
        </li>
        <li>
          Натисни <strong>„Инсталирай приложението“</strong> по-горе на тази страница, или менюто с трите точки и{" "}
          <strong>„Добавяне към началния екран“</strong>.
        </li>
        <li>
          Потвърди с <strong>„Инсталиране“</strong>.
        </li>
      </ol>

      <h2>Ако си отворил сайта от Facebook</h2>
      <p>
        Facebook и приложението Google отварят сайта в свой браузър, от който не може да се добавя на началния екран. Натисни менюто с трите точки и
        избери <strong>„Отвори в Safari“</strong> или <strong>„Отвори в Chrome“</strong>, после следвай стъпките по-горе.
      </p>

      <h2>Какво получаваш</h2>
      <ul>
        <li>икона на магазина на началния екран;</li>
        <li>отваря се на цял екран, без адресната лента;</li>
        <li>оставаш влязъл в профила си и количката ти се пази;</li>
        <li>винаги виждаш актуалните цени и наличности, без да обновяваш нищо.</li>
      </ul>
    </InfoPage>
  );
}
