// Two jobs. sanitise(): rebuild answers from whatever JSON arrived, field by
// field, with bounds and defaults, so a hand-crafted request cannot put
// anything odd into a profile. validate(): what the builder shows as still
// missing or wrong before Start.

import { ALLERGENS, type Allergen, type MenuCategory, type MenuItem, type ModifierGroup } from '../../domain/types.ts';
import { VOICE_NAMES } from '../../domain/voices.ts';
import { defaultAnswers, type AreaAnswer, type DayHours, type RestaurantAnswers, type TableAnswer } from './answers.ts';
import { tableBookable } from './compile.ts';

const str = (v: unknown, max: number, fallback = ''): string => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const time = (v: unknown, fallback: string): string => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
const colour = (v: unknown, fallback: string): string => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const key = (v: unknown, fallback: string): string => {
  const s = typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) : '';
  return s || fallback;
};
const FEATURES = ['window', 'booth', 'quiet', 'heated', 'covered', 'dog_friendly', 'high_table', 'sofa', 'view'] as const;

function days(v: unknown, d: DayHours[]): DayHours[] {
  const input = arr(v);
  return d.map((def, i) => {
    const x = (input[i] ?? {}) as any;
    const services = arr(x.services).slice(0, 3).map((s: any, j) => ({
      label: str(s?.label, 30, j === 0 ? 'Lunch' : 'Dinner') || 'Open',
      open: time(s?.open, '12:00'),
      close: time(s?.close, '22:00'),
    }));
    return { open: bool(x.open, def.open) && services.length > 0, services: x.services === undefined ? def.services : services };
  });
}

function areas(v: unknown, d: AreaAnswer[]): AreaAnswer[] {
  const list = arr(v).slice(0, 8).map((x: any, i): AreaAnswer => ({
    key: key(x?.key, `area_${i + 1}`),
    label: str(x?.label, 30, `Area ${i + 1}`) || `Area ${i + 1}`,
    kind: oneOf(x?.kind, ['indoor', 'outdoor', 'bar', 'private', 'other'] as const, 'indoor'),
    reservable: bool(x?.reservable, true),
    enquiry_only: bool(x?.enquiry_only, false),
    weather_rule: x?.kind === 'outdoor' ? oneOf(x?.weather_rule, ['move_inside', 'own_risk', 'walk_in_only'] as const, 'move_inside') : null,
  }));
  const seen = new Set<string>();
  const unique = list.filter((a) => (seen.has(a.key) ? false : (seen.add(a.key), true)));
  return v === undefined ? d : unique;
}

function tables(v: unknown, areaKeys: Set<string>, d: TableAnswer[]): TableAnswer[] {
  if (v === undefined) return d;
  const list = arr(v).slice(0, 80).map((x: any, i): TableAnswer => {
    const seats = int(x?.seats, 1, 20, 4);
    const k = typeof x?.key === 'string' && /^[A-Za-z0-9]{1,8}$/.test(x.key) ? x.key : `T${i + 1}`;
    return {
      key: k,
      label: str(x?.label, 30, `Table ${i + 1}`) || `Table ${i + 1}`,
      area: typeof x?.area === 'string' && areaKeys.has(x.area) ? x.area : [...areaKeys][0] ?? 'indoor',
      seats,
      shape: oneOf(x?.shape, ['round', 'square', 'rect'] as const, seats <= 2 ? 'round' : seats <= 4 ? 'square' : 'rect'),
      x: int(x?.x, 0, 2000, 0),
      y: int(x?.y, 0, 4000, 0),
      rotation: int(x?.rotation, 0, 359, 0),
      accessible: bool(x?.accessible, false),
      walk_in: bool(x?.walk_in, false),
      features: arr(x?.features).filter((f): f is (typeof FEATURES)[number] => FEATURES.includes(f as never)),
      joins: arr(x?.joins).filter((j): j is string => typeof j === 'string').slice(0, 4),
    };
  });
  const seen = new Set<string>();
  const unique = list.filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true)));
  // Joins must point at real tables, both ways.
  const keys = new Set(unique.map((t) => t.key));
  for (const t of unique) t.joins = [...new Set(t.joins.filter((j) => j !== t.key && keys.has(j)))];
  for (const t of unique) for (const j of t.joins) {
    const u = unique.find((x) => x.key === j)!;
    if (!u.joins.includes(t.key)) u.joins.push(t.key);
  }
  return unique;
}

