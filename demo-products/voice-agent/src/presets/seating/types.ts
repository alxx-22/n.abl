// Tables in rooms, for any business that seats people: the restaurant now,
// then the pub and the café. Areas, tables, the room shapes drawn on the
// floor plan, and how long a table is held.

export interface AreaAnswer {
  key: string;
  label: string;
  kind: 'indoor' | 'outdoor' | 'bar' | 'private' | 'other';
  reservable: boolean;
  /** A private room: take details for a callback rather than book. */
  enquiry_only: boolean;
  /** Outdoor only. */
  weather_rule: 'move_inside' | 'own_risk' | 'walk_in_only' | null;
}

export interface TableAnswer {
  key: string;
  label: string;
  area: string;
  seats: number;
  shape: 'round' | 'square' | 'rect';
  x: number;
  y: number;
  rotation: number;
  accessible: boolean;
  /** Kept back for walk-ins: shown on the plan, never booked by phone. */
  walk_in: boolean;
  features: string[];
  /** Tables this one pushes together with (both ways). */
  joins: string[];
}

/** A room shape on the floor plan, for looks only: a bar counter, a door, a window, a wall. */
export interface FixtureAnswer {
  key: string;
  area: string;
  kind: 'bar' | 'door' | 'window' | 'wall';
  x: number;
  y: number;
  /** Along its run, in plan units (a door: its width). */
  length: number;
  /** 0, 90, 180 or 270: which way it runs, and which way a door opens. */
  rotation: number;
}

export interface SeatingAnswer {
  areas: AreaAnswer[];
  tables: TableAnswer[];
  fixtures: FixtureAnswer[];
  /** 2: each area is its own room, and positions are within it (layout.ts). 1: one canvas for every area. */
  plan: number;
  /** Minutes a table is held, by party size. */
  sittings: { up_to_2: number; up_to_4: number; up_to_8: number; larger: number };
  max_party: number;
  notice_minutes: number;
  horizon_days: number;
  highchairs: number;
  buffer_minutes: number;
}

export interface DepositAnswer {
  mode: 'none' | 'per_person' | 'per_booking' | 'card_hold';
  amount_pence: number;
  min_party: number;
}
