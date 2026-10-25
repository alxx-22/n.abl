// "Describe your stock" (presets/estate-agent.md §12, M3): the Listings step
// drafts homes from a few words about what the agency sells. Every address is
// made up, on a street from STREETS in the agency's own districts; every
// checklist answer is left unknown for the owner to fill in; and each home is
// marked an example, so nobody takes one for a real home.

import type { Config } from '../../config.ts';
import { generateJson } from '../../core/gemini.ts';
import { CHECK_KEYS } from '../../domain/types.ts';
import { PresetError } from '../common/errors.ts';
import type { EstateAnswers } from './answers.ts';
import { HOME_TYPES, MAX_LISTINGS, QUALIFIERS, TENURES, sanitiseListing, type ListingAnswer } from './listings.ts';

/** Ordinary English street names, none of them anyone's real address in the made-up town. */
export const STREETS = [
  'Acorn Close', 'Beech Grove', 'Bramble Lane', 'Chapel Street', 'Clover Way', 'Coppice Road', 'Damson Drive', 'Fern Hill',
  'Foxglove Rise', 'Glebe Road', 'Hawthorn Avenue', 'Holly Walk', 'Juniper Court', 'Lavender Close', 'Linden Road', 'Maple Gardens',
  'Mill Race', 'Nightingale Lane', 'Oak Tree Close', 'Primrose Hill', 'Quarry Lane', 'Rowan Way', 'Sorrel Drive', 'Thistle Road',
];

export interface StockBrief {
  description: string;
  homes: number;
}

/** The request's brief: the owner's words, and how many homes (3 to 12, 8 if not said). */
export function stockBrief(b: unknown): StockBrief {
  const x = (b ?? {}) as { description?: unknown; homes?: unknown };
  const description = typeof x.description === 'string' ? x.description.trim().slice(0, 600) : '';
  const n = Math.round(Number(x.homes));
  return { description, homes: Number.isFinite(n) ? Math.min(12, Math.max(3, n)) : 8 };
}

export interface DraftedHome {
  street?: string;
  number?: string;
  district?: string;
  type?: string;
  beds?: number;
  baths?: number;
  receptions?: number;
  price_pounds?: number;
  qualifier?: string;
  tenure?: string;
  lease_years_left?: number;
  local_tax?: string;
  epc?: string;
  summary?: string;
  features?: string[];
  rooms?: { name?: string; size?: string }[];
}

const stockSchema = {
  type: 'OBJECT',
  properties: {
    homes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          street: { type: 'STRING', enum: STREETS },
          number: { type: 'STRING', description: 'A house number, or "Flat 2, 14" for a flat.' },
          district: { type: 'STRING' },
          type: { type: 'STRING', enum: [...HOME_TYPES] },
          beds: { type: 'INTEGER' },
          baths: { type: 'INTEGER' },
          receptions: { type: 'INTEGER' },
          price_pounds: { type: 'INTEGER' },
          qualifier: { type: 'STRING', enum: QUALIFIERS.filter((q) => q !== 'share') },
          tenure: { type: 'STRING', enum: TENURES.filter((t) => t !== 'unknown') },
          lease_years_left: { type: 'INTEGER', description: 'Leasehold only.' },
          local_tax: { type: 'STRING', description: 'Council tax band, A to H.' },
          epc: { type: 'STRING', description: 'EPC rating, A to G.' },
          summary: { type: 'STRING', description: 'One factual sentence, under 25 words, no selling words.' },
          features: { type: 'ARRAY', items: { type: 'STRING' } },
          rooms: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, size: { type: 'STRING' } }, required: ['name'] } },
        },
        required: ['street', 'number', 'type', 'beds', 'price_pounds', 'tenure', 'summary'],
      },
    },
  },
  required: ['homes'],
};

/** "2026-10-05" plus whole years, for a lease's end. */
const yearsOn = (day: string, years: number) => `${Number(day.slice(0, 4)) + years}${day.slice(4)}`;

/**
 * The model's homes as builder answers: streets from STREETS only, districts
 * and the town the agency's own, each number and street once, prices rounded
 * to £5,000, a lease for every leasehold home, every check unknown.
 */
