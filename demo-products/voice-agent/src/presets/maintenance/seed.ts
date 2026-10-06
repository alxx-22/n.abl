// A property maintenance contractor's believable week, anchored to Start
// (presets/property-maintenance.md §7): the sample properties under the
// sample clients, jobs done earlier in the week, today's board moving with
// the clock, the coming fortnight, jobs awaiting approval or waiting for
// parts, the certificate register, last night's emergency, one gas call,
// the quotes out, and the invoices for finished work.
//
// Every job is placed by the same window rules the tools use, so no
// engineer is over capacity, gas work goes only to Gas Safe engineers and
// everyone stays in their districts; the replay test checks it. A job that
// cannot be placed (a prospect turned the trade off, or removed its
// engineer) is left out, never forced in.

import { addDays, minutesOf, timeOf, toLocal, zonedToUtc } from '../../domain/time.ts';
import type { Certificate, HistoryEntry, Incident, Invoice, Job, JobKind, JobPriority, MtProperty, Quote, TenantProfile } from '../../domain/types.ts';
import { checkWindow, isGasTrade, onCallAt, windowAt, windowOf, windowsOn } from '../../domain/windows.ts';
import { ids, rng } from '../common/random.ts';
import type { SeedMessage, SeedPlan, SeedText } from '../common/types.ts';
import { sampleProperties, shortAddress } from './properties.ts';

type SeedJob = Omit<Job, 'id'>;

/** What goes wrong, by trade, and what the engineer wrote when it was done. */
const FAULTS: Record<string, [string, string][]> = {
  plumbing: [
    ['Dripping kitchen tap', 'Replaced the washer and the cartridge; no drips.'],
    ['Leak under the bathroom sink', 'Remade the compression joint; dry after 20 minutes running.'],
    ['Toilet not flushing', 'New flush valve fitted; flushing properly.'],
    ['Low pressure in the shower', 'Descaled the shower head and cleared the filter.'],
  ],
  drainage: [
    ['Blocked kitchen sink', 'Cleared the trap and the waste pipe; draining freely.'],
    ['Outside drain overflowing', 'Rodded the gully; cleared a fat blockage.'],
  ],
  electrical: [
    ['Socket not working in the bedroom', 'Loose terminal remade; socket tested.'],
    ['Lights keep tripping', 'Faulty light fitting in the hall replaced; circuit tested.'],
    ['Bathroom extractor fan not working', 'New fan fitted and tested.'],
  ],
  gas_heating: [
    ['Boiler losing pressure', 'Pressure relief valve replaced; boiler holding pressure.'],
    ['No hot water', 'Diverter valve replaced; hot water and heating working.'],
    ['Radiator cold at the top', 'Bled the radiators and balanced the system.'],
  ],
  roofing: [
    ['Slipped roof tiles after the wind', 'Three tiles refixed with new clips.'],
    ['Gutter overflowing at the front', 'Gutter cleared and a joint resealed.'],
  ],
  carpentry: [
    ['Back door sticking', 'Door planed and hinges adjusted.'],
    ['Loose stair handrail', 'Handrail brackets refixed into the studs.'],
  ],
  locksmith: [['Front door lock stiff', 'Lock cylinder replaced; three keys handed to the tenant.']],
  glazing: [['Cracked bedroom window', 'Pane measured; sealed unit fitted.']],
  decorating: [['Patch and paint the ceiling after a leak', 'Stain-blocked and two coats on the ceiling.']],
  damp_mould: [['Mould on the bathroom ceiling', 'Treated with fungicide; advised on ventilation; fan working.']],
};

const DAY = 86_400_000;

