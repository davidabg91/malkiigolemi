// The shop runs on Bulgarian time while servers run on UTC. These helpers convert the value of an
// <input type="datetime-local"> ("2026-11-20T09:00", meant as Sofia time) to a real moment and back.

const ZONE = "Europe/Sofia";
const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function sofiaFields(date: Date) {
  const p = Object.fromEntries(parts.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, min: Number(p.minute) };
}

/** "2026-11-20T09:00" in Sofia → Date. Null for anything that is not a valid datetime-local value. */
export function sofiaInputToDate(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // Start from the UTC reading and shift by Sofia's offset at that moment (twice, for the DST edges).
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const f = sofiaFields(new Date(guess));
    guess += wanted - Date.UTC(f.y, f.m - 1, f.d, f.h, f.min);
  }
  return Number.isNaN(guess) ? null : new Date(guess);
}

/** Date → "2026-11-20T09:00" in Sofia, for prefilling a datetime-local input. */
export function dateToSofiaInput(date: Date) {
  const f = sofiaFields(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${f.y}-${pad(f.m)}-${pad(f.d)}T${pad(f.h)}:${pad(f.min)}`;
}
