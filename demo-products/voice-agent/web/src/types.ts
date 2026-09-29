// What the server sends. Kept by hand in step with src/server/main.ts.

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  business_type: string;
  status: string;
  phone_display?: string | null;
  demo_pin?: string | null;
  accent?: string | null;
  summary: string;
  greeting: string;
  voice: string;
  has_booking: boolean;
  has_ordering: boolean;
}

export interface Booking {
  reference: string;
  date: string;
  day: string;
  time: string;
  party_size: number;
  name: string;
  phone: string | null;
  notes: string | null;
  status: 'confirmed' | 'cancelled';
  source: string;
  with: string;
  service: string;
  deposit: string | null;
  deposit_paid: boolean;
}

export interface OrderLine {
  name: string;
  quantity: number;
  modifiers: { name: string }[];
  notes?: string | null;
}

export interface Order {
  reference: string;
  name: string;
  fulfilment: string;
  due: string;
  address: string | null;
  lines: OrderLine[];
  total: string;
  allergy_notes: string | null;
  status: string;
  payment_status: string;
  created_at: string;
}

export interface Message {
  id: string;
  kind: 'message' | 'sms';
  body: string;
  status?: string;
  to_number?: string | null;
  from_name?: string | null;
  from_phone?: string | null;
}

export interface CallRow {
  id: string;
  channel: string;
  started_at: string;
  ended_at: string | null;
  outcome: string | null;
  summary: string | null;
  model: string | null;
  guardrail_flags: number;
  latency: { median_ms?: number; p95_ms?: number; samples?: number } | null;
}

export interface TenantState {
  tenant: TenantSummary;
  today: string;
  active_calls: string[];
  bookings: Booking[];
  orders: Order[];
  messages: Message[];
  calls: CallRow[];
}

export interface Profile {
  slug: string;
  name: string;
  summary: string;
  business_type: string;
  status: string;
  greeting: string;
  voice: string;
  demo_pin?: string | null;
  language_code?: string | null;
  reply_speed?: 'snappy' | 'normal' | 'patient';
  live_model?: string | null;
  brand?: { accent?: string };
  [k: string]: unknown;
}

export interface AppConfig {
  models: string[];
  demo_cards: { number: string; spoken: string; expiry: string; cvc: string; result: string }[];
  telephony: boolean;
  sms: boolean;
  active_calls: number;
  max_calls: number;
}

export interface VoiceMeta {
  voices: { name: string; style: string }[];
  reply_speeds: Record<string, { label: string; silence_ms: number }>;
  models: { id: string; label: string }[];
  default_models: string[];
}

export interface Action {
  kind: string;
  title: string;
  detail?: string;
  data?: Record<string, unknown>;
}

export type BoardEvent =
  | { type: 'call_started'; channel: string; model?: string; caller?: string | null }
  | { type: 'transcript'; role: 'caller' | 'agent'; text: string; final: boolean }
  | { type: 'action'; action: Action }
  | { type: 'flag'; rule: string; text: string }
  | { type: 'call_ended'; outcome?: string }
  | { type: 'refresh' };