export function planMaintenanceSeed(profile: TenantProfile, now: Date, seed: number): SeedPlan {
  const m = profile.maintenance;
  if (!m) return { bookings: [], orders: [], messages: [] };
  const tz = profile.timezone;
  const random = rng(seed);
  const { pick, ref } = ids(random);
  const local = toLocal(now, tz);
  const today = local.date;
  const at = (date: string, time: string) => zonedToUtc(date, time, tz);
  const name = (key: string | null) => m.engineers.find((e) => e.key === key)?.first_name ?? '';

  // Only homes inside the patch, under a client the business still has.
  const clients = new Map(m.clients.map((c) => [c.key, c]));
  const properties = sampleProperties().filter((p) => m.districts.includes(p.district) && (p.client === null || clients.has(p.client)));
  const byKey = new Map(properties.map((p) => [p.key, p]));
  const trades = m.trades.map((t) => t.key).filter((t) => FAULTS[t]);
  const jobs: SeedJob[] = [];

  const reporter = (p: MtProperty): Job['reporter'] => {
    const c = p.client ? clients.get(p.client) : undefined;
    // An agent often raises the job for their tenant; otherwise whoever lives there rings.
    if (c?.kind === 'agent' && random() < 0.4) return { name: c.contact.name, phone: c.contact.phone, role: 'agent' };
    return { name: p.occupant.name, phone: p.occupant.phone, role: p.client ? 'occupant' : 'homeowner' };
  };

  const blank = (p: MtProperty | null, x: Pick<SeedJob, 'trade' | 'priority' | 'description' | 'kind' | 'status'> & Partial<SeedJob>): SeedJob => {
    const created = x.created_at ?? now;
    const priority: JobPriority = x.priority;
    return {
      reference: ref(),
      property_key: p?.key ?? null,
      client_key: p?.client ?? null,
      reporter: p ? reporter(p) : { name: null, phone: null, role: null },
      reason: `${priority[0].toUpperCase()}${priority.slice(1)}: ${x.description.toLowerCase()}`,
      visit_date: null, window_key: null, attend_by: null, engineer_key: null, eta_minutes: null, on_the_way_at: null,
      po: p?.client && clients.get(p.client)?.po_required ? `PO-${4000 + Math.floor(random() * 5000)}` : null,
      price_pence: null, clocks: [], flags: [], access_attempts: 0, waiting_for: null, notes: null,
      history: [{ at: created.toISOString(), by: random() < 0.6 ? 'receptionist' : 'staff', what: 'raised' }],
      source: 'seed', created_at: created, done_at: null,
      ...x,
    };
  };

  /**
   * Puts a job in the first window on `date` with room (or `window`), with
   * an able engineer (or `engineer`). Null when nobody can take it.
   */
  const place = (p: MtProperty, date: string, x: Pick<SeedJob, 'trade' | 'priority' | 'description' | 'kind' | 'status'> & Partial<SeedJob>, opts: { window?: string; engineer?: string } = {}): SeedJob | null => {
    const gas = isGasTrade(m, x.trade) || Boolean(x.flags?.includes('gas'));
    const windows = opts.window ? [windowOf(m, opts.window)].filter((w) => w !== undefined) : windowsOn(m, date);
    for (const w of windows) {
      const c = checkWindow(m, jobs, { date, window: w.key, trade: x.trade, gas, district: p.district, engineer: opts.engineer });
      if (!c.ok) continue;
      const e = opts.engineer ? c.engineers[0] : pick(c.engineers);
      const raisedDaysBefore = 1 + Math.floor(random() * 4);
      const created = x.created_at ?? new Date(Math.min(now.getTime() - 3_600_000, at(date, w.from).getTime() - raisedDaysBefore * DAY));
      const history: HistoryEntry[] = [
        { at: created.toISOString(), by: 'receptionist', what: 'raised' },
        { at: new Date(created.getTime() + 600_000).toISOString(), by: 'staff', what: `booked: ${w.label.toLowerCase()} with ${e.first_name}` },
      ];
      const job = blank(p, { ...x, flags: [...(x.flags ?? []), ...(gas && !x.flags?.includes('gas') ? ['gas'] : [])], created_at: created, history, visit_date: date, window_key: w.key, engineer_key: e.key });
      jobs.push(job);
      return job;
    }
    return null;
  };

  const fault = (trade: string) => pick(FAULTS[trade] ?? [['Repair', 'Done.']]);
  const randomTrade = () => pick(trades);
  const someProperty = (filter: (p: MtProperty) => boolean = () => true) => {
    const xs = properties.filter(filter);
    return xs.length ? pick(xs) : null;
  };
  const done = (j: SeedJob | null, endTime: string, notes: string) => {
    if (!j || !j.visit_date) return;
    const end = at(j.visit_date, endTime);
    Object.assign(j, { status: 'done', done_at: end, notes });
    j.history.push({ at: end.toISOString(), by: name(j.engineer_key) || 'engineer', what: 'done' });
  };
  const windowEnd = (j: SeedJob) => windowOf(m, j.window_key)?.to ?? '17:00';
  const midWindow = (j: SeedJob) => {
    const w = windowOf(m, j.window_key)!;
    return timeOf(Math.round((minutesOf(w.from) + minutesOf(w.to)) / 2));
  };

  /** Working days with windows, counting from `from` in `step` direction, not including it. */
  const workingDays = (from: string, n: number, step: 1 | -1) => {
    const out: string[] = [];
    for (let d = addDays(from, step); out.length < n && Math.abs((Date.parse(d) - Date.parse(from)) / DAY) < 40; d = addDays(d, step)) {
      if (windowsOn(m, d).length) out.push(d);
    }
    return out;
  };
  const upcoming = workingDays(today, 10, 1);

  // ── The engineer on the way: Marek to 14 Elm Road (§1, moment 4) ─────────
  const elm = byKey.get('elm_14');
  const nowWindow = windowAt(m, today, local.time);
  if (elm && trades.includes('plumbing')) {
    const prefer = m.engineers.some((e) => e.key === 'marek') ? 'marek' : undefined;
    const job = { trade: 'plumbing', priority: 'urgent' as const, description: 'Leak under the kitchen sink', kind: 'repair' as JobKind, status: 'scheduled' as const };
    let j: SeedJob | null = null;
    if (nowWindow) {
      j = place(elm, today, job, { window: nowWindow.key, engineer: prefer }) ?? place(elm, today, job, { window: nowWindow.key });
      if (j) {
        const left = new Date(now.getTime() - 5 * 60_000);
        Object.assign(j, { status: 'on_the_way', eta_minutes: 20, on_the_way_at: left });
        j.history.push({ at: left.toISOString(), by: name(j.engineer_key), what: 'on the way, about 20 minutes' });
      }
    } else {
      // Outside every window today: booked for the next one instead, and the caller hears when.
      const later = windowsOn(m, today).find((w) => minutesOf(w.from) > minutesOf(local.time));
      const date = later ? today : upcoming[0];
      if (date) j = place(elm, date, job, { window: later?.key, engineer: prefer }) ?? place(elm, date, job);
    }
  }

  // ── Today's board ───────────────────────────────────────────────────────
  if (windowsOn(m, today).length) {
    let doneToday = 0;
    let onSite = 0;
    for (let i = 0; i < 11; i++) {
      const p = someProperty();
      const trade = randomTrade();
      if (!p || !trade) break;
      const [description, notes] = fault(trade);
      const j = place(p, today, { trade, priority: random() < 0.25 ? 'urgent' : 'routine', description, kind: 'repair', status: 'scheduled' });
      if (!j) continue;
      const w = windowOf(m, j.window_key)!;
      if (minutesOf(w.to) <= minutesOf(local.time) && doneToday < 3) {
        done(j, timeOf(minutesOf(w.to) - 40), notes);
        doneToday++;
      } else if (minutesOf(w.to) <= minutesOf(local.time)) {
        done(j, timeOf(minutesOf(w.to) - 20), notes);
      } else if (minutesOf(w.from) <= minutesOf(local.time) && onSite < 2) {
        const arrived = new Date(Math.max(at(today, w.from).getTime(), now.getTime() - 50 * 60_000));
        Object.assign(j, { status: 'on_site', on_the_way_at: new Date(arrived.getTime() - 25 * 60_000) });
        j.history.push({ at: arrived.toISOString(), by: name(j.engineer_key), what: 'on site' });
        onSite++;
      }
    }
  }

  // ── Earlier in the week: done, with the engineer's notes ─────────────────
  const earlier = workingDays(today, 5, -1);
  const pastDone: SeedJob[] = [];
  for (const date of earlier) {
    for (let i = 0; i < 5; i++) {
      const p = someProperty();
      const trade = randomTrade();
      if (!p || !trade) break;
      const [description, notes] = fault(trade);
      const j = place(p, date, { trade, priority: random() < 0.2 ? 'urgent' : 'routine', description, kind: 'repair', status: 'scheduled' });
      if (j) {
        done(j, timeOf(minutesOf(windowEnd(j)) - 30), notes);
        pastDone.push(j);
      }
    }
  }

  // Two recalls: the same fault back at the same home, booked in the next few days.
  for (const first of pastDone.slice(0, 2)) {
    const p = byKey.get(first.property_key!)!;
    for (const date of upcoming.slice(0, 4)) {
      const j = place(p, date, { trade: first.trade, priority: 'urgent', description: `${first.description}: back again`, kind: 'repair', status: 'scheduled', flags: ['recall'], notes: `Recall of ${first.reference}.` });
      if (j) break;
    }
  }

  // ── Last night's emergency: a burst pipe at 02:10, made safe ─────────────
  const nightDate = local.time >= '03:30' ? today : addDays(today, -1);
  const burstAt = at(nightDate, '02:10');
  const onCall = onCallAt(m, nightDate, '02:10');
  const burstHome = someProperty((p) => p.client !== null && clients.get(p.client)?.kind === 'agent');
  const plumber = onCall.find((e) => e.trades.includes('plumbing')) ?? onCall[0];
  if (burstHome && plumber && trades.includes('plumbing')) {
    const attendBy = new Date(burstAt.getTime() + m.priorities.emergency.attend_hours * 3_600_000);
    const madeSafe = new Date(burstAt.getTime() + 55 * 60_000);
    const e = blank(burstHome, {
      trade: 'plumbing', priority: 'emergency', description: 'Burst pipe: water through the kitchen ceiling', kind: 'repair', status: 'done',
      reason: 'Emergency: uncontained leak', attend_by: attendBy, engineer_key: plumber.key, flags: ['out_of_hours'], created_at: burstAt, done_at: madeSafe,
      notes: `Made safe: water off at the stopcock (${burstHome.notes.stopcock ?? 'as noted'}), pipe clamped. Permanent repair booked.`,
      history: [
        { at: burstAt.toISOString(), by: 'receptionist', what: `raised; ${plumber.first_name} paged` },
        { at: new Date(burstAt.getTime() + 4 * 60_000).toISOString(), by: plumber.first_name, what: 'accepted' },
        { at: madeSafe.toISOString(), by: plumber.first_name, what: 'made safe' },
      ],
    });
    jobs.push(e);
    for (const date of [today, ...upcoming].slice(0, 3)) {
      const windows = windowsOn(m, date).filter((w) => date !== today || minutesOf(w.from) > minutesOf(local.time));
      const f = windows.length ? place(burstHome, date, { trade: 'plumbing', priority: 'urgent', description: 'Permanent repair to the burst pipe, made safe overnight', kind: 'repair', status: 'scheduled', notes: `Follow-up to ${e.reference}.` }, { window: windows[0].key }) : null;
      if (f) break;
    }
  }

  // ── The coming fortnight ────────────────────────────────────────────────
  for (const date of upcoming) {
    for (let i = 0; i < 2; i++) {
      const p = someProperty();
      const trade = randomTrade();
      if (!p || !trade) break;
      const [description] = fault(trade);
      place(p, date, { trade, priority: 'routine', description, kind: 'repair', status: 'scheduled' });
    }
  }
  // A boiler quote, an EICR and an empty home between tenants.
  const gasHome = someProperty((p) => p.client === null && p.gas);
  if (gasHome) for (const date of upcoming.slice(1)) if (place(gasHome, date, { trade: 'gas_heating', priority: 'routine', description: 'Quote for a new boiler', kind: 'quote', status: 'scheduled' })) break;
  const eicrHome = someProperty((p) => p.client !== null);
  if (eicrHome && trades.includes('electrical')) for (const date of upcoming.slice(2)) if (place(eicrHome, date, { trade: 'electrical', priority: 'routine', description: 'Electrical installation condition report', kind: 'eicr', status: 'scheduled', price_pence: m.planned.eicr_from_pence })) break;
  const empty = someProperty((p) => p.client !== null && p.client !== 'ellis');
  if (empty && trades.includes('carpentry')) for (const date of upcoming.slice(3)) if (place(empty, date, { trade: 'carpentry', priority: 'routine', description: 'Empty-property inspection between tenants', kind: 'inspection', status: 'scheduled' })) break;

  // ── Awaiting approval, and waiting ──────────────────────────────────────
  const ellis = properties.find((p) => p.client === 'ellis');
  if (ellis && trades.includes('gas_heating')) {
    jobs.push(blank(ellis, {
      trade: 'gas_heating', priority: 'routine', description: 'Boiler replacement: quote Q-2291', kind: 'repair', status: 'awaiting_approval', price_pence: 245_000, flags: ['gas'],
      created_at: new Date(now.getTime() - 6 * DAY), notes: 'Quote Q-2291 sent to Mrs Ellis.',
    }));
  }
  for (const [kind, trade, description, pence] of [
    ['agent', 'roofing', 'Replace the flat roof over the back extension', 60_000],
    ['agent', 'carpentry', 'Replace the rotten back door and frame', 38_000],
    ['landlord', 'electrical', 'New kitchen circuit for an electric cooker', 52_000],
  ] as const) {
    const p = someProperty((x) => x.client !== null && clients.get(x.client)!.kind === kind && clients.get(x.client)!.works_limit_pence < pence);
    if (p && trades.includes(trade)) jobs.push(blank(p, { trade, priority: 'routine', description, kind: 'repair', status: 'awaiting_approval', price_pence: pence, created_at: new Date(now.getTime() - 2 * DAY) }));
  }
  for (const [trade, description, waiting, attempts] of [
    ['gas_heating', 'No hot water: diverter valve', 'parts: a replacement diverter valve, due Thursday', 0],
    ['glazing', 'Misted double-glazed unit in the lounge', 'parts: a new sealed unit is being made', 0],
    ['damp_mould', 'Mould in the back bedroom', 'access: no answer at two visits; the agent is contacting the tenant', 2],
  ] as const) {
    const p = someProperty((x) => trade !== 'gas_heating' || x.gas);
    const engineer = m.engineers.find((e) => e.trades.includes(trade) && (!isGasTrade(m, trade) || e.gas_safe));
    if (p && engineer && trades.includes(trade)) {
      jobs.push(blank(p, { trade, priority: 'routine', description, kind: 'repair', status: 'waiting', engineer_key: engineer.key, waiting_for: waiting, access_attempts: attempts, created_at: new Date(now.getTime() - 5 * DAY), flags: isGasTrade(m, trade) ? ['gas'] : [] }));
    }
  }

  // ── One gas call this week: sent to the emergency service, then repaired ──
  const incidents: Omit<Incident, 'id'>[] = [];
  const gasDay = earlier[2] ?? earlier[0];
  const gasCallHome = someProperty((p) => p.client === null && p.gas);
  if (gasDay && gasCallHome) {
    const called = at(addDays(gasDay, -1), '19:02');
    const repair = trades.includes('gas_heating')
      ? place(gasCallHome, gasDay, { trade: 'gas_heating', priority: 'urgent', description: 'Gas smell: supply capped by the emergency service; find and repair the leak', kind: 'repair', status: 'scheduled', created_at: new Date(called.getTime() + 30 * 60_000) })
      : null;
    if (repair) done(repair, timeOf(minutesOf(windowEnd(repair)) - 60), 'Leaking joint on the hob supply remade; tightness test passed; supply restored.');
    incidents.push({
      property_key: gasCallHome.key, kind: 'gas', advice_version: 1, advised_at: new Date(called.getTime() + 20_000), caller_phone: gasCallHome.occupant.phone,
      follow_up_job: repair?.reference ?? null, notes: 'Told to leave and ring the gas emergency line from outside; number texted.', source: 'seed', created_at: called,
    });
  }

  // ── Quotes, and the bills for finished work ─────────────────────────────
  // Last, so adding them leaves every job before them as it was.
  const quotes: Quote[] = [];
  const quote = (reference: string, x: Omit<Quote, 'reference' | 'decided_at' | 'decided_by' | 'status' | 'valid_until' | 'created_at'>, decided?: { status: 'approved' | 'declined'; by: string; daysAgo: number }) => {
    quotes.push({
      reference, ...x, valid_until: addDays(x.issued, 30), status: decided?.status ?? 'sent',
      decided_at: decided ? new Date(now.getTime() - decided.daysAgo * DAY) : null, decided_by: decided?.by ?? null, created_at: at(x.issued, '10:00'),
    });
  };
  const awaiting = jobs.filter((j) => j.status === 'awaiting_approval');
  let next = 2292;
  awaiting.forEach((j) => {
    const reference = j.description.match(/Q-\d+/)?.[0] ?? `Q-${next++}`;
    const who = clients.get(j.client_key ?? '')?.contact.name;
    if (!j.notes) j.notes = `Quote ${reference} sent${who ? ` to ${who}` : ''}.`;
    quote(reference, { job_ref: j.reference, property_key: j.property_key, client_key: j.client_key, description: j.description.replace(/: quote Q-\d+$/, ''), amount_pence: j.price_pence ?? 0, issued: toLocal(j.created_at, tz).date });
  });
  // One said yes to last week, now booked in; one turned down.
  const yes = jobs.find((j) => j.status === 'scheduled' && j.kind === 'repair' && j.client_key && !j.flags.includes('recall') && (j.visit_date ?? '') > today && !j.notes);
  const yesClient = yes ? clients.get(yes.client_key!) : undefined;
  if (yes && yesClient) {
    Object.assign(yes, { price_pence: yesClient.works_limit_pence + 14_500, notes: `Quote Q-2288 approved by ${yesClient.contact.name}.` });
    quote('Q-2288', { job_ref: yes.reference, property_key: yes.property_key, client_key: yes.client_key, description: yes.description, amount_pence: yes.price_pence!, issued: addDays(today, -8) }, { status: 'approved', by: yesClient.contact.name, daysAgo: 5 });
  }
  const fence = someProperty((p) => p.client !== null && clients.get(p.client)!.kind === 'landlord' && p.client !== 'ellis');
  if (fence) {
    quote('Q-2289', { job_ref: null, property_key: fence.key, client_key: fence.client, description: 'Replace six fence panels and two posts', amount_pence: 68_000, issued: addDays(today, -9) }, { status: 'declined', by: clients.get(fence.client!)!.contact.name, daysAgo: 4 });
  }

  // Eighteen of the week's finished jobs are billed, and two from last month are overdue.
  const longAgo = workingDays(today, 20, -1);
  const older = [longAgo[14], longAgo[19]].flatMap((date) => {
    // A few tries: the first home or trade picked may have nobody free that day.
    for (let tries = 0; date && tries < 8; tries++) {
      const p = someProperty((x) => x.client !== null && clients.get(x.client)!.kind === 'agent');
      const trade = randomTrade();
      if (!p || !trade) return [];
      const [description, notes] = fault(trade);
      const j = place(p, date, { trade, priority: 'routine', description, kind: 'repair', status: 'scheduled' });
      if (!j) continue;
      done(j, timeOf(minutesOf(windowEnd(j)) - 30), notes);
      return [j];
    }
    return [];
  });
  const billed = [...older, ...pastDone.slice().sort((a, b) => a.done_at!.getTime() - b.done_at!.getTime()).slice(0, Math.max(0, Math.min(18, pastDone.length - 5)))]
    .sort((a, b) => a.done_at!.getTime() - b.done_at!.getTime());
  const homeowners = billed.filter((j) => !j.client_key);
  const invoices: Invoice[] = billed.map((j, n) => {
    const p = byKey.get(j.property_key!)!;
    const c = j.client_key ? clients.get(j.client_key) : undefined;
    const issued = toLocal(j.done_at!, tz).date;
    const reference = `INV-${1044 - billed.length + n}`;
    const extra = Math.floor(random() * 4);
    const amount = j.price_pence ?? Math.min(c?.works_limit_pence ?? Infinity, m.prices.callout_pence + extra * m.prices.half_hour_pence);
    // A homeowner pays on the day by card, except the latest, still to pay.
    const paid = !c && j !== homeowners[homeowners.length - 1];
    j.status = 'invoiced';
    j.history.push({ at: new Date(j.done_at!.getTime() + 3_600_000).toISOString(), by: 'office', what: `invoiced ${reference}` });
    return {
      reference, job_ref: j.reference, property_key: j.property_key, client_key: j.client_key,
      payer: c ? { name: c.contact.name, phone: c.contact.phone } : { name: p.occupant.name, phone: p.occupant.phone },
      kind: 'job', description: `${j.description} (${shortAddress(p)})`, amount_pence: amount, status: paid ? 'paid' : 'due',
      issued, due: addDays(issued, c ? m.prices.account_days : 7), paid_at: paid ? j.done_at : null, paid_how: paid ? 'card' : null,
      card_last4: paid ? '3456' : null, auth_code: paid ? `DEMO-${reference.slice(4)}` : null, created_at: new Date(j.done_at!.getTime() + 3_600_000),
    };
  });

  return {
    bookings: [], orders: [],
    messages: messages(properties, now),
    texts: texts(profile, jobs, byKey),
    properties,
    jobs,
    certificates: certificates(properties, jobs, today),
    incidents,
    quotes,
    invoices,
  };
}

