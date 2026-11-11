"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Package, Search, Store, X } from "lucide-react";
import { CourierLogo } from "@/components/couriers/CourierLogos";
import {
  COURIERS,
  getCouriersForDelivery,
  type CourierId,
  type CourierOffice,
  type DeliveryType,
} from "@/lib/couriers";

const QUICK_CITIES = ["Плевен", "София", "Пловдив", "Варна", "Бургас", "Русе", "Стара Загора", "Велико Търново"];

interface Props {
  delivery: DeliveryType;
  courier: CourierId;
  onCourierChange: (c: CourierId) => void;
  city: string;
  onCityChange: (c: string) => void;
  selectedOffice: CourierOffice | null;
  onOfficeChange: (o: CourierOffice | null) => void;
  address: string;
  onAddressChange: (a: string) => void;
  errors: Record<string, string>;
  /** Prefix for element ids, so several pickers can sit on one page (the admin's Facebook orders). */
  idPrefix?: string;
}

export function CourierOfficePicker({
  delivery,
  courier,
  onCourierChange,
  city,
  onCityChange,
  selectedOffice,
  onOfficeChange,
  address,
  onAddressChange,
  errors,
  idPrefix: prefix = "",
}: Props) {
  // useId on top: a page left behind stays mounted (hidden), so even one picker per page can repeat.
  const idPrefix = `${useId()}-${prefix}`;
  const [cities, setCities] = useState<string[]>([]);
  const [offices, setOffices] = useState<CourierOffice[]>([]);
  const [activeCouriersConfig, setActiveCouriersConfig] = useState<Record<CourierId, boolean> | null>(null);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [officeSearch, setOfficeSearch] = useState("");
  const [citySearchOpen, setCitySearchOpen] = useState(false);
  const [officeDropdownOpen, setOfficeDropdownOpen] = useState(false);

  const cityInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableCouriers = useMemo(
    () => getCouriersForDelivery(delivery, activeCouriersConfig),
    [delivery, activeCouriersConfig],
  );
  const activeCourier = availableCouriers.some((c) => c.id === courier) ? courier : availableCouriers[0]?.id ?? courier;

  // Load cities and courier active settings once on mount
  useEffect(() => {
    fetch("/api/couriers?action=cities")
      .then((r) => r.json())
      .then((d) => setCities(d.cities || []))
      .catch(() => {});

    fetch("/api/couriers?action=config")
      .then((r) => r.json())
      .then((d) => {
        if (d.activeCouriers) setActiveCouriersConfig(d.activeCouriers);
      })
      .catch(() => {});
  }, []);

  // Fetch offices when city or courier or delivery type changes
  useEffect(() => {
    if (delivery !== "office" && delivery !== "box") return;
    if (!city || city.trim().length < 2) return;

    let ignore = false;
    const params = new URLSearchParams({
      action: "offices",
      city: city.trim(),
      courier: activeCourier,
      type: delivery,
    });

    fetch(`/api/couriers?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!ignore) {
          setOffices(d.offices || []);
          setLoadingOffices(false);
        }
      })
      .catch(() => {
        if (!ignore) setLoadingOffices(false);
      });

    return () => {
      ignore = true;
    };
  }, [city, activeCourier, delivery]);

  const currentOffices = useMemo(() => {
    const hasValidCity = Boolean(city && city.trim().length >= 2);
    return hasValidCity && (delivery === "office" || delivery === "box") ? offices : [];
  }, [city, delivery, offices]);

  // Filter city suggestions
  const filteredCities = useMemo(() => {
    if (!city || city.length < 1) return [];
    const q = city.trim().toLowerCase();
    return cities.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [cities, city]);

  // Filter offices by local search query
  const filteredOffices = useMemo(() => {
    if (!officeSearch.trim()) return currentOffices;
    const q = officeSearch.toLowerCase();
    return currentOffices.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q),
    );
  }, [currentOffices, officeSearch]);

  const handleSelectCity = (c: string) => {
    onCityChange(c);
    onOfficeChange(null);
    setCitySearchOpen(false);
  };

  const handleSelectOffice = (o: CourierOffice) => {
    onOfficeChange(o);
    onAddressChange(o.address);
    setOfficeDropdownOpen(false);
    setOfficeSearch("");
  };

  return (
    <div className="space-y-5 rounded-2xl bg-sand/35 p-4 sm:p-5 border border-line">
      {/* 1. Избор на куриер */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
          1. Избери куриерска фирма
        </label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {availableCouriers.map((c) => {
            const active = activeCourier === c.id;
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  onCourierChange(c.id);
                  onOfficeChange(null);
                }}
                className={`relative flex flex-col justify-between rounded-xl border-2 p-3 text-left transition ${
                  active
                    ? "border-forest bg-cream shadow-xs"
                    : "border-line bg-paper hover:bg-sand/40 hover:border-ink/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex h-7 items-center">
                    <CourierLogo courier={c.id} className="h-6 max-h-6 max-w-[125px] w-auto" />
                  </div>
                  {active ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-forest text-white">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="h-5 w-5 rounded-full border border-line" />
                  )}
                </div>
                <div className="mt-2.5">
                  <span className="block font-semibold text-sm text-ink">{c.name}</span>
                  <span className="block text-[0.75rem] text-ink-soft leading-snug">{c.tagline}</span>
                </div>
              </button>
            );
          })}
        </div>
        {errors.courier && (
          <p className="mt-1.5 text-sm font-medium text-tomato">{errors.courier}</p>
        )}
      </div>

      {/* 2. Населено място (Град / Село) */}
      <div className="relative">
        <label htmlFor={`${idPrefix}city`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
          2. Населено място (град / село) <span className="text-tomato">*</span>
        </label>
        <div className="relative">
          <input
            id={`${idPrefix}city`}
            name="city"
            ref={cityInputRef}
            type="text"
            required
            autoComplete="address-level2"
            value={city}
            placeholder="Въведи град, напр. Плевен, София..."
            onChange={(e) => {
              onCityChange(e.target.value);
              setCitySearchOpen(true);
            }}
            onFocus={() => setCitySearchOpen(true)}
            className="field pr-10"
          />
          <MapPin className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        </div>

        {/* Quick select pills */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-ink-soft">Бърз избор:</span>
          {QUICK_CITIES.map((qc) => (
            <button
              type="button"
              key={qc}
              onClick={() => handleSelectCity(qc)}
              className={`rounded-full px-2.5 py-1 transition ${
                city.toLowerCase() === qc.toLowerCase()
                  ? "bg-forest font-semibold text-white"
                  : "bg-paper text-ink hover:bg-sand border border-line"
              }`}
            >
              {qc}
            </button>
          ))}
        </div>

        {/* City Autocomplete Dropdown */}
        {citySearchOpen && filteredCities.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-paper py-1.5 shadow-lg">
            {filteredCities.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => handleSelectCity(c)}
                className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-sand/60"
              >
                <span>{c}</span>
                {city.toLowerCase() === c.toLowerCase() && <Check className="h-4 w-4 text-forest" />}
              </button>
            ))}
          </div>
        )}

        {errors.city && <p className="mt-1.5 text-sm font-medium text-tomato">{errors.city}</p>}
      </div>

      {/* 3. Офис / Автомат или Адрес */}
      {delivery === "office" || delivery === "box" ? (
        <div className="relative" ref={dropdownRef}>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
            3. Избери {delivery === "box" ? "автомат (локър)" : "офис на " + COURIERS[activeCourier]?.name}{" "}
            <span className="text-tomato">*</span>
          </label>

          {/* Selected Office Banner or Search trigger */}
          {selectedOffice ? (
            <div className="flex items-center justify-between rounded-xl border-2 border-forest bg-cream p-3.5 transition">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime/40 text-forest">
                  {delivery === "box" ? <Package className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{selectedOffice.name}</span>
                    <span className="rounded bg-sand px-1.5 py-0.5 text-[0.7rem] font-bold text-ink-soft">
                      Код: {selectedOffice.code}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">{selectedOffice.address}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOfficeChange(null)}
                className="rounded-lg p-1.5 text-ink-soft hover:bg-sand hover:text-ink"
                title="Промени офиса"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                disabled={!city || loadingOffices}
                onClick={() => setOfficeDropdownOpen(!officeDropdownOpen)}
                className={`field flex w-full items-center justify-between text-left ${
                  !city ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <span className="text-sm truncate">
                  {loadingOffices
                    ? "Зареждане на наличните локации..."
                    : !city
                    ? "Първо въведи населено място по-горе"
                    : currentOffices.length === 0
                    ? `Няма намерени ${delivery === "box" ? "автомати" : "офиси"} в ${city}`
                    : `Избери ${delivery === "box" ? "автомат" : "офис"} (налични: ${currentOffices.length})`}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" />
              </button>
            </div>
          )}

          {/* Offices Selection Dropdown */}
          {officeDropdownOpen && !selectedOffice && city && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-hidden rounded-xl border border-line bg-paper shadow-xl">
              <div className="sticky top-0 border-b border-line bg-sand/80 p-2 backdrop-blur-xs">
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Търси по улица, квартал или име..."
                    value={officeSearch}
                    onChange={(e) => setOfficeSearch(e.target.value)}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 pl-8 text-sm outline-hidden focus:border-forest"
                  />
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-line/60">
                {filteredOffices.length === 0 ? (
                  <p className="p-4 text-center text-sm text-ink-soft">
                    Няма намерен {delivery === "box" ? "автомат" : "офис"}, отговарящ на търсенето.
                  </p>
                ) : (
                  filteredOffices.map((o) => (
                    <button
                      type="button"
                      key={o.id}
                      onClick={() => handleSelectOffice(o)}
                      className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-sand/60"
                    >
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-sand text-ink">
                        {delivery === "box" ? <Package className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-ink">{o.name}</span>
                          <span className="rounded bg-sand px-1.5 py-0.2 text-[0.68rem] font-bold text-ink-soft">
                            #{o.code}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-soft">{o.address}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {errors.office && <p className="mt-1.5 text-sm font-medium text-tomato">{errors.office}</p>}
        </div>
      ) : (
        /* До адрес */
        <div>
          <label htmlFor={`${idPrefix}address`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
            3. Точен адрес за доставка (улица, №, блок, вход, ет., ап.) <span className="text-tomato">*</span>
          </label>
          <input
            id={`${idPrefix}address`}
            name="address"
            type="text"
            required
            autoComplete="street-address"
            placeholder="ул. Васил Левски № 10, вх. А, ет. 3, ап. 12"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            className="field"
          />
          <p className="mt-1.5 text-xs text-ink-soft">
            Куриерът на <strong className="text-ink">{COURIERS[activeCourier]?.name}</strong> ще се свърже с теб преди доставка.
          </p>
          {errors.address && <p className="mt-1.5 text-sm font-medium text-tomato">{errors.address}</p>}
        </div>
      )}

      {/* Hidden inputs to send courier & office metadata in form submit */}
      <input type="hidden" name="courier" value={activeCourier} />
      <input type="hidden" name="officeCode" value={selectedOffice?.code || ""} />
    </div>
  );
}
