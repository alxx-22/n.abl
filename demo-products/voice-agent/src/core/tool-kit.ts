// What every tool is made of: reading the model's arguments, declaring
// parameters, texting, and the one helper that tells the call state about
// a record. Shared by the core tools (tools.ts) and the estate agent's
// (estate-tools.ts), so neither has to import the other at runtime.

import type { CallState, ToolContext } from './tools.ts';
import { displayUkPhone } from '../domain/phone.ts';

export const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
export const int = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : undefined;
};
export const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim()) : typeof v === 'string' && v.trim() ? v.split(/,| and /).map((x) => x.trim()).filter(Boolean) : [];

export const S = (description: string) => ({ type: 'STRING', description });
export const I = (description: string) => ({ type: 'INTEGER', description });
export const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'OBJECT', properties, ...(required.length ? { required } : {}),
});
export const B = (description: string) => ({ type: 'BOOLEAN', description });
export const bool = (v: unknown): boolean | undefined => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined);

/**
 * What a record is to this call: a booking or an order it made or looked
 * up, a change to or cancellation of a booking, or an offer it took.
 */
export type RecordKind = 'booking' | 'order' | 'change' | 'cancellation' | 'offer';

/**
 * Every tool that makes or finds a booking or an order says so here, and
 * only here (PRESETS.md §1, rule 5), so a new tool cannot leave out the
 * part of the call state that one of its readers needs: the guardrail
 * (did the call really make or find something it talks about), the check
 * that the caller heard a new reference before the call ends, and the
 * call's outcome and what a payment is for.
 *
 * 'found': looked up, so talking about it is not a false claim.
 * 'committed': written by this call. A new booking, order or offer is the
 * call's own and its reference is owed to the caller; a change keeps the
 * booking the call's own, under the reference the caller already has; a
 * cancellation is neither.
 */
export function record(ctx: { state: CallState }, ref: string, kind: RecordKind, how: 'committed' | 'found'): void {
  const s = ctx.state;
  if (how === 'found') {
    s.found.push(ref);
    return;
  }
  s.committed.push(ref);
  if (kind === 'booking' || kind === 'change') s.lastBookingRef = ref;
  if (kind === 'order') s.lastOrderRef = ref;
  if (kind === 'offer') s.lastOfferRef = ref;
  if (kind === 'booking' || kind === 'order' || kind === 'offer') s.owed = ref;
}

export async function smsTo(ctx: ToolContext, to: string | null, body: string): Promise<string | null> {
  if (!to) return null;
  const status = await ctx.sms.send(to, body);
  await ctx.repo.addMessage({ tenant_id: ctx.tenant.id, call_id: ctx.callId, kind: 'sms', to_number: to, body, status });
  ctx.action({ kind: 'sms', title: status === 'sent' ? 'SMS sent' : 'SMS (simulated)', detail: body, data: { to: displayUkPhone(to), status } });
  return status;
}

export function postcodeOf(input: unknown): { full: string; district: string } | null {
  const s = str(input)?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  const m = /^([A-Z]{1,2}[0-9][A-Z0-9]?)([0-9][A-Z]{2})$/.exec(s);
  if (m) return { full: `${m[1]} ${m[2]}`, district: m[1] };
  const d = /^([A-Z]{1,2}[0-9][A-Z0-9]?)$/.exec(s);
  return d ? { full: d[1], district: d[1] } : null;
}

/** A name the caller actually gave, not a stand-in. On 1 October a booking went through as "Caller". */
export function realName(v: unknown): string | undefined {
  const n = str(v);
  if (!n || !/\p{L}{2}/u.test(n)) return undefined;
  return /^(the )?(caller|customer|guest|user|client|unknown|anonymous|name|no name|n\/?a|none|test|sir|madam)$/i.test(n) ? undefined : n;
}
export const ASK_NAME = "Not done: you don't have the caller's name yet. Ask for it (a first name is fine), read it back, then call this again with it.";
