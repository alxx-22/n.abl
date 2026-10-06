// What the repairs contractor's views share (presets/property-maintenance.md
// §6): acting on a job, the badges a job card carries, and the words for its
// priority and its time.

import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveJob } from '../types.ts';

/** Acts on a job and says what happened; the server keeps every move to the window rules and says why not. */
export async function jobAct(id: string, ref: string, body: Record<string, unknown>, onDone: () => void): Promise<boolean> {
  try {
    const r = await demoApi<{ message: string }>(`/workspaces/${id}/jobs/${ref}`, { method: 'PATCH', json: body });
    toast(r.message);
    onDone();
    return true;
  } catch (e) {
    toast((e as Error).message);
    return false;
  }
}

export const PRIORITY: Record<LiveJob['priority'], { label: string; badge: string }> = {
  emergency: { label: 'Emergency', badge: 'bad' },
  urgent: { label: 'Urgent', badge: 'warn' },
  routine: { label: 'Routine', badge: '' },
};

/** The flags a card shows, in words a dispatcher reads at a glance. */
export function jobBadges(j: LiveJob): { label: string; level: string }[] {
  const out: { label: string; level: string }[] = [];
  if (j.flags.includes('gas')) out.push({ label: 'Gas', level: 'warn' });
  if (j.vulnerable.length || j.flags.includes('vulnerable')) out.push({ label: 'Vulnerable', level: 'bad' });
  // A clock counts down on the card: an Awaab's Law investigation by a day, an emergency hazard by a time.
  for (const c of j.clocks) {
    const when = c.due.length > 10
      ? new Date(c.due).toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
      : new Date(`${c.due}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    if (j.status === 'cancelled') continue;
    if (j.done_at) {
      const met = c.due.length > 10 ? j.done_at <= c.due : j.done_at.slice(0, 10) <= c.due;
      out.push({ label: met ? 'Within the clock' : 'Clock missed', level: met ? 'ok' : 'bad' });
    } else out.push({ label: `${c.kind.startsWith('awaab') ? 'Investigate' : 'Due'} by ${when}`, level: 'bad' });
  }
  if (j.flags.includes('duty_manager')) out.push({ label: 'Duty manager told', level: 'bad' });
  if (j.flags.includes('possible_emergency_hazard')) out.push({ label: 'Possible hazard: landlord decides', level: 'bad' });
  if (j.flags.includes('damp_mould') && !j.clocks.length) out.push({ label: 'Damp and mould', level: 'warn' });
  if (j.po) out.push({ label: `PO ${j.po}`, level: 'info' });
  if (j.flags.includes('recall')) out.push({ label: 'Recall', level: 'warn' });
  if (j.flags.includes('key_collection')) out.push({ label: 'Keys', level: 'info' });
  if (j.pets) out.push({ label: 'Pets', level: '' });
  if (j.flags.includes('out_of_hours')) out.push({ label: 'Out of hours', level: 'info' });
  if (j.flags.includes('paged')) out.push({ label: 'Paged', level: 'bad' });
  return out;
}

export const hhmm = (iso: string, timeZone: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });

/** "Thu 8 Oct, morning", or "attend by 01:00", or "not booked yet". */
export function jobWhen(j: LiveJob, timeZone: string): string {
  if (j.attend_by && !j.window_key) return `attend by ${hhmm(j.attend_by, timeZone)}`;
  if (j.date && j.window) {
    const d = new Date(`${j.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${d}, ${j.window.split(',')[0].toLowerCase()}`;
  }
  return 'not booked yet';
}

/** Minutes left on the way: the ETA counted down from when they set off. */
export function etaLeft(j: LiveJob, nowMs: number): number | null {
  if (j.status !== 'on_the_way' || !j.on_the_way_at || j.eta_minutes === null) return null;
  return Math.max(0, Math.round(j.eta_minutes - (nowMs - Date.parse(j.on_the_way_at)) / 60_000));
}
