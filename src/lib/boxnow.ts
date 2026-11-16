import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Client for the BOX NOW Partner API (guide "Ръководство за работа с API на BOX NOW - BG v1.65", boxnow.bg/partner-api).
 *
 * Credentials come from Vercel: BOXNOW_CLIENT_ID and BOXNOW_CLIENT_SECRET (OAuth2 client credentials from BOX NOW),
 * BOXNOW_API_URL (default production), optionally BOXNOW_PARTNER_ID (sent as X-PartnerID only when set; needed only
 * when one login serves several partners). Without the credentials nothing is sent to BOX NOW.
 */

const DEFAULT_URL = "https://api-production.boxnow.bg";

export function boxnowConfig() {
  const clientId = process.env.BOXNOW_CLIENT_ID?.trim();
  const clientSecret = process.env.BOXNOW_CLIENT_SECRET?.trim();
  const url = (process.env.BOXNOW_API_URL?.trim() || DEFAULT_URL).replace(/\/+$/, "");
  return { configured: Boolean(clientId && clientSecret), clientId, clientSecret, url, partnerId: process.env.BOXNOW_PARTNER_ID?.trim() || null };
}

/** An error from BOX NOW, with a message meant for the admin. */
export class BoxNowError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

// Plain-language versions of the error codes in the guide (section 3) that a shop can actually hit.
const CODES: Record<string, string> = {
  P400: "BOX NOW отказа заявката (грешни данни).",
  P401: "Невалидна начална точка: провери в Куриери → BOX NOW как предаваш пратките.",
  P402: "Невалиден автомат на получателя. Автоматът може да е закрит — свържи се с клиента за друг.",
  P405: "Невалиден телефон на получателя (трябва да е +359…).",
  C404: "Невалиден телефон на получателя (трябва да е +359…).",
  P406: "Невалиден размер на пратката (1, 2 или 3).",
  P408: "Невалидна сума за наложен платеж.",
  P410: "Този номер на поръчка вече е използван в BOX NOW.",
  P411: "Договорът с BOX NOW не позволява наложен платеж.",
  P414: "Пратката не принадлежи на този акаунт в BOX NOW.",
  P420: "Пратката вече не може да бъде отказана.",
  P421: "Невалидно тегло на пратката.",
  P440: "Акаунтът е свързан с няколко партньора: задай BOXNOW_PARTNER_ID във Vercel.",
  P441: "Невалиден BOXNOW_PARTNER_ID във Vercel.",
  P466: "BOX NOW не позволява нови пратки: има просрочено задължение по акаунта.",
  X403: "Акаунтът в BOX NOW е деактивиран.",
  P600: "BOX NOW временно не отговаря (lockerbridge). Опитай след малко.",
};

let token: { value: string; until: number; key: string } | null = null;

async function accessToken(force = false): Promise<string> {
  const c = boxnowConfig();
  if (!c.configured) throw new BoxNowError("Липсват BOXNOW_CLIENT_ID и BOXNOW_CLIENT_SECRET във Vercel.");
  const key = `${c.url}|${c.clientId}`;
  if (!force && token && token.key === key && token.until > Date.now()) return token.value;
  let res: Response;
  try {
    res = await fetch(`${c.url}/api/v1/auth-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: c.clientId, client_secret: c.clientSecret }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new BoxNowError("BOX NOW не отговаря. Опитай отново след малко.");
  }
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!res.ok || !json?.access_token) {
    throw new BoxNowError("BOX NOW отказа достъп: провери BOXNOW_CLIENT_ID и BOXNOW_CLIENT_SECRET във Vercel (след промяна — Redeploy).");
  }
  // The token lives an hour; renew a minute early.
  token = { value: json.access_token, until: Date.now() + Math.max(60, (json.expires_in ?? 3600) - 60) * 1000, key };
  return token.value;
}

async function request(path: string, init: { method?: string; body?: unknown; accept?: string } = {}, retried = false): Promise<Response> {
  const c = boxnowConfig();
  const bearer = await accessToken();
  let res: Response;
  try {
    res = await fetch(`${c.url}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: init.accept ?? "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(c.partnerId ? { "X-PartnerID": c.partnerId } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new BoxNowError("BOX NOW не отговаря. Опитай отново след малко.");
  }
  // An expired or revoked token: log in again once.
  if (res.status === 401 && !retried) {
    await accessToken(true);
    return request(path, init, true);
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
    const code = json?.code;
    const known = code ? CODES[code] : undefined;
    const detail = json?.message?.trim();
    throw new BoxNowError(
      known ? `${known}${detail && detail !== known ? ` (${code}: ${detail})` : ` (${code})`}` : detail ? `BOX NOW: ${detail}${code ? ` (${code})` : ""}` : `BOX NOW върна грешка (${res.status}).`,
      code,
    );
  }
  return res;
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await request(path, init);
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BoxNowError("BOX NOW върна неочакван отговор.");
  }
}

