/**
 * Works out how many pieces a comment under a Facebook group post asks for: "2 бр", "един комплект", "за мен".
 * Used when the browser extension's comments arrive (lib/fb-ingest.ts) and when they go into orders (lib/fb-orders.ts).
 */

const WORD_NUMBERS: Record<string, number> = {
  един: 1, една: 1, едно: 1,
  два: 2, две: 2,
  три: 3, четири: 4, пет: 5, шест: 6, седем: 7, осем: 8, девет: 9, десет: 10,
};
const UNIT = "(?:бр\\.?|броя|брой|бройки|бройка|комплекта|комплект|к-та|к-кт|к-т|пакета|пакет|кутии|кутия|опаковки|опаковка|чифта|чифт|кг|kg|pcs?)";
const WORDS = Object.keys(WORD_NUMBERS).join("|");

/**
 * How many items a single comment asks for. `qty` 0 means it does not look like an order (a question, "благодаря");
 * `sure` false means the number was guessed and a person should look.
 */
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

  // "един за мен", "две моля", "три"
  const bareWord = text.match(new RegExp(`^(${WORDS})(?:\\s+(?:за|моля|и за|също)(?:\\s|$)|\\s*$|[!.,])`));
  if (bareWord) return { qty: WORD_NUMBERS[bareWord[1]] ?? 1, sure: true };

  // "за мен", "искам", "и аз" without a number: one piece.
  if (/(за мен|искам|и аз|аз също|запази|запазете|резервирай|поръчвам|вземам|взимам|желая|\bбр\b|брой\b)/.test(text)) {
    return { qty: 1, sure: /(\bбр\b|брой\b)/.test(text) };
  }
  return { qty: 0, sure: false };
}
