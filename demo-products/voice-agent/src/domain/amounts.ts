// Sums of money as people say or write them: "£2,450", "£95.50", "600
// pounds", "a hundred and twenty quid", "eleven pounds fifty". The
// receptionist's tools and guardrails read prices from both sides of a
// call, so a spoken quote counts and an invented price is caught.

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const NUMBER_WORD = `(?:${[...UNITS, ...TENS.filter(Boolean), 'hundred', 'thousand', 'and', 'a'].join('|')})`;
// Pence after "pounds" are a plain number: "forty pounds a half hour" has no pence.
const PENCE_WORD = `(?:${[...UNITS, ...TENS.filter(Boolean)].join('|')})`;

/** "two thousand four hundred and fifty" → 2450; undefined for no number. */
function wordsToNumber(words: string): number | undefined {
  let total = 0;
  let part = 0;
  let any = false;
  for (const w of words.toLowerCase().split(/[\s-]+/).filter(Boolean)) {
    if (UNITS.includes(w)) part += UNITS.indexOf(w);
    else if (TENS.includes(w)) part += TENS.indexOf(w) * 10;
    else if (w === 'a') part += 1;
    else if (w === 'hundred') part = (part || 1) * 100;
    else if (w === 'thousand') {
      total += (part || 1) * 1000;
      part = 0;
    } else continue;
    if (w !== 'and') any = true;
  }
  return any ? total + part : undefined;
}

// "£10 million" (an insurance cover) is not a price, nor its "£1".
const DIGITS = /£\s?(\d[\d,]*)(?:\.(\d{2}))?(?!\d|,\d|\.\d)(?!\s*(?:million|m\b|bn|billion))|\b(\d[\d,]*)(?:\.(\d{2}))?\s*(?:pounds?|quid)\b/gi;
const WORDS = new RegExp(`\\b((?:${NUMBER_WORD}[\\s-]+)+)(?:pounds?|quid)(?:\\s+((?:${PENCE_WORD}\\b[\\s-]*)+))?`, 'gi');

/** Every sum in the text, in pence, in the order said. */
export function amountsIn(text: string): number[] {
  const out: { at: number; pence: number }[] = [];
  for (const m of text.matchAll(DIGITS)) {
    const pounds = Number((m[1] ?? m[3]).replace(/,/g, ''));
    const pence = Number(m[2] ?? m[4] ?? 0);
    if (pounds || pence) out.push({ at: m.index!, pence: pounds * 100 + pence });
  }
  for (const m of text.matchAll(WORDS)) {
    const pounds = wordsToNumber(m[1]);
    if (!pounds) continue;
    // "eleven pounds fifty": the words after are pence, when under a hundred.
    const after = m[2] ? wordsToNumber(m[2]) : undefined;
    out.push({ at: m.index!, pence: pounds * 100 + (after !== undefined && after < 100 ? after : 0) });
  }
  return out.sort((a, b) => a.at - b.at).map((x) => x.pence);
}

/** The first sum in the text, in whole pounds. Undefined if none. */
export function poundsIn(text: string): number | undefined {
  const [first] = amountsIn(text);
  return first === undefined ? undefined : Math.round(first / 100);
}
