// What every builder checks before Start, whatever the business: a name, a
// greeting that says it is an AI on a demo line, and hours that make sense.

import { closeMinutes, minutesOf } from '../../domain/time.ts';
import type { BaseAnswers, Issue } from './types.ts';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function validateBase(a: BaseAnswers, noun: string): Issue<'basics' | 'hours'>[] {
  const out: Issue<'basics' | 'hours'>[] = [];
  const err = (step: 'basics' | 'hours', message: string) => out.push({ step, level: 'error', message });
  if (!a.basics.name) err('basics', `Give the ${noun} a name.`);
  // Callers must always know they are talking to an AI, on a demo line.
  if (a.basics.greeting && (!/\bAI\b/.test(a.basics.greeting) || !/\bdemo\b/i.test(a.basics.greeting))) {
    err('basics', 'The greeting must say it is an AI assistant and that this is a demo line.');
  }
  if (!a.hours.days.some((d) => d.open && d.services.length)) err('hours', 'Open on at least one day.');
  a.hours.days.forEach((d, i) => {
    for (const s of d.open ? d.services : []) {
      if (closeMinutes(s.close) <= minutesOf(s.open)) err('hours', `${DAY_NAMES[i]}: ${s.label} closes before it opens.`);
    }
  });
  return out;
}
