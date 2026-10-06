// The property maintenance builder's answers (presets/property-maintenance.md
// §2): a repairs and maintenance contractor for homeowners, landlords and
// letting agents, with defaults good enough that "Next, Next, Next" still
// makes a convincing demo. Set in Nottingham, Derby and Loughborough (Alex,
// 5 October 2026); every sample address is invented and marked an example.
// Compiled into a TenantProfile by compile.ts; the receptionist never reads
// these directly.

import type { MtClientKind, MtNation } from '../../domain/types.ts';
import type { BaseAnswers, BasicsAnswer, DayHours, FaqAnswer, HoursAnswer, Sources, ThemeAnswer } from '../common/types.ts';

/** The shape of the answers today. Raise it with a migrate step (PRESETS.md §1, rule 2), so saved setups keep loading. */
export const VERSION = 1;

/** All four nations: the safety numbers are the same, and the differences are in the nation pack. */
export const MT_NATIONS = ['england', 'wales', 'scotland', 'northern_ireland'] as const satisfies readonly MtNation[];
export type { MtNation };

export const CLIENT_KINDS = ['agent', 'landlord', 'block', 'social', 'commercial', 'insurer'] as const satisfies readonly MtClientKind[];
export type ClientKind = MtClientKind;
export const MAX_CLIENTS = 20;
export const MAX_ENGINEERS = 12;
export const MAX_TRADES = 16;
export const MAX_WINDOWS = 6;

/** A window's label inside a sentence: "the morning window", but "the Saturday morning window" and "the AM window". */
export const inSentence = (label: string) =>
  /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b/.test(label) || /^.[A-Z]/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);

export interface ClientAnswer {
  key: string;
  /** "Harbour Lettings". */
  name: string;
  kind: ClientKind;
  /** A tenant's or agent's job under this goes ahead without asking (pence, including VAT). */
  works_limit_pence: number;
  /** Make-safe out of hours without asking, up to this. */
  emergency_authority_pence: number;
  po_required: boolean;
  /** The authoriser: approvals go to their phone (M2), never decided by voice. */
  contact: { name: string; phone: string; email: string };
  notice: 'every_job' | 'over_limit' | 'emergencies';
  /** For staff only ("always ring the tenant 30 minutes before"), never said to callers. */
  instructions: string;
  status: 'active' | 'on_stop';
  example: boolean;
}

export interface EngineerAnswer {
  key: string;
  /** Callers hear the first name only. */
  name: string;
  /** Trade keys. */
  trades: string[];
  /** Gas Safe licence number, or '' (no gas work). */
  gas_safe: string;
  niceic: boolean;
  oftec: boolean;
  /** 0 = Sunday. */
  days: number[];
  /** Empty: the whole area. */
  districts: string[];
  /** Jobs per visit window. */
  per_window: number;
  /** The engineer's phone in the demo; never given to callers. */
  mobile: string;
}

export interface VisitWindow {
  key: string;
  /** "AM", "Evening". */
  label: string;
  from: string;
  to: string;
  /** Added to the call-out, including VAT. */
  premium_pence: number;
  /** 0 = Sunday. */
  days: number[];
}

export interface Trade {
  key: string;
  label: string;
  on: boolean;
  /** Gas work: only a Gas Safe registered engineer may do it. */
  gas?: boolean;
}