const allergens = (v: unknown): Allergen[] => [...new Set(arr(v).filter((a): a is Allergen => ALLERGENS.includes(a as Allergen)))];

function menu(v: any, d: RestaurantAnswers['menu']): RestaurantAnswers['menu'] {
  if (!v || typeof v !== 'object') return d;
  const groups: Record<string, ModifierGroup> = {};
  for (const [k, g] of Object.entries((v.modifier_groups ?? {}) as Record<string, any>).slice(0, 30)) {
    const gk = key(k, 'options');
    groups[gk] = {
      label: str(g?.label, 40, 'Options'),
      min: int(g?.min, 0, 5, 0),
      max: int(g?.max, 1, 10, 1),
      options: arr(g?.options).slice(0, 20).map((o: any, i) => ({
        key: key(o?.key ?? o?.name, `opt_${i + 1}`),
        name: str(o?.name, 50, `Option ${i + 1}`),
        price_pence: int(o?.price_pence, 0, 100000, 0),
        allergens: allergens(o?.allergens),
      })),
    };
  }
  const itemKeys = new Set<string>();
  const categories: MenuCategory[] = arr(v.categories).slice(0, 20).map((c: any, ci) => ({
    key: key(c?.key ?? c?.label, `cat_${ci + 1}`),
    label: str(c?.label, 40, `Section ${ci + 1}`),
    items: arr(c?.items).slice(0, 60).map((it: any, ii): MenuItem => {
      let k = key(it?.key ?? it?.name, `item_${ci + 1}_${ii + 1}`);
      while (itemKeys.has(k)) k = `${k}_2`;
      itemKeys.add(k);
      const dietary = arr(it?.dietary).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 20)).slice(0, 5);
      const mods = arr(it?.modifier_groups).filter((g): g is string => typeof g === 'string' && g in groups);
      const aliases = arr(it?.aliases).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 5);
      return {
        key: k,
        name: str(it?.name, 60, `Dish ${ii + 1}`) || `Dish ${ii + 1}`,
        price_pence: int(it?.price_pence, 0, 100000, 0),
        description: str(it?.description, 200) || undefined,
        allergens: allergens(it?.allergens),
        allergens_unknown: it?.allergens_unknown === true || undefined,
        may_contain: allergens(it?.may_contain).length ? allergens(it?.may_contain) : undefined,
        dietary: dietary.length ? dietary : undefined,
        modifier_groups: mods.length ? mods : undefined,
        available: it?.available === false ? false : undefined,
        aliases: aliases.length ? aliases : undefined,
      };
    }),
  }));
  return {
    categories,
    modifier_groups: groups,
    allergen_statement: str(v.allergen_statement, 600, d.allergen_statement) || d.allergen_statement,
    source: oneOf(v.source, ['sample', 'draft', 'website', 'manual'] as const, 'manual'),
    allergens_are_examples: bool(v.allergens_are_examples, true),
  };
}

