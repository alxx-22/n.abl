// The tenant profile: everything the receptionist knows about one business.
//
// It is one JSON document per tenant (voice_tenants.profile), not a dozen
// tables. The setup wizard produces it in one go, the console edits it in one
// go, and a demo business never has enough menu items for normalisation to pay
// for itself. Transactional records (bookings, orders, payments, calls) are
// proper tables.

export type BusinessType = 'restaurant' | 'cafe' | 'takeaway' | 'pub' | 'hotel' | 'salon' | 'barber' | 'other';

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
}

export interface Resource {
  key: string;
  label: string;
  services: string[];
  capacity?: number;
  min?: number;
  /** A combined resource (two pushed-together tables) blocks its parts, and vice versa. */
  combines?: string[];
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
  brand?: { accent?: string };
  /** The five or so most-asked answers; the only knowledge in the prompt. */
  core_facts: string[];
  opening_hours: OpeningHours[];
  closures?: { date: string; note?: string }[];
  knowledge: KnowledgeEntry[];
  booking?: { services: BookableService[]; resources: Resource[] };
  menu?: Menu;
  ordering?: Ordering;
  policies?: Record<string, string>;
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
