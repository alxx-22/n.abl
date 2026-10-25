// A safety certificate renewed by the visit that does it (presets/property-
// maintenance.md §4.2): the register's new dates once the job is done.
// Pure, so the server and the tests ask the same question.

import type { Certificate } from './types.ts';

const plusYears = (date: string, n: number) => `${Number(date.slice(0, 4)) + n}${date.slice(4)}`.replace(/-02-29$/, '-02-28');
const minusMonths = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

/**
 * The new issue and expiry dates for a certificate renewed on `done`. A gas
 * safety record done in the two months before it runs out keeps its date,
 * so the new one runs a year from the old expiry (the Gas Safety
 * (Installation and Use) Regulations 1998, as amended in 2018); otherwise a
 * year from the visit. An EICR runs five years (the Electrical Safety
 * Standards in the Private Rented Sector (England) Regulations 2020); a boiler
 * service, alarm check or PAT test a year.
 */
export function renewal(c: Pick<Certificate, 'kind' | 'expires'>, done: string): { issued: string; expires: string } {
  if (c.kind === 'eicr') return { issued: done, expires: plusYears(done, 5) };
  const keeps = c.kind === 'gas_record' && c.expires && done <= c.expires && done >= minusMonths(c.expires, 2);
  return { issued: done, expires: plusYears(keeps ? c.expires! : done, 1) };
}
