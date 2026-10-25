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

// A key safe, door or alarm code said on a call is removed before the line
// is stored or shown, for every kind of business: the digits within a few
// words after the word for it. "Alarm" alone is left: a carbon monoxide
// alarm is followed by a safety number that must stay.
const CODE_DIGIT = '(?:\\d|zero|oh|one|two|three|four|five|six|seven|eight|nine)';
const CODE_RUN = new RegExp(
  `(\\b(?:codes?|passcodes?|key ?safes?|key ?box(?:es)?|lock ?box(?:es)?|pin(?: number)?)\\b(?:[^.?!\\d]{0,30}?))(${CODE_DIGIT}(?:[\\s,.-]*${CODE_DIGIT}){2,7})\\b`,
  'gi',
);

export const CODE_REDACTED = '[code removed]';

export function redactCodes(text: string): { text: string; redacted: number } {
  let redacted = 0;
  const out = text.replace(CODE_RUN, (_, lead: string) => {
    redacted++;
    return `${lead}${CODE_REDACTED}`;
  });
  return { text: out, redacted };
}

/** What a call stores and shows: no card number but the demo's, and no access code. */
export function redactLine(text: string, cards: DemoCard[]): string {
  return redactCodes(redactCardNumbers(text, cards).text).text;
}
