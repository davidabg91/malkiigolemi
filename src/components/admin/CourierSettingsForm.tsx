"use client";

import { useState, useTransition } from "react";
import { Check, Info, Loader2, Save } from "lucide-react";
import { CourierLogo } from "@/components/couriers/CourierLogos";
import { updateCourierSettings } from "@/actions/admin";
import { btn } from "@/components/ui";
import { COURIERS, type CourierId } from "@/lib/couriers";

const COURIER_HIGHLIGHTS: Record<CourierId, string> = {
  econt: "Най-популярният куриер с пълно национално покритие",
  speedy: "Най-голяма мрежа от 24/7 автомати (АПС) и офиси",
  boxnow: "Евтина и денонощна доставка до соларни автомати",
  pigeon: "Доставка 7 дни в седмицата без почивен ден",
};

export function CourierSettingsForm({
  initialConfig,
  locationCounts,
}: {
  initialConfig: Record<CourierId, boolean>;
  /** How many offices and lockers of each courier are in the list customers choose from. */
  locationCounts: Record<CourierId, number>;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const toggle = (id: CourierId) => {
    setConfig((prev) => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  };

  const courierKeys: CourierId[] = ["econt", "speedy", "boxnow", "pigeon"];

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await updateCourierSettings(formData);
          setSaved(true);
          setTimeout(() => setSaved(false), 4000);
        });
      }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-sand/40 p-4 border border-line">
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-forest shrink-0" />
          <p className="text-sm text-ink-soft">
            Изберете кои куриерски фирми да се показват на клиентите в чекаута при завършване на поръчка.
          </p>
        </div>
        <button type="submit" disabled={pending} className={`${btn.primary} min-w-36`}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Запазване...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Запази промените
            </>
          )}
        </button>
      </div>

      {saved && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm font-medium animate-fadeIn">
          <Check className="h-5 w-5 text-emerald-600" />
          Настройките са запазени успешно! Промените вече са активни в магазина.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {courierKeys.map((id) => {
          const c = COURIERS[id];
          const active = config[id] !== false;

          return (
            <div
              key={id}
              className={`relative rounded-2xl border-2 p-5 transition flex flex-col justify-between ${
                active
                  ? "border-forest/40 bg-paper shadow-sm"
                  : "border-line bg-sand/20 opacity-70"
              }`}
            >
              <div>
                {/* Header with Logo and Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-9 items-center">
                    <CourierLogo courier={id} className="h-8 max-h-8 max-w-[150px] w-auto" />
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name={id}
                      checked={active}
                      onChange={() => toggle(id)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-forest"></div>
                  </label>
                </div>

                {/* Courier Title and description */}
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-ink">{c.name}</h3>
                    <span
                      className={`text-[0.7rem] font-bold px-2 py-0.5 rounded-full ${
                        active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {active ? "Активен в сайта" : "Скрит"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{c.tagline}</p>
                </div>

                {/* Feature tags */}
                <div className="mt-3.5 flex flex-wrap gap-1.5 text-xs">
                  {c.hasOffices && (
                    <span className="rounded-lg bg-sand px-2 py-1 font-medium text-ink">
                      🏢 Физически офиси
                    </span>
                  )}
                  {c.hasBoxes && (
                    <span className="rounded-lg bg-sand px-2 py-1 font-medium text-ink">
                      📦 Автомати (Локъри)
                    </span>
                  )}
                  {c.hasAddress && (
                    <span className="rounded-lg bg-sand px-2 py-1 font-medium text-ink">
                      🚚 Доставка до адрес
                    </span>
                  )}
                </div>
              </div>

              {/* Footer info */}
              <div className="mt-5 pt-3.5 border-t border-line/60 flex items-center justify-between text-xs text-ink-soft">
                <span>{COURIER_HIGHLIGHTS[id]}</span>
                <span className="shrink-0 font-semibold text-ink">{locationCounts[id]} локации</span>
              </div>
            </div>
          );
        })}
      </div>
    </form>
  );
}
