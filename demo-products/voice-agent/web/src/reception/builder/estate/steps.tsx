// The estate agent's own builder steps (presets/estate-agent.md §3): where
// it works, its three diaries, the team, viewings, offers and valuations,
// fees and the firms it works with, and the area guide. Each composes the
// shared pieces with what only an agency asks.

import type { Nation, StaffDuty, StaffRole } from '../../../../../src/domain/types.ts';
import type { EstateAnswers, StaffAnswer } from '../../../../../src/presets/estate/answers.ts';
import { Hours, Week, type HoursOptions } from '../common/Hours.tsx';
import { Policies, PolicyText } from '../common/Policies.tsx';
import { Choice, ListText, Num, Pounds, Select, Text, Toggle } from '../fields.tsx';
import type { StepProps } from '../registry.ts';

type Props = StepProps<EstateAnswers>;

/** As many as the server keeps (MAX_TEAM in src/presets/estate/answers.ts). */
const MAX_TEAM = 12;

export const ROLES: Record<StaffRole, string> = {
  manager: 'Manager', negotiator: 'Negotiator', valuer: 'Valuer', progressor: 'Sales progressor', adviser: 'Mortgage adviser', other: 'Other',
};
const DUTIES: Record<StaffDuty, string> = { viewings: 'Shows homes', valuations: 'Values homes', progression: 'Progresses sales', mortgage: 'Mortgage advice' };
/** Monday first, as people read a week. */
const DAYS: [number, string][] = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];

/** The team as a picker's options; `none` adds a first option for nobody. */
export function staffOptions(team: StaffAnswer[], none?: string): { value: string; label: string }[] {
  return [...(none ? [{ value: '', label: none }] : []), ...team.filter((t) => t.name).map((t) => ({ value: t.key, label: t.name }))];
}

