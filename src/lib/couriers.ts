// Courier names and rules only. The office list itself lives in courier-offices.ts and must stay on the server:
// importing it here would ship ~500 KB of addresses to every browser that opens the checkout.

export type CourierId = "econt" | "speedy" | "boxnow" | "pigeon";
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
  pigeon: {
    id: "pigeon",
    name: "Pigeon Express",
    tagline: "Доставки 7 дни в седмицата, офиси и автомати",
    badge: "Pigeon",
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
  pigeon: true,
};

/** Return couriers eligible for a specific delivery method, filtered by active settings */
export function getCouriersForDelivery(
  delivery: DeliveryType,
  activeFilter?: Record<CourierId, boolean> | null,
): CourierMeta[] {
  let list: CourierMeta[] = [];
  if (delivery === "office") {
    list = [COURIERS.econt, COURIERS.speedy, COURIERS.pigeon];
  } else if (delivery === "box") {
    list = [COURIERS.speedy, COURIERS.econt, COURIERS.boxnow, COURIERS.pigeon];
  } else if (delivery === "address") {
    list = [COURIERS.speedy, COURIERS.econt, COURIERS.pigeon];
  }

  if (activeFilter) {
    list = list.filter((c) => activeFilter[c.id] !== false);
  }
  return list;
}

export const isCourierId = (v: unknown): v is CourierId => typeof v === "string" && v in COURIERS;

/** Display name for a courier id stored on an order; null when the order has none (pickup, or placed before couriers existed). */
export const courierName = (id: string | null | undefined) => (isCourierId(id) ? COURIERS[id].name : null);
