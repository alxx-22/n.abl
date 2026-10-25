// What the barber builder shows as still missing or wrong before Start,
// each issue on the step it belongs to.

import { closeMinutes, minutesOf } from '../../domain/time.ts';
import type { Issue as BaseIssue } from '../common/types.ts';
import { DAY_NAMES, validateBase } from '../common/validate.ts';
import type { BarberAnswers } from './answers.ts';
import type { BarberStep } from './steps.ts';

export type Issue = BaseIssue<BarberStep>;

export function validateBarber(a: BarberAnswers): Issue[] {
  const out: Issue[] = validateBase(a, 'barber shop');
  const err = (step: BarberStep, message: string) => out.push({ step, level: 'error', message });
  const warn = (step: BarberStep, message: string) => out.push({ step, level: 'warning', message });
  if (!a.services.length) err('services', 'Add at least one service, with its time and price.');
  for (const s of a.services) {
    if (!s.name) err('services', 'Every service needs a name.');
    else if (!s.price_pence && !s.from) warn('services', `${s.name} has no price: callers will hear it's free.`);
  }
  if (!a.team.length) err('team', 'Add at least one barber.');
  for (const b of a.team) {
    if (!b.name) {
      err('team', 'Every barber needs a name.');
      continue;
    }
    if (!b.days.length) warn('team', `${b.name} works no days, so they can't be booked.`);
    if (!b.services.length) warn('team', `${b.name} does no services, so they can't be booked.`);
    const shut = b.days.filter((d) => !a.hours.days[d]?.open);
    if (shut.length) warn('team', `${b.name} works ${shut.map((d) => DAY_NAMES[d]).join(', ')}, when the shop is closed.`);
    for (const h of b.hours) {
      const shop = a.hours.days[h.day];
      const opens = Math.min(...(shop?.services ?? []).map((s) => minutesOf(s.open)));
      const closes = Math.max(...(shop?.services ?? []).map((s) => closeMinutes(s.close)));
      if (closeMinutes(h.close) <= minutesOf(h.open)) err('team', `${b.name}'s ${DAY_NAMES[h.day]} finishes before it starts.`);
      else if (shop?.open && (minutesOf(h.open) < opens || closeMinutes(h.close) > closes)) warn('team', `${b.name}'s ${DAY_NAMES[h.day]} hours go outside the shop's.`);
    }
  }
  const done = new Set(a.team.flatMap((b) => b.services));
  for (const s of a.services.filter((x) => x.name && !done.has(x.key))) warn('services', `No barber does ${s.name}, so it can't be booked.`);
  const unanswered = a.policies.faqs.filter((f) => !f.q || !f.a).length;
  if (unanswered) warn('policies', `${unanswered} question${unanswered === 1 ? ' needs' : 's need'} both the question and its answer before the receptionist can use ${unanswered === 1 ? 'it' : 'them'}.`);
  return out;
}
