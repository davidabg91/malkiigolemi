"use client";

import { CheckCircle2, Download, Puzzle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { btn } from "@/components/ui";

/** Where the packed extension is served from (made by scripts/pack-extension.mjs at build time). */
const DOWNLOAD = "/razshirenie/malkiigolemi-facebook.zip";
const KEY_ID = "fb-extension-key";

// The extension (extension/site.js) reads the key from the element below, then marks it and fires this event.
const subscribe = (onChange: () => void) => {
  window.addEventListener("fb-extension-connected", onChange);
  return () => window.removeEventListener("fb-extension-connected", onChange);
};
const installedVersion = () => document.getElementById(KEY_ID)?.dataset.connected ?? "";

/**
 * The browser extension that reads the group's comments: whether this browser has it, the download,
 * and how to install and use it. Rendering this card is also what connects the extension to the site.
 */
export function FbExtensionCard({ token, latest }: { token: string; latest: string }) {
  const installed = useSyncExternalStore(subscribe, installedVersion, () => "");
  const outdated = installed !== "" && installed !== latest;

  return (
    <section className="rounded-card bg-paper p-5 shadow-soft sm:p-6">
      <span id={KEY_ID} data-key={token} hidden suppressHydrationWarning />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Puzzle className="h-5 w-5 text-forest" aria-hidden />
            Събиране с едно натискане
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Разширение за Chrome, което чете коментарите под постовете в групата и ги праща тук като заявки, без копиране. Работи на компютър, в Chrome, в който си влязъл във Facebook.
          </p>
          <p className="mt-3 text-sm font-semibold" role="status">
            {installed ? (
              <span className="inline-flex items-center gap-1.5 text-forest">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Свързано с този браузър · версия {installed}
              </span>
            ) : (
              <span className="text-ink-soft">Още не е инсталирано в този браузър.</span>
            )}
          </p>
          {outdated && (
            <p className="mt-1 text-sm font-medium text-tomato">
              Има по-нова версия ({latest}). Изтегли я, замени папката със старата и натисни стрелката за презареждане върху разширението в chrome://extensions.
            </p>
          )}
        </div>
        <a href={DOWNLOAD} download className={installed && !outdated ? btn.ghost : btn.primary}>
          <Download className="h-5 w-5" aria-hidden />
          Изтегли разширението
        </a>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <details className="rounded-2xl border border-line px-4 py-3" open={!installed}>
          <summary className="cursor-pointer text-sm font-semibold">Как се инсталира (прави се веднъж)</summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
            <li>Изтегли файла и го разархивирай: десен бутон върху него → „Извличане на всички“.</li>
            <li>
              В Chrome напиши в адресната лента <code className="rounded bg-sand px-1.5 py-0.5 text-ink">chrome://extensions</code> и включи „Режим за програмисти“ (Developer mode) горе вдясно.
            </li>
            <li>Натисни „Зареждане на разопаковано“ (Load unpacked) и избери папката „malkiigolemi-facebook“.</li>
            <li>Върни се на тази страница и я презареди. Тук трябва да пише „Свързано с този браузър“.</li>
          </ol>
        </details>
        <details className="rounded-2xl border border-line px-4 py-3" open={Boolean(installed)}>
          <summary className="cursor-pointer text-sm font-semibold">Как се ползва</summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            <li>В групата долу вляво има кръгъл бутон. Отвори пост, натисни го и избери „Вземи поръчките от този пост“.</li>
            <li>„Събери от всички постове“ отваря нов раздел и минава само през постовете с коментари. Остави раздела отворен и на преден план, докато приключи.</li>
            <li>
              За да събира само: натисни иконата на разширението горе вдясно в Chrome и включи „Събирай автоматично“. През различен брой минути то отваря малък прозорец с групата, минава през постовете и го затваря. Chrome
              трябва да е отворен, а прозорецът да не е закрит изцяло.
            </li>
            <li>Заявките излизат в списъка с постове на тази страница. Коментар, който вече е прочетен, не се добавя втори път.</li>
            <li>Ако в поста има линк към продукта в сайта, продуктът се разпознава сам. Иначе се избира от страницата на поста.</li>
          </ul>
        </details>
      </div>
    </section>
  );
}
