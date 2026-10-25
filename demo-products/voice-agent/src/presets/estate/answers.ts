// The estate agent builder's answers (presets/estate-agent.md §2): an
// independent agency selling homes, with defaults good enough that "Next,
// Next, Next" still makes a convincing demo. Compiled into a TenantProfile
// by compile.ts; the receptionist never reads these directly.

import type { Nation, StaffDuty, StaffRole } from '../../domain/types.ts';
import type { BaseAnswers, BasicsAnswer, DayHours, FaqAnswer, HoursAnswer, Sources, ThemeAnswer } from '../common/types.ts';
import { sampleListings, type ListingAnswer } from './listings.ts';

export type { LeaseAnswer, ListingAnswer } from './listings.ts';

/** The shape of the answers today. Raise it with a migrate step (PRESETS.md §1, rule 2), so saved setups keep loading. */
export const VERSION = 1;

export const NATIONS = ['england', 'wales', 'northern_ireland'] as const satisfies readonly Nation[];
export const STAFF_ROLES = ['manager', 'negotiator', 'valuer', 'progressor', 'adviser', 'other'] as const satisfies readonly StaffRole[];
export const STAFF_DUTIES = ['viewings', 'valuations', 'progression', 'mortgage'] as const satisfies readonly StaffDuty[];
export const MAX_TEAM = 12;

export interface StaffAnswer {
  key: string;
  /** "Jess Morgan"; callers hear the first name only. */
  name: string;
  role: StaffRole;
  does: StaffDuty[];
  /** 0 = Sunday. */
  days: number[];
  /** For urgent texts; shown on the demo's phone, never sent. */
  mobile: string;
}

export interface EstateAnswers extends BaseAnswers {
  version: typeof VERSION;
  basics: BasicsAnswer;
  /** The office's hours; viewing and valuation hours are the diary's. */
  hours: HoursAnswer;
  patch: {
    /** Scotland is shown in the builder as coming later, never selectable. */
    nation: Nation;
    /** Postcode districts covered ("BK1"). */
    districts: string[];
    towns: string[];
    /** Sales only, or take lettings calls as a message. */
    lettings: 'none' | 'message';
    /** A staff key, when lettings calls are a message. */
    lettings_contact: string;
  };
  diary: {
    /** When viewings may happen: can run later than the office. */
    viewing_days: DayHours[];
    valuation_days: DayHours[];
    /** Book viewings and valuations when the office is shut. */
    out_of_hours_booking: boolean;
    /** A staff key: alerted for emergencies at homes the agency holds keys for. */
    on_call: string | null;
  };
  team: StaffAnswer[];
  listings: ListingAnswer[];
  viewings: {
    minutes: number;
    second_minutes: number;
    /** Kept clear before and after an off-site visit: there are no maps. */
    travel_minutes: number;
    /** The least notice for any viewing. */
    notice_hours: number;
    horizon_days: number;
    safety: { take_postcode: boolean; empty_office_hours_only: boolean };
  };
  offers: {
    /** Record and read back, or always an urgent message for a person. */
    take: 'record' | 'message';
    /** ID checks per buyer, including VAT (0 = none). */
    buyer_fee_pence: number;
    buyer_fee_when: string;
    id_provider: string;
    /** How best and final works, said when asked. */
    best_final: string;
  };
  valuations: {
    /** "free market appraisal". */
    name: string;
    minutes: number;
    rics: { offered: boolean; fee_pence: number; staff: string };
  };
  fees: {
    /** Off: "explained at your appraisal". */
    quote: boolean;
    kind: 'percent' | 'fixed';
    /** 120 = 1.2%, including VAT. */
    percent_hundredths: number;
    fixed_pence: number;
    min_weeks: number;
    contract: 'sole_agency' | 'multi_agency';
    includes: string;
    /** Every mandatory extra, so no fee is dripped in later. */
    extras: string;
    /** Portals and what the package includes. */
    marketing: string[];
  };
  partners: {
    /** statement: the partner's own approved words, with its FCA status. */
    mortgage: { on: boolean; staff: string; firm: string; statement: string };
    conveyancing: { on: boolean; statement: string };
  };
  compliance: {
    redress: 'tpo' | 'prs';
    complaints_handler: string;
    data_lead: string;
    /** What the receptionist says about transcripts. */
    recording: string;
  };
  /** The area guide: transport, schools, shops, parks. */
  area: { faqs: FaqAnswer[] };
  policies: { faqs: FaqAnswer[]; parking: string; at_viewings: string };
  theme: ThemeAnswer;
  sources: Sources;
}

const day = (open: string, close: string): DayHours => ({ open: true, services: [{ label: 'Open', open, close }] });
const closed = (): DayHours => ({ open: false, services: [] });
/** Sunday first, as every week is stored. */
const week = (weekday: DayHours, saturday: DayHours, sunday: DayHours = closed()): DayHours[] =>
  [sunday, structuredClone(weekday), structuredClone(weekday), structuredClone(weekday), structuredClone(weekday), structuredClone(weekday), saturday];

