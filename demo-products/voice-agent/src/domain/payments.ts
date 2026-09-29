// The mock card processor. Demo cards only; nothing real is ever accepted.
//
// On a free-tier Gemini line, a real card number read aloud has already
// reached Google before any code here runs. So the agent names the demo card
// before asking for one, this refuses everything else, and the redactor
// removes any other long number from stored transcripts.

import { randomInt } from 'node:crypto';

export interface DemoCard {
  number: string;
  expiry: string;
  cvc: string;
  result: 'approve' | 'decline';
}

export const DEFAULT_DEMO_CARDS: DemoCard[] = [
  { number: '1234567890123456', expiry: '12/34', cvc: '123', result: 'approve' },
  { number: '1234567800000000', expiry: '12/34', cvc: '123', result: 'decline' },
];

/** DEMO_CARDS="1234567890123456:12/34:123:approve,1234567800000000:12/34:123:decline" */
export function parseDemoCards(env: string | undefined): DemoCard[] {
  if (!env?.trim()) return DEFAULT_DEMO_CARDS;
  return env.split(',').map((entry) => {
    const [number, expiry, cvc, result] = entry.trim().split(':');
    if (!/^\d{12,19}$/.test(number) || (result !== 'approve' && result !== 'decline')) {
      throw new Error(`bad DEMO_CARDS entry: ${entry}`);
    }
    return { number, expiry, cvc, result };
  });
}

const WORD_DIGITS: Record<string, string> = {
  zero: '0', oh: '0', o: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9',
};

/** Digits from however the model passed them: "1234 5678…", "one two three four…", "12-34". */
export function digitsOf(input: unknown): string {
  if (typeof input !== 'string' && typeof input !== 'number') return '';
  let s = String(input).toLowerCase();
  s = s.replace(/\b(double|triple)\s+(\w+)/g, (_, n: string, w: string) => {
    const d = WORD_DIGITS[w] ?? w;
    return n === 'double' ? `${d}${d}` : `${d}${d}${d}`;
  });
  s = s.replace(/\b(zero|oh|o|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => WORD_DIGITS[w]);
  return s.replace(/\D/g, '');
}

export type PaymentOutcome =
  | { result: 'approved'; last4: string; auth_code: string }
  | { result: 'declined'; last4: string }
  | { result: 'refused'; message: string };

export function processDemoPayment(cardNumber: unknown, cards: DemoCard[]): PaymentOutcome {
  const digits = digitsOf(cardNumber);
  const card = cards.find((c) => c.number === digits);
  if (!card) {
    return {
      result: 'refused',
      message:
        'Not a demo card. Do not repeat the number back. Say this is a demo line, so only the demo card works, ' +
        'and read out the demo card again.',
    };
  }
  const last4 = digits.slice(-4);
  if (card.result === 'decline') return { result: 'declined', last4 };
  const alphabet = 'ACDEFGHJKLMNPQRTUVWXY3479';
  const code = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('');
  return { result: 'approved', last4, auth_code: `DEMO-${code}` };
}

export function isDemoCard(digits: string, cards: DemoCard[]): boolean {
  return cards.some((c) => c.number === digits);
}
