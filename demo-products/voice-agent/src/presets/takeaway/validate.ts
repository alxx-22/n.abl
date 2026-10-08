// What the takeaway builder shows as still missing or wrong before Start,
// each issue on the step it belongs to.

import { normaliseUkPhone } from '../../domain/phone.ts';
import type { Issue as BaseIssue } from '../common/types.ts';
import { validateBase } from '../common/validate.ts';
import { validateDeals } from '../food/deals.ts';
import { validateMenu } from '../food/menu.ts';
import { takesOrders, validateOrdering } from '../food/ordering.ts';
import type { TakeawayAnswers } from './answers.ts';
import type { TakeawayStep } from './steps.ts';

export type Issue = BaseIssue<TakeawayStep>;

export function validateTakeaway(a: TakeawayAnswers): Issue[] {
  const out: Issue[] = validateBase(a, 'takeaway');
  const o = a.ordering;
  if (!takesOrders(o)) out.push({ step: 'ordering', level: 'error', message: 'Turn on collection or delivery: a takeaway takes orders.' });
  out.push(...validateOrdering(o, 'ordering'));
  if (o.delivery.enabled && !o.delivery.drivers.length) {
    out.push({ step: 'ordering', level: 'warning', message: 'Add your drivers, so the back office can send deliveries out.' });
  }
  if (o.delivery.enabled && o.delivery.free_over_pence !== null && o.delivery.free_over_pence <= o.delivery.min_order_pence) {
    out.push({ step: 'ordering', level: 'warning', message: 'Free delivery starts at or below the minimum order, so every delivery is free.' });
  }
  out.push(...validateMenu(a.menu, 'menu', { orderable: true }));
  out.push(...validateDeals(a.deals, a.menu, 'deals'));
  // A delivery paid "when you collect" is never paid: it needs the phone or the driver.
  if (o.delivery.enabled && a.money.payment === 'collection' && a.money.pay_driver === 'no') {
    out.push({ step: 'money', level: 'error', message: 'Delivery orders need paying: take card on the phone, or let the driver take payment.' });
  }
  const notNumbers = a.after.pay_on_phone_numbers.filter((n) => !normaliseUkPhone(n));
  if (notNumbers.length) {
    out.push({ step: 'money', level: 'warning', message: `Not a UK phone number, so left off the pay-on-the-phone list: ${notNumbers.join(', ')}.` });
  }
  const unanswered = a.policies.faqs.filter((f) => !f.q || !f.a).length;
  if (unanswered) out.push({ step: 'policies', level: 'warning', message: `${unanswered} question${unanswered === 1 ? ' needs' : 's need'} both the question and its answer before the receptionist can use ${unanswered === 1 ? 'it' : 'them'}.` });
  return out;
}
