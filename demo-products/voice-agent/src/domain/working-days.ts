// Working days for a nation: weekends and its bank holidays off. Clocks
// and targets count them (an estate agency's offer timers, a contractor's
// repair targets and EICR remedials). Scotland's bank holidays differ:
// 2 January, the first Monday of August and St Andrew's Day, with no
// Easter Monday or late August.

import { addDays, weekdayOf } from './time.ts';

export type DayNation = 'england' | 'wales' | 'scotland' | 'northern_ireland';

/** As observed (substitute days included), 2026 and 2027. Wales follows England. */
const ENGLAND = [
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
];
const SCOTLAND = [
  '2026-01-01', '2026-01-02', '2026-04-03', '2026-05-04', '2026-05-25', '2026-08-03', '2026-11-30', '2026-12-25', '2026-12-28',
  '2027-01-01', '2027-01-04', '2027-03-26', '2027-05-03', '2027-05-31', '2027-08-02', '2027-11-30', '2027-12-27', '2027-12-28',
];
/** Northern Ireland: England's, and St Patrick's Day and the Battle of the Boyne. */
const NORTHERN_IRELAND = [...ENGLAND, '2026-03-17', '2026-07-13', '2027-03-17', '2027-07-12'];

const HOLIDAYS: Record<DayNation, string[]> = { england: ENGLAND, wales: ENGLAND, scotland: SCOTLAND, northern_ireland: NORTHERN_IRELAND };

export function isWorkingDay(date: string, nation: DayNation): boolean {
  const wd = weekdayOf(date);
  return wd !== 0 && wd !== 6 && !HOLIDAYS[nation].includes(date);
}

/** The date n working days after `date` (n >= 0), skipping weekends and bank holidays. */
export function addWorkingDays(date: string, n: number, nation: DayNation): string {
  let d = date;
  for (let left = n; left > 0;) {
    d = addDays(d, 1);
    if (isWorkingDay(d, nation)) left--;
  }
  return d;
}
