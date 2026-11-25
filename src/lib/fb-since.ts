/**
 * The days collecting from the Facebook group covers: the admin gives periods ("from" a day, "to" a day or open),
 * and posts published outside them are left alone, because their orders were taken by hand. This works out when
 * a post was published from the date Facebook shows next to it, and whether that falls in a period.
 */

const dayInSofia = (at: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(at);

/** The first moment of a "YYYY-MM-DD" day in Bulgaria, in milliseconds; null when the text is not a date. */
export function startOfSofiaDay(day: string | null | undefined): number | null {
  const m = day?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(utc)) return null;
  // Bulgaria is two hours ahead of UTC in winter and three in summer.
  for (const hours of [3, 2]) {
    const at = utc - hours * 3600000;
    if (dayInSofia(at) === day && dayInSofia(at - 1) !== day) return at;
  }
  return utc - 2 * 3600000;
}

const HOURS: Record<string, number> = { с: 0, сек: 0, s: 0, м: 1 / 60, мин: 1 / 60, m: 1 / 60, ч: 1, h: 1, д: 24, d: 24, седм: 168, w: 168, г: 8760, y: 8760 };

/** How many hours ago, from the short date Facebook shows ("7 м", "11 ч", "1 д", "2 седм."). Null when unreadable. */
export function stampAgeHours(stamp: string): number | null {
  const s = stamp.trim().toLowerCase();
  if (/^(току-що|сега|just now|now)$/.test(s)) return 0;
  const m = s.match(/^(\d{1,3})\s*([a-zа-я]+)\.?$/);
  if (!m || !(m[2] in HOURS)) return null;
  return Number(m[1]) * HOURS[m[2]];
}

const MONTHS: Record<string, number> = {
  януари: 0, февруари: 1, март: 2, април: 3, май: 4, юни: 5, юли: 6, август: 7, септември: 8, октомври: 9, ноември: 10, декември: 11,
  яну: 0, фев: 1, мар: 2, апр: 3, авг: 7, сеп: 8, септ: 8, окт: 9, ное: 10, ноем: 10, дек: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** When something was written, as far as Facebook's short date tells: not before `earliest`, not after `latest`. */
export type Span = { earliest: number; latest: number };

const HOUR = 3600000;

/**
 * When a post (or comment) was written, from the short date Facebook shows: "Току-що", "16 ч", "3 д", "2 седм.",
 * "Вчера в 10:30", "14 ноември", "14 ноември 2025 г. в 10:29", "November 14". "3 д" means three to four days
 * ago, and a date means some time that day. Null when the text is not understood.
 */
export function stampToSpan(stamp: string | null | undefined, now = Date.now()): Span | null {
  const s = (stamp ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!s) return null;
  const hours = stampAgeHours(s);
  if (hours !== null) {
    // The unit Facebook counts in is how far off the number can be: "3 д" is anything from 72 to 96 hours.
    const unit = s.match(/[a-zа-я]+/)?.[0] ?? "";
    const width = Math.max(HOURS[unit] ?? 0, 1 / 60);
    return { earliest: now - (hours + width) * HOUR, latest: now - hours * HOUR };
  }
  if (/^(вчера|yesterday)/.test(s)) return { earliest: now - 48 * HOUR, latest: now - 24 * HOUR };

  // "14 ноември [2025 г.]" or "november 14[, 2025]"
  const dayFirst = s.match(/^(\d{1,2})\.? ([a-zа-я]+)\.?,?(?: (\d{4}))?/);
  const monthFirst = s.match(/^([a-zа-я]+)\.? (\d{1,2})(?:,? (\d{4}))?/);
  const day = dayFirst ? Number(dayFirst[1]) : monthFirst ? Number(monthFirst[2]) : null;
  const month = MONTHS[dayFirst ? dayFirst[2] : monthFirst ? monthFirst[1] : ""];
  if (day == null || month == null || day < 1 || day > 31) return null;
  const typedYear = dayFirst?.[3] ?? monthFirst?.[3];
  const startOf = (year: number) => startOfSofiaDay(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  const year = typedYear ? Number(typedYear) : new Date(now).getUTCFullYear();
  let start = startOf(year);
  // Without a year the date is the most recent one that is not in the future.
  if (!typedYear && start !== null && start > now) start = startOf(year - 1);
  if (start === null) return null;
  // Up to the last minute of that day in Bulgaria, and never in the future.
  const latest = Math.min(start + 24 * HOUR - 60000, now);
  return { earliest: Math.min(start, latest), latest };
}

/** The latest moment a post (or comment) could have been written; see `stampToSpan`. */
export function stampToTime(stamp: string | null | undefined, now = Date.now()): number | null {
  return stampToSpan(stamp, now)?.latest ?? null;
}

/** A stretch of days posts are collected from ("YYYY-MM-DD", Bulgarian time, both days included); no `to` means from that day on. */
export type FbPeriod = { from: string; to: string | null };

/** The day after a "YYYY-MM-DD" day. */
function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** The periods as moments, from `start` up to (not including) `end`; an open period never ends. Unreadable ones are left out. */
export function periodBounds(periods: FbPeriod[]): { start: number; end: number }[] {
  const bounds: { start: number; end: number }[] = [];
  for (const p of periods) {
    const start = startOfSofiaDay(p.from);
    if (start === null) continue;
    const end = p.to ? startOfSofiaDay(nextDay(p.to)) : null;
    bounds.push({ start, end: p.to && end !== null ? end : Infinity });
  }
  return bounds;
}

/**
 * Whether a post published somewhere in `span` counts: the moment to keep as its date, inside the first period
 * that may hold it (so later looks at the post agree), or null when no period can. A post is rather collected
 * than missed: "3 д" counts when any part of that day-long stretch touches a period. Without periods every post counts.
 */
export function placeInPeriods(span: Span, bounds: { start: number; end: number }[]): number | null {
  if (bounds.length === 0) return span.latest;
  for (const b of bounds) if (span.latest >= b.start && span.earliest < b.end) return Math.min(span.latest, b.end - 1);
  return null;
}

/** Whether a known moment falls in a period (or there are none). */
export const inPeriods = (at: number, bounds: { start: number; end: number }[]) => placeInPeriods({ earliest: at, latest: at }, bounds) !== null;
