// The back office's views, by the ids a workspace spec lists them under. Each
// says what it shows, bookings or orders or neither, so a booking or order
// that lands on a call can bring the first view that shows it forward, and
// whether it opens the booking drawer. Views later presets add (drivers,
// rooms, classes) join here.

import type { ReactNode } from 'react';
import { Calls } from '../../components/BoardPanels.tsx';
import type { TenantState } from '../../types.ts';
import type { LiveBooking, LiveState } from '../types.ts';
import { FloorBoard, type View } from './FloorBoard.tsx';
import { Messages } from './Messages.tsx';
import { OrderBoard } from './OrderBoard.tsx';
import type { Shows, WorkspaceSpec } from './spec.ts';
import { Timeline } from './Timeline.tsx';

export type ViewId = WorkspaceSpec['views'][number]['id'];

/** What a view is drawn with: the workspace's state and spec, and what the page around it shares. */
export interface ViewProps {
  id: string;
  state: LiveState;
  spec: WorkspaceSpec;
  today: string;
  nowMinute: number;
  clock: number;
  view: View;
  setView: (v: View) => void;
  /** The table the open booking is on. */
  selected: string | null;
  onSelectTable: (key: string | null) => void;
  onDrop: (from: string, to: string) => void;
  flash: Set<string>;
  onOpen: (b: LiveBooking) => void;
  onMove: (b: LiveBooking, table: string) => void;
  refresh: () => void;
}

export interface ViewDef {
  shows: Shows;
  /** Shown only when the state has what it draws: the floor plan needs tables. */
  needs?(state: LiveState): boolean;
  /** A number in the tab: new orders, unread messages. */
  count?(state: LiveState): number;
  render(p: ViewProps): ReactNode;
}

export const VIEWS: Partial<Record<ViewId, ViewDef>> = {
  floor: {
    shows: 'bookings',
    needs: (s) => Boolean(s.plan),
    render: (p) => (
      <FloorBoard
        state={p.state} today={p.today} nowMinute={p.nowMinute} view={p.view} setView={p.setView}
        selected={p.selected} onSelectTable={p.onSelectTable} onDrop={p.onDrop} flash={p.flash}
      />
    ),
  },
  timeline: {
    shows: 'bookings',
    needs: (s) => Boolean(s.plan),
    render: (p) => <Timeline state={p.state} today={p.today} nowMinute={p.nowMinute} view={p.view} setView={p.setView} onOpen={p.onOpen} onMove={p.onMove} />,
  },
  orders: {
    shows: 'orders',
    count: (s) => s.orders.filter((o) => o.status === 'confirmed').length,
    render: (p) => (p.spec.orders ? <OrderBoard id={p.id} state={p.state} spec={p.spec.orders} nowMs={p.clock} onDone={p.refresh} /> : null),
  },
  messages: {
    shows: null,
    count: (s) => s.messages.filter((m) => m.kind === 'message' && m.status === 'new').length,
    render: (p) => <Messages id={p.id} state={p.state} onDone={p.refresh} />,
  },
  calls: {
    shows: null,
    render: (p) => <Calls state={p.state as unknown as TenantState} />,
  },
};

/** The spec's views this page can draw, in its order, each with its tab label. */
export function viewsOf(spec: WorkspaceSpec, state: LiveState): { id: ViewId; label: string; shows: Shows; def: ViewDef }[] {
  return spec.views.flatMap((v) => {
    const def = VIEWS[v.id];
    if (!def || (def.needs && !def.needs(state))) return [];
    const n = def.count?.(state) ?? 0;
    return [{ id: v.id, label: `${v.label}${n ? ` (${n})` : ''}`, shows: def.shows, def }];
  });
}
