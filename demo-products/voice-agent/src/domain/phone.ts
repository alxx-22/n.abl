// UK phone numbers as callers say them, normalised to E.164 for storage.

export function normaliseUkPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const words: Record<string, string> = {
    oh: '0', o: '0', zero: '0', one: '1', two: '2', three: '3', four: '4',
    five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  };
  // "double oh" / "triple seven" as people say them.
  let s = input.toLowerCase().replace(/\b(double|triple)\s+(\w+)/g, (_, n: string, w: string) => {
    const d = words[w] ?? w;
    return n === 'double' ? `${d}${d}` : `${d}${d}${d}`;
  });
  s = s.replace(/\b(oh|o|zero|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => words[w]);
  const plus = s.trim().startsWith('+');
  const digits = s.replace(/\D/g, '');
  if (plus || digits.startsWith('44')) {
    const rest = digits.startsWith('44') ? digits.slice(2) : digits;
    const national = rest.startsWith('0') ? rest.slice(1) : rest;
    return national.length >= 9 && national.length <= 10 ? `+44${national}` : null;
  }
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 10)) return `+44${digits.slice(1)}`;
  return null;
}

/** "+447700900123" → "07700 900123" */
export function displayUkPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  if (!e164.startsWith('+44')) return e164;
  const n = `0${e164.slice(3)}`;
  return n.length === 11 ? `${n.slice(0, 5)} ${n.slice(5)}` : n;
}

/** Last four digits only, for logs. */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  return `…${e164.replace(/\D/g, '').slice(-4)}`;
}

const DIGIT_NAMES = ['oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/**
 * A number as it is said aloud, in its groups: "0800 111 999" → "oh eight
 * hundred, one one one, nine nine nine"; "105" → "one oh five". A safety
 * number is said this way, twice, so a caller under stress can take it in.
 */
export function spokenNumber(number: string): string {
  return number.trim().split(/\s+/).map((g) => {
    const hundred = /^0([1-9])00$/.exec(g);
    if (hundred) return `oh ${DIGIT_NAMES[Number(hundred[1])]} hundred`;
    return g.replace(/\D/g, '').split('').map((d) => DIGIT_NAMES[Number(d)]).join(' ');
  }).join(', ');
}

/**
 * The digits a speaker said, whether written as figures or words: "oh eight
 * hundred, one one one, nine nine nine" and "0800 111 999" both give
 * "0800111999". For checking a number was said, never for storing one.
 */
export function digitsSaid(text: string): string {
  const words: Record<string, string> = { oh: '0', o: '0', zero: '0', nought: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
  return text
    .toLowerCase()
    .replace(/\b(double|triple)\s+(\w+)/g, (_, n: string, w: string) => (words[w] ?? w).repeat(n === 'double' ? 2 : 3))
    .replace(/\b(oh|o|zero|nought|one|two|three|four|five|six|seven|eight|nine)\s+hundred\b/g, (_, w: string) => `${words[w]}00`)
    .replace(/\b(oh|o|zero|nought|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => words[w])
    .replace(/\D/g, '');
}
