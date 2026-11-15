"use client";

import { Check, ImagePlus, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { replaceChosenFile, shrinkImage, UPLOAD_LIMIT } from "@/lib/shrink-image";
import { optimizedImage } from "@/lib/optimized-image";
import { isTileImage, TILE_AUTO, TILE_PRESET_LABELS, TILE_PRESETS } from "@/lib/tile-art";

const option = "relative flex h-24 w-full flex-col items-center justify-end gap-1 overflow-hidden rounded-2xl p-1.5 text-center text-[0.7rem] font-medium leading-tight transition active:scale-95";

/**
 * Chooses the picture on a category's home-page tile: the category's own products ("auto"), one of the
 * ready-made illustrations, or an uploaded picture. Posts `tile` ("auto", a preset key or "image") and,
 * for an upload, the file as `tileImage`.
 */
export function TilePicker({ value }: { value: string | null }) {
  const uid = useId();
  const uploaded = isTileImage(value) ? value : null;
  const [choice, setChoice] = useState(uploaded ? "image" : value && value in TILE_PRESETS ? value : TILE_AUTO);
  // A picture picked from the device, shown before it is saved.
  const [preview, setPreview] = useState<string | null>(null);

  const cls = (key: string) => `${option} ${choice === key ? "bg-forest text-white" : "text-ink raised hover:brightness-[0.96]"}`;
  const tick = (key: string) => choice === key && <Check className="absolute right-1.5 top-1.5 z-10 h-3.5 w-3.5" strokeWidth={3} aria-hidden />;

  return (
    // A fieldset is by default as wide as its content, which once made this wider than a phone's screen.
    <fieldset className="min-w-0">
      <legend className="mb-1.5 block text-sm font-medium">
        Картинка на плочката <span className="font-normal text-ink-soft">(на началната страница)</span>
      </legend>
      <input type="hidden" name="tile" value={choice} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
        <button type="button" onClick={() => setChoice(TILE_AUTO)} aria-pressed={choice === TILE_AUTO} className={cls(TILE_AUTO)} title="Снимки на най-новите продукти в категорията">
          {tick(TILE_AUTO)}
          <Sparkles className="mb-1 h-7 w-7" strokeWidth={1.5} aria-hidden />
          От продуктите
        </button>

        {Object.entries(TILE_PRESETS).map(([key, items]) => (
          <button key={key} type="button" onClick={() => setChoice(key)} aria-pressed={choice === key} className={cls(key)}>
            {tick(key)}
            {/* eslint-disable-next-line @next/next/no-img-element -- a small preview of the illustration */}
            <img {...optimizedImage(items[items.length - 1].src, 128)} alt="" loading="lazy" className="h-12 w-auto object-contain drop-shadow-sm" />
            <span className="line-clamp-2">{TILE_PRESET_LABELS[key] ?? key}</span>
          </button>
        ))}

        <label htmlFor={`${uid}-file`} className={`${cls("image")} cursor-pointer`}>
          {tick("image")}
          {preview || uploaded ? (
            // eslint-disable-next-line @next/next/no-img-element -- a preview of the admin's own picture
            <img src={preview ?? optimizedImage(uploaded!, 128).src} alt="" className="h-12 w-auto max-w-full object-contain" />
          ) : (
            <ImagePlus className="mb-1 h-7 w-7" strokeWidth={1.5} aria-hidden />
          )}
          <span>{preview || uploaded ? "Смени снимката" : "Собствена снимка"}</span>
        </label>
        <input
          id={`${uid}-file`}
          name="tileImage"
          type="file"
          accept="image/png,image/webp,image/avif,image/jpeg"
          className="sr-only"
          onChange={async (e) => {
            const field = e.currentTarget;
            const chosen = field.files?.[0];
            if (!chosen) return;
            // A large picture is made smaller here, before it is sent: the request has room for about 4 MB.
            const result = await shrinkImage(chosen);
            if (field.files?.[0] !== chosen) return;
            if (!result.ok || (result.shrunk && !replaceChosenFile(field, result.file) && chosen.size > UPLOAD_LIMIT)) {
              field.value = "";
              toast.error(result.ok ? `Снимката е твърде голяма за този браузър. Опитай с по-малка (до 3,5 MB).` : result.error);
              return;
            }
            const file = field.files?.[0] ?? chosen;
            setPreview((old) => {
              if (old) URL.revokeObjectURL(old);
              return URL.createObjectURL(file);
            });
            setChoice("image");
          }}
        />
      </div>
      {choice === "image" && <p className="mt-2 text-sm text-ink-soft">Най-добре изглежда снимка с прозрачен фон (PNG): плочката е светла и бял фон ще се вижда като правоъгълник.</p>}
    </fieldset>
  );
}
