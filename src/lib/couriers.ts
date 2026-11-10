import officesData from "@/../data/couriers/offices.json";
import citiesData from "@/../data/couriers/cities.json";

export type CourierId = "econt" | "speedy" | "boxnow" | "penguin";
export type DeliveryType = "office" | "box" | "address" | "store";

export interface CourierOffice {
  id: string;
  code: string;
  name: string;
  courier: CourierId;
  type: "office" | "box";
  city: string;
  address: string;
  phone?: string;
}

export interface CourierMeta {
  id: CourierId;
  name: string;
  tagline: string;
  badge: string;
  color: string;
  bgLight: string;
  hasOffices: boolean;
  hasBoxes: boolean;
  hasAddress: boolean;
}

export const COURIERS: Record<CourierId, CourierMeta> = {
  econt: {
    id: "econt",
    name: "Еконт",
    tagline: "Офиси, Еконтомати и доставка до врата",
    badge: "Еконт",
    color: "#0c3b7a",
    bgLight: "#edf3fc",
    hasOffices: true,
    hasBoxes: true,
    hasAddress: true,
  },
  speedy: {
    id: "speedy",
    name: "Спиди",
    tagline: "Офиси, автомати (АПС) и куриер до адрес",
    badge: "Спиди",
    color: "#cb1818",
    bgLight: "#fdefef",
    hasOffices: true,
    hasBoxes: true,
    hasAddress: true,
  },
  boxnow: {
    id: "boxnow",
    name: "Box Now",
    tagline: "Денонощни автомати (24/7 локъри)",
    badge: "Box Now",
    color: "#15803d",
    bgLight: "#edfbf2",
    hasOffices: false,
    hasBoxes: true,
    hasAddress: false,
  },
  penguin: {
    id: "penguin",
    name: "Penguin Express",
    tagline: "Доставки 7 дни в седмицата, офиси и автомати",
    badge: "Penguin",
    color: "#0f766e",
    bgLight: "#f0fdfa",
    hasOffices: true,
    hasBoxes: true,
    hasAddress: true,
  },
};

export const DEFAULT_ACTIVE_COURIERS: Record<CourierId, boolean> = {
  econt: true,
  speedy: true,
  boxnow: true,
  penguin: true,
};

const allOffices = officesData as CourierOffice[];
const allCities = citiesData as string[];

/** Return couriers eligible for a specific delivery method, filtered by active settings */
export function getCouriersForDelivery(
  delivery: DeliveryType,
  activeFilter?: Record<CourierId, boolean> | null,
): CourierMeta[] {
  let list: CourierMeta[] = [];
  if (delivery === "office") {
    list = [COURIERS.econt, COURIERS.speedy, COURIERS.penguin];
  } else if (delivery === "box") {
    list = [COURIERS.speedy, COURIERS.econt, COURIERS.boxnow, COURIERS.penguin];
  } else if (delivery === "address") {
    list = [COURIERS.speedy, COURIERS.econt, COURIERS.penguin];
  }

  if (activeFilter) {
    list = list.filter((c) => activeFilter[c.id] !== false);
  }
  return list;
}

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
