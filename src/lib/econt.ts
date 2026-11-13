import "server-only";

/**
 * Client for Econt's SOAP/JSON API (https://ee.econt.com/services/).
 *
 * Without ECONT_USERNAME / ECONT_PASSWORD it talks to Econt's public test system, where waybills are not real.
 * With them it uses the live system, where every waybill is charged to the shop's Econt account and a requested
 * courier really comes. ECONT_ENV=demo forces the test system even with credentials set.
 */

const DEMO = { url: "https://demo.econt.com/ee/services", username: "iasp-dev", password: "1Asp-dev" };
const LIVE_URL = "https://ee.econt.com/services";

export function econtMode() {
  const username = process.env.ECONT_USERNAME;
  const password = process.env.ECONT_PASSWORD;
  const live = Boolean(username && password) && process.env.ECONT_ENV !== "demo";
  return live ? { live, url: LIVE_URL, username: username!, password: password! } : { live, ...DEMO };
}

/** An error from Econt, with its own (Bulgarian) messages. */
export class EcontError extends Error {}

type EcontFault = { type?: string; message?: string; innerErrors?: EcontFault[] };

function faultText(f: EcontFault): string {
  const own = f.message?.trim() ?? "";
  const inner = (f.innerErrors ?? []).map(faultText).filter(Boolean);
  return [own, ...inner].filter(Boolean).join(" ");
}

