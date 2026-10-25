// What the estate agent builder shows as still missing or wrong before
// Start (presets/estate-agent.md §3). Errors stop Start: a diary nobody can
// be booked into, or a home that points at someone who is not in the team.
// Warnings are what a careful agency would fix before going live.

import type { Issue } from '../common/types.ts';
import { validateBase } from '../common/validate.ts';
import type { EstateAnswers } from './answers.ts';
import type { ListingAnswer } from './listings.ts';
import type { EstateStep } from './steps.ts';

/** Price, tenure, the council tax band and the EPC: what every advert must state. */
export function missingPartA(l: ListingAnswer): string[] {
  return [
    l.price_pence ? null : 'price',
    l.tenure !== 'unknown' ? null : 'tenure',
    l.local_tax ? null : 'council tax band',
    l.epc ? null : 'EPC',
  ].filter((x): x is string => x !== null);
}

const homeName = (l: ListingAnswer) => `${l.number} ${l.street}`.trim() || 'A home';

export function validateEstate(a: EstateAnswers): Issue<EstateStep>[] {
  const out: Issue<EstateStep>[] = validateBase(a, 'estate agency');
  const err = (step: EstateStep, message: string) => out.push({ step, level: 'error', message });
  const warn = (step: EstateStep, message: string) => out.push({ step, level: 'warning', message });
  const staff = new Set(a.team.map((t) => t.key));

  if (!a.patch.districts.length) err('patch', 'Add at least one postcode district you cover.');
  if (a.patch.lettings === 'message' && !staff.has(a.patch.lettings_contact)) err('patch', 'Choose who in the team lettings messages go to.');

  if (!a.team.some((t) => t.does.includes('viewings') && t.days.length)) err('team', 'Someone in the team must do viewings.');
  if (!a.team.some((t) => t.does.includes('valuations') && t.days.length)) err('team', 'Someone in the team must do valuations.');
  for (const t of a.team) {
    if (!t.name) err('team', 'Every member of the team needs a name.');
    else if (!t.days.length) err('team', `${t.name} works no days: pick at least one.`);
  }
  if (a.diary.on_call && !staff.has(a.diary.on_call)) err('hours', 'The person on call is not in the team.');
  if (!staff.has(a.compliance.complaints_handler)) err('services', 'Choose who handles complaints from the team.');
  if (!staff.has(a.compliance.data_lead)) err('services', 'Choose who leads on data protection from the team.');
  if (a.partners.mortgage.on && !staff.has(a.partners.mortgage.staff)) err('services', 'Choose the mortgage adviser from the team.');
  if (a.valuations.rics.offered && !staff.has(a.valuations.rics.staff)) err('offers', 'Choose who does RICS valuations from the team.');

  const seen = new Set<string>();
  for (const l of a.listings) {
    const name = homeName(l);
    if (!l.street) err('listings', 'Every home needs a street.');
    const where = `${l.number}|${l.street}`.toLowerCase();
    if (l.street && seen.has(where)) err('listings', `${name} is listed twice.`);
    seen.add(where);
    if (!staff.has(l.negotiator)) err('listings', `${name}: choose its negotiator from the team.`);
    if (l.personal_interest) {
      if (!staff.has(l.personal_interest.staff)) err('listings', `${name}: the personal interest names someone not in the team.`);
      if (!l.personal_interest.wording) warn('listings', `${name}: say how the personal interest is disclosed to buyers.`);
    }
    if ((l.tenure === 'leasehold' || l.tenure === 'shared_ownership') && !l.lease) err('listings', `${name}: add the lease details.`);
    if (l.status === 'available') {
      const missing = missingPartA(l);
      if (missing.length) warn('listings', `${name} is missing its ${missing.join(', ')}.`);
    }
    // Compile leaves out hours with no days; with none left, the seller's limits are gone, which the agent must know.
    const dayless = l.viewing.windows.filter((w) => !w.days.length).length;
    if (dayless && dayless === l.viewing.windows.length) warn('listings', `${name}: its viewing hours have no days ticked, so viewings can be booked any time in your viewing hours.`);
    else if (dayless) warn('listings', `${name}: ${dayless === 1 ? 'one set' : `${dayless} sets`} of viewing hours ${dayless === 1 ? 'has' : 'have'} no days ticked, so ${dayless === 1 ? 'it is' : 'they are'} left out.`);
    const unknown = Object.values(l.checks).filter((c) => c.v === 'unknown').length;
    if (unknown > 5) warn('listings', `${name} has ${unknown} checks still unknown: callers will hear "that isn't in the details".`);
  }

  const unanswered = [...a.area.faqs, ...a.policies.faqs].filter((f) => !f.q || !f.a).length;
  if (unanswered) warn('policies', `${unanswered} question${unanswered === 1 ? ' needs' : 's need'} both the question and its answer before the receptionist can use ${unanswered === 1 ? 'it' : 'them'}.`);
  if (a.partners.mortgage.on && !a.partners.mortgage.statement) warn('services', 'Add the mortgage partner\'s approved sentence, with its FCA status.');
  if (a.fees.quote && !a.fees.min_weeks) warn('services', 'Fees are quoted: add the minimum term of the agreement.');
  return out;
}
