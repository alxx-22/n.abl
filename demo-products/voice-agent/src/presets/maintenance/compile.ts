// Property maintenance answers → the receptionist's profile
// (presets/property-maintenance.md §4.1). Pure: the same answers always make
// the same profile. It writes the two fields only this preset writes
// (maintenance, and team with its engineers), so every new behaviour stays
// off for every other kind of business. Clients' numbers are compiled only
// to recognise an authoriser calling in; no tool reads them out.

import { normaliseUkPhone } from '../../domain/phone.ts';
import { spokenTime } from '../../domain/time.ts';
import type { KnowledgeEntry, MaintenanceSettings, MtClient, MtEngineer, StaffMember, TenantProfile } from '../../domain/types.ts';
import { baseProfile, entry, greetingFor as greetingOf, mergeFaqs } from '../common/profile.ts';
import { inSentence, type EngineerAnswer, type MaintenanceAnswers } from './answers.ts';
import { MT_NATION_PACKS, gasFact, nationKnowledge } from './nations.ts';

export const NOUN = 'property maintenance company';

export const greetingFor = (a: MaintenanceAnswers): string => greetingOf(a.basics, NOUN);

export const firstName = (e: Pick<EngineerAnswer, 'name' | 'key'>) => e.name.trim().split(/\s+/)[0] || e.key;

const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] ?? '');

/** £95, £12.50: prices are said in whole pounds when they are whole. */
export function money(pence: number): string {
  const p = Math.abs(pence);
  return `£${Math.floor(p / 100).toLocaleString('en-GB')}${p % 100 ? `.${String(p % 100).padStart(2, '0')}` : ''}`;
}

/** " including VAT", or nothing when the business isn't VAT registered: prices are then said as they are. */
const incVat = (a: Pick<MaintenanceAnswers, 'prices'>) => (a.prices.vat_registered ? ' including VAT' : '');

/** "NG1 to NG11, DE1 to DE3 and LE11": runs of three or more in order are said as a range. */
export function districtRuns(districts: string[]): string[] {
  const runs: string[][] = [];
  for (const d of districts) {
    const last = runs.at(-1)?.at(-1);
    const m = /^([A-Z]+)(\d+)$/.exec(d);
    const l = last ? /^([A-Z]+)(\d+)$/.exec(last) : null;
    if (m && l && m[1] === l[1] && Number(m[2]) === Number(l[2]) + 1) runs.at(-1)!.push(d);
    else runs.push([d]);
  }
  return runs.flatMap((r) => (r.length >= 3 ? [`${r[0]} to ${r.at(-1)}`] : r));
}

/**
 * "We cover Nottingham, Derby and Loughborough, and around: NG1 to NG11,
 * DE1 to DE3, DE21 to DE24 and LE11." With `most`, the core fact names that
 * many towns and district runs and counts the rest; the searchable answer
 * lists them all.
 */
export function areaSentence(a: MaintenanceAnswers, most = Infinity): string {
  const towns = a.area.towns.slice(0, most);
  const moreTowns = a.area.towns.length - towns.length;
  const runs = districtRuns(a.area.districts);
  const shown = runs.slice(0, most);
  const moreRuns = runs.length - shown.length;
  const where = and(moreTowns ? [...towns, `${moreTowns} more town${moreTowns === 1 ? '' : 's'}`] : towns);
  const districts = and(moreRuns ? [...shown, `${moreRuns} more`] : shown);
  if (!where && !districts) return '';
  return `We cover ${[where, districts].filter(Boolean).join(': ')}.`;
}

/** The emergency promise as a target, never a time: only the board gives a time. */
export const emergencySentence = (a: MaintenanceAnswers) =>
  `Emergencies, day and night: we aim to attend within ${a.priorities.emergency.attend_hours} hour${a.priorities.emergency.attend_hours === 1 ? '' : 's'} and make safe within ${a.priorities.emergency.make_safe_hours}.`;

export function calloutSentence(a: MaintenanceAnswers): string {
  const p = a.prices;
  return `Call-out ${money(p.callout_pence)}${incVat(a)}, with the first hour, then ${money(p.half_hour_pence)} a half hour. Nights and weekends: ${money(p.ooh_first_hour_pence)} for the first hour.`;
}

