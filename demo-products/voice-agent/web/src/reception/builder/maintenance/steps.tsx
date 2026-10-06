// The property maintenance builder's own steps (presets/property-maintenance.md
// §3): where it works, who it works for, trades, engineers and on call,
// urgency, safety, office hours and visits, prices, safety checks and
// servicing, and policies. Each composes the shared pieces with what only a
// repairs contractor asks. The safety scripts are shown, never edited.

import type { MtNation } from '../../../../../src/domain/types.ts';
import { CLIENT_KINDS, MAX_CLIENTS, MAX_ENGINEERS, MAX_TRADES, MAX_WINDOWS, type ClientAnswer, type MaintenanceAnswers } from '../../../../../src/presets/maintenance/answers.ts';
import { safetyScripts } from '../../../../../src/presets/maintenance/nations.ts';
import { DayChips } from '../estate/steps.tsx';
import { Hours, type HoursOptions } from '../common/Hours.tsx';
import { Policies, PolicyText } from '../common/Policies.tsx';
import { Choice, ListText, Num, Pounds, Select, Text, Toggle } from '../fields.tsx';
import type { StepProps } from '../registry.ts';

type Props = StepProps<MaintenanceAnswers>;

const KIND_LABEL: Record<ClientAnswer['kind'], string> = {
  agent: 'Letting agent', landlord: 'Landlord', block: 'Block manager', social: 'Housing association', commercial: 'Business', insurer: 'Insurer',
};
const NOTICE: { value: ClientAnswer['notice']; label: string }[] = [
  { value: 'every_job', label: 'Every job' }, { value: 'over_limit', label: 'Only over their limit' }, { value: 'emergencies', label: 'Emergencies only' },
];
const NIGHTS: [number, string][] = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];
const key = (s: string, fallback: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || fallback;

// ── Where you work ──────────────────────────────────────────────────────

export function StepArea({ a, set }: Props) {
  return (
    <div className="fields">
      <Choice<MtNation>
        legend="Where you work" value={a.area.nation}
        options={[
          { value: 'england', label: 'England' },
          { value: 'wales', label: 'Wales' },
          { value: 'scotland', label: 'Scotland' },
          { value: 'northern_ireland', label: 'Northern Ireland', hint: 'its own gas emergency number' },
        ]}
        onChange={(v) => set((d) => void (d.area.nation = v))}
      />
      <ListText
        label="Postcode districts you cover" value={a.area.districts} placeholder="NG1, NG2, DE1"
        onChange={(v) => set((d) => void (d.area.districts = v))}
        hint="Separate them with commas. Outside these, callers are told politely that you don't cover them."
      />
      <ListText label="Towns" value={a.area.towns} placeholder="Nottingham, Derby, Loughborough" onChange={(v) => set((d) => void (d.area.towns = v))} />
    </div>
  );
}

// ── Who you work for ────────────────────────────────────────────────────

export function StepCustomers({ a, set }: Props) {
  const c = a.customers;
  const add = () => set((d) => void d.clients.push({
    key: `client_${Date.now().toString(36)}`, name: '', kind: 'agent', works_limit_pence: 25_000, emergency_authority_pence: 40_000, po_required: false,
    contact: { name: '', phone: '', email: '' }, notice: 'over_limit', instructions: '', status: 'active', min_priority: null, example: false,
  }));
  return (
    <div className="fields">
      <p className="lead">Who rings you. Each kind of customer is handled their own way: a homeowner hears the price and pays, a tenant's repair goes ahead under their agent's or landlord's limit.</p>
      <Toggle label="Homeowners" checked={c.homeowners} onChange={(v) => set((d) => void (d.customers.homeowners = v))} />
      <Toggle label="Landlords" checked={c.landlords} onChange={(v) => set((d) => void (d.customers.landlords = v))} />
      <Toggle label="Letting agents" checked={c.agents} onChange={(v) => set((d) => void (d.customers.agents = v))} />
      <Toggle
        label="Housing associations (social housing)" checked={c.social.on} onChange={(v) => set((d) => void (d.customers.social.on = v))}
        hint="Damp and mould is told to them the same day, with the time it was reported, and never blamed on the tenant."
      />
      {c.social.on ? (
        <Toggle
          label="We act as their agent for repairs" checked={c.social.agent_of_landlord} onChange={(v) => set((d) => void (d.customers.social.agent_of_landlord = v))}
          hint="In England, Awaab's Law then starts their 10-working-day damp and mould clock when we're told, and it counts down on the job."
        />
      ) : null}
      <Toggle
        label="Block and property managers" checked={c.blocks} onChange={(v) => set((d) => void (d.customers.blocks = v))}
        hint="A fault in a block's common parts is one job however many residents ring; inside a flat is the leaseholder's own."
      />
      <Toggle label="Businesses" checked={c.commercial} onChange={(v) => set((d) => void (d.customers.commercial = v))} hint="Shops, offices and surgeries: trading hours, a PO and the contract's priority." />
      <Toggle label="Insurers" checked={c.insurers} onChange={(v) => set((d) => void (d.customers.insurers = v))} hint="Claim work: the claim number on every job, and never a word on what a policy covers." />
      <Choice
        legend="A tenant whose landlord isn't one of your clients" value={c.tenant_no_client}
        options={[
          { value: 'contact_landlord', label: "We need the landlord's go-ahead first", hint: 'the receptionist takes the landlord\'s details as a message' },
          { value: 'private', label: 'Book them as a private customer', hint: 'at your standard prices' },
        ]}
        onChange={(v) => set((d) => void (d.customers.tenant_no_client = v))}
      />
      <Toggle
        label="Lockouts and tenant damage are recharged" checked={c.recharge_lockouts} onChange={(v) => set((d) => void (d.customers.recharge_lockouts = v))}
        hint="Said to tenants as something their landlord or agent may decide, never decided on the call."
      />

      <h3 className="sub">Clients</h3>
      <p className="hint">Agents, landlords, housing associations, block managers, businesses and insurers who authorise work. Their contact approves anything over the limit on their own phone, never by voice.</p>
      {a.clients.map((cl, i) => (
        <div className="group on area-card" key={cl.key}>
          <div className="area-head">
            <input aria-label="Client name" className="area-name" placeholder="Harbour Lettings" value={cl.name} maxLength={80} onChange={(e) => set((d) => void (d.clients[i].name = e.target.value))} />
            <select aria-label={`${cl.name || 'Client'} kind`} value={cl.kind} onChange={(e) => set((d) => void (d.clients[i].kind = e.target.value as ClientAnswer['kind']))}>
              {CLIENT_KINDS.filter((k) => k === 'agent' || k === 'landlord' || (k === 'social' && c.social.on) || (k === 'block' && c.blocks) || (k === 'commercial' && c.commercial) || (k === 'insurer' && c.insurers) || k === cl.kind).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            {cl.example ? <span className="badge">Example</span> : null}
            <button type="button" className="ghost small" onClick={() => {
              if (!confirm(`Remove ${cl.name || 'this client'}? Their sample homes won't be in the demo.`)) return;
              set((d) => void d.clients.splice(i, 1));
            }}>Remove</button>
          </div>
          <div className="three">
            <Pounds label="Go ahead without asking up to" pence={cl.works_limit_pence} onChange={(v) => set((d) => void (d.clients[i].works_limit_pence = v))} />
            <Pounds label="Emergency make-safe up to" pence={cl.emergency_authority_pence} onChange={(v) => set((d) => void (d.clients[i].emergency_authority_pence = v))} />
            <Select label="Tell them about" value={cl.notice} options={NOTICE} onChange={(v) => set((d) => void (d.clients[i].notice = v))} />
          </div>
          <div className="three">
            <Text label="Contact" value={cl.contact.name} max={60} onChange={(v) => set((d) => void (d.clients[i].contact.name = v))} />
            <Text label="Their mobile" value={cl.contact.phone} max={20} onChange={(v) => set((d) => void (d.clients[i].contact.phone = v))} hint="Approvals go here. Use a 07700 900 number in the demo." />
            <Text label="Email" value={cl.contact.email} max={120} onChange={(v) => set((d) => void (d.clients[i].contact.email = v))} />
          </div>
          <Toggle label="A purchase order on every job" checked={cl.po_required} onChange={(v) => set((d) => void (d.clients[i].po_required = v))} />
          {cl.kind === 'commercial' ? (
            <Select
              label="Their contract makes every job at least" value={cl.min_priority ?? ''}
              options={[{ value: '', label: 'As triaged' }, { value: 'urgent', label: 'Urgent' }, { value: 'emergency', label: 'An emergency' }]}
              onChange={(v) => set((d) => void (d.clients[i].min_priority = v === 'urgent' || v === 'emergency' ? v : null))}
            />
          ) : null}
          <Toggle label="On stop" checked={cl.status === 'on_stop'} onChange={(v) => set((d) => void (d.clients[i].status = v ? 'on_stop' : 'active'))} hint="No new work is booked for them." />
          <Text label="Notes for staff" value={cl.instructions} max={300} onChange={(v) => set((d) => void (d.clients[i].instructions = v))} hint="Never said to callers." />
        </div>
      ))}
      <div className="row-tools">
        <button type="button" className="small" disabled={a.clients.length >= MAX_CLIENTS} onClick={add}>+ Add a client</button>
      </div>
      <p className="hint">Start adds 90 sample homes and sites on made-up streets in your districts, under these clients and homeowners, each marked “example”. You'll see them under Properties and compliance.</p>
    </div>
  );
}

// ── Trades ──────────────────────────────────────────────────────────────

export function StepTrades({ a, set }: Props) {
  return (
    <div className="fields">
      <p className="lead">What you do. Gas work goes only to engineers with a Gas Safe number.</p>
      {a.trades.map((t, i) => (
        <div className="toggle-row" key={t.key}>
          <Toggle label={t.label} checked={t.on} onChange={(v) => set((d) => void (d.trades[i].on = v))} hint={t.gas ? 'Gas work' : undefined} />
        </div>
      ))}
      <div className="row-tools">
        <button type="button" className="small" disabled={a.trades.length >= MAX_TRADES} onClick={() => {
          const label = prompt('Your own trade, e.g. "Fencing and gates"');
          if (label?.trim()) set((d) => void d.trades.push({ key: key(label, `trade_${d.trades.length + 1}`), label: label.trim(), on: true }));
        }}>+ Add your own trade</button>
      </div>
      <h3 className="sub">What you don't do</h3>
      <p className="hint">And who to suggest instead, so a caller isn't left with nothing.</p>
      {a.dont_do.map((x, i) => (
        <div className="faq" key={i}>
          <input aria-label="What you don't do" value={x.what} maxLength={60} onChange={(e) => set((d) => void (d.dont_do[i].what = e.target.value))} />
          <input aria-label="Who to suggest" value={x.suggest} maxLength={160} onChange={(e) => set((d) => void (d.dont_do[i].suggest = e.target.value))} />
          <button type="button" className="ghost" aria-label={`Remove ${x.what}`} onClick={() => set((d) => void d.dont_do.splice(i, 1))}>✕</button>
        </div>
      ))}
      <div className="row-tools">
        <button type="button" className="small" disabled={a.dont_do.length >= 8} onClick={() => set((d) => void d.dont_do.push({ what: '', suggest: '' }))}>+ Add one</button>
      </div>
    </div>
  );
}

// ── Engineers and on call ───────────────────────────────────────────────

export function StepEngineers({ a, set }: Props) {
  const trades = a.trades.filter((t) => t.on);
  const add = () => set((d) => void d.engineers.push({
    key: `engineer_${Date.now().toString(36)}`, name: '', trades: [], gas_safe: '', niceic: false, oftec: false, days: [1, 2, 3, 4, 5], districts: [], per_window: 2, mobile: '',
  }));
  const options = [{ value: '', label: 'Nobody' }, ...a.engineers.filter((e) => e.name).map((e) => ({ value: e.key, label: e.name }))];
  return (
    <div className="fields">
      <p className="lead">Who goes out. Callers hear first names only, and a job is booked only with someone who does that trade, covers that district and works that day.</p>
      {a.engineers.map((e, i) => (
        <div className="group on area-card" key={e.key}>
          <div className="area-head">
            <input aria-label="Engineer's name" className="area-name" placeholder="Full name" value={e.name} maxLength={60} onChange={(ev) => set((d) => void (d.engineers[i].name = ev.target.value))} />
            <button type="button" className="ghost small" onClick={() => set((d) => {
              d.engineers.splice(i, 1);
              d.on_call.nights.forEach((n) => (n.engineers = n.engineers.filter((k) => k !== e.key)));
            })}>Remove</button>
          </div>
          <fieldset className="chips">
            <legend>Trades</legend>
            {trades.map((t) => (
              <label key={t.key} className={e.trades.includes(t.key) ? 'on' : ''}>
                <input type="checkbox" checked={e.trades.includes(t.key)} onChange={(ev) => set((d) => void (d.engineers[i].trades = ev.target.checked ? [...e.trades, t.key] : e.trades.filter((x) => x !== t.key)))} />
                {t.label}
              </label>
            ))}
          </fieldset>
          <div className="three">
            <Text label="Gas Safe number" value={e.gas_safe} max={30} onChange={(v) => set((d) => void (d.engineers[i].gas_safe = v))} hint="Empty: no gas work." />
            <Text label="Their mobile" value={e.mobile} max={20} onChange={(v) => set((d) => void (d.engineers[i].mobile = v))} hint="Pages land here in the demo; never given to callers." />
            <Num label="Jobs per window" value={e.per_window} min={1} max={6} onChange={(v) => set((d) => void (d.engineers[i].per_window = v))} />
          </div>
          <Toggle label="NICEIC registered" checked={e.niceic} onChange={(v) => set((d) => void (d.engineers[i].niceic = v))} />
          <DayChips legend="Works on" days={e.days} onChange={(days) => set((d) => void (d.engineers[i].days = days))} />
          <ListText label="Districts" value={e.districts} placeholder="Empty: the whole area" onChange={(v) => set((d) => void (d.engineers[i].districts = v))} />
        </div>
      ))}
      <div className="row-tools">
        <button type="button" className="small" disabled={a.engineers.length >= MAX_ENGINEERS} onClick={add}>+ Add an engineer</button>
      </div>

      <h3 className="sub">On call at night</h3>
      <p className="hint">Two a night, one Gas Safe whenever you do gas work: an emergency pages them, and nobody is named to the caller until they accept.</p>
      {NIGHTS.map(([day, label]) => {
        const i = a.on_call.nights.findIndex((n) => n.day === day);
        const pair = i >= 0 ? a.on_call.nights[i].engineers : [];
        const setPair = (slot: number, v: string) => set((d) => {
          let n = d.on_call.nights.find((x) => x.day === day);
          if (!n) d.on_call.nights.push((n = { day, engineers: [] }));
          const next = [...n.engineers];
          next[slot] = v;
          n.engineers = next.filter(Boolean);
        });
        return (
          <div className="two" key={day}>
            <Select label={`${label} night`} value={pair[0] ?? ''} options={options} onChange={(v) => setPair(0, v)} />
            <Select label="With" value={pair[1] ?? ''} options={options} onChange={(v) => setPair(1, v)} />
          </div>
        );
      })}
      <Num
        label="No answer to a page after" value={a.on_call.escalate_minutes} min={5} max={60} suffix="minutes"
        onChange={(v) => set((d) => void (d.on_call.escalate_minutes = v))} hint="Then the other engineer on call is paged, and after them the duty manager."
      />
      <div className="two">
        <Text label="Duty manager" value={a.on_call.duty_manager.name} max={60} onChange={(v) => set((d) => void (d.on_call.duty_manager.name = v))} hint="Texted when nobody on call can take an emergency." />
        <Text label="Their mobile" value={a.on_call.duty_manager.mobile} max={20} onChange={(v) => set((d) => void (d.on_call.duty_manager.mobile = v))} />
      </div>
    </div>
  );
}

// ── Urgency and response ────────────────────────────────────────────────

export function StepPriorities({ a, set }: Props) {
  const p = a.priorities;
  return (
    <div className="fields">
      <p className="lead">How soon each kind of fault is seen. The receptionist sorts each call by these, and says the target, never a promise.</p>
      <h3 className="sub">Emergency</h3>
      <div className="two">
        <Num label="Attend within" value={p.emergency.attend_hours} min={1} max={24} suffix="hours" onChange={(v) => set((d) => void (d.priorities.emergency.attend_hours = v))} />
        <Num label="Make safe within" value={p.emergency.make_safe_hours} min={1} max={72} suffix="hours" onChange={(v) => set((d) => void (d.priorities.emergency.make_safe_hours = v))} />
      </div>
      <ListText label="For example" value={p.emergency.examples} onChange={(v) => set((d) => void (d.priorities.emergency.examples = v))} max={600} />
      <h3 className="sub">Urgent</h3>
      <Num label="Within" value={p.urgent.working_days} min={1} max={10} suffix="working days" onChange={(v) => set((d) => void (d.priorities.urgent.working_days = v))} />
      <ListText label="For example" value={p.urgent.examples} onChange={(v) => set((d) => void (d.priorities.urgent.examples = v))} max={600} />
      <h3 className="sub">Routine</h3>
      <Num label="Within" value={p.routine.working_days} min={1} max={60} suffix="working days" onChange={(v) => set((d) => void (d.priorities.routine.working_days = v))} />
      <ListText label="For example" value={p.routine.examples} onChange={(v) => set((d) => void (d.priorities.routine.examples = v))} max={600} />
      <Toggle label="One step up for someone vulnerable" checked={p.vulnerable_uplift} onChange={(v) => set((d) => void (d.priorities.vulnerable_uplift = v))} hint="Over 75, under 5, disabled, unwell or pregnant, noted with their consent." />
      <Toggle label="No heating in winter is urgent for a vulnerable household" checked={p.winter_heating} onChange={(v) => set((d) => void (d.priorities.winter_heating = v))} hint="31 October to 1 May." />
    </div>
  );
}

// ── Safety ──────────────────────────────────────────────────────────────

export function StepSafety({ a, set }: Props) {
  const c = a.checks;
  return (
    <div className="fields">
      <ul className="facts locked">
        <li>Sends gas and carbon monoxide calls to the emergency service, never an engineer first.</li>
        <li>Never gives instructions beyond your approved checks.</li>
        <li>Never says who pays or admits fault: a person decides.</li>
        <li>Never reads out a key safe or alarm code.</li>
      </ul>
      <h3 className="sub">The checks a caller may try</h3>
      <p className="hint">The only things the receptionist suggests. Everything else is for an engineer.</p>
      <Toggle label="Prepayment meter has credit" checked={c.prepayment} onChange={(v) => set((d) => void (d.checks.prepayment = v))} />
      <Toggle label="Thermostat and timer" checked={c.thermostat} onChange={(v) => set((d) => void (d.checks.thermostat = v))} />
      <Toggle label="Reset a tripped switch once" checked={c.trip_reset} onChange={(v) => set((d) => void (d.checks.trip_reset = v))} />
      <Toggle label="Boiler pressure, for someone shown how" checked={c.boiler_pressure} onChange={(v) => set((d) => void (d.checks.boiler_pressure = v))} hint="Off: callers asking how to repressurise get an engineer instead." />
      <h3 className="sub">What the receptionist says in an emergency</h3>
      <p className="hint">Fixed, with {a.area.nation === 'northern_ireland' ? "Northern Ireland's" : 'the'} numbers. Said before anything else, and the number is texted.</p>
      <div className="scripts">
        {safetyScripts(a.area.nation).map((s) => (
          <details key={s.kind}>
            <summary>{s.title}{s.number ? ` · ${s.number}` : ''}</summary>
            <ol className="small">{s.steps.map((x) => <li key={x}>{x}</li>)}</ol>
          </details>
        ))}
      </div>
    </div>
  );
}

// ── Office hours and visits ─────────────────────────────────────────────

const OFFICE: HoursOptions = {
  day: { label: 'Open', open: '08:00', close: '17:30' },
  first: { label: 'Open', open: '08:00', close: '17:30' },
  next: { label: 'Open', open: '13:00', close: '17:30' },
  copy: { from: 1, to: [2, 3, 4, 5], label: 'Copy Monday to Tuesday–Friday' },
};

export function StepVisits(p: Props) {
  const { a, set } = p;
  const v = a.visits;
  return (
    <div className="fields">
      <Hours {...p} options={OFFICE} add="+ Add hours" lead="When the office is open. Out of these hours, the engineers on call take emergencies.">
        <h3 className="sub">Visit windows</h3>
        <p className="hint">Callers book a window, never an exact time. An all-day window can hold a morning and an afternoon.</p>
        {v.windows.map((w, i) => (
          <div className="group on area-card" key={w.key}>
            <div className="area-head">
              <input aria-label="Window name" className="area-name" value={w.label} maxLength={30} onChange={(e) => set((d) => void (d.visits.windows[i].label = e.target.value))} />
              <input aria-label={`${w.label} from`} type="time" value={w.from} onChange={(e) => set((d) => void (d.visits.windows[i].from = e.target.value))} />
              <input aria-label={`${w.label} to`} type="time" value={w.to} onChange={(e) => set((d) => void (d.visits.windows[i].to = e.target.value))} />
              <button type="button" className="ghost small" onClick={() => set((d) => void d.visits.windows.splice(i, 1))}>Remove</button>
            </div>
            <DayChips legend="On" days={w.days} onChange={(days) => set((d) => void (d.visits.windows[i].days = days))} />
            <Pounds label="Extra charge" pence={w.premium_pence} onChange={(x) => set((d) => void (d.visits.windows[i].premium_pence = x))} />
          </div>
        ))}
        <div className="row-tools">
          <button type="button" className="small" disabled={v.windows.length >= MAX_WINDOWS} onClick={() => set((d) => void d.visits.windows.push({ key: `window_${Date.now().toString(36)}`, label: 'All day', from: '08:00', to: '17:00', premium_pence: 0, days: [1, 2, 3, 4, 5] }))}>+ Add a window</button>
        </div>
      </Hours>
      <div className="three">
        <Num label="Notice needed" value={v.notice_hours} min={0} max={72} suffix="hours" onChange={(x) => set((d) => void (d.visits.notice_hours = x))} />
        <Num label="Book up to" value={v.horizon_days} min={1} max={60} suffix="days ahead" onChange={(x) => set((d) => void (d.visits.horizon_days = x))} />
        <Pounds label="No access, no notice" pence={v.abortive_fee_pence} onChange={(x) => set((d) => void (d.visits.abortive_fee_pence = x))} hint="Charged for a wasted visit." />
      </div>
      <Toggle label="Someone over 18 must be in" checked={v.adult_present} onChange={(x) => set((d) => void (d.visits.adult_present = x))} />
      <Toggle label="The engineer texts when on the way" checked={v.call_ahead} onChange={(x) => set((d) => void (d.visits.call_ahead = x))} />
    </div>
  );
}

// ── Prices and payment ──────────────────────────────────────────────────

export function StepPrices({ a, set }: Props) {
  const p = a.prices;
  const s = (k: 'callout_pence' | 'half_hour_pence' | 'ooh_first_hour_pence' | 'minimum_pence' | 'lockout_from_pence' | 'free_quote_over_pence') => (v: number) => set((d) => void (d.prices[k] = v));
  return (
    <div className="fields">
      <Toggle label="VAT registered" checked={p.vat_registered} onChange={(v) => set((d) => void (d.prices.vat_registered = v))} hint="On: every price is said including VAT, as consumer law asks." />
      <div className="three">
        <Pounds label="Call-out, with the first hour" pence={p.callout_pence} onChange={s('callout_pence')} />
        <Pounds label="Each half hour after" pence={p.half_hour_pence} onChange={s('half_hour_pence')} />
        <Pounds label="Nights and weekends, first hour" pence={p.ooh_first_hour_pence} onChange={s('ooh_first_hour_pence')} />
      </div>
      <div className="three">
        <Pounds label="Minimum charge" pence={p.minimum_pence} onChange={s('minimum_pence')} />
        <Pounds label="Lockouts from" pence={p.lockout_from_pence} onChange={s('lockout_from_pence')} />
        <Pounds label="Free quotes for work over" pence={p.free_quote_over_pence} onChange={s('free_quote_over_pence')} />
      </div>
      <div className="two">
        <Num label="Workmanship guarantee" value={p.guarantee_months} min={0} max={120} suffix="months" onChange={(v) => set((d) => void (d.prices.guarantee_months = v))} />
        <Num label="Account terms" value={p.account_days} min={0} max={90} suffix="days" onChange={(v) => set((d) => void (d.prices.account_days = v))} />
      </div>
      <Toggle label="Homeowners pay the call-out by card when booking" checked={p.card_on_booking} onChange={(v) => set((d) => void (d.prices.card_on_booking = v))} hint="With the demo card only: no real card is ever taken. Clients pay on account." />
      <Text label="Cancellation, as homeowners are told" area rows={2} max={300} value={p.cancellation} onChange={(v) => set((d) => void (d.prices.cancellation = v))} hint="Goes in every homeowner's booking text." />
    </div>
  );
}

// ── Safety checks and servicing ─────────────────────────────────────────

export function StepPlanned({ a, set }: Props) {
  const p = a.planned;
  const s = (k: 'gas_record_pence' | 'extra_appliance_pence' | 'boiler_service_pence' | 'combined_pence' | 'eicr_from_pence') => (v: number) => set((d) => void (d.planned[k] = v));
  return (
    <div className="fields">
      <p className="lead">Landlords' certificates and servicing. A gas safety record booked up to two months early keeps its date, and the receptionist says so.</p>
      <div className="two">
        <Pounds label="Gas safety record, one appliance" pence={p.gas_record_pence} onChange={s('gas_record_pence')} />
        <Pounds label="Each extra appliance" pence={p.extra_appliance_pence} onChange={s('extra_appliance_pence')} />
      </div>
      <div className="three">
        <Pounds label="Boiler service" pence={p.boiler_service_pence} onChange={s('boiler_service_pence')} />
        <Pounds label="Both on one visit" pence={p.combined_pence} onChange={s('combined_pence')} />
        <Pounds label="EICR from" pence={p.eicr_from_pence} onChange={s('eicr_from_pence')} />
      </div>
      <Num label="Remind landlords" value={p.reminder_weeks} min={0} max={26} suffix="weeks before" onChange={(v) => set((d) => void (d.planned.reminder_weeks = v))} hint="Only where they agreed to reminders." />
    </div>
  );
}

// ── Policies and questions ──────────────────────────────────────────────

export function StepPolicies(props: Props) {
  const { a, set } = props;
  const co = a.compliance;
  return (
    <Policies {...props}>
      <h3 className="sub">Accreditations and insurance</h3>
      <div className="two">
        <Text label="Gas Safe registration number" value={co.gas_safe_number} max={30} onChange={(v) => set((d) => void (d.compliance.gas_safe_number = v))} />
        <Text label="Insurance" value={co.insurance} max={160} onChange={(v) => set((d) => void (d.compliance.insurance = v))} />
      </div>
      <Toggle label="NICEIC" checked={co.niceic} onChange={(v) => set((d) => void (d.compliance.niceic = v))} />
      <Toggle label="NAPIT" checked={co.napit} onChange={(v) => set((d) => void (d.compliance.napit = v))} />
      <Toggle label="OFTEC" checked={co.oftec} onChange={(v) => set((d) => void (d.compliance.oftec = v))} />
      <div className="two">
        <Text label="Complaints go to" value={co.complaints_handler} max={60} onChange={(v) => set((d) => void (d.compliance.complaints_handler = v))} />
        <Text label="Data protection lead" value={co.data_lead} max={60} onChange={(v) => set((d) => void (d.compliance.data_lead = v))} />
      </div>
      <div className="two">
        <PolicyText a={a} set={set} k="guarantee" label="Guarantee" />
        <PolicyText a={a} set={set} k="asbestos" label="Asbestos" />
        <PolicyText a={a} set={set} k="parking" label="Parking for engineers" />
        <PolicyText a={a} set={set} k="payment" label="How customers pay" />
        <PolicyText a={a} set={set} k="careers" label="Jobs with you" />
      </div>
      <Text label="What callers hear about recording" area rows={2} max={300} value={co.recording} onChange={(v) => set((d) => void (d.compliance.recording = v))} />
    </Policies>
  );
}
