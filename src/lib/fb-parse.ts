/**
 * Reads comments copied from a Facebook post (select all, copy, paste) and works out who asked for how many.
 *
 * A copied comment looks like:
 *   Mariq Georgieva
 *    ·
 *   1 брой за мен ако не е късно ☺️
 *   Споделяне
 * The name is the line just before the "·", the comment is everything after it up to the next comment.
 * Runs in the browser for the live preview and again on the server, which trusts only its own result.
 */

export type ParsedClaim = {
  name: string;
  comment: string;
  /** 0 when the comment does not look like an order (a question, "благодаря"…). */
  qty: number;
  /** False when the number was guessed, so the preview can point it out. */
  sure: boolean;
};

// Facebook interface text that ends up in a copied comment thread.
const NOISE = [
  /^споделяне$/i,
  /^отговор(и)?$/i,
  /^отговори$/i,
  /^харесвам$/i,
  /^харесване$/i,
  /^редактиран[оа]?$/i,
  /^автор$/i,
  /^топ фен$/i,
  /^top fan$/i,
  /^(share|reply|like|edited|author)$/i,
  /^виж (още|превод|оригинала).*$/i,
  /^(see more|see translation).*$/i,
  /^преглед на (още|всички).*$/i,
  /^(най-подходящи|всички коментари|най-нови).*$/i,
  /^\d+\s*(с|сек|м|мин|ч|д|дни|седм|г|s|m|h|d|w|y)\.?$/i,
  /^\d+\s*(отговор|отговора|reply|replies)$/i,
  /^\d+$/, // reaction counts on their own line
];
const isNoise = (line: string) => NOISE.some((re) => re.test(line));
const isDot = (line: string) => /^[·•]$/.test(line);

const WORD_NUMBERS: Record<string, number> = {
  един: 1, една: 1, едно: 1, 1: 1,
  два: 2, две: 2, двe: 2,
  три: 3, четири: 4, пет: 5, шест: 6, седем: 7, осем: 8, девет: 9, десет: 10,
};
const UNIT = "(?:бр\\.?|броя|брой|бройки|бройка|пакет[а]?|кутии|кутия|опаковк[иа]|кг|kg|x|х|pcs?)";

/** How many items a single comment asks for. */
export function quantityOf(comment: string): { qty: number; sure: boolean } {
  const text = comment.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return { qty: 0, sure: false };

  // "2 бр", "2бр.", "2 броя", "х2", "2x"
  const digitUnit = text.match(new RegExp(`(\\d{1,2})\\s*${UNIT}(?![а-яa-z])`, "i")) ?? text.match(/(?:^|\s)[xх]\s*(\d{1,2})(?!\d)/i);
  if (digitUnit) return { qty: Math.max(1, Number(digitUnit[1])), sure: true };

  // "два броя", "една бройка", "три пакета"
  const wordUnit = text.match(new RegExp(`(${Object.keys(WORD_NUMBERS).filter((k) => !/\d/.test(k)).join("|")})\\s+${UNIT}`, "i"));
  if (wordUnit) return { qty: WORD_NUMBERS[wordUnit[1]] ?? 1, sure: true };

  // A bare number as the whole comment: "2", "2 моля", "1 за мен"
  const bare = text.match(/^(\d{1,2})(?:\s|$|[!.,])/);
  if (bare && Number(bare[1]) > 0) return { qty: Number(bare[1]), sure: true };

  // Questions are not orders, even when they mention a quantity word.
  if (/\?\s*$/.test(text) && !/\bза мен\b/.test(text)) return { qty: 0, sure: false };

  // "за мен", "искам", "и аз", "запазете ми" without a number: one piece.
  if (/(за мен|искам|и аз|аз също|запази|запазете|резервирай|поръчвам|вземам|взимам|желая|бр\b|брой)/.test(text)) {
    return { qty: 1, sure: /(\bбр\b|брой)/.test(text) };
  }
  return { qty: 0, sure: false };
}

export function parseComments(raw: string): ParsedClaim[] {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[​-‏‪-‮﻿]/g, "").trim())
    .filter(Boolean);

  const claims: ParsedClaim[] = [];
  let current: { name: string; comment: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const comment = current.comment.join(" ").trim();
    if (current.name && comment) {
      const { qty, sure } = quantityOf(comment);
      claims.push({ name: current.name, comment, qty, sure });
    }
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // "Mariq Georgieva · 1 бр" on one line (some browsers copy it like this).
    const inline = line.match(/^(.{2,60}?)\s+[·•]\s+(.+)$/);
    if (inline && !isNoise(inline[1])) {
      flush();
      current = { name: inline[1].trim(), comment: [inline[2].trim()] };
      continue;
    }
    if (isDot(line)) {
      // The name is the last meaningful line before the dot; it was collected as part of the previous comment.
      const open = current as { name: string; comment: string[] } | null;
      const name: string | undefined = open?.comment.pop() ?? lines[i - 1];
      flush();
      if (name && !isNoise(name)) current = { name, comment: [] };
      continue;
    }
    // A lone number is the whole comment ("3") when nothing was written yet; after the text it is a like count.
    if (isNoise(line) && !(/^\d{1,2}$/.test(line) && current?.comment.length === 0)) continue;
    current?.comment.push(line);
  }
  flush();
  return claims;
}