export function plannedSentence(a: MaintenanceAnswers): string {
  const pl = a.planned;
  return `A landlord's gas safety record is ${money(pl.gas_record_pence)}${incVat(a)} for one appliance, plus ${money(pl.extra_appliance_pence)} for each extra one. A boiler service is ${money(pl.boiler_service_pence)}, or ${money(pl.combined_pence)} for both on one visit.`;
}

/** "Morning 8am to 12 noon, afternoon 12 noon to 5pm, evening 5pm to 8pm (£30 extra)". */
export function windowWords(a: MaintenanceAnswers): string {
  return and(a.visits.windows.filter((w) => w.days.length).map((w) =>
    `${inSentence(w.label)} ${spokenTime(w.from)} to ${spokenTime(w.to)}${w.premium_pence ? ` (${money(w.premium_pence)} extra)` : ''}`));
}

export function compileEngineers(a: MaintenanceAnswers): MtEngineer[] {
  return a.engineers.map((e) => ({
    key: e.key,
    name: e.name,
    first_name: firstName(e),
    trades: e.trades,
    gas_safe: Boolean(e.gas_safe),
    accreditations: [e.gas_safe ? `Gas Safe ${e.gas_safe}` : '', e.niceic ? 'NICEIC' : '', e.oftec ? 'OFTEC' : ''].filter(Boolean),
    days: e.days,
    districts: e.districts,
    per_window: e.per_window,
  }));
}

export const DUTY_MANAGER_KEY = 'duty_manager';

/**
 * The engineers and the duty manager, as messages and urgent texts reach
 * them. What an engineer does is in maintenance.engineers; the team keeps
 * the estate agent's roles, so its builder and tools are unchanged.
 */
export function compileTeam(a: MaintenanceAnswers): StaffMember[] {
  const engineers: StaffMember[] = a.engineers.map((e) => ({ key: e.key, name: e.name, first_name: firstName(e), role: 'other', does: [], days: e.days, mobile: e.mobile }));
  const dm = a.on_call.duty_manager;
  if (!dm.name || engineers.some((e) => e.key === DUTY_MANAGER_KEY)) return engineers;
  return [...engineers, { key: DUTY_MANAGER_KEY, name: dm.name, first_name: firstName({ name: dm.name, key: DUTY_MANAGER_KEY }), role: 'manager', does: [], days: [0, 1, 2, 3, 4, 5, 6], mobile: dm.mobile }];
}

export function compileClients(a: MaintenanceAnswers): MtClient[] {
  return a.clients.filter((c) => c.name).map((c) => ({
    key: c.key,
    name: c.name,
    kind: c.kind,
    works_limit_pence: c.works_limit_pence,
    emergency_authority_pence: c.emergency_authority_pence,
    po_required: c.po_required,
    contact: { name: c.contact.name, phone: normaliseUkPhone(c.contact.phone), email: c.contact.email },
    notice: c.notice,
    instructions: c.instructions,
    status: c.status,
    ...(c.min_priority ? { min_priority: c.min_priority } : {}),
    ...(c.example ? { example: true } : {}),
  }));
}

export function compileSettings(a: MaintenanceAnswers): MaintenanceSettings {
  return {
    nation: a.area.nation,
    districts: a.area.districts,
    towns: a.area.towns,
    customers: structuredClone(a.customers),
    clients: compileClients(a),
    trades: a.trades.filter((t) => t.on).map((t) => ({ key: t.key, label: t.label, gas: Boolean(t.gas) })),
    dont_do: a.dont_do.filter((d) => d.what),
    engineers: compileEngineers(a),
    on_call: structuredClone(a.on_call),
    priorities: structuredClone(a.priorities),
    checks: { ...a.checks },
    // A window with no days is never offered (the builder warns), so it is left out here.
    windows: a.visits.windows.filter((w) => w.days.length).map((w) => ({ ...w })),
    visits: {
      notice_hours: a.visits.notice_hours,
      horizon_days: a.visits.horizon_days,
      adult_present: a.visits.adult_present,
      call_ahead: a.visits.call_ahead,
      abortive_fee_pence: a.visits.abortive_fee_pence,
    },
    prices: { ...a.prices },
    planned: { ...a.planned },
    gas: MT_NATION_PACKS[a.area.nation].gas.number,
    complaints_handler: a.compliance.complaints_handler,
    data_lead: a.compliance.data_lead,
  };
}

