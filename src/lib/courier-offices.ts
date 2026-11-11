import "server-only";
import citiesData from "@/../data/couriers/cities.json";
import officesData from "@/../data/couriers/offices.json";
import type { CourierId, CourierOffice } from "./couriers";

const allOffices = officesData as CourierOffice[];
const allCities = citiesData as string[];

/** Get list of available Bulgarian cities/settlements, optionally filtered by courier or type */
export function getAvailableCities(courier?: CourierId, type?: "office" | "box"): string[] {
  if (!courier && !type) {
    return allCities;
  }
  const matching = new Set<string>();
  for (const o of allOffices) {
    if (courier && o.courier !== courier) continue;
    if (type && o.type !== type) continue;
    matching.add(o.city);
  }
  return allCities.filter((c) => matching.has(c));
}

/** Get offices matching given parameters */
export function getOffices({
  city,
  courier,
  type,
  query,
}: {
  city?: string;
  courier?: CourierId;
  type?: "office" | "box";
  query?: string;
}): CourierOffice[] {
  let list = allOffices;

  if (courier) {
    list = list.filter((o) => o.courier === courier);
  }

  if (type) {
    list = list.filter((o) => o.type === type);
  }

  if (city) {
    const normCity = city.trim().toLowerCase();
    list = list.filter((o) => o.city.toLowerCase() === normCity);
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q),
    );
  }

  return list;
}

/** Lookup a specific office by courier and code */
export function findOffice(courier: CourierId, code: string): CourierOffice | undefined {
  return allOffices.find((o) => o.courier === courier && o.code === code);
}

/**
 * A customer's saved office, re-read from the list so name and address are always the real ones.
 * Null when nothing is saved, the office has since closed, or it does not fit the saved delivery method.
 */
export function savedOffice(delivery: string | null, courier: string | null, code: string | null): CourierOffice | null {
  if (!courier || !code || (delivery !== "office" && delivery !== "box")) return null;
  const office = findOffice(courier as CourierId, code);
  return office && office.type === delivery ? office : null;
}

/** Number of offices and lockers per courier, for the admin overview. */
export function countLocations(): Record<CourierId, number> {
  const counts: Record<CourierId, number> = { econt: 0, speedy: 0, boxnow: 0, pigeon: 0 };
  for (const o of allOffices) if (o.courier in counts) counts[o.courier] += 1;
  return counts;
}
