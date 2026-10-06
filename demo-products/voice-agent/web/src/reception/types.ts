// What the prospect API (src/server/demo.ts) sends. Answers, issues and the
// catalogue are the server's own types: one definition, checked on both sides.

import type { BaseAnswers, Issue } from '../../../src/presets/common/types.ts';
import type { BuyerPosition, HomeType, ListingStatus, Nation, OfferStatus, PriceQualifier, StaffDuty, StaffRole } from '../../../src/domain/types.ts';
import type { AreaAnswer, FixtureAnswer, RestaurantAnswers, TableAnswer } from '../../../src/presets/restaurant/answers.ts';
import type { PresetInfo } from '../../../src/presets/catalogue.ts';
import type { WorkspaceSpec } from '../../../src/presets/index.ts';
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
  /** A viewing's home (an estate agency's). */
  listing_key?: string;
  home?: string;
  /** What a viewing or valuation knows: the buyer's position and badges, feedback, a valuation's lead. */
  details?: Record<string, unknown>;
}

/** An estate agency's home in the back office: its facts joined with what staff changed (src/server/state.ts). */
export interface LiveListing {
  key: string;
  ref: string;
  address: string;
  town: string;
  district: string;
  type: HomeType;
  home: string;
  example: boolean;
  status: ListingStatus;
  price_pence: number;
  qualifier: PriceQualifier;
  days_on_market: number;
  back_on_market_at: string | null;
  negotiator: string | null;
  viewings_week: number;
  offers: number;
  part_a_missing: string[];
  unknown: number;
  personal_interest: boolean;
  marketing_continues: boolean;
  best_final_at: string | null;
  checking: string[];
  blocked: { from: string; to: string; note?: string }[];
  history: { at: string; by: string; what: string }[];
}

export interface LiveOffer {
  reference: string;
  listing_key: string;
  home: string;
  revises: string | null;
  amount_pence: number;
  buyer_names: string[];
  phone: string | null;
  position: BuyerPosition;
  conditions: string | null;
  flags: string[];
  status: OfferStatus;
  received_at: string;
  sent_at: string | null;
  decided_at: string | null;
  note: string | null;
  source: string;
  /** The home's seller left an offer message on a call that nobody has read yet. */
  seller_replied?: boolean;
}

/** A sale from the offer accepted to the keys (the Sales progress view). */
export interface LiveSale {
  id: string;
  listing_key: string;
  home: string;
  buyer_name: string;
  buyer_phone: string;
  agreed_pence: number;
  milestones: { key: string; done_at: string | null }[];
  exchange_target: string | null;
  completion_date: string | null;
  parties: { role: string; name: string; firm?: string; phone: string | null }[];
  chain: string | null;
  status: 'progressing' | 'exchanged' | 'completed' | 'fell_through';
  keys_released_at: string | null;
  updates: { at: string; by: string; what: string }[];
  created_at: string;
}

/** A valuation and its lead, from booked to won or lost (the Valuations view). */
export interface LiveValuation {
  reference: string;
  date: string;
  day: string;
  time: string;
  starts_at: string;
  ends_at: string;
  valuer: string;
  name: string;
  phone: string;
  visit_status: string;
  details: Record<string, unknown>;
}

/** A buyer on the agency's list (the Applicants view). */
export interface LiveBuyer {
  name: string | null;
  phone: string;
  position: BuyerPosition | null;
  wants: string | null;
  timescale: string | null;
  /** Homes on the market now that fit what they asked for. */
  matches: number;
  alerts: boolean;
  consent_at: string | null;
  backup_for: string[];
  investor: boolean;
  hot: boolean;
  last_contact: string | null;
  source: string | null;
}

