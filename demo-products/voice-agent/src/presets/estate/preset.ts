// The estate agent as the server sees it: the hooks of PRESETS.md §2.2
// (presets/estate-agent.md §3 and §6). The builder's preview lists lines;
// the back office is a diary of the team, the homes, the offers, messages
// and calls. Homes are never imported from a website: a real home's photos
// and address next to invented offers would point at a real house.

import { initialLive, listingSummary } from '../../domain/listings.ts';
import { toLocal } from '../../domain/time.ts';
import type { TenantProfile } from '../../domain/types.ts';
import { applyBaseScan } from '../../scout/map.ts';
import type { Preset, WorkspaceSpec } from '../index.ts';
import { hoursSentence } from '../common/hours.ts';
import { VERSION, defaultAnswers, type EstateAnswers } from './answers.ts';
import { NOUN, appraisalSentence, compileEstate, daysWords, durationWords, firstName, nameOf, patchSentence } from './compile.ts';
import { suggestions } from './featured.ts';
import { NATION_PACKS } from './nations.ts';
import { sanitiseEstate } from './sanitise.ts';
import { planEstateSeed } from './seed.ts';
import { STEPS } from './steps.ts';
import { missingPartA, validateEstate } from './validate.ts';

/** What the receptionist does itself, so the FAQ draft leaves it out. */
export const ESTATE_HANDLES = 'finding homes, booking viewings and valuations, or taking offers';

const STATUS_ORDER = ['available', 'under_offer', 'sale_agreed', 'exchanged', 'coming_soon', 'withdrawn'] as const;
const STATUS_WORDS: Record<string, string> = {
  available: 'available', under_offer: 'under offer', sale_agreed: 'sale agreed', exchanged: 'exchanged', coming_soon: 'coming soon', withdrawn: 'withdrawn',
};

const join = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] ?? '');

/** The builder's preview pane: what the receptionist will say, and what it can book (rule 7: lines). */
export function estatePreview(a: EstateAnswers, profile: TenantProfile, now = new Date()): { lines: string[] } {
  const lines = [profile.greeting];
  const n = a.listings.length;
  const counts = STATUS_ORDER.map((s) => [s, a.listings.filter((l) => l.status === s).length] as const).filter(([, c]) => c);
  lines.push(n ? `${n} listing${n === 1 ? '' : 's'}: ${counts.map(([s, c]) => `${c} ${STATUS_WORDS[s]}`).join(', ')}.` : 'No listings yet: add your homes, or start from the sample.');
  const missing = a.listings.filter((l) => l.status === 'available' && missingPartA(l).length).length;
  if (missing) lines.push(`${missing} listing${missing === 1 ? ' is' : 's are'} missing Part A facts.`);
  const show = a.team.filter((t) => t.does.includes('viewings')).map(firstName);
  const value = a.team.filter((t) => t.does.includes('valuations')).map(firstName);
  lines.push(
    `Viewings: ${a.viewings.minutes} minutes, with ${a.viewings.travel_minutes} minutes to travel` +
      `${show.length ? `; ${join(show)} ${show.length === 1 ? 'shows' : 'show'} homes` : ''}${value.length ? `; ${join(value)} ${value.length === 1 ? 'values' : 'value'}` : ''}.`,
  );
  const sample = profile.listings?.find((l) => l.initial.status === 'available');
  if (sample) lines.push(listingSummary(sample, initialLive(sample, now), toLocal(now, profile.timezone).date, a.patch.nation));
  return { lines };
}