export function listingsFromDraft(d: { homes?: DraftedHome[] } | null | undefined, a: EstateAnswers, today: string): ListingAnswer[] {
  const districts = a.patch.districts.length ? a.patch.districts : ['BK1'];
  const town = a.patch.towns[0] ?? a.basics.town ?? '';
  const negotiator = a.team.find((m) => m.does.includes('viewings') && m.days.length)?.key ?? a.team[0]?.key ?? '';
  const seen = new Set<string>();
  const out: ListingAnswer[] = [];
  for (const [i, h] of (d?.homes ?? []).slice(0, MAX_LISTINGS).entries()) {
    const street = STREETS.includes(h.street ?? '') ? h.street! : STREETS[i % STREETS.length];
    let number = (h.number ?? '').trim() || String(2 + i * 3);
    while (seen.has(`${number}|${street}`)) number = `${number}A`;
    seen.add(`${number}|${street}`);
    const tenure = (TENURES as readonly string[]).includes(h.tenure ?? '') ? h.tenure! : 'freehold';
    const leased = tenure === 'leasehold' || tenure === 'share_of_freehold' || tenure === 'shared_ownership';
    const years = Math.min(990, Math.max(40, Math.round(Number(h.lease_years_left) || 125)));
    const pounds = Math.min(5_000_000, Math.max(50_000, Math.round((Number(h.price_pounds) || 250_000) / 5000) * 5000));
    const raw = {
      key: `draft_${i + 1}`, ref: `HG${400 + i}`, number, street,
      district: districts.includes(h.district ?? '') ? h.district : districts[i % districts.length], town,
      status: 'available', price_pence: pounds * 100,
      qualifier: (QUALIFIERS as readonly string[]).includes(h.qualifier ?? '') && h.qualifier !== 'share' ? h.qualifier : 'guide',
      marketed_days_ago: 3 + i * 5, reduced: null, back_on_market_days_ago: null, viewings_from_days: null,
      type: h.type, beds: h.beds, baths: h.baths ?? 1, receptions: h.receptions ?? 1,
      features: h.features ?? [], summary: h.summary ?? '', rooms: (h.rooms ?? []).map((r) => ({ name: r.name ?? '', size: r.size ?? '' })),
      tenure,
      lease: leased ? {
        expires: yearsOn(today, years), service_charge: '', ground_rent: '', reserve_fund: '', event_fee: '', managing_agent: '', age_limit: null,
        shared: tenure === 'shared_ownership' ? { share_percent: 50, rent_pence_month: 0, provider: '', eligibility: '', nomination_weeks: 0 } : null,
      } : null,
      local_tax: /^[A-H]$/i.test(h.local_tax ?? '') ? h.local_tax!.toUpperCase() : '',
      epc: /^[A-G]$/i.test(h.epc ?? '') ? h.epc!.toUpperCase() : '',
      // Nothing about flooding, rights of way or the rest is invented: the owner answers each.
      checks: Object.fromEntries(CHECK_KEYS.map((k) => [k, { v: 'unknown', note: '' }])),
      say_up_front: [], seller_position: '', fall_through: '',
      viewing: { windows: [], notice_hours: 24, occupied: 'owner', key_held: false },
      negotiator, personal_interest: null, other_agents: '',
      links: { brochure: true, floorplan: true, video: false, epc: true },
      example: true,
    };
    out.push(sanitiseListing(raw, raw.key));
  }
  return out;
}

/** Asks the text model for the homes, then makes them answers. Throws PresetError (400) with nothing to go on. */
export async function draftStock(body: unknown, a: EstateAnswers, config: Config, today: string): Promise<ListingAnswer[]> {
  const brief = stockBrief(body);
  if (!brief.description) throw new PresetError(400, 'Describe the homes you sell first.');
  const prompt = [
    'Write realistic homes for sale for a UK estate agency, for a demo of an AI phone receptionist. Every home is made up.',
    `The agency covers ${a.patch.towns.join(', ') || a.basics.town || 'a small town'} (postcode districts ${a.patch.districts.join(', ') || 'BK1'}).`,
    `The owner describes what they sell: "${brief.description}"`,
    `${brief.homes} homes, varied as that description suggests. Use only these streets: ${STREETS.join(', ')}.`,
    'Prices in whole pounds, typical for each home. Flats are leasehold, with the years left on the lease. Council tax bands A to H; EPC ratings A to G.',
    'The summary is one plain, factual sentence: no "stunning", "must see" or other selling words. Features from: garden, parking, garage, step-free, en-suite, conservatory, utility room, home office, no chain.',
    'Rooms: the main ones, with sizes like "4.2m x 3.6m", or no size if it would not be measured.',
  ].join('\n');
  const d = await generateJson<{ homes: DraftedHome[] }>(config.textModel, prompt, config.keys.text, stockSchema, { temperature: 0.7 });
  const homes = listingsFromDraft(d, a, today);
  if (!homes.length) throw new Error('The draft came back empty. Try again, or describe the homes in a little more detail.');
  return homes;
}