export interface MaintenanceAnswers extends BaseAnswers {
  version: typeof VERSION;
  basics: BasicsAnswer;
  /** The office's hours; out of them, the on-call rules apply. */
  hours: HoursAnswer;
  area: {
    nation: MtNation;
    /** Postcode districts covered ("NG5"); outside them, told politely. */
    districts: string[];
    towns: string[];
  };
  /** "Who you work for": each on opens its own questions. */
  customers: {
    homeowners: boolean;
    landlords: boolean;
    /** Letting agents. */
    agents: boolean;
    /** Block and property managers (M3). */
    blocks: boolean;
    /** Social housing, with Awaab's Law clocks (M2). */
    social: { on: boolean; agent_of_landlord: boolean };
    commercial: boolean;
    insurers: boolean;
    /** A tenant whose landlord isn't a client: we contact the landlord, or treat them as a private customer. */
    tenant_no_client: 'contact_landlord' | 'private';
    /** Lockouts and tenant damage are recharged: said, never decided on the call. */
    recharge_lockouts: boolean;
  };
  clients: ClientAnswer[];
  trades: Trade[];
  /** What the business doesn't do, and who to suggest instead. */
  dont_do: { what: string; suggest: string }[];
  engineers: EngineerAnswer[];
  on_call: {
    /** 0 = Sunday; two engineer keys each night, one Gas Safe. */
    nights: { day: number; engineers: string[] }[];
    /** No acceptance in this many minutes: page the next, then the duty manager (M2). */
    escalate_minutes: number;
    /** The office manager on duty out of hours: a person, not an engineer. */
    duty_manager: { name: string; mobile: string };
  };
  priorities: {
    emergency: { attend_hours: number; make_safe_hours: number; examples: string[] };
    urgent: { working_days: number; examples: string[] };
    routine: { working_days: number; examples: string[] };
    /** Over 75, under 5, disabled, medical needs or pregnancy: one step up. */
    vulnerable_uplift: boolean;
    /** 31 October to 1 May: no heating for a vulnerable household is urgent. */
    winter_heating: boolean;
  };
  /** The only things the receptionist may suggest trying. */
  checks: { prepayment: boolean; thermostat: boolean; trip_reset: boolean; boiler_pressure: boolean };
  visits: {
    windows: VisitWindow[];
    notice_hours: number;
    horizon_days: number;
    /** An adult over 18 must be in. */
    adult_present: boolean;
    /** The engineer texts when on the way. */
    call_ahead: boolean;
    /** No access, with no notice. */
    abortive_fee_pence: number;
  };
  prices: {
    vat_registered: boolean;
    /** Call-out and the first hour, including VAT. */
    callout_pence: number;
    half_hour_pence: number;
    /** Nights and weekends. */
    ooh_first_hour_pence: number;
    minimum_pence: number;
    lockout_from_pence: number;
    /** Work over this is quoted, free. */
    free_quote_over_pence: number;
    /** Homeowners pay the call-out by (demo) card when booking (M2). */
    card_on_booking: boolean;
    account_days: number;
    guarantee_months: number;
    /** In the homeowner's confirmation text. */
    cancellation: string;
  };
  /** Planned and compliance work, including VAT. */
  planned: {
    gas_record_pence: number;
    extra_appliance_pence: number;
    boiler_service_pence: number;
    /** Both on one visit. */
    combined_pence: number;
    eicr_from_pence: number;
    /** Reminders this many weeks ahead, only where consent allows. */
    reminder_weeks: number;
  };
  /** The business's own: said when asked. */
  compliance: {
    gas_safe_number: string;
    niceic: boolean;
    napit: boolean;
    oftec: boolean;
    insurance: string;
    waste_carrier: string;
    complaints_handler: string;
    data_lead: string;
    recording: string;
  };
  policies: { faqs: FaqAnswer[]; guarantee: string; asbestos: string; parking: string; payment: string; careers: string };
  theme: ThemeAnswer;
  sources: Sources;
}

/** The eleven standard trades: gas work marked, as only a Gas Safe engineer may do it. */
export function standardTrades(): Trade[] {
  return [
    { key: 'gas_heating', label: 'Gas, boilers and heating', on: true, gas: true },
    { key: 'boiler_servicing', label: 'Boiler servicing and gas safety records', on: true, gas: true },
    { key: 'plumbing', label: 'Plumbing and leaks', on: true },
    { key: 'drainage', label: 'Drains and blockages', on: true },
    { key: 'electrical', label: 'Electrics, EICRs and PAT', on: true },
    { key: 'roofing', label: 'Roofs and gutters', on: true },
    { key: 'carpentry', label: 'Carpentry and handyman', on: true },
    { key: 'locksmith', label: 'Locks and lockouts', on: true },
    { key: 'glazing', label: 'Glazing and boarding up', on: true },
    { key: 'decorating', label: 'Decorating', on: true },
    { key: 'damp_mould', label: 'Damp and mould', on: true },
  ];
}

const day = (open: string, close: string): DayHours => ({ open: true, services: [{ label: 'Open', open, close }] });
const closed = (): DayHours => ({ open: false, services: [] });
const MON_FRI = [1, 2, 3, 4, 5];
const MON_SAT = [1, 2, 3, 4, 5, 6];