/** What the FAQ draft is told about the agency: its own answers, as plain facts, and no homes. */
export function factSheet(a: EstateAnswers): string {
  const team = a.team.map((t) => `${firstName(t)} (${t.role}${t.does.length ? `: ${t.does.join(', ')}` : ''})`).join(', ');
  const fee = a.fees.quote
    ? `quoted: ${a.fees.kind === 'percent' ? `${a.fees.percent_hundredths / 100}%` : `£${a.fees.fixed_pence / 100}`} including VAT, ${a.fees.min_weeks} weeks ${a.fees.contract.replace('_', ' ')}`
    : `explained at the ${a.valuations.name}, not on the phone`;
  return [
    `Name: ${a.basics.name || 'the estate agency'}. Style: ${a.basics.style}. Address: ${a.basics.address || a.basics.town}. Sells homes in ${NATION_PACKS[a.patch.nation].name}.`,
    `Patch: ${patchSentence(a)} Lettings: ${a.patch.lettings === 'none' ? 'sales only' : `lettings calls taken as a message for ${nameOf(a, a.patch.lettings_contact) || 'the team'}`}.`,
    `Office hours: ${hoursSentence(a.hours)}`,
    `Viewings: ${daysWords(a.diary.viewing_days)}; ${a.viewings.minutes} minutes each. Valuations: ${daysWords(a.diary.valuation_days)}. ${appraisalSentence(a)}`,
    `Team: ${team}.`,
    `RICS valuations: ${a.valuations.rics.offered ? 'yes' : 'no'}. Fees: ${fee}. Marketing: ${a.fees.marketing.join(', ')}.`,
    `Buyers: ${a.offers.buyer_fee_pence ? `£${a.offers.buyer_fee_pence / 100} including VAT each for ID checks, ${a.offers.buyer_fee_when}, by ${a.offers.id_provider}` : 'pay nothing'}.`,
    `Mortgage partner: ${a.partners.mortgage.on ? `${a.partners.mortgage.firm}. ${a.partners.mortgage.statement}` : 'none'}. Conveyancing panel: ${a.partners.conveyancing.on ? 'yes' : 'no'}.`,
    `Redress scheme: ${a.compliance.redress === 'tpo' ? 'The Property Ombudsman' : 'the Property Redress Scheme'}. Complaints: ${nameOf(a, a.compliance.complaints_handler) || 'the manager'}.`,
    `Parking: ${a.policies.parking} At viewings: ${a.policies.at_viewings} Appraisals take ${durationWords(a.valuations.minutes)}.`,
    `Area guide: ${a.area.faqs.filter((f) => f.q && f.a).map((f) => `${f.q} ${f.a}`).join(' ')}`,
  ].join('\n');
}

/**
 * The agency's back office (presets/estate-agent.md §6, the M1 views): a
 * diary with a row for each member of the team, the homes, the offers,
 * messages and calls. Applicants, valuations and sales progress join in
 * later milestones.
 */
export function estateWorkspace(profile: TenantProfile): WorkspaceSpec {
  return {
    views: [
      { id: 'timeline', label: 'Diary', of: 'staff' },
      { id: 'properties', label: 'Properties' },
      { id: 'offers', label: 'Offers' },
      { id: 'messages', label: 'Messages' },
      { id: 'calls', label: 'Calls' },
    ],
    bookings: {
      resource: 'person', resources: 'team', party: null,
      visit: { expected: 'Booked', finished: 'Done', no_show: 'No-show' },
      allergies: false, combine: false, property: true,
    },
    teamPhones: (profile.team ?? []).filter((t) => t.mobile).map((t) => ({ name: t.first_name, phone: t.mobile })),
    suggestions: suggestions(profile),
    resetLine: 'viewings, valuations, offers and sales',
  };
}

export const estateAgent: Omit<Preset<EstateAnswers>, 'info'> = {
  VERSION,
  defaults: defaultAnswers,
  sanitise: sanitiseEstate,
  steps: STEPS,
  validate: validateEstate,
  compile: compileEstate,
  seed: planEstateSeed,
  preview: (a, profile) => estatePreview(a, profile),
  factSheet,
  handles: ESTATE_HANDLES,
  scan: { parts: ['identity', 'hours', 'theme'], apply: applyBaseScan },
  workspace: estateWorkspace,
};

export { NOUN };