/** The on-the-way text already on the occupant's phone. */
function texts(profile: TenantProfile, jobs: SeedJob[], byKey: Map<string, MtProperty>): SeedText[] {
  const out: SeedText[] = [];
  for (const j of jobs) {
    const p = j.property_key ? byKey.get(j.property_key) : undefined;
    if (j.status !== 'on_the_way' || !p?.occupant.phone || !j.on_the_way_at) continue;
    const who = profile.maintenance!.engineers.find((e) => e.key === j.engineer_key)?.first_name ?? 'Your engineer';
    out.push({ to: p.occupant.phone, body: `${profile.name}: ${who} is on the way, about ${j.eta_minutes} minutes. Ref ${j.reference}. (Demo)`, created_at: j.on_the_way_at });
  }
  return out;
}

const plusYears = (date: string, n: number) => `${Number(date.slice(0, 4)) + n}${date.slice(4)}`.replace(/-02-29$/, '-02-28');

/** Days to go on the gas records due soonest; with 14 Elm Road's 40, six are due within six weeks and one is three days overdue. */
const GAS_DUE = [9, 16, 23, 30, 37, -3];

/**
 * The compliance register: a gas safety record for every rented home with
 * gas, an EICR for every rented home, and boiler services for some
 * homeowners, spread over their lives. Four EICRs are due within two
 * months, and one, done 19 days ago, found C2 items to put right within 28.
 */