export function sanitiseRestaurant(input: unknown): RestaurantAnswers {
  const d = defaultAnswers();
  const x = (input ?? {}) as any;
  const ar = areas(x.seating?.areas, d.seating.areas);
  const areaKeys = new Set(ar.map((a) => a.key));
  const b = x.basics ?? {};
  const h = x.hours ?? {};
  const s = x.serve ?? {};
  const st = x.seating ?? {};
  const m = x.money ?? {};
  const p = x.policies ?? {};
  const th = x.theme ?? {};
  return {
    version: 1,
    basics: {
      name: str(b.name, 60, d.basics.name),
      style: str(b.style, 160, d.basics.style),
      town: str(b.town, 60, d.basics.town),
      address: str(b.address, 160, d.basics.address),
      phone_display: str(b.phone_display, 20, d.basics.phone_display),
      website: str(b.website, 200, d.basics.website),
      voice: typeof b.voice === 'string' && VOICE_NAMES.has(b.voice) ? b.voice : d.basics.voice,
      greeting: str(b.greeting, 300, d.basics.greeting),
    },
    hours: {
      days: days(h.days, d.hours.days),
      last_booking_before_close: int(h.last_booking_before_close, 0, 240, d.hours.last_booking_before_close),
      closures: arr(h.closures).slice(0, 30)
        .map((c: any) => ({ date: typeof c?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? c.date : '', note: str(c?.note, 60) }))
        .filter((c) => c.date),
    },
    serve: {
      reservations: bool(s.reservations, d.serve.reservations),
      walk_ins: bool(s.walk_ins, d.serve.walk_ins),
      collection: {
        enabled: bool(s.collection?.enabled, d.serve.collection.enabled),
        prep_minutes: int(s.collection?.prep_minutes, 5, 120, d.serve.collection.prep_minutes),
        slot_minutes: oneOf(s.collection?.slot_minutes, [5, 10, 15, 20, 30] as unknown as readonly number[] as never, d.serve.collection.slot_minutes as never),
        per_slot: int(s.collection?.per_slot, 0, 50, d.serve.collection.per_slot),
        evenings_only: bool(s.collection?.evenings_only, d.serve.collection.evenings_only),
      },
      delivery: {
        enabled: bool(s.delivery?.enabled, d.serve.delivery.enabled),
        districts: arr(s.delivery?.districts).filter((z): z is string => typeof z === 'string')
          .map((z) => z.toUpperCase().replace(/\s+/g, '')).filter((z) => /^[A-Z]{1,2}\d[A-Z\d]?$/.test(z)).slice(0, 30),
        fee_pence: int(s.delivery?.fee_pence, 0, 2000, d.serve.delivery.fee_pence),
        min_order_pence: int(s.delivery?.min_order_pence, 0, 10000, d.serve.delivery.min_order_pence),
        extra_minutes: int(s.delivery?.extra_minutes, 0, 120, d.serve.delivery.extra_minutes),
      },
      delivery_apps: arr(s.delivery_apps).filter((z): z is string => typeof z === 'string').map((z) => z.slice(0, 20)).slice(0, 5),
    },
    seating: {
      areas: ar,
      tables: tables(st.tables, areaKeys, d.seating.tables),
      sittings: {
        up_to_2: int(st.sittings?.up_to_2, 30, 300, d.seating.sittings.up_to_2),
        up_to_4: int(st.sittings?.up_to_4, 30, 300, d.seating.sittings.up_to_4),
        up_to_8: int(st.sittings?.up_to_8, 30, 360, d.seating.sittings.up_to_8),
        larger: int(st.sittings?.larger, 30, 480, d.seating.sittings.larger),
      },
      max_party: int(st.max_party, 1, 60, d.seating.max_party),
      notice_minutes: int(st.notice_minutes, 0, 1440, d.seating.notice_minutes),
      horizon_days: int(st.horizon_days, 1, 365, d.seating.horizon_days),
      highchairs: int(st.highchairs, 0, 30, d.seating.highchairs),
      buffer_minutes: int(st.buffer_minutes, 0, 60, d.seating.buffer_minutes),
    },
    menu: menu(x.menu, d.menu),
    money: {
      deposit: {
        mode: oneOf(m.deposit?.mode, ['none', 'per_person', 'per_booking', 'card_hold'] as const, d.money.deposit.mode),
        amount_pence: int(m.deposit?.amount_pence, 0, 50000, d.money.deposit.amount_pence),
        min_party: int(m.deposit?.min_party, 1, 60, d.money.deposit.min_party),
      },
      cancellation_policy: str(m.cancellation_policy, 300, d.money.cancellation_policy),
      takeaway_payment: oneOf(m.takeaway_payment, ['phone', 'collection', 'either'] as const, d.money.takeaway_payment),
      service_charge: str(m.service_charge, 200, d.money.service_charge),
    },
    policies: {
      children: str(p.children, 200, d.policies.children),
      dogs: oneOf(p.dogs, ['inside', 'outside_only', 'no'] as const, d.policies.dogs),
      accessibility: str(p.accessibility, 300, d.policies.accessibility),
      parking: str(p.parking, 300, d.policies.parking),
      dress_code: str(p.dress_code, 200, d.policies.dress_code),
      corkage: str(p.corkage, 200, d.policies.corkage),
      cakes: str(p.cakes, 200, d.policies.cakes),
      vouchers: str(p.vouchers, 200, d.policies.vouchers),
      dietary: str(p.dietary, 300, d.policies.dietary),
      faqs: arr(p.faqs).slice(0, 20).map((f: any) => ({ q: str(f?.q, 150), a: str(f?.a, 500) })).filter((f) => f.q && f.a),
    },
    theme: {
      accent: colour(th.accent, d.theme.accent),
      primary: colour(th.primary, d.theme.primary),
      background: colour(th.background, d.theme.background),
      font_heading: str(th.font_heading, 60, d.theme.font_heading).replace(/[^A-Za-z0-9 \-]/g, '') || d.theme.font_heading,
      font_body: str(th.font_body, 60, d.theme.font_body).replace(/[^A-Za-z0-9 \-]/g, '') || d.theme.font_body,
      // Logos are only ever data: URLs the scout made or our own paths.
      logo: typeof th.logo === 'string' && (/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(th.logo) && th.logo.length < 400_000) ? th.logo : null,
    },
    sources: Object.fromEntries(
      Object.entries((x.sources ?? {}) as Record<string, unknown>)
        .filter(([k, v]) => /^[a-z_.0-9]{1,60}$/.test(k) && (v === 'website' || v === 'guess'))
        .slice(0, 100),
    ) as Record<string, 'website' | 'guess'>,
  };
}

