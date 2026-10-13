// The small words the back office puts on a booking or a message so the
// owner can tell them apart at a glance: which service a bar is (an afternoon
// tea has scones to bake; a group's lunch hasn't), a quiet appointment, and
// what a message is about and how soon it needs a call back. Kept out of the
// views so the rules can be tested without a browser.

import type { LiveBooking } from '../types.ts';

/**
 * A service's name short enough for a bar a few minutes wide: its last word,
 * which in English is the thing itself ("Afternoon tea" is a tea, "Sunday
 * roast" a roast). A name that is short already stays whole.
 */
export function shortService(label: string): string {
  const words = label.trim().split(/\s+/);
  const word = label.trim().length <= 8 ? label.trim() : words[words.length - 1];
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A booking the caller asked to be a quiet one (a barber's, set by the receptionist; staff can add the tag too). */
export const isQuiet = (b: Pick<LiveBooking, 'tags'>) => b.tags.some((t) => t.trim().toLowerCase() === 'quiet');

export interface MessageTag {
  label: string;
  /** A badge's tone: bad (red) for urgent, warn (amber) for today, none for what it is about. */
  tone: 'bad' | 'warn' | null;
}

/** Categories whose key doesn't read as words on its own. */
const CATEGORY: Record<string, string> = {
  group: 'Group booking',
  unwell: 'Felt unwell',
  cake_order: 'Cake order',
  hire: 'Private hire',
  careers: 'Job enquiry',
  data: 'Data request',
};

/** Said nothing an owner would sort by, so no tag. */
const SILENT = new Set(['other', 'general']);

/**
 * A message's tags, most pressing first: Urgent or Today, then what it is
 * about. "This week" is the usual pace, so it has no marker. A message from
 * before messages had either gets none and shows as it always has.
 */
export function messageTags(m: { category?: string | null; urgency?: string | null }): MessageTag[] {
  const out: MessageTag[] = [];
  if (m.urgency === 'urgent') out.push({ label: 'Urgent', tone: 'bad' });
  else if (m.urgency === 'today') out.push({ label: 'Today', tone: 'warn' });
  const c = m.category?.trim();
  if (c && !SILENT.has(c)) {
    const words = CATEGORY[c] ?? c.replace(/_/g, ' ');
    out.push({ label: words.charAt(0).toUpperCase() + words.slice(1), tone: null });
  }
  return out;
}
