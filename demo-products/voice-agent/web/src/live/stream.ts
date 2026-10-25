// The call as it happens, from the board's event stream: transcript lines
// growing word by word, then bookings, orders and payments as the tools run.
// It covers every call on the business, so a phone call shows up too.

import type { BoardEvent } from '../types.ts';

export type Item =
  | { id: number; kind: 'caller' | 'agent'; text: string; final: boolean }
  | { id: number; kind: 'action'; tone: string; title: string; detail?: string }
  | { id: number; kind: 'flag'; text: string }
  | { id: number; kind: 'note'; text: string };

export interface StreamState {
  items: Item[];
  partial: { caller: number | null; agent: number | null };
  call: { live: boolean; channel?: string; caller?: string | null; model?: string; outcome?: string } | null;
  nextId: number;
  /** Set when an action should make the diary jump to a booking. */
  focusRef: string | null;
  onHold: boolean;
}

export const initialStream: StreamState = { items: [], partial: { caller: null, agent: null }, call: null, nextId: 1, focusRef: null, onHold: false };

export type StreamAction = { type: 'event'; event: BoardEvent } | { type: 'note'; text: string } | { type: 'focused' };

export function streamReducer(s: StreamState, a: StreamAction): StreamState {
  if (a.type === 'note') return { ...initialStream, items: [{ id: s.nextId, kind: 'note', text: a.text }], nextId: s.nextId + 1 };
  if (a.type === 'focused') return { ...s, focusRef: null };
  const e = a.event;
  switch (e.type) {
    case 'call_started':
      return { ...s, items: [], partial: { caller: null, agent: null }, call: { live: true, channel: e.channel, caller: e.caller, model: e.model } };
    case 'transcript': {
      const open = s.partial[e.role];
      let items: Item[];
      let id = open;
      let nextId = s.nextId;
      if (open !== null) {
        items = s.items.map((it) => (it.id === open ? { ...it, text: e.text, final: e.final } as Item : it));
      } else {
        id = nextId++;
        items = [...s.items, { id, kind: e.role, text: e.text, final: e.final }];
      }
      return { ...s, items, nextId, partial: { ...s.partial, [e.role]: e.final ? null : id } };
    }
    case 'action': {
      if (e.action.kind === 'call_ending') return s;
      const tone = e.action.kind === 'payment' ? 'payment' : e.action.kind === 'sms' ? 'sms' : e.action.kind === 'transfer' ? 'sms' : '';
      const ref = ['booking_created', 'booking_changed', 'job_created', 'job_changed'].includes(e.action.kind) ? String(e.action.data?.reference ?? '') || null : s.focusRef;
      return {
        ...s,
        focusRef: ref,
        items: [...s.items, { id: s.nextId, kind: 'action', tone, title: e.action.title, detail: e.action.detail }],
        nextId: s.nextId + 1,
      };
    }
    case 'flag':
      return { ...s, items: [...s.items, { id: s.nextId, kind: 'flag', text: `${e.rule.replace(/_/g, ' ')}: "${e.text}"` }], nextId: s.nextId + 1 };
    case 'turn': {
      const hold = e.state === 'hold';
      if (hold === s.onHold) return s;
      if (!hold) return { ...s, onHold: false };
      const why = e.reason === 'side_talk' ? 'The caller is talking to someone in the room' : 'The caller asked to hold on';
      return {
        ...s,
        onHold: true,
        items: [...s.items, { id: s.nextId, kind: 'note', text: `${why}: the receptionist waits quietly until they come back.` }],
        nextId: s.nextId + 1,
      };
    }
    case 'call_ended':
      return { ...s, partial: { caller: null, agent: null }, call: { ...(s.call ?? {}), live: false, outcome: e.outcome } };
    default:
      return s;
  }
}