/** The working days as chips, Monday first. */
export function DayChips({ legend, days, onChange }: { legend: string; days: number[]; onChange: (days: number[]) => void }) {
  return (
    <fieldset className="chips">
      <legend>{legend}</legend>
      {DAYS.map(([d, label]) => (
        <label key={d} className={days.includes(d) ? 'on' : ''}>
          <input type="checkbox" checked={days.includes(d)} onChange={(e) => onChange(e.target.checked ? [...days, d].sort() : days.filter((x) => x !== d))} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

// ── Where you work ──────────────────────────────────────────────────────

export function StepPatch({ a, set }: Props) {
  const p = a.patch;
  return (
    <div className="fields">
      <Choice<Nation | 'scotland'>
        legend="Where your homes are" value={p.nation}
        options={[
          { value: 'england', label: 'England' },
          { value: 'wales', label: 'Wales' },
          { value: 'northern_ireland', label: 'Northern Ireland', hint: 'rates instead of council tax' },
          { value: 'scotland', label: 'Scotland', hint: 'coming later: the law there is different', disabled: true },
        ]}
        onChange={(v) => v !== 'scotland' && set((d) => void (d.patch.nation = v))}
      />
      <ListText
        label="Postcode districts you cover" value={p.districts} placeholder="BK1, BK2, BK3"
        onChange={(v) => set((d) => void (d.patch.districts = v))}
        hint="Separate them with commas. The receptionist books valuations only inside these."
      />
      <ListText label="Towns and villages" value={p.towns} placeholder="Brackenford, Little Haddon" onChange={(v) => set((d) => void (d.patch.towns = v))} />
      <Choice
        legend="Lettings" value={p.lettings}
        options={[
          { value: 'none', label: 'Sales only', hint: 'callers about renting are told you only sell homes' },
          { value: 'message', label: 'Take lettings calls as a message' },
        ]}
        onChange={(v) => set((d) => void (d.patch.lettings = v))}
      />
      {p.lettings === 'message' ? (
        <Select label="Lettings messages go to" value={p.lettings_contact} options={staffOptions(a.team, 'Choose someone')} onChange={(v) => set((d) => void (d.patch.lettings_contact = v))} />
      ) : null}
    </div>
  );
}

// ── Office and viewing hours ────────────────────────────────────────────

const OFFICE: HoursOptions = {
  day: { label: 'Open', open: '09:00', close: '17:30' },
  first: { label: 'Open', open: '09:00', close: '17:30' },
  next: { label: 'Open', open: '13:00', close: '17:30' },
  copy: { from: 1, to: [2, 3, 4, 5], label: 'Copy Monday to Tuesday–Friday' },
};
const VIEWINGS: HoursOptions = { ...OFFICE, day: { label: 'Viewings', open: '09:00', close: '19:00' }, first: { label: 'Viewings', open: '09:00', close: '19:00' }, next: { label: 'Viewings', open: '17:00', close: '19:00' } };
const VALUATIONS: HoursOptions = { ...OFFICE, day: { label: 'Valuations', open: '09:00', close: '18:00' }, first: { label: 'Valuations', open: '09:00', close: '18:00' }, next: { label: 'Valuations', open: '14:00', close: '18:00' } };

export function StepHours(p: Props) {
  const { a, set } = p;
  const diary = (k: 'viewing_days' | 'valuation_days') => ({ days: a.diary[k], edit: (fn: (days: EstateAnswers['diary'][typeof k]) => void) => set((d) => fn(d.diary[k])) });
  return (
    <div className="fields">
      <Hours {...p} options={OFFICE} add="+ Add hours" lead="When the office is open. The receptionist answers “are you open?” from these, and says when someone will be back.">
        <h3 className="sub">Viewings</h3>
        <p className="hint">When homes can be shown: often later than the office. Each home’s own rules (a tenant’s notice, a seller’s hours) come on top.</p>
        <Week {...diary('viewing_days')} options={VIEWINGS} name="Viewings" add="+ Add hours" />
        <h3 className="sub">Valuations</h3>
        <p className="hint">When your valuers visit sellers.</p>
        <Week {...diary('valuation_days')} options={VALUATIONS} name="Valuations" add="+ Add hours" />
      </Hours>
      <div className="fields">
        <Toggle
          label="Book viewings and valuations when the office is shut" checked={a.diary.out_of_hours_booking}
          onChange={(v) => set((d) => void (d.diary.out_of_hours_booking = v))}
          hint="Off: out of hours, the receptionist takes a message for the morning instead."
        />
        <Select
          label="On call for emergencies" value={a.diary.on_call ?? ''} options={staffOptions(a.team, 'Nobody')}
          onChange={(v) => set((d) => void (d.diary.on_call = v || null))}
          hint="Texted at once about a leak or a break-in at a home you hold keys for."
        />
      </div>
    </div>
  );
}

// ── Your team ───────────────────────────────────────────────────────────

export function StepTeam({ a, set }: Props) {
  const add = () => set((d) => void d.team.push({ key: `person_${Date.now().toString(36)}`, name: '', role: 'negotiator', does: ['viewings'], days: [1, 2, 3, 4, 5], mobile: '' }));
  return (
    <div className="fields">
      <p className="lead">Who works here and what each does. Callers hear first names only, and the diary books each person on their own days.</p>
      {a.team.map((t, i) => {
        const homes = a.listings.filter((l) => l.negotiator === t.key).length;
        return (
          <div className="group on area-card" key={t.key}>
            <div className="area-head">
              <input aria-label="Name" className="area-name" placeholder="Full name" value={t.name} maxLength={60} onChange={(e) => set((d) => void (d.team[i].name = e.target.value))} />
              <select aria-label={`${t.name || 'Their'} role`} value={t.role} onChange={(e) => set((d) => void (d.team[i].role = e.target.value as StaffRole))}>
                {Object.entries(ROLES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              {homes ? <span className="muted small">{homes} home{homes === 1 ? '' : 's'}</span> : null}
              <button type="button" className="ghost small" onClick={() => {
                if (homes && !confirm(`Remove ${t.name || 'this person'}? ${homes} home${homes === 1 ? '' : 's'} will need another negotiator.`)) return;
                set((d) => {
                  d.team.splice(i, 1);
                  // Nothing may point at someone who has gone: each is left to choose again (the validator says where).
                  const k = t.key;
                  if (d.diary.on_call === k) d.diary.on_call = null;
                  if (d.patch.lettings_contact === k) d.patch.lettings_contact = '';
                  if (d.valuations.rics.staff === k) d.valuations.rics.staff = '';
                  if (d.partners.mortgage.staff === k) d.partners.mortgage.staff = '';
                  if (d.compliance.complaints_handler === k) d.compliance.complaints_handler = '';
                  if (d.compliance.data_lead === k) d.compliance.data_lead = '';
                  for (const l of d.listings) if (l.personal_interest?.staff === k) l.personal_interest.staff = '';
                });
              }}>Remove</button>
            </div>
            <fieldset className="chips">
              <legend>What they do</legend>
              {(Object.keys(DUTIES) as StaffDuty[]).map((k) => (
                <label key={k} className={t.does.includes(k) ? 'on' : ''}>
                  <input type="checkbox" checked={t.does.includes(k)} onChange={(e) => set((d) => {
                    const p = d.team[i];
                    p.does = e.target.checked ? [...p.does, k] : p.does.filter((x) => x !== k);
                  })} />
                  {DUTIES[k]}
                </label>
              ))}
            </fieldset>
            <DayChips legend="Working days" days={t.days} onChange={(v) => set((d) => void (d.team[i].days = v))} />
            <Text label="Mobile for urgent texts" value={t.mobile} max={20} placeholder="07700 900000" onChange={(v) => set((d) => void (d.team[i].mobile = v))} hint="Shown on the demo’s phone; nothing is sent." />
          </div>
        );
      })}
      <div className="row-tools">
        <button type="button" className="small" disabled={a.team.length >= MAX_TEAM} onClick={add}>+ Add someone</button>
        <span className="hint">Up to {MAX_TEAM} people.</span>
      </div>
    </div>
  );
}

// ── Viewings and safety ─────────────────────────────────────────────────

export function StepViewings({ a, set }: Props) {
  const v = a.viewings;
  return (
    <div className="fields">
      <div className="three">
        <Num label="A viewing" suffix="min" min={15} max={90} value={v.minutes} onChange={(n) => set((d) => void (d.viewings.minutes = n))} />
        <Num label="A second viewing" suffix="min" min={15} max={120} value={v.second_minutes} onChange={(n) => set((d) => void (d.viewings.second_minutes = n))} />
        <Num label="Travel between homes" suffix="min" min={0} max={60} value={v.travel_minutes} onChange={(n) => set((d) => void (d.viewings.travel_minutes = n))} hint="Kept clear before and after each visit." />
        <Num label="Least notice" suffix="hours" min={0} max={72} value={v.notice_hours} onChange={(n) => set((d) => void (d.viewings.notice_hours = n))} />
        <Num label="Book up to" suffix="days ahead" min={1} max={60} value={v.horizon_days} onChange={(n) => set((d) => void (d.viewings.horizon_days = n))} />
      </div>
      <h3 className="sub">Safety</h3>
      <Toggle
        label="Ask a new buyer for their home postcode" checked={v.safety.take_postcode}
        onChange={(n) => set((d) => void (d.viewings.safety.take_postcode = n))}
        hint="Before their first viewing, so whoever meets them knows who they are meeting."
      />
      <Toggle
        label="First viewings at an empty home only in office hours" checked={v.safety.empty_office_hours_only}
        onChange={(n) => set((d) => void (d.viewings.safety.empty_office_hours_only = n))}
        hint="The receptionist never says a home is empty: it just offers those times."
      />
    </div>
  );
}

// ── Offers and valuations ───────────────────────────────────────────────

/** The law, shown as fixed so a prospect sees it rather than a switch. */
const LOCKED = [
  'Never gives a value on the phone.',
  'Tells buyers who have offered that other offers exist.',
  'Never shares another buyer’s offer: only your team can, to every bidder at once.',
];

export function StepOffers({ a, set }: Props) {
  const o = a.offers;
  const va = a.valuations;
  return (
    <div className="fields">
      <Choice
        legend="Offers on the phone" value={o.take}
        options={[
          { value: 'record', label: 'Record the offer and read it back', hint: 'then it goes to the negotiator to put to the seller' },
          { value: 'message', label: 'Always an urgent message for a person' },
        ]}
        onChange={(v) => set((d) => void (d.offers.take = v))}
      />
      <div className="three">
        <Pounds label="Buyer ID checks, each" pence={o.buyer_fee_pence} max={100_000} onChange={(v) => set((d) => void (d.offers.buyer_fee_pence = v))} hint="Including VAT. £0 for none." />
        <Text label="Charged" value={o.buyer_fee_when} max={100} onChange={(v) => set((d) => void (d.offers.buyer_fee_when = v))} />
        <Text label="Checked by" value={o.id_provider} max={80} onChange={(v) => set((d) => void (d.offers.id_provider = v))} />
      </div>
      <Text label="How best and final works" area rows={2} max={300} value={o.best_final} onChange={(v) => set((d) => void (d.offers.best_final = v))} hint="Said when a buyer asks." />

      <h3 className="sub">Valuations</h3>
      <div className="two">
        <Text label="What you call them" value={va.name} max={60} onChange={(v) => set((d) => void (d.valuations.name = v))} hint="“free market appraisal”, “valuation”." />
        <Num label="How long one takes" suffix="min" min={15} max={180} value={va.minutes} onChange={(v) => set((d) => void (d.valuations.minutes = v))} />
      </div>
      <Toggle label="RICS valuations too" checked={va.rics.offered} onChange={(v) => set((d) => void (d.valuations.rics.offered = v))} hint="A paid, formal report, as for probate. The receptionist takes the details for a call back." />
      {va.rics.offered ? (
        <div className="two">
          <Pounds label="Fee" pence={va.rics.fee_pence} max={1_000_000} onChange={(v) => set((d) => void (d.valuations.rics.fee_pence = v))} />
          <Select label="Done by" value={va.rics.staff} options={staffOptions(a.team, 'Choose someone')} onChange={(v) => set((d) => void (d.valuations.rics.staff = v))} />
        </div>
      ) : null}

      <h3 className="sub">Always, whatever you set</h3>
      <ul className="facts locked">
        {LOCKED.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </div>
  );
}

// ── Fees and services ───────────────────────────────────────────────────

export function StepServices({ a, set }: Props) {
  const f = a.fees;
  const m = a.partners.mortgage;
  const c = a.partners.conveyancing;
  const co = a.compliance;
  return (
    <div className="fields">
      <Toggle label="Quote your fees on the phone" checked={f.quote} onChange={(v) => set((d) => void (d.fees.quote = v))} hint="Off: callers hear the fee is explained at the valuation." />
      {f.quote ? (
        <div className="group on">
          <Choice legend="Your fee" value={f.kind} options={[{ value: 'percent', label: 'A percentage of the price' }, { value: 'fixed', label: 'A fixed fee' }]} onChange={(v) => set((d) => void (d.fees.kind = v))} />
          <div className="three">
            {f.kind === 'percent' ? (
              <Num label="Fee" suffix="% including VAT" min={0} max={10} step={0.05} value={f.percent_hundredths / 100} onChange={(v) => set((d) => void (d.fees.percent_hundredths = Math.round(v * 100)))} />
            ) : (
              <Pounds label="Fee, including VAT" pence={f.fixed_pence} max={10_000_000} onChange={(v) => set((d) => void (d.fees.fixed_pence = v))} />
            )}
            <Num label="Least term" suffix="weeks" min={0} max={52} value={f.min_weeks} onChange={(v) => set((d) => void (d.fees.min_weeks = v))} />
            <Select label="Agreement" value={f.contract} options={[{ value: 'sole_agency', label: 'Sole agency' }, { value: 'multi_agency', label: 'Multi-agency' }]} onChange={(v) => set((d) => void (d.fees.contract = v))} />
          </div>
          <Text label="Every extra a seller must pay" area rows={2} max={300} value={f.extras} onChange={(v) => set((d) => void (d.fees.extras = v))} hint="So no charge is added later. Empty if there are none." />
        </div>
      ) : null}
      <Text label="What your fee includes" area rows={2} max={300} value={f.includes} onChange={(v) => set((d) => void (d.fees.includes = v))} />
      <ListText label="Where and how you market homes" value={f.marketing} max={800} onChange={(v) => set((d) => void (d.fees.marketing = v))} hint="Separate them with commas: Rightmove, Zoopla, a video tour." />

      <h3 className="sub">Firms you work with</h3>
      <Toggle label="A mortgage adviser" checked={m.on} onChange={(v) => set((d) => void (d.partners.mortgage.on = v))} hint="Offered to buyers, never pressed on them." />
      {m.on ? (
        <div className="group on">
          <div className="two">
            <Text label="Their firm" value={m.firm} max={80} onChange={(v) => set((d) => void (d.partners.mortgage.firm = v))} />
            <Select label="Your adviser" value={m.staff} options={staffOptions(a.team, 'Choose someone')} onChange={(v) => set((d) => void (d.partners.mortgage.staff = v))} />
          </div>
          <Text label="The sentence the firm approved" area rows={3} max={400} value={m.statement} onChange={(v) => set((d) => void (d.partners.mortgage.statement = v))} hint="Said word for word, with any referral fee. The receptionist gives no advice itself." />
        </div>
      ) : null}
      <Toggle label="A conveyancing panel" checked={c.on} onChange={(v) => set((d) => void (d.partners.conveyancing.on = v))} />
      {c.on ? <Text label="What callers are told about it" area rows={2} max={400} value={c.statement} onChange={(v) => set((d) => void (d.partners.conveyancing.statement = v))} hint="Including any referral fee." /> : null}

      <h3 className="sub">Complaints and data</h3>
      <div className="three">
        <Select label="Redress scheme" value={co.redress} options={[{ value: 'tpo', label: 'The Property Ombudsman' }, { value: 'prs', label: 'Property Redress Scheme' }]} onChange={(v) => set((d) => void (d.compliance.redress = v))} />
        <Select label="Complaints go to" value={co.complaints_handler} options={staffOptions(a.team, 'Choose someone')} onChange={(v) => set((d) => void (d.compliance.complaints_handler = v))} />
        <Select label="Data protection lead" value={co.data_lead} options={staffOptions(a.team, 'Choose someone')} onChange={(v) => set((d) => void (d.compliance.data_lead = v))} />
      </div>
      <Text label="What callers hear about recording" area rows={2} max={300} value={co.recording} onChange={(v) => set((d) => void (d.compliance.recording = v))} />
    </div>
  );
}

// ── Area guide and questions ────────────────────────────────────────────

export function StepPolicies(props: Props) {
  const { a, set } = props;
  return (
    <Policies {...props}>
      <h3 className="sub">Area guide</h3>
      <p className="hint">Transport, schools, doctors, parks: what buyers new to the area ask.</p>
      {a.area.faqs.map((f, i) => (
        <div className="faq" key={i}>
          <input aria-label="Area question" value={f.q} maxLength={150} onChange={(e) => set((d) => void (d.area.faqs[i].q = e.target.value))} />
          <textarea aria-label="Area answer" className="prose" rows={2} maxLength={500} value={f.a} onChange={(e) => set((d) => void (d.area.faqs[i].a = e.target.value))} />
          <button type="button" className="ghost" aria-label="Remove this area question" onClick={() => set((d) => void d.area.faqs.splice(i, 1))}>✕</button>
        </div>
      ))}
      <div className="row-tools">
        <button type="button" className="small" onClick={() => set((d) => void d.area.faqs.push({ q: '', a: '' }))}>+ Add an area question</button>
      </div>
      <div className="two">
        <PolicyText a={a} set={set} k="parking" label="Parking at the office" />
        <PolicyText a={a} set={set} k="at_viewings" label="At viewings" hint="Children, dogs, shoes off: what buyers should know." />
      </div>
    </Policies>
  );
}
