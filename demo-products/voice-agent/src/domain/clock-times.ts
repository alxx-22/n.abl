// Times of day as people say or write them: "9am", "10:30am", "10 15 am"
// (how a spoken time is often transcribed), "14:00", "noon", and ranges
// like "11:15am to 12:30pm". An estate agency's guardrail reads them from
// both sides of a call, so a time its tools gave may be offered and one
// nothing gave is caught (a live call on 6 October offered "9am or
// 10:30am" before anything was checked).

/** Minutes after midnight, or undefined for an hour or minute that can't be. */
function minutes(hour: number, minute: number, half?: string): number | undefined {
  if (minute > 59) return undefined;
  if (half) {
    if (hour < 1 || hour > 12) return undefined;
    return ((hour % 12) + (half === 'p' ? 12 : 0)) * 60 + minute;
  }
  return hour > 23 ? undefined : hour * 60 + minute;
}

const TWELVE = /\b(\d{1,2})(?:([:.]|\s)(\d{2}))?\s?([ap])\.?m\b\.?/gi;
const TWENTY_FOUR = /\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s?[ap]\.?m\b)/gi;
const NOON = /\b(?:noon|midday)\b/gi;

/**
 * Each time said, as the readings it could be. "Flat 4 10am" might be 4:10am or 10am, so both
 * readings come back and either one known is enough.
 */
export function timesIn(text: string): { said: string; readings: number[] }[] {
  const out: { said: string; readings: number[] }[] = [];
  for (const m of text.matchAll(TWELVE)) {
    const [, h, sep, mm, half] = m;
    const readings: (number | undefined)[] = [];
    if (mm === undefined) readings.push(minutes(Number(h), 0, half.toLowerCase()));
    else {
      readings.push(minutes(Number(h), Number(mm), half.toLowerCase()));
      // "4 10am": a number before a time, not a time with minutes.
      if (sep === ' ') readings.push(minutes(Number(mm), 0, half.toLowerCase()));
    }
    const ok = readings.filter((r): r is number => r !== undefined);
    if (ok.length) out.push({ said: m[0].trim(), readings: ok });
  }
  for (const m of text.matchAll(TWENTY_FOUR)) {
    const t = minutes(Number(m[1]), Number(m[2]));
    if (t !== undefined) out.push({ said: m[0], readings: [t] });
  }
  for (const m of text.matchAll(NOON)) out.push({ said: m[0], readings: [720] });
  return out;
}

/** Every reading of every time in the text, for what may be said. */
export function knownTimes(text: string): number[] {
  return timesIn(text).flatMap((t) => t.readings);
}

const RANGE = /(\d{1,2}(?:[:.]\d{2})?\s?[ap]\.?m|\b\d{1,2}:\d{2}|noon|midday)\s*(?:to|till|until|-|–)\s*(\d{1,2}(?:[:.]\d{2})?\s?[ap]\.?m|\b\d{1,2}:\d{2}|noon|midday)/gi;

/** "11:15am to 12:30pm" → [[675, 750]]: any time inside one of a tool's ranges may be offered. */
export function rangesIn(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of text.matchAll(RANGE)) {
    const from = timesIn(m[1])[0]?.readings[0];
    const to = timesIn(m[2])[0]?.readings[0];
    if (from !== undefined && to !== undefined && from <= to) out.push([from, to]);
  }
  return out;
}
