// What the property maintenance builder shows as still missing or wrong
// before Start (presets/property-maintenance.md §3). Errors stop Start: a
// trade nobody can do, gas work with no Gas Safe engineer, a night with no
// one to send to a gas leak. Warnings are what a careful contractor would fix
// before going live.

import { minutesOf } from '../../domain/time.ts';
import type { Issue } from '../common/types.ts';
import { validateBase } from '../common/validate.ts';
import { inSentence, type MaintenanceAnswers } from './answers.ts';
import type { MaintenanceStep } from './steps.ts';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function validateMaintenance(a: MaintenanceAnswers): Issue<MaintenanceStep>[] {
  // Office hours sit on the Visits step.
  const out: Issue<MaintenanceStep>[] = validateBase(a, 'business').map((i) => ({ ...i, step: i.step === 'hours' ? 'visits' : i.step }));
  const err = (step: MaintenanceStep, message: string) => out.push({ step, level: 'error', message });
  const warn = (step: MaintenanceStep, message: string) => out.push({ step, level: 'warning', message });
  const engineers = new Map(a.engineers.map((e) => [e.key, e]));
  const working = a.engineers.filter((e) => e.days.length);
  const tradesOn = a.trades.filter((t) => t.on);
  const gasOn = tradesOn.some((t) => t.gas);
  const gasTrades = new Set(a.trades.filter((t) => t.gas).map((t) => t.key));

  if (!a.area.districts.length) err('area', 'Add at least one postcode district you cover.');

  const c = a.customers;
  if (!(c.homeowners || c.landlords || c.agents || c.blocks || c.social.on || c.commercial || c.insurers)) err('customers', 'Choose at least one kind of customer.');
  for (const cl of a.clients) {
    if (!cl.name) { err('customers', 'Every client needs a name.'); continue; }
    if ((cl.po_required || cl.works_limit_pence > 0) && (!cl.contact.name || !cl.contact.phone)) err('customers', `${cl.name}: add the contact who approves work, with their phone.`);
    if (cl.status === 'on_stop') warn('customers', `${cl.name} is on stop: the receptionist won't book work for them.`);
  }
  // The prospect's own homes: an address to find, someone to ring as, and inside the area.
  const clientKeys = new Set(a.clients.map((x) => x.key));
  for (const p of a.properties) {
    const where = [p.number, p.street].filter(Boolean).join(' ') || 'A property of yours';
    if (!p.number || !p.street || !p.district) err('customers', `${where}: add the house number or name, the street and the postcode district.`);
    else if (!a.area.districts.includes(p.district)) warn('customers', `${where} is in ${p.district}, outside your area: callers about it will hear you don't cover it.`);
    if (!p.occupant.phone) warn('customers', `${where}: add who lives there and their phone, to ring as them on the demo phone.`);
    if (p.client && !clientKeys.has(p.client)) warn('customers', `${where}: its client has been removed, so it's a homeowner's own.`);
  }
  if (c.social.on && !c.social.agent_of_landlord) warn('customers', "Social housing is on, but you haven't said you act as the landlord's agent, so damp and mould clocks are the landlord's to start.");

  if (!tradesOn.length) err('trades', 'Turn on at least one trade.');
  for (const t of tradesOn) {
    const doers = working.filter((e) => e.trades.includes(t.key) && (!t.gas || e.gas_safe));
    if (!doers.length) err('engineers', t.gas ? `${t.label} is gas work: it needs an engineer with a Gas Safe number.` : `No engineer does ${inSentence(t.label)}: add one, or turn it off.`);
  }
  for (const d of a.dont_do) if (!d.suggest) warn('trades', `Say who to suggest for ${d.what}.`);

  for (const e of a.engineers) {
    if (!e.name) { err('engineers', 'Every engineer needs a name.'); continue; }
    if (!e.days.length) err('engineers', `${e.name} works no days: pick at least one.`);
    if (!e.trades.length) warn('engineers', `${e.name} has no trades, so is never booked.`);
    // Only a Gas Safe registered engineer may do gas work (Gas Safety (Installation and Use) Regulations 1998).
    const gasWork = e.trades.filter((t) => gasTrades.has(t));
    if (gasWork.length && !e.gas_safe) err('engineers', `${e.name} is down for gas work: add their Gas Safe number, or take the gas trades off.`);
  }
  for (const n of a.on_call.nights) {
    const night = `${DAY_NAMES[n.day]} night`;
    if (n.engineers.some((k) => !engineers.has(k))) err('engineers', `${night}'s rota names someone who isn't one of your engineers.`);
    const on = n.engineers.map((k) => engineers.get(k)).filter((e) => e !== undefined);
    if (gasOn && !on.some((e) => e.gas_safe)) err('engineers', `${night}: put a Gas Safe engineer on call.`);
    else if (!on.length) warn('engineers', `Nobody is on call on ${night}.`);
  }
  if (!a.on_call.duty_manager.name || !a.on_call.duty_manager.mobile) warn('engineers', "Add the duty manager's name and mobile, for emergencies nobody accepts.");

  const p = a.priorities;
  if (p.emergency.attend_hours >= p.urgent.working_days * 24) err('priorities', 'The emergency target must be shorter than the urgent one.');
  if (p.urgent.working_days >= p.routine.working_days) err('priorities', 'The urgent target must be shorter than the routine one.');

  const w = a.visits.windows;
  if (!w.length) err('visits', 'Add at least one visit window.');
  for (const x of w) {
    if (minutesOf(x.to) <= minutesOf(x.from)) err('visits', `The ${inSentence(x.label)} window ends before it starts.`);
    if (!x.days.length) warn('visits', `The ${inSentence(x.label)} window has no days ticked, so it is never offered.`);
  }
  // An all-day window may hold the morning and the afternoon; only a part overlap muddles which one a job is in.
  const reported = new Set<string>();
  for (const x of w) for (const y of w) {
    if (x === y || reported.has(`${y.key}|${x.key}`)) continue;
    const shared = x.days.filter((d) => y.days.includes(d));
    const [xf, xt, yf, yt] = [minutesOf(x.from), minutesOf(x.to), minutesOf(y.from), minutesOf(y.to)];
    const nested = (xf <= yf && yt <= xt) || (yf <= xf && xt <= yt);
    const same = xf === yf && xt === yt;
    if (shared.length && xf < yt && yf < xt && (same || !nested)) {
      err('visits', `The ${inSentence(x.label)} and ${inSentence(y.label)} windows overlap on ${DAY_NAMES[shared[0]]}.`);
      reported.add(`${x.key}|${y.key}`);
    }
  }

  if (!a.prices.vat_registered) warn('prices', "You're not VAT registered, so callers hear your prices as they are, with no VAT.");
  // A gas safety record renewed more than 2 months early loses its date, so a reminder sent sooner invites a costly booking.
  if (a.planned.reminder_weeks > 8) warn('planned', 'Reminders more than 8 weeks ahead invite gas safety checks booked over 2 months early, which lose the record\'s date.');

  const unanswered = a.policies.faqs.filter((f) => !f.q || !f.a).length;
  if (unanswered) warn('policies', `${unanswered} question${unanswered === 1 ? ' needs' : 's need'} both the question and its answer before the receptionist can use ${unanswered === 1 ? 'it' : 'them'}.`);
  return out;
}
