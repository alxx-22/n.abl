// The tenant profile: everything the receptionist knows about one business.
//
// It is one JSON document per tenant (voice_tenants.profile), not a dozen
// tables. The setup wizard produces it in one go, the console edits it in one
// go, and a demo business never has enough menu items for normalisation to pay
// for itself. Transactional records (bookings, orders, payments, calls) are
// proper tables.

// Every kind of business in src/presets/catalogue.ts, and 'other' for fixtures read from a website.
export type BusinessType =
  | 'restaurant' | 'takeaway' | 'cafe' | 'pub' | 'barber' | 'salon' | 'beauty' | 'spa'
  | 'estate_agent' | 'letting_agent' | 'property_maintenance' | 'hotel' | 'gym' | 'dog_grooming' | 'garage' | 'other';

export const ALLERGENS = [
  'celery', 'gluten', 'crustaceans', 'eggs', 'fish', 'lupin', 'milk',
  'molluscs', 'mustard', 'nuts', 'peanuts', 'sesame', 'soya', 'sulphites',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export interface Window {
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** First start time, HH:MM local. */
  first: string;
  /** Last start time, HH:MM local. */
  last: string;
}

export interface OpeningHours {
  days: number[];
  open: string;
  close: string;
  label?: string;
}

export interface BookableService {
  key: string;
  label: string;
  kind: 'table' | 'appointment';
  slot_minutes: number;
  /** Tables: length of a sitting by party size. */
  duration_rules?: { max_party: number; minutes: number }[];
  /** Appointments: fixed length. */
  duration_minutes?: number;
  buffer_minutes?: number;
  price_pence?: number;
  description?: string;
  windows: Window[];
  max_party?: number;
  large_party_note?: string;
  lead_minutes?: number;
  horizon_days?: number;
  deposit?: { min_party?: number; per_person_pence?: number; flat_pence?: number };
  /** A viewing: booked at one of profile.listings, under that home's own rules (estate agent only). */
  needs_listing?: true;
}

export interface Resource {
  key: string;
  label: string;
  services: string[];
  capacity?: number;
  min?: number;
  /** A combined resource (two pushed-together tables) blocks its parts, and vice versa. */
  combines?: string[];
  /** Tables: which seating area it is in (see booking.areas). */
  area?: string;
  /** Step-free, with room for a wheelchair. */
  accessible?: boolean;
  /** window, booth, quiet, heated, covered, dog_friendly... */
  features?: string[];
  /** Where it sits on the floor plan (tables only; combined tables have none). */
  layout?: TableLayout;
  /** A person who is only bookable on these weekdays (0 = Sunday); unset, every day. */
  days?: number[];
  /** A member of staff: the back office's diary has a row each (estate agent only). */
  kind?: 'staff';
}

export interface TableLayout {
  x: number;
  y: number;
  shape: 'round' | 'square' | 'rect';
  seats: number;
  rotation?: number;
}

export interface PlanFixture {
  key: string;
  area: string;
  kind: 'bar' | 'door' | 'window' | 'wall';
  x: number;
  y: number;
  length: number;
  rotation: number;
}

/** A seating area: indoor, a terrace, the bar, a private room. */
export interface SeatingArea {
  key: string;
  label: string;
  kind: 'indoor' | 'outdoor' | 'bar' | 'private' | 'other';
  /** Bookable by phone. Unbookable areas are walk-in only. */
  reservable: boolean;
  /** Take details for a callback instead of booking (a private room). */
  enquiry_only?: boolean;
  /** Outdoor areas: what happens when it rains, said once to callers who choose it. */
  weather_note?: string;
}

export interface ModifierOption {
  key: string;
  name: string;
  price_pence: number;
  allergens?: Allergen[];
}

export interface ModifierGroup {
  label: string;
  min: number;
  max: number;
  options: ModifierOption[];
}

export interface MenuItem {
  key: string;
  name: string;
  price_pence: number;
  description?: string;
  allergens: Allergen[];
  /** The business has not published this dish's allergens: the agent must not say it has none. */
  allergens_unknown?: boolean;
  may_contain?: Allergen[];
  dietary?: string[];
  modifier_groups?: string[];
  available?: boolean;
  aliases?: string[];
}

export interface MenuCategory {
  key: string;
  label: string;
  items: MenuItem[];
}

export interface Menu {
  categories: MenuCategory[];
  modifier_groups: Record<string, ModifierGroup>;
  allergen_statement: string;
}

export interface Ordering {
  collection: boolean;
  /** Collection times are offered on this grid (default 15 minutes)... */
  slot_minutes?: number;
  /** ...with room for this many orders in each (unset: no limit). */
  slot_capacity?: number;
  /** Takeaway payment: card on the phone, pay on collection, or the caller's choice. Default either. */
  payment?: 'phone' | 'collection' | 'either';
  delivery?: {
    districts: string[];
    fee_pence: number;
    min_order_pence: number;
    extra_minutes: number;
  };
  prep_minutes: number;
  hours: OpeningHours[];
}

export interface KnowledgeEntry {
  q: string;
  a: string;
  tags?: string[];
  source?: string;
}

export interface TenantProfile {
  slug: string;
  name: string;
  business_type: BusinessType;
  timezone: string;
  status: 'demo' | 'pilot' | 'live';
  voice: string;
  /** BCP-47, default en-GB. Unset it (null) to let the model follow the caller's language. */
  language_code?: string | null;
  /** How long a pause ends the caller's turn; see REPLY_SPEEDS. Default normal. */
  reply_speed?: 'snappy' | 'normal' | 'patient';
  /** Pin this business to one Live model (the others stay as fallbacks). */
  live_model?: string | null;
  /**
   * Who decides the caller has finished. contextual (the default): this
   * server, from what was asked and what the caller is saying; see
   * src/core/turns.ts. standard: Gemini, after a fixed pause.
   */
  turn_taking?: 'contextual' | 'standard';
  greeting: string;
  /** How the business describes itself, in a sentence. */
  summary: string;
  address: string;
  phone_display?: string;
  /** Four digits for the shared demo line's PIN router. */
  demo_pin?: string;
  handoff_number?: string | null;
  owner_sms_number?: string | null;
  website?: string;
  brand?: Brand;
  /** The five or so most-asked answers; the only knowledge in the prompt. */
  core_facts: string[];
  opening_hours: OpeningHours[];
  closures?: { date: string; note?: string }[];
  knowledge: KnowledgeEntry[];
  booking?: {
    services: BookableService[];
    resources: Resource[];
    /** Seating areas, for businesses with more than one (indoor, terrace, bar). */
    areas?: SeatingArea[];
    /** Highchairs available. */
    highchairs?: number;
    /** Room shapes drawn on the floor plan (bar, door, window, wall): looks only. */
    fixtures?: PlanFixture[];
  };
  menu?: Menu;
  ordering?: Ordering;
  policies?: Record<string, string>;
  /**
   * The estate agent's three switches (presets/estate-agent.md §4.1): homes
   * for sale, the team messages go to, and the agency's settings. Only the
   * estate agent's compile writes them; without them a call runs as it
   * always has.
   */
  listings?: Listing[];
  team?: StaffMember[];
  estate?: EstateSettings;
  /**
   * The repairs contractor's settings (presets/property-maintenance.md
   * §4.1). Only the property maintenance compile writes it; without it a
   * call runs as it always has. Its windows and engineers live here, not in
   * booking, so no table or appointment tool is ever offered for a job.
   */
  maintenance?: MaintenanceSettings;
}

// ── Estate agency ─────────────────────────────────────────────────────────

export type Nation = 'england' | 'wales' | 'northern_ireland';
export type ListingStatus = 'coming_soon' | 'available' | 'under_offer' | 'sale_agreed' | 'exchanged' | 'completed' | 'withdrawn';
export type PriceQualifier = 'guide' | 'offers_over' | 'oiro' | 'fixed' | 'share';
export type HomeType = 'flat' | 'maisonette' | 'terraced' | 'end_terrace' | 'semi' | 'detached' | 'bungalow' | 'cottage' | 'other';
export type Tenure = 'freehold' | 'leasehold' | 'share_of_freehold' | 'shared_ownership' | 'unknown';
export type CheckValue = 'yes' | 'no' | 'unknown';
export const CHECK_KEYS = [
  'construction', 'heating', 'mains_gas', 'mains_water', 'mains_drainage', 'broadband', 'mobile',
  'parking', 'flooded', 'flood_defences', 'coastal_erosion', 'listed', 'conservation_area',
  'covenants', 'rights_of_way', 'planning', 'building_safety', 'accessibility', 'mining',
  'knotweed', 'disputes', 'alterations', 'warranty',
] as const;
/** The material-information checklist; construction 'no' means non-standard. */
export type CheckKey = (typeof CHECK_KEYS)[number];
export type StaffRole = 'manager' | 'negotiator' | 'valuer' | 'progressor' | 'adviser' | 'other';
export type StaffDuty = 'viewings' | 'valuations' | 'progression' | 'mortgage';
/** What a buyer has to sell first. */
export type Selling = 'nothing' | 'not_on_market' | 'on_market' | 'under_offer';
export type Funding = 'mortgage_aip' | 'mortgage_not_yet' | 'cash';

/** A home's viewing hours as the seller allows them: start and finish both inside. */
export interface ViewingWindow {
  days: number[];
  from: string;
  to: string;
}

/** Something the receptionist must say, and the words that show it was said (numbers in figures and in words). */
export interface SayItem {
  say: string;
  listen: string[];
}

export interface ListingLease {
  /** YYYY-MM-DD; the years left are worked out on the day (domain/listings.ts leaseYears). */
  expires: string;
  service_charge: string;
  ground_rent: string;
  reserve_fund: string;
  event_fee: string;
  managing_agent: string;
  age_limit: number | null;
  shared: { share_percent: number; rent_pence_month: number; provider: string; eligibility: string; nomination_weeks: number } | null;
}

/**
 * A home for sale, as the receptionist's tools read it: the owner's facts,
 * with the checklist in words and the must-say lines built in code. Status
 * and price here are what Start begins with; during the demo they live in
 * voice_listings.
 */
export interface Listing {
  key: string;
  /** The agency's own reference, quoted from the portals ("HG104"). */
  ref: string;
  number: string;
  street: string;
  district: string;
  town: string;
  /** "Flat 2, 41 Albion Road, Brackenford BK2". */
  address: string;
  initial: { status: ListingStatus; price_pence: number; qualifier: PriceQualifier };
  /** Relative to Start, so a sample never goes stale. */
  marketed_days_ago: number;
  reduced: { days_ago: number; from_pence: number } | null;
  back_on_market_days_ago: number | null;
  /** Coming soon: first viewings this many days after Start. */
  viewings_from_days: number | null;
  type: HomeType;
  beds: number;
  baths: number;
  receptions: number;
  /** "two-bedroom flat, one bathroom, one reception". */
  home: string;
  features: string[];
  summary: string;
  rooms: { name: string; size: string }[];
  tenure: Tenure;
  lease: ListingLease | null;
  local_tax: string;
  epc: string;
  /** Each check as the seller answered it, and in words; says is empty when unknown. */
  checks: Record<CheckKey, { v: CheckValue; says: string }>;
  /** What isn't in the details, in words ("flooding", "broadband speed"): never said as no. */
  unknown: string[];
  /** Must-say lines that never change; sayFirst adds the ones that depend on the day and the live status. */
  say_first: SayItem[];
  before_offer: SayItem[];
  seller_position: string;
  fall_through: string;
  viewing: {
    /** Empty: any of the agency's viewing hours. */
    windows: ViewingWindow[];
    notice_minutes: number;
    occupied: 'owner' | 'tenant' | 'vacant';
    key_held: boolean;
    /** First viewings only in office hours: an empty home under the agency's safety rule. Never said as empty. */
    first_in_office_hours: boolean;
    /** "Viewings on Saturdays 10am to 1pm and weekday evenings 5pm to 7pm.": all a caller hears about access. */
    rule: string;
  };
  /** A staff key. */
  negotiator: string;
  personal_interest: { staff: string; wording: string } | null;
  other_agents: string;
  links: ('brochure' | 'floorplan' | 'video' | 'epc')[];
  /** An invented sample home: the back office labels it "example". */
  example?: boolean;
}

/** A member of an agency's team, as messages and texts reach them. Callers hear the first name only. */
export interface StaffMember {
  key: string;
  name: string;
  first_name: string;
  role: StaffRole;
  does: StaffDuty[];
  days: number[];
  /** For urgent texts; shown on the demo's phone, never sent. */
  mobile: string;
}

export interface EstateSettings {
  nation: Nation;
  districts: string[];
  towns: string[];
  lettings: 'none' | 'message';
  lettings_contact: string | null;
  out_of_hours_booking: boolean;
  on_call: string | null;
  viewing_hours: OpeningHours[];
  valuation_hours: OpeningHours[];
  safety: { take_postcode: boolean; empty_office_hours_only: boolean };
  offers: {
    take: 'record' | 'message';
    buyer_fee_pence: number;
    /** "Buyers pay £36 including VAT each for ID checks, once an offer is accepted.", or empty. */
    buyer_fee: string;
    id_provider: string;
    best_final: string;
  };
  valuations: { name: string; minutes: number; rics: { offered: boolean; fee_pence: number; staff: string | null }; say: string };
  mortgage: { staff: string; firm: string; statement: string } | null;
  /** The nation's gas emergency number. */
  gas: string;
  /** Where a buyer checks for themselves what a home's details leave out ("the Environment Agency's long-term flood risk service on GOV.UK"). */
  official?: { flooding: string; local_tax: string; broadband: string; mobile: string };
  redress: 'tpo' | 'prs';
  complaints_handler: string;
  data_lead: string;
}

// ── Property maintenance ──────────────────────────────────────────────────

export type MtNation = 'england' | 'wales' | 'scotland' | 'northern_ireland';
export type MtClientKind = 'agent' | 'landlord' | 'block' | 'social' | 'commercial' | 'insurer';
export type JobPriority = 'emergency' | 'urgent' | 'routine';

/** A letting agent, landlord or other client: who authorises work, and up to how much. */
export interface MtClient {
  key: string;
  name: string;
  kind: MtClientKind;
  works_limit_pence: number;
  emergency_authority_pence: number;
  po_required: boolean;
  /** The authoriser. Their phone recognises them calling in, and is never read out. */
  contact: { name: string; phone: string | null; email: string };
  notice: 'every_job' | 'over_limit' | 'emergencies';
  /** For staff only. */
  instructions: string;
  status: 'active' | 'on_stop';
  example?: boolean;
}

/** An engineer as windows, dispatch and the on-call rota read them. Callers hear first_name only. */
export interface MtEngineer {
  key: string;
  name: string;
  first_name: string;
  trades: string[];
  /** Gas Safe registered: the only engineers a gas job may go to. */
  gas_safe: boolean;
  /** "Gas Safe 512345 (example)", "NICEIC": said when a caller asks. */
  accreditations: string[];
  days: number[];
  /** Empty: the whole area. */
  districts: string[];
  per_window: number;
}

/** A visit window as a caller books it: "Thursday morning, 8 to 12". */
export interface MtWindow {
  key: string;
  label: string;
  from: string;
  to: string;
  premium_pence: number;
  days: number[];
}

export interface MaintenanceSettings {
  nation: MtNation;
  districts: string[];
  towns: string[];
  customers: {
    homeowners: boolean;
    landlords: boolean;
    agents: boolean;
    blocks: boolean;
    social: { on: boolean; agent_of_landlord: boolean };
    commercial: boolean;
    insurers: boolean;
    tenant_no_client: 'contact_landlord' | 'private';
    recharge_lockouts: boolean;
  };
  clients: MtClient[];
  /** The trades that are on. */
  trades: { key: string; label: string; gas: boolean }[];
  dont_do: { what: string; suggest: string }[];
  engineers: MtEngineer[];
  on_call: { nights: { day: number; engineers: string[] }[]; escalate_minutes: number; duty_manager: { name: string; mobile: string } };
  priorities: {
    emergency: { attend_hours: number; make_safe_hours: number; examples: string[] };
    urgent: { working_days: number; examples: string[] };
    routine: { working_days: number; examples: string[] };
    vulnerable_uplift: boolean;
    winter_heating: boolean;
  };
  /** The only things the receptionist may suggest trying. */
  checks: { prepayment: boolean; thermostat: boolean; trip_reset: boolean; boiler_pressure: boolean };
  windows: MtWindow[];
  visits: { notice_hours: number; horizon_days: number; adult_present: boolean; call_ahead: boolean; abortive_fee_pence: number };
  prices: {
    vat_registered: boolean;
    callout_pence: number;
    half_hour_pence: number;
    ooh_first_hour_pence: number;
    minimum_pence: number;
    lockout_from_pence: number;
    free_quote_over_pence: number;
    card_on_booking: boolean;
    account_days: number;
    guarantee_months: number;
    cancellation: string;
  };
  planned: { gas_record_pence: number; extra_appliance_pence: number; boiler_service_pence: number; combined_pence: number; eicr_from_pence: number; reminder_weeks: number };
  /** The nation's gas emergency number. */
  gas: string;
  complaints_handler: string;
  data_lead: string;
}

/** A buyer's position, as viewings, offers and registrations take it. */
export interface BuyerPosition {
  first_time_buyer?: boolean;
  selling?: Selling;
  funding?: Funding;
  aip_amount_pence?: number;
}

export interface Brand {
  accent?: string;
  primary?: string;
  background?: string;
  font_heading?: string;
  font_body?: string;
  /** A data: URL or a path this server serves; never hotlinked. */
  logo?: string | null;
}

export interface Tenant {
  id: string;
  slug: string;
  profile: TenantProfile;
}

export interface Booking {
  id: string;
  tenant_id: string;
  reference: string;
  service_key: string;
  resource_key: string;
  starts_at: Date;
  ends_at: Date;
  party_size: number;
  name: string;
  phone: string | null;
  notes: string | null;
  status: 'confirmed' | 'cancelled';
  source: string;
  deposit_pence: number;
  deposit_paid: boolean;
  visit_status?: 'expected' | 'arrived' | 'seated' | 'finished' | 'no_show';
  allergies?: string | null;
  tags?: string[];
  area_key?: string | null;
  history?: { at: string; by: string; what: string }[];
  /** A viewing's home (estate agent). */
  listing_key?: string | null;
  /** A viewing's buyer and their position and feedback, or a valuation's lead (estate agent). */
  details?: Record<string, unknown>;
}

export interface OrderLine {
  line: number;
  item_key: string;
  name: string;
  quantity: number;
  unit_pence: number;
  modifiers: { key: string; name: string; price_pence: number }[];
  notes?: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  reference: string;
  name: string;
  phone: string | null;
  fulfilment: 'collection' | 'delivery';
  due_at: Date;
  address: string | null;
  postcode: string | null;
  lines: OrderLine[];
  subtotal_pence: number;
  delivery_fee_pence: number;
  total_pence: number;
  allergy_notes: string | null;
  status: string;
  payment_status: 'unpaid' | 'paid';
  created_at: Date;
}

export function pounds(pence: number): string {
  const sign = pence < 0 ? '-' : '';
  const p = Math.abs(pence);
  return `${sign}£${Math.floor(p / 100)}.${String(p % 100).padStart(2, '0')}`;
}

// ── An estate agency's records during the demo ───────────────────────────

export interface HistoryEntry {
  at: string;
  by: string;
  what: string;
}

/** A home's live row (voice_listings): what staff change while the demo runs, and Reset puts back. */
export interface ListingState {
  listing_key: string;
  status: ListingStatus;
  price_pence: number;
  qualifier: PriceQualifier;
  marketing_continues: boolean;
  best_final_at: Date | null;
  /** Facts staff are checking (check keys or "rooms", "price"): not stated until cleared. */
  checking: string[];
  /** Dates (YYYY-MM-DD, inclusive) no viewings may happen. */
  blocked: { from: string; to: string; note?: string }[];
  /** Who is selling, to check a seller who rings is one. Never returned to a caller. */
  sellers: { name: string; phone: string }[];
  marketed_at: Date;
  back_on_market_at: Date | null;
  /** The builder's status and price at the last sync, so a later builder change is noticed. */
  set_from: { status?: ListingStatus; price_pence?: number };
  history: HistoryEntry[];
}

export type OfferStatus = 'received' | 'sent' | 'accepted' | 'declined' | 'countered' | 'withdrawn';

export interface Offer {
  reference: string;
  listing_key: string;
  /** An earlier offer's reference this one raises or changes. */
  revises: string | null;
  amount_pence: number;
  buyer_names: string[];
  phone: string | null;
  email: string | null;
  position: BuyerPosition;
  conditions: string | null;
  solicitor: string | null;
  /** connected, company, gifted_deposit, viewed_elsewhere. */
  flags: string[];
  status: OfferStatus;
  received_at: Date;
  sent_at: Date | null;
  decided_at: Date | null;
  note: string | null;
  source: string;
  call_id?: string | null;
  history: HistoryEntry[];
}

export type SaleStatus = 'progressing' | 'exchanged' | 'completed' | 'fell_through';
/** A sale's steps, from the memorandum to the keys (presets/estate-agent.md §6, Sales progress). */
export const SALE_MILESTONES = ['memorandum_sent', 'solicitors_instructed', 'searches', 'survey', 'mortgage_offer', 'enquiries_answered', 'exchange', 'completion'] as const;

export interface SaleParty {
  /** buyer_solicitor, seller_solicitor, chain_agent, broker. */
  role: string;
  name: string;
  firm?: string;
  phone?: string;
}

export interface Sale {
  id?: string;
  listing_key: string;
  offer_ref: string | null;
  buyer_name: string;
  buyer_phone: string | null;
  agreed_pence: number;
  milestones: { key: string; done_at: string | null }[];
  /** YYYY-MM-DD. */
  exchange_target: string | null;
  completion_date: string | null;
  parties: SaleParty[];
  chain: string | null;
  status: SaleStatus;
  keys_released_at: Date | null;
  updates: HistoryEntry[];
  created_at: Date;
}

/** What an agency knows about a buyer (voice_customers.details). */
export interface BuyerDetails {
  roles?: ('buyer' | 'seller' | 'landlord' | 'tenant')[];
  position?: BuyerPosition;
  requirements?: { areas?: string[]; max_price_pence?: number; min_beds?: number; types?: HomeType[]; must_haves?: string[]; timescale?: string };
  /** When they said yes to alerts; marketing_consent is the switch. */
  consent_at?: string | null;
  /** Homes they would buy if a sale falls through. */
  backup_for?: string[];
  investor?: boolean;
  /** Marked hot by staff in Applicants: ready to buy, worth a call first. */
  hot?: boolean;
  email?: string;
  /** Who in the team rang them and missed them: who, never why. */
  tried_to_call?: { by: string; at: string };
  last_contact?: string;
  source?: string;
}

export interface Buyer {
  phone: string;
  name: string | null;
  details: BuyerDetails;
  marketing_consent: boolean;
}