async function call<T>(method: string, body: unknown, timeoutMs = 20_000): Promise<T> {
  const { url, username, password } = econtMode();
  let res: Response;
  try {
    res = await fetch(`${url}/${method}.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new EcontError("Еконт не отговаря. Опитай отново след малко.");
  }
  const text = await res.text();
  let json: (T & EcontFault) | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON: an outage page or a proxy error.
  }
  if (res.status === 401 || res.status === 403) throw new EcontError("Еконт отказа достъп: провери потребителя и паролата за e-Econt.");
  if (!res.ok || !json || (json.type && /Exception|Ex[A-Z]/.test(json.type))) {
    const text = json ? faultText(json) || "Еконт върна грешка." : `Еконт върна грешка (${res.status}).`;
    // Econt answers a wrong login like any other bad request; say where the login comes from.
    if (/потребителско име|парола/i.test(text)) {
      throw new EcontError(
        `${text} Провери ECONT_USERNAME и ECONT_PASSWORD във Vercel: с тях трябва да можеш да влезеш в ee.econt.com. След промяна направи Redeploy.`,
      );
    }
    throw new EcontError(text);
  }
  return json;
}

/** Who the site is logged in to Econt as: proves the username/password and shows the client number. */
export async function econtProfile(): Promise<{ name: string; clientNumber: string | null; company: boolean; email: string | null }> {
  const res = await call<{ profiles?: { client?: { name?: string; clientNumber?: string | null; juridicalEntity?: boolean; email?: string | null } }[] }>(
    "Profile/ProfileService.getClientProfiles",
    {},
  );
  const c = res.profiles?.[0]?.client;
  if (!c) throw new EcontError("Входът в Еконт е успешен, но към потребителя няма клиентски профил.");
  return { name: c.name ?? "—", clientNumber: c.clientNumber || null, company: Boolean(c.juridicalEntity), email: c.email ?? null };
}

// ---------------------------------------------------------------------------------------------- labels

export type EcontParty = {
  name: string;
  phone: string;
  /** Econt office or locker code; when empty the address below is used. */
  officeCode?: string | null;
  city?: string;
  address?: string;
};

export type EcontLabelInput = {
  sender: EcontParty;
  receiver: EcontParty;
  orderNumber: string;
  description: string;
  weight: number;
  packCount: number;
  /** Cash on delivery in euro; 0 for none. */
  cod: number;
  /** Who pays Econt: the shop (sender) or the customer when collecting (receiver). */
  payer: "sender" | "receiver";
  /** How the shop pays: cash at the office, or on account under its contract. */
  senderPayment: "cash" | "credit";
  /** The customer may open and check the parcel before paying. */
  inspectBeforePay: boolean;
  sms: boolean;
  /** Econt's code for the shop's cash-on-delivery agreement, if it has one. */
  codTemplate?: string | null;
  /** Ask Econt to send a courier to the sender's address, between these "HH:mm" times. */
  pickup?: { from: string; to: string } | null;
};

export type EcontLabelResult = {
  shipmentNumber: string | null;
  pdfUrl: string | null;
  /** Total price in euro, and how much of it each side owes. */
  price: number;
  senderDue: number;
  receiverDue: number;
  currency: string;
  expectedDelivery: Date | null;
  services: { description: string; price: number }[];
};

function party(p: EcontParty) {
  const client = { name: p.name.trim(), phones: [p.phone.trim()] };
  if (p.officeCode) return { client, officeCode: p.officeCode };
  return { client, address: { city: { country: { code3: "BGR" }, name: (p.city ?? "").trim() }, other: (p.address ?? "").trim() } };
}

type RawLabel = {
  shipmentNumber?: string | null;
  pdfURL?: string | null;
  totalPrice?: number;
  senderDueAmount?: number;
  receiverDueAmount?: number;
  currency?: string;
  expectedDeliveryDate?: number | null;
  services?: { description?: string; price?: number }[];
};

/**
 * One waybill. "calculate" only prices it, "validate" checks it, "create" makes the real waybill
 * (and, with `pickup`, books the courier).
 */
export async function econtLabel(input: EcontLabelInput, mode: "calculate" | "validate" | "create"): Promise<EcontLabelResult> {
  const s = party(input.sender);
  const r = party(input.receiver);
  const label = {
    senderClient: s.client,
    ...(s.officeCode ? { senderOfficeCode: s.officeCode } : { senderAddress: s.address }),
    receiverClient: r.client,
    ...(r.officeCode ? { receiverOfficeCode: r.officeCode } : { receiverAddress: r.address }),
    packCount: input.packCount,
    shipmentType: "PACK",
    weight: input.weight,
    shipmentDescription: input.description.slice(0, 200),
    orderNumber: input.orderNumber,
    // Without a choice Econt refuses address deliveries that would fall on a weekend.
    holidayDeliveryDay: "workday",
    payAfterAccept: input.inspectBeforePay,
    ...(input.payer === "sender" ? { paymentSenderMethod: input.senderPayment } : { paymentReceiverMethod: "cash" }),
    services: {
      ...(input.cod > 0 ? { cdAmount: Math.round(input.cod * 100) / 100, cdType: "GET", cdCurrency: "EUR" } : {}),
      ...(input.cod > 0 && input.codTemplate ? { cdPayOptionsTemplate: input.codTemplate } : {}),
      ...(input.sms ? { smsNotification: true } : {}),
    },
  };
  const res = await call<{ label?: RawLabel }>("Shipments/LabelService.createLabel", {
    label,
    mode,
    ...(mode === "create" && input.pickup ? { requestCourierTimeFrom: input.pickup.from, requestCourierTimeTo: input.pickup.to } : {}),
  });
  const l = res.label ?? {};
  return {
    shipmentNumber: l.shipmentNumber || null,
    pdfUrl: l.pdfURL ? l.pdfURL.replace(/^http:\/\//, "https://") : null,
    price: l.totalPrice ?? 0,
    senderDue: l.senderDueAmount ?? 0,
    receiverDue: l.receiverDueAmount ?? 0,
    currency: l.currency ?? "EUR",
    expectedDelivery: l.expectedDeliveryDate ? new Date(l.expectedDeliveryDate) : null,
    services: (l.services ?? []).map((x) => ({ description: x.description ?? "", price: x.price ?? 0 })),
  };
}

/** Cancels waybills Econt has not accepted yet. Returns Econt's message for each one it refused. */
export async function deleteEcontLabels(numbers: string[]): Promise<Record<string, string>> {
  const res = await call<{ results?: { shipmentNum?: string; error?: EcontFault | null }[] }>("Shipments/LabelService.deleteLabels", { shipmentNumbers: numbers });
  const refused: Record<string, string> = {};
  for (const r of res.results ?? []) if (r.shipmentNum && r.error) refused[r.shipmentNum] = faultText(r.error) || "Еконт отказа изтриването.";
  return refused;
}

// -------------------------------------------------------------------------------------------- tracking

export type TrackingEvent = { time: string; text: string; place: string | null };

export type EcontShipmentStatus = {
  shipmentNumber: string;
  /** Econt's own short status, e.g. "Очаква предаване към Еконт", "Доставена". */
  status: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  /** Cash on delivery collected from the customer, and paid out to the shop. */
  codCollected: number;
  codPaid: number;
  returned: boolean;
  events: TrackingEvent[];
  error: string | null;
};

type RawStatus = {
  shipmentNumber?: string;
  shortDeliveryStatus?: string | null;
  sendTime?: number | string | null;
  deliveryTime?: number | string | null;
  cdCollectedAmount?: number;
  cdPaidAmount?: number;
  nextShipments?: { shipmentNumber?: string; reason?: string }[];
  trackingEvents?: { destinationType?: string; destinationDetails?: string; officeName?: string; cityName?: string; time?: number | string }[];
};

const toDate = (v: number | string | null | undefined) => (v == null || v === "" ? null : new Date(v));

/** Status and history of up to 100 shipments at a time. */
export async function econtStatuses(numbers: string[]): Promise<EcontShipmentStatus[]> {
  if (numbers.length === 0) return [];
  const res = await call<{ shipmentStatuses?: { status?: RawStatus | null; error?: EcontFault | null }[] }>(
    "Shipments/ShipmentService.getShipmentStatuses",
    { shipmentNumbers: numbers.slice(0, 100) },
  );
  return (res.shipmentStatuses ?? []).map((x, i) => {
    const s = x.status ?? {};
    const short = s.shortDeliveryStatus ?? null;
    return {
      shipmentNumber: s.shipmentNumber ?? numbers[i],
      status: short,
      sentAt: toDate(s.sendTime),
      deliveredAt: toDate(s.deliveryTime),
      codCollected: s.cdCollectedAmount ?? 0,
      codPaid: s.cdPaidAmount ?? 0,
      returned: Boolean(short && /върн|отказ/i.test(short)) || (s.nextShipments ?? []).some((n) => /return|връщ/i.test(n.reason ?? "")),
      events: (s.trackingEvents ?? [])
        .map((e) => ({
          time: toDate(e.time)?.toISOString() ?? "",
          text: (e.destinationDetails || e.destinationType || "").trim(),
          place: e.officeName || e.cityName || null,
        }))
        .filter((e) => e.time && e.text)
        .sort((a, b) => a.time.localeCompare(b.time)),
      error: x.error ? faultText(x.error) || "Неизвестна пратка." : null,
    };
  });
}

/** The tracking history as stored on an order (JSON in orders.tracking_events). */
export function parseEvents(json: string | null | undefined): TrackingEvent[] {
  if (!json) return [];
  try {
    const list = JSON.parse(json);
    return Array.isArray(list) ? list.filter((e) => e && typeof e.time === "string" && typeof e.text === "string") : [];
  } catch {
    return [];
  }
}

/** Econt's public tracking page for a shipment. */
export const econtTrackingUrl = (shipmentNumber: string) => `https://www.econt.com/services/track-shipment/${encodeURIComponent(shipmentNumber)}`;
