// What the prospect API (src/server/demo.ts) sends. Answers, issues and the
// catalogue are the server's own types: one definition, checked on both sides.

import type { BaseAnswers, Issue } from '../../../src/presets/common/types.ts';
import type { AreaAnswer, FixtureAnswer, RestaurantAnswers, TableAnswer } from '../../../src/presets/restaurant/answers.ts';
import type { PresetInfo } from '../../../src/presets/catalogue.ts';
import type { TenantState } from '../types.ts';

export type { AreaAnswer, BaseAnswers, FixtureAnswer, Issue, PresetInfo, RestaurantAnswers, TableAnswer };

export interface Limits {
  days: number;
  call_minutes_per_day: number;
  total_call_minutes_per_day: number;
  workspaces: number;
  drafts_per_day: number;
  scans_per_day: number;
}

export interface WorkspaceSummary {
  id: string;
  slug: string;
  preset: string;
  name: string;
  accent: string | null;
  started_at: string | null;
  updated_at: string;
  /** Shared keys: when this demo and everything in it is deleted. */
  expires_at: string | null;
}

export interface Me {
  kind: 'private' | 'shared';
  /** Shared keys: how long a demo lives after Start, and a draft before it. */
  shared: { demo_minutes: number; draft_minutes: number } | null;
  person_name: string;
  company: string | null;
  products: string[];
  expires_at: string;
  limits: Limits;
  used: { call_minutes: number; drafts: number; scans: number; workspaces: number };
  workspaces?: WorkspaceSummary[];
}

/**
 * The builder's preview pane, as the preset makes it. Every preset may send
 * these; the restaurant adds its own fields (RestaurantPreview), and the
 * presets after it send `lines` instead.
 */
export type PreviewPayload = {
  greeting?: string;
  core_facts?: string[];
  hours?: string | null;
  lines?: string[];
} & Record<string, unknown>;

/** The restaurant's preview: today's fields, and no lines. */
export interface RestaurantPreview {
  greeting: string;
  core_facts: string[];
  hours: string | null;
  covers: { area: string; label: string; covers: number }[];
  bookable_tables: number;
  pairs: string[];
  dishes: number;
}

/** A workspace in the builder; each preset's steps narrow A to its own answers. */
export interface WorkspacePayload<A extends BaseAnswers = BaseAnswers> extends WorkspaceSummary {
  answers: A;
  settings: Record<string, unknown>;
  issues: Issue[];
  preview: PreviewPayload | null;
  profile: { voice: string; greeting: string; demo_pin?: string | null; phone_display?: string | null };
}

export interface PlanTable {
  key: string;
  label: string;
  area: string | null;
  seats: number;
  shape: 'round' | 'square' | 'rect';
  x: number;
  y: number;
  rotation: number;
  accessible: boolean;
  features: string[];
  bookable: boolean;
}

export interface LiveBooking {
  id: string;
  reference: string;
  date: string;
  day: string;
  time: string;
  end_time: string;
  starts_at: string;
  ends_at: string;
  party_size: number;
  name: string;
  phone: string | null;
  notes: string | null;
  allergies: string | null;
  tags: string[];
  status: 'confirmed' | 'cancelled';
  visit_status: 'expected' | 'arrived' | 'seated' | 'finished' | 'no_show';
  source: string;
  history: { at: string; by: string; what: string }[];
  resource_key: string;
  tables: string[];
  with: string;
  area: string | null;
  service: string;
  deposit: string | null;
  deposit_paid: boolean;
}

export interface LiveOrder {
  reference: string;
  name: string;
  phone: string | null;
  fulfilment: string;
  due: string;
  due_time: string;
  due_at: string;
  address: string | null;
  lines: { name: string; quantity: number; modifiers: { name: string }[]; notes?: string | null }[];
  total: string;
  allergy_notes: string | null;
  status: 'confirmed' | 'in_kitchen' | 'ready' | 'completed' | 'cancelled';
  payment_status: 'paid' | 'unpaid';
  created_at: string;
}

export interface LiveState extends Omit<TenantState, 'bookings' | 'orders'> {
  now: string;
  started_at: string | null;
  /** Shared keys: when this demo is deleted. */
  expires_at: string | null;
  tenant: TenantState['tenant'] & { brand: Partial<BaseAnswers['theme']>; timezone: string };
  plan: {
    areas: { key: string; label: string; kind: string; reservable: boolean; enquiry_only?: boolean; weather_note?: string }[];
    tables: PlanTable[];
    pairs: { key: string; label: string; combines: string[]; capacity: number; bookable: boolean }[];
    fixtures: { key: string; area: string; kind: 'bar' | 'door' | 'window' | 'wall'; x: number; y: number; length: number; rotation: number }[];
  } | null;
  opening_hours: { days: number[]; open: string; close: string; label?: string }[];
  bookings: LiveBooking[];
  orders: LiveOrder[];
}
