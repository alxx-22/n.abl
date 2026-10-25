// What the barber's back office views share (presets/barber.md §6): one way
// to send a staff action, the shop's services by name, who is in today, and
// minutes said the way a shop says them.

import { SKIN_TEST_KEY } from '../../../../src/domain/shop-floor.ts';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveState, LiveStaff } from '../types.ts';
import { live, span, weekday } from './model.ts';

/** Sends a staff action; the toast says what the server did, or why it couldn't. */
export async function shopAct(id: string, path: string, method: 'POST' | 'PATCH', body: Record<string, unknown>, onDone: () => void): Promise<boolean> {
  try {
    const r = await demoApi<{ message?: string }>(`/workspaces/${id}/${path}`, { method, json: body });
    toast(r.message ?? 'Done.');
    onDone();
    return true;
  } catch (e) {
    toast((e as Error).message);
    return false;
  }
}

/** The services a walk-in can have: the skin test is booked ahead, never walked in for. */
export const shopServices = (state: LiveState) => (state.barber?.services ?? []).filter((s) => s.key !== SKIN_TEST_KEY);

/** The barbers on the rota for today, each with whether they've been marked off. */
export function rotaToday(state: LiveState): { m: LiveStaff; off: boolean }[] {
  const b = state.barber;
  if (!b) return [];
  const wd = weekday(b.today.date);
  return (state.team ?? []).filter((m) => m.days.includes(wd)).map((m) => ({ m, off: b.today.off.includes(m.key) }));
}

/** How long a service takes, from any booking of it; a cut's half hour when none is booked. */
export function serviceMinutes(state: LiveState, key: string): number {
  const b = state.bookings.find((x) => x.service_key === key);
  return b ? span(b)[1] - span(b)[0] : 30;
}

/**
 * When a barber's chair is next free for `minutes`, from the Diary: now, or
 * the end of whatever is in the way. For "Next", which seats someone
 * already waiting; the wait now (the server's) is for someone walking in.
 */
export function chairFreeAt(state: LiveState, key: string, date: string, nowMinute: number, minutes: number): number {
  const mine = state.bookings.filter((b) => b.date === date && b.resource_key === key && live(b)).map(span).sort((a, b) => a[0] - b[0]);
  let at = nowMinute;
  for (const [s, e] of mine) {
    if (e <= at) continue;
    if (s >= at + minutes) break;
    at = e;
  }
  return at;
}

/** "4 min", "1 hr 5 min". */
export const mins = (n: number) => (n < 60 ? `${n} min` : `${Math.floor(n / 60)} hr${n % 60 ? ` ${n % 60} min` : ''}`);

/** Minutes since the state was read, on the demo's clock: the waits keep counting between refreshes. */
export const sinceRead = (state: LiveState, nowMs: number) => Math.max(0, Math.floor((nowMs - Date.parse(state.now)) / 60000));

/** 14:05, in the shop's time. */
export const clockTime = (iso: string, timeZone: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });

/** Thu 14:05, in the shop's time. */
export const dayTime = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone });
