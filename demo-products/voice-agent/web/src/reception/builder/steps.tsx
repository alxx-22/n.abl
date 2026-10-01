// The builder's steps, one component each. Field by field in
// DEMO-SERVICE-PLAN.md §4.1; every field says what it changes.

import { useEffect, useRef, useState } from 'react';
import { DEMO_API, audioBlob, demoApi } from '../../api.ts';
import { PlayIcon } from '../../components/Icons.tsx';
import { toast } from '../../components/Toaster.tsx';
import { autoLayout } from '../../../../src/presets/restaurant/layout.ts';
import type { AreaAnswer, RestaurantAnswers, TableAnswer, WorkspacePayload } from '../types.ts';
import type { VoiceMeta } from '../../types.ts';
import type { StepProps } from './Builder.tsx';
import { Choice, Num, Pounds, Select, Source, Text, Toggle } from './fields.tsx';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const ALLERGENS = ['celery', 'gluten', 'crustaceans', 'eggs', 'fish', 'lupin', 'milk', 'molluscs', 'mustard', 'nuts', 'peanuts', 'sesame', 'soya', 'sulphites'] as const;
const FEATURES: { key: string; label: string }[] = [
  { key: 'window', label: 'Window' }, { key: 'booth', label: 'Booth' }, { key: 'quiet', label: 'Quiet' }, { key: 'heated', label: 'Heated' },
  { key: 'covered', label: 'Covered' }, { key: 'dog_friendly', label: 'Dog-friendly' }, { key: 'high_table', label: 'High table' },
  { key: 'sofa', label: 'Sofa' }, { key: 'view', label: 'View' },
];
export { FEATURES };

// ── 1. Basics ───────────────────────────────────────────────────────────

let voiceCache: VoiceMeta | null = null;

export function StepBasics({ a, set, ws }: StepProps) {
  const [voices, setVoices] = useState<VoiceMeta | null>(voiceCache);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!voiceCache) demoApi<VoiceMeta>('/voices').then((v) => setVoices((voiceCache = v))).catch(() => {});
    return () => audio.current?.pause();
  }, []);
  const hear = async () => {
    setPlaying(true);
    try {
      const blob = await audioBlob(`${DEMO_API}/workspaces/${ws.id}/voice-preview`, { voice: a.basics.voice, greeting: a.basics.greeting || ws.preview?.greeting }, false);
      audio.current?.pause();
      audio.current = new Audio(URL.createObjectURL(blob));
      await audio.current.play();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setPlaying(false);
    }
  };
  const s = a.sources;
  return (
    <div className="fields">
      <Text label={<>Restaurant name <Source of="basics.name" sources={s} /></>} value={a.basics.name} max={60} onChange={(v) => set((d) => void (d.basics.name = v))} hint="In the greeting, every text, and everything the receptionist says." />
      <Text label={<>Style or cuisine <Source of="basics.style" sources={s} /></>} value={a.basics.style} max={160} placeholder="Neapolitan pizza and fresh pasta" onChange={(v) => set((d) => void (d.basics.style = v))} hint="Shapes the menu draft and how the receptionist describes you." />
      <div className="two">
        <Text label={<>Town <Source of="basics.town" sources={s} /></>} value={a.basics.town} max={60} onChange={(v) => set((d) => void (d.basics.town = v))} />
        <Text label={<>Phone number shown <Source of="basics.phone_display" sources={s} /></>} value={a.basics.phone_display} max={20} onChange={(v) => set((d) => void (d.basics.phone_display = v))} />
      </div>
      <Text label={<>Address <Source of="basics.address" sources={s} /></>} value={a.basics.address} max={160} placeholder="12 High Street, fictional is fine" onChange={(v) => set((d) => void (d.basics.address = v))} hint="For directions questions. A made-up address is fine for a demo." />

      <div className="field">
        <label htmlFor="b-voice">Voice</label>
        <div className="field-row">
          <select id="b-voice" value={a.basics.voice} onChange={(e) => set((d) => void (d.basics.voice = e.target.value))}>
            {(voices?.voices ?? [{ name: a.basics.voice, style: '' }]).map((v) => (
              <option key={v.name} value={v.name}>{v.name}{v.style ? ` (${v.style})` : ''}</option>
            ))}
          </select>
          <button type="button" onClick={hear} disabled={playing}><PlayIcon /> {playing ? 'Generating…' : 'Hear it'}</button>
        </div>
      </div>
      <Text
        label="Greeting" area rows={2} max={300} value={a.basics.greeting} placeholder={ws.preview?.greeting}
        onChange={(v) => set((d) => void (d.basics.greeting = v))}
        hint="Leave empty for the one shown. Yours must say it is an AI assistant and that this is a demo line."
      />
      <div className="field">
        <label htmlFor="b-accent">Accent colour <Source of="theme.accent" sources={s} /></label>
        <div className="field-row colour-row">
          <input id="b-accent" type="color" value={a.theme.accent} onChange={(e) => set((d) => void (d.theme.accent = e.target.value))} />
          <span className="mono small">{a.theme.accent}</span>
          {a.theme.logo ? <img className="logo-preview" src={a.theme.logo} alt="Your logo" /> : null}
        </div>
        <p className="hint">Your workspace, floor plan and texts take this colour.</p>
      </div>
    </div>
  );
}

