/**
 * Reads comments copied from a Facebook group (anything from a few comments to the whole page) and works out
 * who asked for how many.
 *
 * In a copy, every comment looks like:
 *   Fani Chaikova        ← name (sometimes as a link, sometimes followed by badges such as "Топ сътрудник")
 *    ·                   ← one or two dot lines
 *   Комплект от 4 бр за мен
 *   Отговор              ← "Отговор" / "Споделяне" close the comment
 * A whole-page copy also holds the posts themselves, dates, the group's description and the sidebar.
 * Those never end with "Отговор"/"Споделяне", so once the copy uses those words, only text closed by
 * them counts as a comment. Shorter copies without them are read the simple way.
 *
 * Runs in the browser for the live preview and again on the server.
 */

export type ParsedClaim = {
  name: string;
  comment: string;
  /** 0 when the comment does not look like an order (a question, "благодаря", the admin's own reply…). */
  qty: number;
  /** False when the number was guessed, so the preview can point it out. */
  sure: boolean;
  /** First line of the post the comment was under, when the copy included the post itself. */
  post: string | null;
};

const TERMINATOR = /^(отговор|отговори|споделяне|reply|share)$/i;
const MONTHS = "януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември|яну|фев|мар|апр|авг|сеп|окт|ное|дек";

// Facebook interface text: badges, dates, buttons, counters.
const NOISE = [
  /^(харесвам|харесване|like|edited|author|редактиран[оа]?|автор)$/i,
  /^(администратор|модератор|водещ глас|топ сътрудник|топ фен|top fan|нов член|съдържание от ai|ново|препоръчани|публична група|частна група)$/i,
  /^(вижте|виж) (още|повече|по-малко|превод|оригинала).*$/i,
  /^(see more|see less|see translation).*$/i,
  /^(преглед на|покажи) (още|всички|предишни).*$/i,
  /^(най-подходящи|всички коментари|най-нови|най-уместни).*$/i,
  /^преди \d+/i,
  /^(понеделник|вторник|сряда|четвъртък|петък|събота|неделя),/i,
  /^\d+\s*(с|сек|м|мин|ч|д|дни|седм|г|s|m|h|d|w|y)\.?$/i,
  new RegExp(`^\\d{1,2} (${MONTHS})( \\d{4})?( г\\.)?( в \\d{1,2}:\\d{2})?$`, "i"),
  /^\d+\s*(отговор|отговора|reply|replies|коментар|коментара)$/i,
  /^\d+([.,]\d+)?\s*(хил\.)?\s*(членове|members)$/i,
  /^[\d\s]+$/, // reaction counts on their own line
];

const isNoise = (line: string) => NOISE.some((re) => re.test(line));
const isDot = (line: string) => /^[·•]$/.test(line);