export function defaultEngineers(): EngineerAnswer[] {
  // Gas Safe numbers are invented and marked example; mobiles are in Ofcom's drama range, so they ring nobody.
  const e = (key: string, name: string, trades: string[], extra: Partial<EngineerAnswer>, mobile: string): EngineerAnswer =>
    ({ key, name, trades, gas_safe: '', niceic: false, oftec: false, days: MON_FRI, districts: [], per_window: 2, mobile, ...extra });
  return [
    e('dan', 'Dan Hughes', ['gas_heating', 'plumbing'], { gas_safe: '512345 (example)', days: MON_SAT }, '07700 900301'),
    e('callum', 'Callum Price', ['boiler_servicing', 'gas_heating', 'plumbing'], { gas_safe: '587210 (example)' }, '07700 900302'),
    e('marek', 'Marek Nowak', ['plumbing', 'drainage'], { days: MON_SAT }, '07700 900303'),
    e('priya', 'Priya Shah', ['electrical'], { niceic: true }, '07700 900304'),
    e('tom', 'Tom Reilly', ['roofing'], {}, '07700 900305'),
    e('shaz', 'Shaz Ahmed', ['carpentry'], {}, '07700 900306'),
    e('leon', 'Leon Clarke', ['locksmith', 'glazing'], { days: MON_SAT }, '07700 900307'),
    e('grace', 'Grace Okafor', ['decorating', 'damp_mould'], {}, '07700 900308'),
  ];
}

export function defaultClients(): ClientAnswer[] {
  const c = (key: string, name: string, kind: ClientAnswer['kind'], limit: number, emergency: number, po: boolean, contact: ClientAnswer['contact'], notice: ClientAnswer['notice'], instructions = ''): ClientAnswer =>
    ({ key, name, kind, works_limit_pence: limit, emergency_authority_pence: emergency, po_required: po, contact, notice, instructions, status: 'active', example: true });
  return [
    c('harbour', 'Harbour Lettings', 'agent', 25_000, 40_000, true, { name: 'Sophie Grant', phone: '07700 900401', email: 'maintenance@harbour-lettings.example' }, 'over_limit',
      'Always ring the tenant 30 minutes before arriving.'),
    c('castle_gate', 'Castle Gate Residential', 'agent', 15_000, 30_000, false, { name: 'Imran Akhtar', phone: '07700 900402', email: 'repairs@castlegate.example' }, 'every_job'),
    c('oakfield', 'Oakfield Homes', 'agent', 30_000, 40_000, false, { name: 'Natalie Byrne', phone: '07700 900403', email: 'property@oakfield.example' }, 'over_limit'),
    c('ellis', 'Mrs J Ellis', 'landlord', 20_000, 30_000, false, { name: 'Jean Ellis', phone: '07700 900404', email: '' }, 'every_job',
      'Holds quote Q-2291: a £2,450 boiler replacement at her flat.'),
    c('kaur', 'Mr R Kaur', 'landlord', 15_000, 25_000, false, { name: 'Raj Kaur', phone: '07700 900405', email: '' }, 'over_limit'),
    c('whitfield', 'Whitfield Properties', 'landlord', 25_000, 40_000, false, { name: 'Ben Whitfield', phone: '07700 900406', email: 'ben@whitfield.example' }, 'over_limit'),
    c('meadowbank', 'Meadowbank Housing', 'social', 50_000, 100_000, true, { name: 'Carl Mensah', phone: '07700 900407', email: 'repairs@meadowbank.example' }, 'every_job',
      "We act as Meadowbank's agent for repairs: report damp and mould the same day, with the time it was reported."),
  ];
}

