// What every kind of business's answers share, and what a preset hands back
// from validate and seed. Each preset's answers extend BaseAnswers, so the
// server can read a name, a voice or a greeting without knowing which kind of
// business it is.

import type { Booking, OrderLine } from '../../domain/types.ts';

export interface ServicePeriod {
  label: string;
  open: string;
  close: string;
}

export interface DayHours {
  open: boolean;
  services: ServicePeriod[];
}

export interface BasicsAnswer {
  name: string;
  /** "Neapolitan pizza and fresh pasta": drives the menu draft and the greeting's tone. */
  style: string;
  town: string;
  address: string;
  phone_display: string;
  website: string;
  voice: string;
  /** Empty: generated from the name. */
  greeting: string;
}

export interface ClosureAnswer {
  date: string;
  note: string;
}

export interface FaqAnswer {
  q: string;
  a: string;
}

export interface HoursAnswer {
  /** Seven entries, 0 = Sunday. */
  days: DayHours[];
  closures: ClosureAnswer[];
}

export interface ThemeAnswer {
  accent: string;
  primary: string;
  background: string;
  font_heading: string;
  font_body: string;
  logo: string | null;
}

/** Where each field came from, by path ("basics.name"): the scout marks what it found or guessed. */
export type Sources = Record<string, 'website' | 'guess'>;

export interface BaseAnswers {
  version: number;
  basics: BasicsAnswer;
  /** A preset may add its own fields (the restaurant's last_booking_before_close). */
  hours: HoursAnswer;
  policies: { faqs: FaqAnswer[] } & Record<string, unknown>;
  theme: ThemeAnswer;
  sources: Sources;
}

/** Something the builder shows as still missing or wrong, on the step it belongs to. */
export interface Issue<StepKey extends string = string> {
  step: StepKey;
  level: 'error' | 'warning';
  message: string;
}

// ── A seeded week: planned in memory, then written by repo.insertSeed ────

export interface SeedBooking {
  reference: string;
  resource_key: string;
  area_key: string | null;
  starts_at: Date;
  ends_at: Date;
  party_size: number;
  name: string;
  phone: string;
  notes: string | null;
  allergies: string | null;
  tags: string[];
  deposit_pence: number;
  deposit_paid: boolean;
  visit_status: NonNullable<Booking['visit_status']>;
  booked_via: 'receptionist' | 'staff' | 'online';
}

export interface SeedOrder {
  reference: string;
  name: string;
  phone: string;
  due_at: Date;
  lines: OrderLine[];
  subtotal_pence: number;
  total_pence: number;
  allergy_notes: string | null;
  status: 'confirmed' | 'in_kitchen' | 'ready' | 'completed';
  payment_status: 'unpaid' | 'paid';
}

export interface SeedMessage {
  from_name: string;
  from_phone: string;
  body: string;
}

export interface SeedPlan {
  bookings: SeedBooking[];
  orders: SeedOrder[];
  messages: SeedMessage[];
}