/** "[Fani Chaikova](https://facebook.com/…)" → "Fani Chaikova"; bullets and odd characters out. */
function clean(raw: string) {
  return raw
    .replace(/[​-‏‪-‮﻿￼]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[*\-–]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const WORD_NUMBERS: Record<string, number> = {
  един: 1, една: 1, едно: 1,
  два: 2, две: 2,
  три: 3, четири: 4, пет: 5, шест: 6, седем: 7, осем: 8, девет: 9, десет: 10,
};
const UNIT = "(?:бр\\.?|броя|брой|бройки|бройка|комплекта|комплект|к-та|пакета|пакет|кутии|кутия|опаковки|опаковка|чифта|чифт|кг|kg|pcs?)";
const WORDS = Object.keys(WORD_NUMBERS).join("|");

/** How many items a single comment asks for. */
export function quantityOf(comment: string): { qty: number; sure: boolean } {
  const text = comment.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return { qty: 0, sure: false };
  // "комплект от 4 бр" may mean one set or four pieces: let the shop check.
  const ambiguous = /комплект/.test(text) && /\d/.test(text) && !/\d+\s*комплект/.test(text);

  // "2 бр", "5броя", "3 комплекта", "х2", "2x"
  const digitUnit = text.match(new RegExp(`(\\d{1,2})\\s*${UNIT}(?![а-яa-z])`, "i")) ?? text.match(/(?:^|\s)[xх]\s*(\d{1,2})(?!\d)|(\d{1,2})\s*[xх](?![а-яa-z])/i);
  if (digitUnit) return { qty: Math.max(1, Number(digitUnit[1] ?? digitUnit[2])), sure: !ambiguous };

  // "два броя", "един комплект"
  const wordUnit = text.match(new RegExp(`(?:^|\\s)(${WORDS})\\s+${UNIT}`, "i"));
  if (wordUnit) return { qty: WORD_NUMBERS[wordUnit[1]] ?? 1, sure: true };

  // "искам 1 за подарък", "вземам 2"
  const verbNumber = text.match(/(?:искам|вземам|взимам|запази(?:те)?(?: ми)?|резервирай|поръчвам|желая)\s+(\d{1,2})(?!\d)/);
  if (verbNumber) return { qty: Math.max(1, Number(verbNumber[1])), sure: true };

  // A bare number: "3", "2 моля", "1 за мен"
  const bare = text.match(/^(\d{1,2})(?:\s|$|[!.,])/);
  if (bare && Number(bare[1]) > 0) return { qty: Number(bare[1]), sure: true };

  // Questions are not orders, even when they mention a quantity word.
  if (/\?\s*$/.test(text) && !/за мен/.test(text)) return { qty: 0, sure: false };

  // "за мен", "искам", "и аз" without a number: one piece.
  if (/(за мен|искам|и аз|аз също|запази|запазете|резервирай|поръчвам|вземам|взимам|желая|\bбр\b|брой\b)/.test(text)) {
    return { qty: 1, sure: /(\bбр\b|брой\b)/.test(text) };
  }
  return { qty: 0, sure: false };
}

type Block = { name: string; lines: string[] };

export function parseComments(raw: string): ParsedClaim[] {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(clean)
    .filter(Boolean);
  const strict = lines.some((l) => TERMINATOR.test(l));

  const claims: ParsedClaim[] = [];
  const seen = new Set<string>();
  // The comment being read; kept in an object because the helpers below replace it.
  const st: { current: Block | null } = { current: null };
  // The post the following comments belong to: the first line of the last unclosed block (a post's text).
  let post: string | null = null;
  // Lines read outside any comment; the last one before a dot is the next commenter's name.
  let loose: string[] = [];

  const accept = (block: Block | null) => {
    if (!block) return;
    const comment = block.lines.join(" ").trim();
    if (!block.name || !comment) return;
    // A whole-page copy often holds the same post twice.
    const key = `${block.name}\u0000${comment}`;
    if (seen.has(key)) return;
    seen.add(key);
    const { qty, sure } = quantityOf(comment);
    claims.push({ name: block.name, comment, qty, sure, post });
  };

  const startComment = (name: string | undefined) => {
    // An unclosed block (a post, the sidebar) is dropped when the copy marks comments with "Отговор",
    // but its first line names the post for the comments that follow.
    if (!strict) accept(st.current);
    else if (st.current && st.current.lines.length > 0) post = st.current.lines[0].slice(0, 80);
    st.current = name && !isNoise(name) && !isDot(name) ? { name, lines: [] } : null;
    loose = [];
  };

  for (const line of lines) {
    if (TERMINATOR.test(line)) {
      accept(st.current);
      st.current = null;
      loose = [];
      continue;
    }

    // "Fani Chaikova ·" or "6 ч ·": a name (or a date) that carries its own dot.
    const trailingDot = line.match(/^(.+?)\s*[·•]$/);
    if (trailingDot) {
      const name = trailingDot[1].trim();
      if (isNoise(name)) continue;
      startComment(name);
      continue;
    }

    // "Fani Chaikova · Комплект за мен" on one line.
    const inline = line.match(/^(.{2,60}?)\s+[·•]\s+(.+)$/);
    if (inline && !isNoise(inline[1])) {
      startComment(inline[1].trim());
      if (st.current) st.current.lines.push(inline[2].trim());
      continue;
    }

    if (isDot(line)) {
      // A second dot right after the first: still the same comment.
      if (st.current && st.current.lines.length === 0) continue;
      const source: string[] = st.current ? st.current.lines : loose;
      startComment(source.pop());
      continue;
    }

    // A lone number is the whole comment ("3") when nothing was written yet; after the text it is a like count.
    if (isNoise(line) && !(/^\d{1,2}$/.test(line) && st.current?.lines.length === 0)) continue;
    if (st.current) st.current.lines.push(line);
    else loose.push(line);
  }
  // The very last comment may be copied without its "Отговор"; keep it if it is short like a comment.
  if (st.current && (!strict || st.current.lines.join(" ").length <= 200)) accept(st.current);
  return claims;
}