// ------------------------------------------------------------------------------------------------ origins

/** A place BOX NOW collects parcels from (the shop's warehouse), or the "any-apm" option of dropping them in a locker. */
export type BoxNowOrigin = { id: string; type: string; name: string; address: string };

/** The pickup places on the shop's contract. Doubles as the connection check. */
export async function boxnowOrigins(): Promise<BoxNowOrigin[]> {
  type Raw = { id?: string | number; type?: string; title?: string; name?: string; addressLine1?: string; addressLine2?: string; postalCode?: string };
  const res = await call<{ data?: Raw[] }>("/api/v1/origins");
  return (res.data ?? [])
    .filter((o) => o.id != null)
    .map((o) => ({
      id: String(o.id),
      type: o.type ?? "warehouse",
      name: (o.name || o.title || String(o.id)).trim(),
      address: [o.addressLine1, o.addressLine2, o.postalCode].filter(Boolean).join(", "),
    }));
}

// ---------------------------------------------------------------------------------------- delivery requests

export type BoxNowContact = { name: string; phone: string; email: string };

export type BoxNowRequestInput = {
  orderNumber: string;
  /** Goods value in euro (insurance / invoice value). */
  invoiceValue: number;
  /** Cash to collect in euro; 0 for prepaid. */
  cod: number;
  allowReturn: boolean;
  origin: BoxNowContact & { locationId: string };
  destination: BoxNowContact & { locationId: string };
  description: string;
  /** One entry per parcel. */
  parcels: { name: string; value: number; weight: number; size: 1 | 2 | 3 }[];
};

const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** "0888 123 456", "359888…", "+359 888…" → "+359888123456", the international format BOX NOW requires. */
export function boxnowPhone(phone: string): string {
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return `+${d.slice(1).replace(/\D/g, "")}`;
  d = d.replace(/\D/g, "");
  if (d.startsWith("00")) return `+${d.slice(2)}`;
  if (d.startsWith("359")) return `+${d}`;
  if (d.startsWith("0")) return `+359${d.slice(1)}`;
  return `+359${d}`;
}

/** Creates the delivery request. Returns BOX NOW's reference and the parcel ids (one per parcel). */
export async function createDeliveryRequest(input: BoxNowRequestInput): Promise<{ referenceNumber: string | null; parcelIds: string[] }> {
  const contact = (c: BoxNowContact) => ({ contactName: c.name.trim().slice(0, 100), contactNumber: boxnowPhone(c.phone), contactEmail: c.email.trim() });
  const body = {
    orderNumber: input.orderNumber,
    invoiceValue: money(input.invoiceValue),
    paymentMode: input.cod > 0 ? "cod" : "prepaid",
    amountToBeCollected: money(input.cod),
    allowReturn: input.allowReturn,
    description: input.description.slice(0, 200),
    origin: { ...contact(input.origin), locationId: input.origin.locationId },
    destination: { ...contact(input.destination), locationId: input.destination.locationId },
    items: input.parcels.map((p, i) => ({
      id: `${input.orderNumber}-${i + 1}`,
      name: p.name.slice(0, 100),
      value: money(p.value),
      weight: p.weight,
      compartmentSize: p.size,
    })),
  };
  type Raw = { referenceNumber?: string | number; id?: string | number; parcels?: { id?: string | number }[] };
  const res = await call<Raw>("/api/v1/delivery-requests", { method: "POST", body });
  const parcelIds = (res.parcels ?? []).map((p) => (p.id == null ? "" : String(p.id))).filter(Boolean);
  // The guide shows `referenceNumber` in one place and `id` in another.
  const ref = res.referenceNumber ?? res.id;
  return { referenceNumber: ref == null ? null : String(ref), parcelIds };
}