/** Fernhill Property Care: Nottingham, Derby and Loughborough, England. */
export function defaultAnswers(): MaintenanceAnswers {
  const nights = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day: d, engineers: d % 2 ? ['dan', 'leon'] : ['callum', 'priya'] }));
  return {
    version: VERSION,
    basics: {
      name: '',
      style: 'Repairs and maintenance for homes, landlords and letting agents',
      town: 'Nottingham',
      address: 'Unit 4, Fernhill Trade Park, Nottingham NG7 (example)',
      // Ofcom's range for drama in Nottingham, so it rings nobody.
      phone_display: '0115 496 0456',
      website: '',
      voice: 'Charon',
      greeting: '',
    },
    hours: { days: [closed(), day('08:00', '17:30'), day('08:00', '17:30'), day('08:00', '17:30'), day('08:00', '17:30'), day('08:00', '17:30'), day('09:00', '12:00')], closures: [] },
    area: {
      nation: 'england',
      districts: ['NG1', 'NG2', 'NG3', 'NG4', 'NG5', 'NG6', 'NG7', 'NG8', 'NG9', 'NG10', 'NG11', 'DE1', 'DE2', 'DE3', 'DE21', 'DE22', 'DE23', 'DE24', 'LE11'],
      towns: ['Nottingham', 'Derby', 'Loughborough', 'Beeston', 'West Bridgford', 'Long Eaton'],
    },
    customers: {
      homeowners: true, landlords: true, agents: true, blocks: false,
      social: { on: true, agent_of_landlord: true }, commercial: false, insurers: false,
      tenant_no_client: 'contact_landlord', recharge_lockouts: true,
    },
    clients: defaultClients(),
    trades: standardTrades(),
    dont_do: [
      { what: 'pest control', suggest: "the council's pest service, or a member of the British Pest Control Association" },
      { what: 'lifts', suggest: "the building's lift contractor" },
      { what: 'white goods', suggest: 'the manufacturer or the shop it came from' },
      { what: 'asbestos removal', suggest: "a licensed contractor: the HSE keeps a register" },
    ],
    engineers: defaultEngineers(),
    on_call: { nights, escalate_minutes: 15, duty_manager: { name: 'Helen Ward', mobile: '07700 900310' } },
    priorities: {
      emergency: { attend_hours: 4, make_safe_hours: 24, examples: ['no heating or hot water for a vulnerable household', 'an uncontrollable leak', 'no power at all', "a door that won't lock", 'sewage coming up inside'] },
      urgent: { working_days: 3, examples: ['no heating in winter', 'a toilet not flushing (the only one)', 'a partial loss of power', 'a roof leak in heavy rain'] },
      routine: { working_days: 20, examples: ['a dripping tap', 'a sticking door', 'a cracked tile', 'a loose handrail'] },
      vulnerable_uplift: true,
      winter_heating: true,
    },
    checks: { prepayment: true, thermostat: true, trip_reset: true, boiler_pressure: true },
    visits: {
      windows: [
        { key: 'am', label: 'Morning', from: '08:00', to: '12:00', premium_pence: 0, days: MON_FRI },
        { key: 'pm', label: 'Afternoon', from: '12:00', to: '17:00', premium_pence: 0, days: MON_FRI },
        { key: 'evening', label: 'Evening', from: '17:00', to: '20:00', premium_pence: 3000, days: MON_FRI },
        { key: 'sat_am', label: 'Saturday morning', from: '09:00', to: '12:00', premium_pence: 0, days: [6] },
      ],
      notice_hours: 2,
      horizon_days: 21,
      adult_present: true,
      call_ahead: true,
      abortive_fee_pence: 4500,
    },
    prices: {
      vat_registered: true,
      callout_pence: 9500,
      half_hour_pence: 4000,
      ooh_first_hour_pence: 15000,
      minimum_pence: 9500,
      lockout_from_pence: 12000,
      free_quote_over_pence: 50000,
      card_on_booking: false,
      account_days: 14,
      guarantee_months: 12,
      cancellation: 'You can cancel free of charge until 5pm the working day before your visit.',
    },
    planned: { gas_record_pence: 7500, extra_appliance_pence: 1500, boiler_service_pence: 8500, combined_pence: 13000, eicr_from_pence: 15000, reminder_weeks: 6 },
    compliance: {
      gas_safe_number: '512345 (example)',
      niceic: true,
      napit: false,
      oftec: false,
      insurance: '£5 million public liability (example)',
      waste_carrier: 'Registered upper-tier waste carrier (example)',
      complaints_handler: 'Helen Ward',
      data_lead: 'Helen Ward',
      recording: 'Calls on this demo line are transcribed so the team can see what was said.',
    },
    policies: {
      faqs: [
        { q: 'Do you work on Sundays?', a: 'The office is closed on Sundays, but an engineer is on call for emergencies day and night.' },
        { q: 'Are your engineers DBS checked?', a: 'Yes, every engineer has a basic DBS check and carries ID. You can ask to see it at the door.' },
        { q: "Someone at my door says they're from you, but I wasn't expecting anyone", a: "We only come when a visit is booked, and we text when the engineer is on the way. If nothing is booked, we haven't sent anyone: don't let them in. If you feel unsafe, ring 999; otherwise the police on 101." },
      ],
      guarantee: 'Our workmanship is guaranteed for 12 months; parts carry the maker’s warranty.',
      asbestos: 'If we find anything that might be asbestos, we stop and arrange for it to be tested before any work goes on.',
      parking: 'Please let us know about any parking restrictions; a permit or a space on the drive helps.',
      payment: 'Homeowners pay on completion by card or bank transfer; landlords and agents on account, within 14 days.',
      careers: 'We’re always glad to hear from qualified engineers: take a message and the office will call back.',
    },
    theme: {
      accent: '#e0a23b',
      primary: '#1f3347',
      background: '#0f151b',
      font_heading: 'system-ui',
      font_body: 'system-ui',
      logo: null,
    },
    sources: {},
  };
}
