/**
 * The day collecting from the Facebook group starts: posts published before it are left alone, because their
 * orders were taken by hand before the script existed. This works out when a post was published from the date
 * Facebook shows next to it, and when that day begins.
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

/**
 * The latest moment a post (or comment) could have been written, from the short date Facebook shows:
 * "Току-що", "16 ч", "3 д", "2 седм.", "Вчера в 10:30", "14 ноември", "14 ноември 2025 г. в 10:29", "November 14".
 * "3 д" means three to four days ago, so the answer is three days ago. Null when the text is not understood.
 */
export function stampToTime(stamp: string | null | undefined, now = Date.now()): number | null {
  const s = (stamp ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!s) return null;
  const hours = stampAgeHours(s);
  if (hours !== null) return now - hours * 3600000;
  if (/^(вчера|yesterday)/.test(s)) return now - 24 * 3600000;

  // "14 ноември [2025 г.]" or "november 14[, 2025]"
  const dayFirst = s.match(/^(\d{1,2})\.? ([a-zа-я]+)\.?,?(?: (\d{4}))?/);
  const monthFirst = s.match(/^([a-zа-я]+)\.? (\d{1,2})(?:,? (\d{4}))?/);
  const day = dayFirst ? Number(dayFirst[1]) : monthFirst ? Number(monthFirst[2]) : null;
  const month = MONTHS[dayFirst ? dayFirst[2] : monthFirst ? monthFirst[1] : ""];
  if (day == null || month == null || day < 1 || day > 31) return null;
  const typedYear = dayFirst?.[3] ?? monthFirst?.[3];
  // The last minute of that day in Bulgaria: the latest it could have been written.
  const endOf = (year: number) => {
    const start = startOfSofiaDay(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    return start === null ? null : start + 24 * 3600000 - 60000;
  };
  const year = typedYear ? Number(typedYear) : new Date(now).getUTCFullYear();
  let at = endOf(year);
  // Without a year the date is the most recent one that is not in the future.
  if (!typedYear && at !== null && at - 24 * 3600000 > now) at = endOf(year - 1);
  return at === null ? null : Math.min(at, now);
}