export interface LiveStaff {
  key: string;
  name: string;
  first_name: string;
  role: StaffRole;
  does: StaffDuty[];
  days: number[];
  mobile: string;
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

// ── A repairs contractor's (presets/property-maintenance.md §6) ─────────

export interface LiveMtWindow {
  key: string;
  label: string;
  from: string;
  to: string;
  premium_pence: number;
  days: number[];
}

export interface LiveEngineer {
  key: string;
  name: string;
  first_name: string;
  trades: string[];
  gas_safe: boolean;
  accreditations: string[];
  days: number[];
  districts: string[];
  per_window: number;
  mobile: string;
}

/** A letting agent, landlord or other client, and the authoriser whose phone approves work over the limit. */
export interface LiveClient {
  key: string;
  name: string;
  kind: string;
  works_limit_pence: number;
  emergency_authority_pence: number;
  po_required: boolean;
  notice: string;
  instructions: string;
  status: 'active' | 'on_stop';
  contact: { name: string; phone: string; email: string };
  properties: number;
}

export type JobStatus = 'new' | 'awaiting_approval' | 'scheduled' | 'on_the_way' | 'on_site' | 'waiting' | 'done' | 'invoiced' | 'cancelled';

/** A job as the board shows it: first names only, and a window or an attend-by time. */
export interface LiveJob {
  reference: string;
  property_key: string | null;
  address: string | null;
  client: string | null;
  reporter: { name: string | null; phone: string; role: string | null };
  trade: string;
  trade_label: string;
  priority: 'emergency' | 'urgent' | 'routine';
  reason: string | null;
  description: string;
  kind: string;
  status: JobStatus;
  date: string | null;
  day: string | null;
  window_key: string | null;
  window: string | null;
  attend_by: string | null;
  engineer_key: string | null;
  engineer: string | null;
  eta_minutes: number | null;
  on_the_way_at: string | null;
  po: string | null;
  price_pence: number | null;
  clocks: { kind: string; label: string; start: string; due: string }[];
  flags: string[];
  waiting_for: string | null;
  access_attempts: number;
  notes: string | null;
  history: { at: string; by: string; what: string }[];
  source: string;
  created_at: string;
  done_at: string | null;
  pets: string | null;
  vulnerable: string[];
}

export interface LiveCertificate {
  kind: 'gas_record' | 'eicr' | 'boiler_service' | 'alarms' | 'pat';
  issued: string | null;
  expires: string | null;
  booked_job: string | null;
  remedials: { what: string; due: string; done?: boolean }[];
  state: 'booked' | 'overdue' | 'due soon' | 'in date' | 'unknown';
}

export interface LiveMtProperty {
  key: string;
  address: string;
  town: string;
  district: string;
  kind: string;
  example: boolean;
  client_key: string | null;
  client: string | null;
  occupant: { name: string | null; phone: string };
  notes: { stopcock?: string; boiler?: string; parking?: string; pets?: string };
  /** occupant, key_safe or keys_held: a code is never sent. */
  access: string;
  vulnerable: string[];
  markers: string[];
  gas: boolean;
  gas_appliances: number;
  certificates: LiveCertificate[];
}

export interface LiveIncident {
  id: string;
  kind: string;
  title: string;
  number: string | null;
  address: string | null;
  caller_phone: string;
  advised_at: string | null;
  created_at: string;
  follow_up_job: string | null;
  advice_version: number;
  notes: string | null;
  source: string;
}

export interface LiveQuote {
  reference: string;
  job_ref: string | null;
  address: string | null;
  client_key: string | null;
  client: string | null;
  description: string;
  amount_pence: number;
  status: 'sent' | 'approved' | 'declined' | 'expired';
  issued: string;
  valid_until: string | null;
  decided_at: string | null;
  decided_by: string | null;
}

export interface LiveInvoice {
  reference: string;
  job_ref: string | null;
  address: string | null;
  client_key: string | null;
  client: string | null;
  payer: { name: string | null; phone: string };
  kind: 'job' | 'callout';
  description: string;
  amount_pence: number;
  status: 'due' | 'overdue' | 'paid' | 'void';
  issued: string;
  due: string;
  paid_at: string | null;
  paid_how: 'card' | 'bank' | null;
  card_last4: string | null;
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
  /** What the back office shows, in the business's words; missing from a server that predates it. */
  workspace?: WorkspaceSpec;
  bookings: LiveBooking[];
  orders: LiveOrder[];
  /** An estate agency's. */
  nation?: Nation;
  team?: LiveStaff[];
  listings?: LiveListing[];
  offers?: LiveOffer[];
  buyers?: LiveBuyer[];
  valuations?: LiveValuation[];
  sales?: LiveSale[];
  /** A repairs contractor's. */
  maintenance?: {
    nation: string;
    windows: LiveMtWindow[];
    trades: { key: string; label: string; gas: boolean }[];
    on_call_tonight: string[];
    duty_manager: string;
    escalate_minutes: number;
    reminder_weeks: number;
    attend_hours: number;
  };
  engineers?: LiveEngineer[];
  clients?: LiveClient[];
  jobs?: LiveJob[];
  properties?: LiveMtProperty[];
  incidents?: LiveIncident[];
  quotes?: LiveQuote[];
  invoices?: LiveInvoice[];
}
