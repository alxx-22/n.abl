// An estate agency's words in the back office: what a home's status and
// price are called, a buyer's position as badges, money as buyers read it.

import type { BuyerPosition, ListingStatus, OfferStatus, PriceQualifier } from '../../../../src/domain/types.ts';

export const STATUS: Record<ListingStatus, { label: string; badge: string }> = {
  coming_soon: { label: 'Coming soon', badge: 'info' },
  available: { label: 'Available', badge: 'ok' },
  under_offer: { label: 'Under offer', badge: 'warn' },
  sale_agreed: { label: 'Sale agreed', badge: 'warn' },
  exchanged: { label: 'Exchanged', badge: '' },
  completed: { label: 'Completed', badge: '' },
  withdrawn: { label: 'Withdrawn', badge: 'bad' },
};

export const QUALIFIER: Record<PriceQualifier, string> = { guide: 'Guide price', offers_over: 'Offers over', oiro: 'Offers in the region of', fixed: 'Fixed price', share: 'Price of the share' };

export const OFFER_STATUS: Record<OfferStatus, string> = { received: 'Received', sent: 'Sent to seller', accepted: 'Accepted', declined: 'Declined', countered: 'Countered', withdrawn: 'Withdrawn' };

/** "£320,000". */
export const pounds = (pence: number) => `£${Math.round(pence / 100).toLocaleString('en-GB')}`;

/** FTB, Cash, AIP, Chain: what a negotiator scans for. */
export function positionBadges(p: BuyerPosition | undefined): string[] {
  if (!p) return [];
  return [
    p.first_time_buyer ? 'FTB' : null,
    p.funding === 'cash' ? 'Cash' : p.funding === 'mortgage_aip' ? 'AIP' : p.funding === 'mortgage_not_yet' ? 'No AIP yet' : null,
    p.selling === 'nothing' ? (p.first_time_buyer ? null : 'Nothing to sell') : p.selling === 'under_offer' ? 'Chain: under offer' : p.selling === 'on_market' ? 'Chain: on the market' : p.selling === 'not_on_market' ? 'Chain: not on the market' : null,
  ].filter((x): x is string => x !== null);
}

/** "Mon 3 Oct, 14:05". */
export const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * How long an offer has waited to go to the seller, in working hours
 * (Monday to Friday): amber after a day, red at two working days.
 */
export function waited(receivedIso: string, nowMs: number): { text: string; level: '' | 'warn' | 'bad' } {
  let ms = 0;
  const step = 3600000;
  for (let t = new Date(receivedIso).getTime(); t < nowMs; t += step) {
    const d = new Date(t).getDay();
    if (d !== 0 && d !== 6) ms += Math.min(step, nowMs - t);
  }
  const hours = ms / 3600000;
  const text = hours < 1 ? 'just now' : hours < 24 ? `${Math.floor(hours)}h waiting` : `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h waiting`;
  return { text, level: hours >= 48 ? 'bad' : hours >= 24 ? 'warn' : '' };
}