function certificates(props: MtProperty[], jobs: SeedJob[], today: string): Certificate[] {
  const out: Certificate[] = [];
  const rented = props.filter((p) => p.client !== null);
  let g = 0;
  rented.forEach((p, i) => {
    if (p.gas) {
      const days = p.key === 'elm_14' ? 40 : g < GAS_DUE.length ? GAS_DUE[g++] : 45 + ((i * 37) % 315);
      const expires = addDays(today, days);
      out.push({ property_key: p.key, kind: 'gas_record', issued: plusYears(expires, -1), expires, remedials: [], booked_job: null });
    }
    if (i === 4) {
      const issued = addDays(today, -19);
      out.push({ property_key: p.key, kind: 'eicr', issued, expires: plusYears(issued, 5), remedials: [{ what: 'C2: no RCD protection on the socket circuits', due: addDays(issued, 28) }], booked_job: null });
      return;
    }
    const expires = addDays(today, i < 4 ? 12 + i * 12 : 70 + ((i * 53) % 1700));
    out.push({ property_key: p.key, kind: 'eicr', issued: plusYears(expires, -5), expires, remedials: [], booked_job: null });
  });
  props.filter((p) => p.client === null && p.gas).forEach((p, i) => {
    if (i % 2) return;
    const expires = addDays(today, 20 + ((i * 41) % 330));
    out.push({ property_key: p.key, kind: 'boiler_service', issued: plusYears(expires, -1), expires, remedials: [], booked_job: null });
  });
  // An EICR already booked shows as booked on the register.
  for (const j of jobs) {
    const c = j.kind === 'eicr' ? out.find((x) => x.property_key === j.property_key && x.kind === 'eicr') : undefined;
    if (c) c.booked_job = j.reference;
  }
  return out;
}

/** A tenant asking about a visit, and someone after a job. */
function messages(props: MtProperty[], now: Date): SeedMessage[] {
  const p = props[3];
  return [
    ...(p ? [{
      from_name: p.occupant.name ?? 'A tenant', from_phone: p.occupant.phone ?? '', body: `Can the engineer come after 3pm on Thursday? I'm at work in the mornings. (${shortAddress(p)})`,
      for_staff: 'duty_manager', category: 'job', urgency: 'this_week' as const, created_at: new Date(now.getTime() - 3 * 3_600_000),
    }] : []),
    {
      from_name: 'Kieran Doyle', from_phone: '+447700900611', body: "I'm a qualified electrician, NICEIC registered, looking for work. Please call me back.",
      for_staff: 'duty_manager', category: 'careers', created_at: new Date(now.getTime() - 26 * 3_600_000),
    },
  ];
}
