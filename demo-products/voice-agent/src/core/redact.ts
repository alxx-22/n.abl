// Removes card-like numbers from text before it is stored or shown.
//
// Transcripts arrive either as digits ("4111 1111 1111 1111") or as words
// ("four one one one …"), so both forms are caught. Demo cards are left
// alone: seeing them on the board is part of the demo.

import { digitsOf, isDemoCard, type DemoCard } from '../domain/payments.ts';

const DIGIT_RUN = /\d(?:[\s-]*\d){11,18}/g;
const WORD = '(?:zero|oh|o|one|two|three|four|five|six|seven|eight|nine|double|triple|\\d)';
const WORD_RUN = new RegExp(`\\b${WORD}(?:[\\s,.-]+${WORD}\\b){11,}`, 'gi');

export const REDACTED = '[card number removed]';

export function redactCardNumbers(text: string, cards: DemoCard[]): { text: string; redacted: number } {
  let redacted = 0;
  const replace = (match: string) => {
    const digits = digitsOf(match);
    if (digits.length < 12 || digits.length > 19) return match;
    if (isDemoCard(digits, cards)) return match;
    redacted++;
    return REDACTED;
  };
  const out = text.replace(DIGIT_RUN, replace).replace(WORD_RUN, replace);
  return { text: out, redacted };
}