/** Cancels one parcel (possible while it is "new"; P420 otherwise). */
export async function cancelParcel(parcelId: string): Promise<void> {
  await request(`/api/v1/parcels/${encodeURIComponent(parcelId)}:cancel`, { method: "POST" });
}

/** The parcel's label as a PDF. */
export async function parcelLabel(parcelId: string): Promise<ArrayBuffer> {
  const res = await request(`/api/v1/parcels/${encodeURIComponent(parcelId)}/label.pdf`, { accept: "application/pdf" });
  return res.arrayBuffer();
}

// ------------------------------------------------------------------------------------------------ tracking

/** BOX NOW's event names (webhook "event", parcel "state" and its history), as the customer sees them on boxnow.bg. */
const EVENT_TEXT: Record<string, string> = {
  new: "Пратката е регистрирана в BOX NOW",
  // Not in the guides, but in real parcel histories: the sender has dropped the parcel in a locker.
  "accepted-to-locker": "Пратката е оставена в автомат и приета от BOX NOW",
  "in-depot": "Пратката е в склад на BOX NOW",
  "in-transit": "Пратката пътува към автомата",
  "final-destination": "Пратката е в автомата и очаква получаване",
  delivered: "Пратката е получена от клиента",
  returned: "Пратката е върната на подателя",
  expired: "Срокът за получаване изтече, пратката се връща",
  "expired-return": "Срокът за получаване изтече, пратката се връща",
  cancelled: "Пратката е отказана от подателя",
  canceled: "Пратката е отказана от подателя",
  "cancelled-return": "Връщането е отказано от подателя",
  "wait-for-load": "Пратката чака куриер в автомат (връщане или пренасочване)",
  lost: "Пратката е изгубена",
  missing: "Пратката липсва",
  undelivered: "Пратката не е доставена",
};

export const normalizeEvent = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

export function boxnowEventText(event: string | null | undefined): string {
  const e = normalizeEvent(event);
  return EVENT_TEXT[e] ?? (e ? `BOX NOW: ${e}` : "—");
}

/** What an event means for the order: on its way, delivered, or nothing to change. */
export function eventOutcome(event: string | null | undefined): "shipped" | "delivered" | null {
  const e = normalizeEvent(event);
  if (e === "delivered") return "delivered";
  if (e === "accepted-to-locker" || e === "in-depot" || e === "in-transit" || e === "final-destination") return "shipped";
  return null;
}

export type BoxNowParcelStatus = {
  id: string;
  state: string | null;
  events: { type: string; time: string; place: string | null }[];
};

/** A parcel's state and history, straight from BOX NOW. Null when BOX NOW does not know it. */
export async function boxnowParcel(parcelId: string): Promise<BoxNowParcelStatus | null> {
  type Raw = {
    id?: string | number;
    state?: string;
    events?: { type?: string; createTime?: string; locationDisplayName?: string | null }[];
  };
  const res = await call<{ data?: Raw[] }>(`/api/v1/parcels?parcelId=${encodeURIComponent(parcelId)}`);
  const p = (res.data ?? []).find((x) => String(x.id) === parcelId) ?? res.data?.[0];
  if (!p) return null;
  return {
    id: String(p.id ?? parcelId),
    state: p.state ?? null,
    events: (p.events ?? [])
      .filter((e) => e.type && e.createTime)
      .map((e) => ({ type: e.type!, time: new Date(e.createTime!).toISOString(), place: e.locationDisplayName?.trim() || null }))
      .sort((a, b) => a.time.localeCompare(b.time)),
  };
}

/** BOX NOW's public tracking page for a parcel. */
export const boxnowTrackingUrl = (parcelId: string) => `https://boxnow.bg/?track=${encodeURIComponent(parcelId)}`;

// ------------------------------------------------------------------------------------------------ webhook

/** The key BOX NOW must send with every webhook call (BOXNOW_WEBHOOK_SECRET in Vercel). */
export const webhookSecret = () => process.env.BOXNOW_WEBHOOK_SECRET?.trim() || null;

/** Constant-time comparison of the key that came with a webhook call. */
export function webhookKeyMatches(given: string | null | undefined): boolean {
  const secret = webhookSecret();
  if (!secret || !given) return false;
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