export interface Issue {
  /** The builder step it belongs to. */
  step: 'basics' | 'hours' | 'serve' | 'seating' | 'floor' | 'menu' | 'money' | 'policies';
  level: 'error' | 'warning';
  message: string;
}

export function validateRestaurant(a: RestaurantAnswers): Issue[] {
  const out: Issue[] = [];
  const err = (step: Issue['step'], message: string) => out.push({ step, level: 'error', message });
  const warn = (step: Issue['step'], message: string) => out.push({ step, level: 'warning', message });

  if (!a.basics.name) err('basics', 'Give the restaurant a name.');
  if (a.basics.greeting && (!/\bAI\b/.test(a.basics.greeting) || !/\bdemo\b/i.test(a.basics.greeting))) {
    err('basics', 'The greeting must say it is an AI assistant and that this is a demo line.');
  }
  if (!a.hours.days.some((d) => d.open && d.services.length)) err('hours', 'Open on at least one day.');
  a.hours.days.forEach((d, i) => {
    for (const s of d.open ? d.services : []) {
      if (s.close <= s.open) err('hours', `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}: ${s.label} closes before it opens.`);
    }
  });
  if (!a.serve.reservations && !a.serve.collection.enabled && !a.serve.delivery.enabled) {
    warn('serve', 'With no bookings and no takeaway, the receptionist can only answer questions.');
  }
  if (a.serve.reservations) {
    if (!a.seating.areas.length) err('seating', 'Add at least one seating area.');
    if (!a.seating.tables.some((t) => tableBookable(a, t))) err('seating', 'Nothing is bookable: add tables to an area that takes bookings.');
    if (a.seating.max_party < 2) err('seating', 'Allow bookings for at least two people.');
    const biggest = Math.max(0, ...a.seating.tables.filter((t) => tableBookable(a, t)).map((t) => t.seats));
    const pair = Math.max(0, ...a.seating.tables.flatMap((t) => t.joins.map((j) => t.seats + (a.seating.tables.find((u) => u.key === j)?.seats ?? 0))));
    if (Math.max(biggest, pair) < Math.min(a.seating.max_party, 8)) {
      warn('seating', `No table or pair of tables seats ${Math.min(a.seating.max_party, 8)}; bigger parties will be offered a callback.`);
    }
    for (const t of a.seating.tables) {
      const clash = a.seating.tables.find((u) => u !== t && u.area === t.area && Math.abs(u.x - t.x) < 30 && Math.abs(u.y - t.y) < 30);
      if (clash && t.key < clash.key) warn('floor', `${t.label} and ${clash.label} overlap on the floor plan.`);
    }
  }
  const items = a.menu.categories.flatMap((c) => c.items);
  if ((a.serve.collection.enabled || a.serve.delivery.enabled) && !items.length) err('menu', 'Takeaway needs a menu: add some dishes or turn takeaway off.');
  if (items.some((i) => i.price_pence === 0)) warn('menu', 'Some dishes have no price yet.');
  if (a.menu.allergens_are_examples && items.length) warn('menu', 'The allergens are examples until you check them.');
  if (a.serve.delivery.enabled && !a.serve.delivery.districts.length) err('serve', 'List the postcode districts you deliver to, like NG1.');
  if (a.money.deposit.mode !== 'none' && a.money.deposit.mode !== 'card_hold' && a.money.deposit.amount_pence <= 0) err('money', 'Set the deposit amount.');
  return out;
}