// ── 2. Hours ────────────────────────────────────────────────────────────

export function StepHours({ a, set }: StepProps) {
  return (
    <div className="fields">
      <p className="lead">When you are open, and the services within each day. The receptionist only offers times inside these, and answers “are you open?” from them. <Source of="hours.days" sources={a.sources} /></p>
      <div className="hours">
        {WEEK.map((i) => {
          const day = a.hours.days[i];
          return (
            <div className="day-row" key={i}>
              <Toggle label={DAY_NAMES[i]} checked={day.open} onChange={(v) => set((d) => {
                d.hours.days[i].open = v;
                if (v && !d.hours.days[i].services.length) d.hours.days[i].services = [{ label: 'Dinner', open: '17:30', close: '22:00' }];
              })} />
              {day.open ? (
                <div className="services">
                  {day.services.map((sv, j) => (
                    <div className="service" key={j}>
                      <input aria-label={`${DAY_NAMES[i]} service name`} value={sv.label} maxLength={30} onChange={(e) => set((d) => void (d.hours.days[i].services[j].label = e.target.value))} />
                      <input aria-label={`${DAY_NAMES[i]} ${sv.label} opens`} type="time" step={900} value={sv.open} onChange={(e) => set((d) => void (d.hours.days[i].services[j].open = e.target.value))} />
                      <span className="muted">to</span>
                      <input aria-label={`${DAY_NAMES[i]} ${sv.label} closes`} type="time" step={900} value={sv.close} onChange={(e) => set((d) => void (d.hours.days[i].services[j].close = e.target.value))} />
                      <button type="button" className="ghost" aria-label={`Remove ${sv.label}`} onClick={() => set((d) => {
                        d.hours.days[i].services.splice(j, 1);
                        if (!d.hours.days[i].services.length) d.hours.days[i].open = false;
                      })}>✕</button>
                    </div>
                  ))}
                  {day.services.length < 3 ? (
                    <button type="button" className="ghost small" onClick={() => set((d) => void d.hours.days[i].services.push(d.hours.days[i].services.length ? { label: 'Dinner', open: '17:30', close: '22:00' } : { label: 'Lunch', open: '12:00', close: '14:30' }))}>
                      + Add a service
                    </button>
                  ) : null}
                </div>
              ) : (
                <span className="muted small">Closed</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="row-tools">
        <button type="button" className="small" onClick={() => set((d) => { const t = d.hours.days[2]; for (const k of [3, 4, 5, 6]) d.hours.days[k] = structuredClone(t); })}>Copy Tuesday to Wednesday–Saturday</button>
      </div>
      <Select
        label="Last booking" value={a.hours.last_booking_before_close}
        options={[0, 30, 45, 60, 75, 90, 120].map((m) => ({ value: m, label: m ? `${m} minutes before close` : 'Right up to close' }))}
        onChange={(v) => set((d) => void (d.hours.last_booking_before_close = v))}
        hint="The latest start time the receptionist offers in each service."
      />
      <div className="field">
        <label>Closures</label>
        {a.hours.closures.map((c, j) => (
          <div className="field-row" key={j}>
            <input type="date" aria-label="Closed on" value={c.date} onChange={(e) => set((d) => void (d.hours.closures[j].date = e.target.value))} />
            <input aria-label="Reason" placeholder="Private event" maxLength={60} value={c.note} onChange={(e) => set((d) => void (d.hours.closures[j].note = e.target.value))} />
            <button type="button" className="ghost" aria-label="Remove closure" onClick={() => set((d) => void d.hours.closures.splice(j, 1))}>✕</button>
          </div>
        ))}
        <button type="button" className="ghost small" onClick={() => set((d) => void d.hours.closures.push({ date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), note: '' }))}>+ Add a closure</button>
        <p className="hint">Days you are shut outside the usual pattern: a holiday, a private hire.</p>
      </div>
    </div>
  );
}

// ── 3. How you serve ────────────────────────────────────────────────────

const APPS = ['Deliveroo', 'Uber Eats', 'Just Eat'];

export function StepServe({ a, set }: StepProps) {
  const c = a.serve.collection;
  const dl = a.serve.delivery;
  return (
    <div className="fields">
      <Toggle label="Table reservations" checked={a.serve.reservations} onChange={(v) => set((d) => void (d.serve.reservations = v))} hint="The receptionist books tables into your floor plan. Seating and the floor plan come next." />
      <Toggle label="Walk-ins welcome" checked={a.serve.walk_ins} onChange={(v) => set((d) => void (d.serve.walk_ins = v))} hint="Tables marked for walk-ins stay free in the diary, and the receptionist says “do pop by”." />
      <div className={`group ${c.enabled ? 'on' : ''}`}>
        <Toggle label="Click and collect" checked={c.enabled} onChange={(v) => set((d) => void (d.serve.collection.enabled = v))} hint="Phone orders for collection, into collection slots the kitchen can handle." />
        {c.enabled ? (
          <div className="three">
            <Num label="Prep time" suffix="min" min={5} max={120} value={c.prep_minutes} onChange={(v) => set((d) => void (d.serve.collection.prep_minutes = v))} hint="Earliest collection is now plus this." />
            <Select label="A slot every" value={c.slot_minutes} options={[5, 10, 15, 20, 30].map((m) => ({ value: m, label: `${m} minutes` }))} onChange={(v) => set((d) => void (d.serve.collection.slot_minutes = v))} />
            <Num label="Orders per slot" min={0} max={50} value={c.per_slot} onChange={(v) => set((d) => void (d.serve.collection.per_slot = v))} hint="0 means no limit." />
            <Toggle label="Evenings only" checked={c.evenings_only} onChange={(v) => set((d) => void (d.serve.collection.evenings_only = v))} />
          </div>
        ) : null}
      </div>
      <div className={`group ${dl.enabled ? 'on' : ''}`}>
        <Toggle label="Delivery by your own drivers" checked={dl.enabled} onChange={(v) => set((d) => void (d.serve.delivery.enabled = v))} hint="The receptionist checks the postcode, the minimum order and adds the fee." />
        {dl.enabled ? (
          <>
            <Text label="Postcode districts" value={dl.districts.join(', ')} placeholder="NG1, NG2, NG3, NG7" onChange={(v) => set((d) => void (d.serve.delivery.districts = v.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean)))} hint="The first half of the postcode, like NG1." />
            <div className="three">
              <Pounds label="Delivery fee" pence={dl.fee_pence} max={2000} onChange={(v) => set((d) => void (d.serve.delivery.fee_pence = v))} />
              <Pounds label="Minimum order" pence={dl.min_order_pence} max={10000} onChange={(v) => set((d) => void (d.serve.delivery.min_order_pence = v))} />
              <Num label="Extra time" suffix="min" min={0} max={120} value={dl.extra_minutes} onChange={(v) => set((d) => void (d.serve.delivery.extra_minutes = v))} />
            </div>
          </>
        ) : null}
      </div>
      <fieldset className="choice inline">
        <legend>Also on delivery apps <Source of="serve.delivery_apps" sources={a.sources} /></legend>
        {APPS.map((app) => (
          <label key={app}>
            <input type="checkbox" checked={a.serve.delivery_apps.includes(app)} onChange={(e) => set((d) => {
              d.serve.delivery_apps = e.target.checked ? [...d.serve.delivery_apps, app] : d.serve.delivery_apps.filter((x) => x !== app);
            })} />
            <span>{app}</span>
          </label>
        ))}
        <p className="hint">For answers only: “you’ll find us on Deliveroo”. The receptionist does not take app orders.</p>
      </fieldset>
    </div>
  );
}

// ── 4. Seating ──────────────────────────────────────────────────────────

const KINDS: { value: AreaAnswer['kind']; label: string }[] = [
  { value: 'indoor', label: 'Inside' }, { value: 'outdoor', label: 'Outdoor' }, { value: 'bar', label: 'Bar or counter' },
  { value: 'private', label: 'Private room' }, { value: 'other', label: 'Other' },
];

function nextTableKey(tables: TableAnswer[]): number {
  return Math.max(0, ...tables.map((t) => Number(/^T(\d+)$/.exec(t.key)?.[1] ?? 0))) + 1;
}

export function addTable(d: RestaurantAnswers, area: string, seats: number): void {
  const n = nextTableKey(d.seating.tables);
  d.seating.tables.push({
    key: `T${n}`, label: `Table ${n}`, area, seats, shape: seats <= 2 ? 'round' : seats <= 4 ? 'square' : 'rect',
    x: 0, y: 0, rotation: 0, accessible: false, walk_in: false, features: [], joins: [],
  });
  d.seating.tables = autoLayout(d.seating.areas, d.seating.tables);
}

export function removeTable(d: RestaurantAnswers, key: string): void {
  d.seating.tables = d.seating.tables.filter((t) => t.key !== key);
  for (const t of d.seating.tables) t.joins = t.joins.filter((j) => j !== key);
}

export function StepSeating({ a, set }: StepProps) {
  const sizes = [2, 4, 6, 8];
  const addArea = (kind: AreaAnswer['kind']) => set((d) => {
    const label = { indoor: 'Inside', outdoor: 'Terrace', bar: 'Bar', private: 'Private dining room', other: 'Upstairs' }[kind];
    let key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    while (d.seating.areas.some((x) => x.key === key)) key += '_2';
    d.seating.areas.push({ key, label, kind, reservable: kind !== 'bar', enquiry_only: kind === 'private', weather_rule: kind === 'outdoor' ? 'move_inside' : null });
    addTable(d, key, kind === 'private' ? 8 : 4);
  });
  return (
    <div className="fields">
      <p className="lead">Your areas and how many tables of each size. You arrange them on the floor plan next.</p>
      {a.seating.areas.map((ar, i) => {
        const mine = a.seating.tables.filter((t) => t.area === ar.key);
        const covers = mine.reduce((n, t) => n + t.seats, 0);
        const walkIns = mine.filter((t) => t.walk_in).length;
        return (
          <div className="group on area-card" key={ar.key}>
            <div className="area-head">
              <input aria-label="Area name" className="area-name" value={ar.label} maxLength={30} onChange={(e) => set((d) => void (d.seating.areas[i].label = e.target.value))} />
              <select aria-label="Kind of area" value={ar.kind} onChange={(e) => set((d) => {
                const k = e.target.value as AreaAnswer['kind'];
                d.seating.areas[i].kind = k;
                d.seating.areas[i].weather_rule = k === 'outdoor' ? d.seating.areas[i].weather_rule ?? 'move_inside' : null;
              })}>
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <span className="muted small">{mine.length} tables · {covers} covers{walkIns && ar.reservable ? ` · ${walkIns} kept for walk-ins` : ''}</span>
              <button type="button" className="ghost small" onClick={() => {
                if (mine.length && !confirm(`Remove ${ar.label} and its ${mine.length} tables?`)) return;
                set((d) => {
                  for (const t of d.seating.tables.filter((x) => x.area === ar.key)) removeTable(d, t.key);
                  d.seating.areas.splice(i, 1);
                });
              }}>Remove</button>
            </div>
            <div className="counts">
              {sizes.map((seats) => {
                const n = mine.filter((t) => t.seats === seats).length;
                return (
                  <div className="size-count" key={seats}>
                    <span>{seats}-seat tables</span>
                    <span className="stepper">
                      <button type="button" aria-label={`One fewer ${seats}-seat table in ${ar.label}`} disabled={!n} onClick={() => set((d) => {
                        const last = d.seating.tables.filter((t) => t.area === ar.key && t.seats === seats).at(-1);
                        if (last) removeTable(d, last.key);
                      })}>−</button>
                      <b>{n}</b>
                      <button type="button" aria-label={`One more ${seats}-seat table in ${ar.label}`} onClick={() => set((d) => addTable(d, ar.key, seats))}>+</button>
                    </span>
                  </div>
                );
              })}
            </div>
            {ar.reservable && !ar.enquiry_only && mine.length ? (
              <fieldset className="chips walk-ins">
                <legend>Kept for walk-ins <span className="muted">(never booked by phone, so they stay free for people who turn up)</span></legend>
                {mine.map((t) => (
                  <label key={t.key} className={t.walk_in ? 'on walk' : ''}>
                    <input type="checkbox" checked={t.walk_in} onChange={(e) => set((d) => {
                      const tb = d.seating.tables.find((x) => x.key === t.key);
                      if (tb) tb.walk_in = e.target.checked;
                    })} />
                    {t.label.replace(/^Table /, 'T')} · {t.seats}
                  </label>
                ))}
              </fieldset>
            ) : !ar.reservable ? <p className="hint">Every table here is walk-in only.</p> : null}
            <div className="three">
              <Toggle label="Takes bookings" checked={ar.reservable} onChange={(v) => set((d) => void (d.seating.areas[i].reservable = v))} />
              {ar.kind === 'private' || ar.enquiry_only ? (
                <Toggle label="Enquiries only" checked={ar.enquiry_only} onChange={(v) => set((d) => void (d.seating.areas[i].enquiry_only = v))} hint="Takes details for a callback instead of booking." />
              ) : null}
              {ar.kind === 'outdoor' ? (
                <Select
                  label="If the weather turns" value={ar.weather_rule ?? 'move_inside'}
                  options={[
                    { value: 'move_inside', label: 'Bookable; we move you inside' },
                    { value: 'own_risk', label: 'Bookable at your own risk' },
                    { value: 'walk_in_only', label: 'Walk-in only' },
                  ]}
                  onChange={(v) => set((d) => void (d.seating.areas[i].weather_rule = v))}
                />
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="row-tools">
        <span className="muted small">Add an area:</span>
        {KINDS.map((k) => <button type="button" className="small" key={k.value} onClick={() => addArea(k.value)}>+ {k.label}</button>)}
      </div>

      <h3 className="sub">Sittings and limits</h3>
      <div className="four">
        <Num label="Up to 2 people" suffix="min" min={30} max={300} value={a.seating.sittings.up_to_2} onChange={(v) => set((d) => void (d.seating.sittings.up_to_2 = v))} />
        <Num label="Up to 4" suffix="min" min={30} max={300} value={a.seating.sittings.up_to_4} onChange={(v) => set((d) => void (d.seating.sittings.up_to_4 = v))} />
        <Num label="Up to 8" suffix="min" min={30} max={360} value={a.seating.sittings.up_to_8} onChange={(v) => set((d) => void (d.seating.sittings.up_to_8 = v))} />
        <Num label="Larger" suffix="min" min={30} max={480} value={a.seating.sittings.larger} onChange={(v) => set((d) => void (d.seating.sittings.larger = v))} />
      </div>
      <p className="hint">How long a table is held, by party size.</p>
      <div className="three">
        <Num label="Largest party by phone" min={2} max={60} value={a.seating.max_party} onChange={(v) => set((d) => void (d.seating.max_party = v))} hint="Bigger groups: the receptionist takes details for a callback." />
        <Num label="Booking notice" suffix="min" min={0} max={1440} value={a.seating.notice_minutes} onChange={(v) => set((d) => void (d.seating.notice_minutes = v))} />
        <Num label="Book up to" suffix="days ahead" min={1} max={365} value={a.seating.horizon_days} onChange={(v) => set((d) => void (d.seating.horizon_days = v))} />
        <Num label="Highchairs" min={0} max={30} value={a.seating.highchairs} onChange={(v) => set((d) => void (d.seating.highchairs = v))} />
        <Num label="Gap between sittings" suffix="min" min={0} max={60} value={a.seating.buffer_minutes} onChange={(v) => set((d) => void (d.seating.buffer_minutes = v))} />
      </div>
    </div>
  );
}

// ── 6. Menu ─────────────────────────────────────────────────────────────

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'item';
}

export function StepMenu({ a, set, ws, me }: StepProps) {
  const [brief, setBrief] = useState({ description: '', price_level: 'mid', dishes: 18 });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const items = a.menu.categories.reduce((n, c) => n + c.items.length, 0);

  const draft = async () => {
    if (items && a.menu.source !== 'sample' && !confirm('Replace your current menu with a new draft?')) return;
    setBusy(true);
    try {
      const { menu } = await demoApi<{ menu: RestaurantAnswers['menu'] }>(`/workspaces/${ws.id}/menu-draft`, {
        method: 'POST', json: { ...brief, style: a.basics.style, takeaway: a.serve.collection.enabled || a.serve.delivery.enabled },
      });
      set((d) => void (d.menu = menu));
      toast(`Drafted ${menu.categories.reduce((n, c) => n + c.items.length, 0)} dishes. Edit anything below.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fields">
      <div className="group on draft-box">
        <h3>Describe your food <Source of="menu.categories" sources={a.sources} /></h3>
        <textarea
          className="prose" rows={3} maxLength={1200} aria-label="Describe your food"
          placeholder="Wood-fired Neapolitan pizza, about ten, fresh pasta, a few starters, tiramisu, Italian wines; good vegan options"
          value={brief.description} onChange={(e) => setBrief({ ...brief, description: e.target.value })}
        />
        <div className="field-row">
          <select aria-label="Price level" value={brief.price_level} onChange={(e) => setBrief({ ...brief, price_level: e.target.value })}>
            <option value="budget">Budget</option>
            <option value="mid">Mid-priced</option>
            <option value="high">Upmarket</option>
          </select>
          <select aria-label="How many dishes" value={brief.dishes} onChange={(e) => setBrief({ ...brief, dishes: Number(e.target.value) })}>
            {[10, 14, 18, 24, 30].map((n) => <option key={n} value={n}>About {n} dishes</option>)}
          </select>
          <button type="button" className="primary" disabled={busy || (!brief.description.trim() && !a.basics.style)} onClick={draft}>
            {busy ? 'Drafting… (about 20 s)' : 'Draft my menu'}
          </button>
        </div>
        <p className="hint">
          The AI writes a menu from this, with prices and example allergens, and you edit it below. {Math.max(0, me.limits.drafts_per_day - me.used.drafts)} drafts left today.
          {a.menu.source === 'sample' ? ' The menu below is our sample until you draft or edit it.' : ''}
        </p>
      </div>

      {a.menu.categories.map((c, ci) => (
        <div className="menu-cat" key={c.key}>
          <div className="cat-head">
            <input aria-label="Section name" className="cat-name" value={c.label} maxLength={40} onChange={(e) => set((d) => { d.menu.categories[ci].label = e.target.value; d.menu.source = d.menu.source === 'sample' ? 'manual' : d.menu.source; })} />
            <span className="muted small">{c.items.length} dishes</span>
            <button type="button" className="ghost small" onClick={() => confirm(`Remove ${c.label} and its dishes?`) && set((d) => void d.menu.categories.splice(ci, 1))}>Remove section</button>
          </div>
          <div className="dishes">
            {c.items.map((it, ii) => {
              const id = `${c.key}/${it.key}`;
              return (
                <div className={`dish ${it.available === false ? 'off' : ''}`} key={it.key}>
                  <input aria-label="Dish" className="dish-name" value={it.name} maxLength={60} onChange={(e) => set((d) => void (d.menu.categories[ci].items[ii].name = e.target.value))} />
                  <span className="num-field money price">
                    <span className="muted">£</span>
                    <input aria-label={`${it.name} price`} inputMode="decimal" defaultValue={(it.price_pence / 100).toFixed(2)} key={it.price_pence}
                      onBlur={(e) => { const n = Number(e.target.value.replace(/[£,\s]/g, '')); if (Number.isFinite(n) && n >= 0) set((d) => void (d.menu.categories[ci].items[ii].price_pence = Math.round(n * 100))); }} />
                  </span>
                  <button type="button" className={`ghost small allergen-btn ${it.allergens.length ? 'has' : ''}`} aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>
                    {it.allergens.length ? it.allergens.join(', ') : 'No allergens set'}
                  </button>
                  <label className="tiny-toggle" title="Available for takeaway">
                    <input type="checkbox" checked={it.available !== false} onChange={(e) => set((d) => void (d.menu.categories[ci].items[ii].available = e.target.checked ? undefined : false))} />
                    <span>Takeaway</span>
                  </label>
                  <button type="button" className="ghost" aria-label={`Remove ${it.name}`} onClick={() => set((d) => void d.menu.categories[ci].items.splice(ii, 1))}>✕</button>
                  <input aria-label={`${it.name} description`} className="dish-desc" placeholder="Short description" value={it.description ?? ''} maxLength={200} onChange={(e) => set((d) => void (d.menu.categories[ci].items[ii].description = e.target.value || undefined))} />
                  {open === id ? (
                    <div className="allergen-grid" role="group" aria-label={`${it.name} allergens`}>
                      {ALLERGENS.map((al) => (
                        <label key={al}>
                          <input type="checkbox" checked={it.allergens.includes(al)} onChange={(e) => set((d) => {
                            const x = d.menu.categories[ci].items[ii];
                            x.allergens = e.target.checked ? [...x.allergens, al] : x.allergens.filter((y) => y !== al);
                            x.allergens_unknown = undefined;
                          })} />
                          <span>{al}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <button type="button" className="ghost small" onClick={() => set((d) => {
              const cat = d.menu.categories[ci];
              let k = slug(`new dish ${cat.items.length + 1}`);
              while (d.menu.categories.some((x) => x.items.some((y) => y.key === k))) k += '_2';
              cat.items.push({ key: k, name: 'New dish', price_pence: 0, allergens: [] });
              if (d.menu.source === 'sample') d.menu.source = 'manual';
            })}>+ Add a dish</button>
          </div>
        </div>
      ))}
      <div className="row-tools">
        <button type="button" className="small" onClick={() => set((d) => {
          let k = 'new_section';
          while (d.menu.categories.some((x) => x.key === k)) k += '_2';
          d.menu.categories.push({ key: k, label: 'New section', items: [] });
        })}>+ Add a section</button>
      </div>
      <Text label="Allergen statement" area rows={3} max={600} value={a.menu.allergen_statement} onChange={(v) => set((d) => void (d.menu.allergen_statement = v))} hint="Read to callers who ask about allergies, with the dish’s own allergens." />
      <Toggle
        label="I have checked the allergens" checked={!a.menu.allergens_are_examples}
        onChange={(v) => set((d) => void (d.menu.allergens_are_examples = !v))}
        hint="Until then the receptionist treats them as examples. For a demo, examples are fine."
      />
    </div>
  );
}

// ── 7. Money ────────────────────────────────────────────────────────────

export function StepMoney({ a, set }: StepProps) {
  const dep = a.money.deposit;
  return (
    <div className="fields">
      <Choice
        legend="Table deposits" value={dep.mode}
        options={[
          { value: 'none', label: 'No deposits' },
          { value: 'per_person', label: 'A deposit per person', hint: 'for larger groups' },
          { value: 'per_booking', label: 'A deposit per booking', hint: 'for larger groups' },
          { value: 'card_hold', label: 'Card details to secure, no charge' },
        ]}
        onChange={(v) => set((d) => void (d.money.deposit.mode = v))}
      />
      {dep.mode === 'per_person' || dep.mode === 'per_booking' ? (
        <div className="three">
          <Pounds label={dep.mode === 'per_person' ? 'Per person' : 'Per booking'} pence={dep.amount_pence} max={50000} onChange={(v) => set((d) => void (d.money.deposit.amount_pence = v))} />
          <Num label="For parties of" suffix="or more" min={1} max={60} value={dep.min_party} onChange={(v) => set((d) => void (d.money.deposit.min_party = v))} />
        </div>
      ) : null}
      {dep.mode !== 'none' ? <p className="hint">After booking, the receptionist offers to take it with the demo card, or “texts a payment link” (simulated).</p> : null}
      <Text label="Cancellation policy" area rows={2} max={300} value={a.money.cancellation_policy} onChange={(v) => set((d) => void (d.money.cancellation_policy = v))} hint="Read out when a deposit is taken." />
      <Choice
        legend="Paying for takeaway" value={a.money.takeaway_payment}
        options={[
          { value: 'phone', label: 'Pay on the phone', hint: 'the receptionist takes the demo card' },
          { value: 'collection', label: 'Pay on collection', hint: 'no card on the phone' },
          { value: 'either', label: 'The caller chooses' },
        ]}
        onChange={(v) => set((d) => void (d.money.takeaway_payment = v))}
      />
      <Text label="Service charge" max={200} value={a.money.service_charge} onChange={(v) => set((d) => void (d.money.service_charge = v))} />
    </div>
  );
}

// ── 8. Policies and questions ───────────────────────────────────────────

export function StepPolicies({ a, set, ws }: StepProps) {
  const [busy, setBusy] = useState(false);
  const p = a.policies;
  const t = (k: Exclude<keyof RestaurantAnswers['policies'], 'dogs' | 'faqs'>, label: string, hint?: string) => (
    <Text label={<>{label} <Source of={`policies.${k}`} sources={a.sources} /></>} area rows={2} max={300} value={p[k]} onChange={(v) => set((d) => void (d.policies[k] = v))} hint={hint} />
  );
  const draft = async () => {
    setBusy(true);
    try {
      const { faqs } = await demoApi<{ faqs: { q: string; a: string }[] }>(`/workspaces/${ws.id}/faq-draft`, { method: 'POST', json: { answers: a } });
      const have = new Set(a.policies.faqs.map((f) => f.q.toLowerCase()));
      const fresh = faqs.filter((f) => !have.has(f.q.toLowerCase()));
      set((d) => void (d.policies.faqs = [...d.policies.faqs, ...fresh].slice(0, 20)));
      toast(`${fresh.length} questions drafted. Keep, edit or delete each one.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fields">
      <p className="lead">Each becomes something the receptionist can answer. Short and in your own words is best.</p>
      <div className="two">
        {t('children', 'Children and highchairs')}
        <Select label="Dogs" value={p.dogs} options={[{ value: 'inside', label: 'Welcome inside' }, { value: 'outside_only', label: 'Outside only' }, { value: 'no', label: 'Not allowed (assistance dogs welcome)' }]} onChange={(v) => set((d) => void (d.policies.dogs = v))} />
        {t('accessibility', 'Accessibility')}
        {t('parking', 'Parking')}
        {t('dress_code', 'Dress code')}
        {t('corkage', 'Corkage and bring your own')}
        {t('cakes', 'Birthday cakes')}
        {t('vouchers', 'Gift vouchers')}
      </div>
      {t('dietary', 'Gluten-free, vegan and other diets')}

      <h3 className="sub">Common questions</h3>
      {p.faqs.map((f, i) => (
        <div className="faq" key={i}>
          <input aria-label="Question" value={f.q} maxLength={150} onChange={(e) => set((d) => void (d.policies.faqs[i].q = e.target.value))} />
          <textarea aria-label="Answer" className="prose" rows={2} maxLength={500} value={f.a} onChange={(e) => set((d) => void (d.policies.faqs[i].a = e.target.value))} />
          <button type="button" className="ghost" aria-label="Remove this question" onClick={() => set((d) => void d.policies.faqs.splice(i, 1))}>✕</button>
        </div>
      ))}
      <div className="row-tools">
        <button type="button" className="primary" onClick={draft} disabled={busy}>{busy ? 'Drafting…' : 'Draft common questions'}</button>
        <button type="button" className="small" onClick={() => set((d) => void d.policies.faqs.push({ q: '', a: '' }))}>+ Add one</button>
      </div>
      <p className="hint">The AI proposes questions callers ask a restaurant like yours, answered only from what you have set.</p>
    </div>
  );
}

// ── Review ──────────────────────────────────────────────────────────────

export function StepReview({ a, ws, go, flush, onStarted }: StepProps & { flush: () => Promise<void>; onStarted: () => void }) {
  const [busy, setBusy] = useState(false);
  const errors = ws.issues.filter((i) => i.level === 'error');
  const warnings = ws.issues.filter((i) => i.level === 'warning');
  const start = async () => {
    setBusy(true);
    try {
      await flush();
      const r = await demoApi<{ bookings: number; orders: number; workspace: WorkspacePayload }>(`/workspaces/${ws.id}/${ws.started_at ? 'reset' : 'start'}`, { method: 'POST' });
      toast(`Ready: ${r.bookings} bookings this week and ${r.orders} orders today, made from your setup.`);
      onStarted();
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };
  const tables = a.seating.tables;
  return (
    <div className="fields review">
      <dl className="summary">
        <dt>Restaurant</dt><dd>{a.basics.name || <em>no name yet</em>}, {a.basics.town}</dd>
        <dt>Hours</dt><dd>{ws.preview?.hours}</dd>
        <dt>Serving</dt>
        <dd>{[a.serve.reservations && 'table bookings', a.serve.walk_ins && 'walk-ins', a.serve.collection.enabled && 'click and collect', a.serve.delivery.enabled && 'delivery'].filter(Boolean).join(', ') || 'questions only'}</dd>
        {a.serve.reservations ? (<><dt>Seating</dt><dd>{a.seating.areas.map((x) => x.label).join(', ')}: {tables.length} tables, {tables.reduce((n, t) => n + t.seats, 0)} covers</dd></>) : null}
        <dt>Menu</dt><dd>{ws.preview?.dishes ?? 0} dishes in {a.menu.categories.length} sections</dd>
        <dt>Deposits</dt><dd>{a.money.deposit.mode === 'none' ? 'none' : a.money.deposit.mode === 'card_hold' ? 'card to secure' : `£${(a.money.deposit.amount_pence / 100).toFixed(2)} ${a.money.deposit.mode === 'per_person' ? 'a head' : 'a booking'} for ${a.money.deposit.min_party}+`}</dd>
        <dt>Questions</dt><dd>{a.policies.faqs.length} of your own, plus the policies</dd>
      </dl>
      {errors.length ? (
        <div className="issues-box bad">
          <b>Still to do before Start</b>
          <ul>{errors.map((x, i) => <li key={i}><button type="button" className="linkish" onClick={() => go(x.step)}>{x.message}</button></li>)}</ul>
        </div>
      ) : null}
      {warnings.length ? (
        <div className="issues-box">
          <b>Worth a look</b>
          <ul>{warnings.map((x, i) => <li key={i}><button type="button" className="linkish" onClick={() => go(x.step)}>{x.message}</button></li>)}</ul>
        </div>
      ) : null}
      <div className="start-box">
        <p>
          {ws.started_at
            ? 'Your changes are saved and the receptionist already uses them. To refill the diary to match (new tables, hours or menu), reset the demo data.'
            : 'Start builds your receptionist from these answers and fills a week of bookings and today’s orders, shaped by your own tables, hours and menu.'}
        </p>
        <button type="button" className="primary big" disabled={busy || errors.length > 0} onClick={start}>
          {busy ? 'Building your demo…' : ws.started_at ? 'Reset the demo data' : 'Start my demo'}
        </button>
      </div>
    </div>
  );
}
