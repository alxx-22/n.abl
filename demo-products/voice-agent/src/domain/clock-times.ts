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
// Spoken: "quarter past two", "half past eleven", "ten fifteen", "eleven thirty", "two o'clock" (a live call on
// 6 October offered "Thursday at quarter past two" having checked nothing).
const HOURS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
const HOUR = `(${HOURS.join('|')})`;
const PAST = new RegExp(`\\b(quarter|half|ten|five|twenty|twenty[- ]five) (past|to) ${HOUR}\\b`, 'gi');
const SAID = new RegExp(`\\b${HOUR} (o'?clock|fifteen|thirty|forty[- ]five)\\b`, 'gi');
const PAST_MINUTES: Record<string, number> = { quarter: 15, half: 30, ten: 10, five: 5, twenty: 20, 'twenty five': 25, 'twenty-five': 25 };
const SAID_MINUTES: Record<string, number> = { oclock: 0, "o'clock": 0, fifteen: 15, thirty: 30, 'forty five': 45, 'forty-five': 45 };

/** An hour said without morning or afternoon: either. */
const bothHalves = (hour: number, minute: number) => [(hour % 12) * 60 + minute, ((hour % 12) + 12) * 60 + minute];

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
    if (ok.length) out.push({ said: m[0].trim().replace(/\.$/, ''), readings: ok });
  }
  for (const m of text.matchAll(TWENTY_FOUR)) {
    const h = Number(m[1]);
    // "2:15" said aloud is as likely the afternoon; "14:00" is only that.
    const readings = h >= 1 && h <= 12 ? bothHalves(h, Number(m[2])) : [minutes(h, Number(m[2]))!];
    out.push({ said: m[0], readings });
  }
  for (const m of text.matchAll(NOON)) out.push({ said: m[0], readings: [720] });
  for (const m of text.matchAll(PAST)) {
    const hour = HOURS.indexOf(m[3].toLowerCase());
    const by = PAST_MINUTES[m[1].toLowerCase()];
    // "Quarter to three" is 2:45.
    out.push({ said: m[0], readings: m[2].toLowerCase() === 'past' ? bothHalves(hour, by) : bothHalves((hour + 11) % 12, 60 - by) });
  }
  for (const m of text.matchAll(SAID)) {
    const by = SAID_MINUTES[m[2].toLowerCase()];
    if (by !== undefined) out.push({ said: m[0], readings: bothHalves(HOURS.indexOf(m[1].toLowerCase()), by) });
  }
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
