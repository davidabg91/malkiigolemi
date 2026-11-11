import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Public order number, e.g. "LM-7K2Q9XHD": short to read out on the phone, without look-alike characters. */
export function orderNumber() {
  let out = "LM-";
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
