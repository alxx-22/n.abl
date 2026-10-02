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

/** Where a booked guest is on the day: expected, arrived, seated, finished, or a no-show. */
export type VisitStatus = NonNullable<Booking['visit_status']>;

// ── A seeded week: planned in memory, then written by repo.insertSeed ────
// The optional fields are for businesses that are not a restaurant; a plan
// that leaves one out gets what the restaurant's rows have always had.

export interface SeedBooking {
  reference: string;
  /** The booked service; default 'table'. */
  service_key?: string;
  /** Minutes kept clear after it; default 0. */
  buffer_minutes?: number;
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
  visit_status: VisitStatus;
  booked_via: 'receptionist' | 'staff' | 'online';
}

export interface SeedOrder {
  reference: string;
  name: string;
  phone: string;
  /** Default collection, with no address, postcode or delivery fee. */
  fulfilment?: 'collection' | 'delivery';
  address?: string | null;
  postcode?: string | null;
  delivery_fee_pence?: number;
  due_at: Date;
  /**
   * When the kitchen must have it ready; a collection's defaults to its due
   * time. The seed plans a delivery's, since it knows the delivery minutes.
   */
  ready_at?: Date;
  lines: OrderLine[];
  subtotal_pence: number;
  total_pence: number;
  allergy_notes: string | null;
  /** When the caller rang; default 50 minutes before it is due. */
  created_at?: Date;
  /** Default confirmed and unpaid, as a new order is. */
  status?: 'confirmed' | 'in_kitchen' | 'ready' | 'out_for_delivery' | 'completed';
  payment_status?: 'unpaid' | 'paid';
  /** Who took a delivery out, and when. */
  driver?: string | null;
  out_at?: Date | null;
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