export function defaultTeam(): StaffAnswer[] {
  const MON_FRI = [1, 2, 3, 4, 5];
  return [
    { key: 'rachel', name: 'Rachel Hartwell', role: 'manager', does: [], days: MON_FRI, mobile: '07700 900020' },
    { key: 'jess', name: 'Jess Morgan', role: 'negotiator', does: ['viewings'], days: [1, 2, 3, 4, 5, 6], mobile: '07700 900021' },
    { key: 'tom', name: 'Tom Bennett', role: 'negotiator', does: ['viewings'], days: [2, 3, 4, 5, 6], mobile: '07700 900022' },
    { key: 'priya', name: 'Priya Shah', role: 'valuer', does: ['valuations'], days: [1, 2, 3, 4, 5, 6], mobile: '07700 900023' },
    { key: 'dan', name: 'Dan Fletcher', role: 'progressor', does: ['progression'], days: MON_FRI, mobile: '07700 900024' },
    { key: 'mark', name: 'Mark Ellis', role: 'adviser', does: ['mortgage'], days: [2, 4], mobile: '07700 900025' },
  ];
}

/** Hartwell & Green of Brackenford: an invented town, so no sample address can be a real house. */
export function defaultAnswers(): EstateAnswers {
  return {
    version: VERSION,
    basics: {
      name: '',
      style: 'Independent estate agency, sales only',
      town: 'Brackenford',
      address: '12 High Street, Brackenford BK1 2AB',
      // Ofcom's range for drama, so it rings nobody.
      phone_display: '01632 960 123',
      website: '',
      voice: 'Kore',
      greeting: '',
    },
    hours: { days: week(day('09:00', '17:30'), day('09:00', '16:00')), closures: [] },
    patch: { nation: 'england', districts: ['BK1', 'BK2', 'BK3', 'BK4', 'BK5'], towns: ['Brackenford', 'Little Haddon', 'Coldbrook'], lettings: 'none', lettings_contact: '' },
    diary: {
      viewing_days: week(day('09:00', '19:00'), day('09:00', '16:00')),
      valuation_days: week(day('09:00', '18:00'), day('09:00', '13:00')),
      out_of_hours_booking: true,
      on_call: 'rachel',
    },
    team: defaultTeam(),
    listings: sampleListings(),
    viewings: { minutes: 30, second_minutes: 45, travel_minutes: 15, notice_hours: 2, horizon_days: 21, safety: { take_postcode: true, empty_office_hours_only: true } },
    offers: {
      take: 'record',
      buyer_fee_pence: 3600,
      buyer_fee_when: 'once an offer is accepted',
      id_provider: 'Movecheck (example)',
      best_final: 'Best and final offers are made in writing by a set time, and every buyer who has offered hears at once.',
    },
    valuations: { name: 'free market appraisal', minutes: 60, rics: { offered: false, fee_pence: 0, staff: '' } },
    fees: {
      quote: false,
      kind: 'percent',
      percent_hundredths: 120,
      fixed_pence: 0,
      min_weeks: 12,
      contract: 'sole_agency',
      includes: 'Professional photos, a floorplan, a video tour, a board, accompanied viewings and feedback within 24 hours.',
      extras: '',
      marketing: ['Rightmove', 'Zoopla', 'OnTheMarket', 'professional photos', 'a floorplan', 'a video tour', 'a board', 'accompanied viewings', 'feedback within 24 hours'],
    },
    partners: {
      mortgage: {
        on: true,
        staff: 'mark',
        firm: 'Clearwater Mortgages',
        statement: 'Clearwater Mortgages is a separate firm we work with, and we may receive a referral fee. Seeing them is optional and makes no difference to any viewing or offer.',
      },
      conveyancing: { on: false, statement: '' },
    },
    compliance: {
      redress: 'tpo',
      complaints_handler: 'rachel',
      data_lead: 'rachel',
      recording: 'Calls on this demo line are transcribed so the team can see what was said.',
    },
    area: {
      faqs: [
        { q: 'How far is the station, and how long does the train take?', a: 'Brackenford station is a ten-minute walk from the High Street, with trains to the city about every half hour taking around 35 minutes.' },
        { q: 'What are the primary schools like?', a: 'There are two primary schools in town, Brackenford Church of England Primary and Mill Lane Primary. Ofsted reports are on GOV.UK, and places are allocated by the county council.' },
        { q: 'Which secondary school is it for?', a: 'Most children go to Brackenford Academy, but catchment areas change, so please check with the county council admissions team.' },
        { q: 'Is there a doctor nearby?', a: 'The Brackenford Health Centre on Station Road is the GP surgery for the town and the villages.' },
        { q: 'Are there parks nearby?', a: 'Riverside Park runs along the river from Mill Lane, and Coldbrook Common is a short drive away.' },
        { q: 'Is there parking in town?', a: 'There are two pay and display car parks off the High Street, and free parking on Sundays.' },
      ],
    },
    policies: {
      faqs: [],
      parking: 'There is free parking behind our office on the High Street.',
      at_viewings: 'Children are welcome at viewings; please leave dogs at home.',
    },
    theme: {
      accent: '#c9a24a',
      primary: '#1d3b34',
      background: '#0f1513',
      font_heading: 'system-ui',
      font_body: 'system-ui',
      logo: null,
    },
    sources: {},
  };
}