function customersSentence(a: MaintenanceAnswers): string {
  const c = a.customers;
  const who = [
    c.homeowners ? 'homeowners' : '', c.landlords ? 'landlords' : '', c.agents ? 'letting agents' : '', c.blocks ? 'block managers' : '',
    c.social.on ? 'housing associations' : '', c.commercial ? 'businesses' : '', c.insurers ? 'insurers' : '',
  ].filter(Boolean);
  return who.length ? `We work for ${and(who)}.` : '';
}

function accreditationSentence(a: MaintenanceAnswers): string {
  const co = a.compliance;
  const bodies = [co.niceic ? 'NICEIC' : '', co.napit ? 'NAPIT' : '', co.oftec ? 'OFTEC' : ''].filter(Boolean);
  return [
    co.gas_safe_number ? `Yes: we're Gas Safe registered, number ${co.gas_safe_number}, and every engineer who does gas work carries their own Gas Safe ID card.` : '',
    bodies.length ? `We're registered with ${and(bodies)}.` : '',
    co.insurance ? `We carry ${co.insurance}.` : '',
    co.waste_carrier ? `${co.waste_carrier}.` : '',
  ].filter(Boolean).join(' ').replace(/\.\./g, '.');
}

function knowledge(a: MaintenanceAnswers): KnowledgeEntry[] {
  const p = a.prices;
  const pack = MT_NATION_PACKS[a.area.nation];
  const trades = a.trades.filter((t) => t.on).map((t) => inSentence(t.label));
  const handler = a.compliance.complaints_handler || 'the office manager';
  const v = a.visits;
  return mergeFaqs([
    entry('Which areas do you cover?', `${areaSentence(a)} Outside those, we can't send an engineer, sorry.`, ['area', 'cover', 'postcode', 'where', 'come out']),
    // Semicolons, because the trades' own names have "and" in them.
    entry('What work do you do?', trades.length ? `We do ${trades.length > 1 ? `${trades.slice(0, -1).join('; ')}; and ${trades.at(-1)}` : trades[0]}.` : '', ['trades', 'work', 'do you do', 'services']),
    ...a.dont_do.filter((d) => d.what).map((d) => entry(`Do you do ${d.what}?`, `We don't do ${d.what}, sorry.${d.suggest ? ` Try ${d.suggest}.` : ''}`, [d.what, ...d.what.split(/\s+/).filter((w) => w.length > 3)])),
    entry('Who do you work for?', customersSentence(a), ['landlord', 'letting agent', 'homeowner', 'business', 'who']),
    entry("I'm a tenant: can I book a repair?", a.customers.tenant_no_client === 'contact_landlord'
      ? "Yes: tell me the address and what's wrong. If your landlord or letting agent is one of our clients, we arrange it with them; if not, we need your landlord's go-ahead first, and I can take their details."
      : "Yes: we can book it with you as a private customer at our standard prices, or you can ask your landlord first.", ['tenant', 'renting', 'rent', 'landlord']),
    entry('How much is a call-out?', `${calloutSentence(a)}${p.minimum_pence > p.callout_pence ? ` The minimum charge is ${money(p.minimum_pence)}.` : ''} Bigger jobs, over ${money(p.free_quote_over_pence)}, we quote for, free.`,
      ['price', 'cost', 'call-out', 'callout', 'charge', 'how much', 'hourly', 'rate']),
    entry('How much is it out of hours?', `Nights and weekends, the first hour is ${money(p.ooh_first_hour_pence)}${incVat(a)}. ${emergencySentence(a)}`, ['night', 'weekend', 'out of hours', 'emergency', 'evening']),
    entry('How much is a lockout?', `Lockouts start from ${money(p.lockout_from_pence)}${incVat(a)}.${a.customers.recharge_lockouts ? ' If you rent, your landlord or agent may pass the cost on to you: that is for them to decide.' : ''}`,
      ['lockout', 'locked out', 'keys', 'lost keys', 'locksmith']),
    entry('How much is a gas safety certificate?', plannedSentence(a), ['gas safety', 'gas certificate', 'cp12', 'boiler service', 'service', 'landlord certificate']),
    entry('How much is an EICR?', `An electrical installation condition report starts from ${money(a.planned.eicr_from_pence)}${incVat(a)}, depending on the size of the property.`, ['eicr', 'electrical certificate', 'electrical safety', 'electrics check']),
    entry('Do you give free quotes?', `Jobs over ${money(p.free_quote_over_pence)} are quoted, free. Smaller repairs are charged at the call-out rate, ${money(p.callout_pence)}${incVat(a)} with the first hour.`, ['quote', 'estimate', 'free']),
    entry('What time will the engineer come?', [
      `We book a window rather than a time: ${windowWords(a)}.`,
      v.call_ahead ? "The engineer texts when they're on the way." : '',
      v.adult_present ? 'Someone over 18 needs to be in.' : '',
    ].filter(Boolean).join(' '), ['what time', 'arrive', 'window', 'slot', 'when', 'morning', 'afternoon', 'evening']),
    entry("What if I'm not in?", `Let us know beforehand and we'll move the visit.${v.abortive_fee_pence ? ` If nobody's in and we weren't told, there's a ${money(v.abortive_fee_pence)} charge for the wasted visit.` : ''}`, ['not in', 'missed', 'out', 'no access', 'wasted']),
    entry('Can I cancel?', p.cancellation, ['cancel', 'cancellation', 'change my mind']),
    entry('Is your work guaranteed?', a.policies.guarantee, ['guarantee', 'warranty', 'come back']),
    entry('How do I pay?', a.policies.payment, ['pay', 'payment', 'card', 'invoice', 'account', 'bank transfer']),
    entry('Are you Gas Safe registered?', accreditationSentence(a), ['gas safe', 'registered', 'niceic', 'napit', 'oftec', 'accredited', 'qualified', 'insured', 'insurance']),
    entry('Could there be asbestos?', a.policies.asbestos ? `${a.policies.asbestos} ${pack.asbestos.replace(/^./, (ch) => ch.toUpperCase())} explains more.` : '', ['asbestos', 'artex']),
    entry('Do I need to sort out parking?', a.policies.parking, ['parking', 'permit', 'park', 'van']),
    entry('Are you hiring?', a.policies.careers, ['job', 'jobs', 'hiring', 'work for you', 'career', 'vacancy']),
    entry('How do I make a complaint?', `Tell us what went wrong and ${handler} will look into it and call you back.`, ['complain', 'complaint', 'unhappy']),
    entry('Is this call recorded?', a.compliance.recording, ['recorded', 'recording', 'transcribed', 'transcript']),
    entry('Am I talking to a real person?', "I'm an AI assistant answering for the team. If you'd rather speak to a person, I can take a message and someone will call you back.", ['real person', 'robot', 'ai', 'human']),
    entry('Can I see the data you hold about me, or stop your texts?', `${a.compliance.data_lead || 'Our data protection lead'} looks after data protection, and we reply to any request within a month. To stop our texts, reply STOP or just say so.`,
      ['data', 'gdpr', 'personal information', 'stop texts', 'unsubscribe']),
    ...nationKnowledge(a.area.nation),
  ], a.policies.faqs.filter((f) => f.q && f.a));
}

export function compileMaintenance(a: MaintenanceAnswers, meta: { slug: string }): TenantProfile {
  return {
    ...baseProfile(a, meta, {
      businessType: 'property_maintenance',
      hoursMax: 160,
      noun: NOUN,
      facts: [areaSentence(a, 4), emergencySentence(a), calloutSentence(a), gasFact(a.area.nation)],
    }),
    knowledge: knowledge(a),
    team: compileTeam(a),
    maintenance: compileSettings(a),
  };
}
