// An estate agency's words in the back office: what a home's status and
// price are called, a buyer's position as badges, money as buyers read it.

import { offerTimer, positionBadges as domainBadges } from '../../../../src/domain/listings.ts';
import type { BuyerPosition, ListingStatus, Nation, OfferStatus, PriceQualifier } from '../../../../src/domain/types.ts';

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

/**
 * FTB, Cash, AIP, Chain: what a negotiator scans for, in the domain's rule
 * (positionBadges in src/domain/listings.ts) with the chain spelt out.
 * "We're cash" with a home to sell is a chain, never a cash buyer; with
 * "anything to sell" not yet answered, not a cash buyer yet either.
 */
export function positionBadges(p: BuyerPosition | undefined): string[] {
  if (!p) return [];
  return [
    p.first_time_buyer ? 'FTB' : null,
    p.funding === 'cash' ? (p.selling === 'nothing' ? 'Cash' : null) : p.funding === 'mortgage_aip' ? 'AIP' : p.funding === 'mortgage_not_yet' ? 'No AIP yet' : null,
    p.selling === 'nothing' ? (p.first_time_buyer ? null : 'Nothing to sell') : p.selling === 'under_offer' ? 'Chain: under offer' : p.selling === 'on_market' ? 'Chain: on the market' : p.selling === 'not_on_market' ? 'Chain: not on the market' : null,
  ].filter((x): x is string => x !== null);
}

/** Every badge the domain makes from a position: a booking's own copies of them are replaced by the position as it is now. */
const POSITION_WORDS = new Set([
  ...domainBadges({ first_time_buyer: true, selling: 'on_market', funding: 'mortgage_aip' }),
  ...domainBadges({ first_time_buyer: false, selling: 'nothing', funding: 'cash' }),
]);

/** A viewing's badges: its buyer's position, plus any others it was given ("ID check" for an empty home). */
export function bookingBadges(details: { position?: unknown; badges?: unknown } | undefined): string[] {
  const given = Array.isArray(details?.badges) ? (details.badges as string[]) : [];
  if (!details?.position) return given;
  return [...positionBadges(details.position as BuyerPosition), ...given.filter((x) => !POSITION_WORDS.has(x))];
}

/** "Mon 3 Oct, 14:05", in the agency's time zone: the browser may be elsewhere. */
export const when = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone });

/**
 * How long an offer has waited to go to the seller. The colour is the
 * domain's offerTimer (amber after a day, red at two working days, bank
 * holidays skipped, in the agency's time zone); the text is plain hours.
 */
export function waited(receivedIso: string, nowMs: number, nation: Nation, timeZone: string): { text: string; level: '' | 'warn' | 'bad' } {
  const timer = offerTimer({ status: 'received', received_at: new Date(receivedIso) }, new Date(nowMs), nation, timeZone);
  const hours = Math.max(0, nowMs - new Date(receivedIso).getTime()) / 3600000;
  const text = hours < 1 ? 'just now' : hours < 24 ? `${Math.floor(hours)}h waiting` : `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h waiting`;
  return { text, level: timer === 'red' ? 'bad' : timer === 'amber' ? 'warn' : '' };
}
