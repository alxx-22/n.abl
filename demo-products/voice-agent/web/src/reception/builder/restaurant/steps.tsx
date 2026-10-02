// The restaurant's own builder steps: how it serves, its seating, money and
// policies. Each composes the shared pieces (collection and delivery,
// takeaway payment, policies and questions) with what only a restaurant
// asks. Field by field in DEMO-SERVICE-PLAN.md §4.1.

import { CollectionDelivery } from '../food/Ordering.tsx';
import { TakeawayPayment } from '../food/Payment.tsx';
import { PolicyText, Policies } from '../common/Policies.tsx';
import { Choice, Num, Pounds, Select, Text, Toggle } from '../fields.tsx';
import type { StepProps } from '../registry.ts';
import { sectionOf } from '../section.ts';
import type { AreaAnswer, RestaurantAnswers } from '../../types.ts';
import { KINDS, addArea, addTable, removeTable } from './seating.ts';

type Props = StepProps<RestaurantAnswers>;

// ── How you serve ───────────────────────────────────────────────────────

export function StepServe({ a, set }: Props) {
  return (
    <div className="fields">
      <Toggle label="Table reservations" checked={a.serve.reservations} onChange={(v) => set((d) => void (d.serve.reservations = v))} hint="The receptionist books tables into your floor plan. Seating and the floor plan come next." />
      <Toggle label="Walk-ins welcome" checked={a.serve.walk_ins} onChange={(v) => set((d) => void (d.serve.walk_ins = v))} hint="Tables marked for walk-ins stay free in the diary, and the receptionist says “do pop by”." />
      <CollectionDelivery ordering={sectionOf(a, set, 'serve')} path="serve" sources={a.sources} />
    </div>
  );
}

// ── Seating ─────────────────────────────────────────────────────────────

export function StepSeating({ a, set }: Props) {
  const sizes = [2, 4, 6, 8];
  const addArea_ = (kind: AreaAnswer['kind']) => set((d) => void addArea(d, kind));
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
                  d.seating.fixtures = d.seating.fixtures.filter((f) => f.area !== ar.key);
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
        {KINDS.map((k) => <button type="button" className="small" key={k.value} onClick={() => addArea_(k.value)}>+ {k.label}</button>)}
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

// ── Money ───────────────────────────────────────────────────────────────

export function StepMoney({ a, set }: Props) {
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
      <TakeawayPayment legend="Paying for takeaway" value={a.money.takeaway_payment} onChange={(v) => set((d) => void (d.money.takeaway_payment = v))} />
      <Text label="Service charge" max={200} value={a.money.service_charge} onChange={(v) => set((d) => void (d.money.service_charge = v))} />
    </div>
  );
}

// ── Policies and questions ──────────────────────────────────────────────

export function StepPolicies(props: Props) {
  const { a, set } = props;
  const t = (k: Exclude<keyof RestaurantAnswers['policies'], 'dogs' | 'faqs'>, label: string) => <PolicyText a={a} set={set} k={k} label={label} />;
  return (
    <Policies {...props}>
      <div className="two">
        {t('children', 'Children and highchairs')}
        <Select label="Dogs" value={a.policies.dogs} options={[{ value: 'inside', label: 'Welcome inside' }, { value: 'outside_only', label: 'Outside only' }, { value: 'no', label: 'Not allowed (assistance dogs welcome)' }]} onChange={(v) => set((d) => void (d.policies.dogs = v))} />
        {t('accessibility', 'Accessibility')}
        {t('parking', 'Parking')}
        {t('dress_code', 'Dress code')}
        {t('corkage', 'Corkage and bring your own')}
        {t('cakes', 'Birthday cakes')}
        {t('vouchers', 'Gift vouchers')}
      </div>
      {t('dietary', 'Gluten-free, vegan and other diets')}
    </Policies>
  );
}
