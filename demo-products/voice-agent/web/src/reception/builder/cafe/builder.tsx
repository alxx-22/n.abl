// The café's builder (presets/cafe.md §3): its steps with the server's own
// titles (src/presets/cafe/steps.ts). Seating and the floor plan are the
// restaurant's; the menu and ordering to collect are the shared editors;
// bookings and afternoon tea, and the policies, are the café's own. The preview pane lists the server's
// lines.

import { STEPS, type CafeStep } from '../../../../../src/presets/cafe/steps.ts';
import type { CafeAnswers } from '../../types.ts';
import { Basics } from '../common/Basics.tsx';
import { Hours } from '../common/Hours.tsx';
import { PolicyText, Policies } from '../common/Policies.tsx';
import { MenuEditor } from '../food/MenuEditor.tsx';
import { CollectionDelivery } from '../food/Ordering.tsx';
import { TakeawayPayment } from '../food/Payment.tsx';
import { Choice, ListText, Num, Pounds, Select, Text, Toggle } from '../fields.tsx';
import type { BuilderDef, StepProps } from '../registry.ts';
import { StepFloor } from '../restaurant/StepFloor.tsx';
import { StepSeating } from '../restaurant/steps.tsx';
import { sectionOf } from '../section.ts';

type Props = StepProps<CafeAnswers>;
const pounds = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const TIMES = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'];

function StepBooking({ a, set }: Props) {
  const t = a.afternoon_tea;
  return (
    <div className="fields">
      <p className="lead">Which tables callers can book, and your afternoon tea.</p>
      <Num
        label="Book tables for" value={a.booking.min_party} min={1} max={20}
        onChange={(v) => set((d) => void (d.booking.min_party = v))}
        suffix="people or more"
        hint="Smaller tables are walk-in: the receptionist never books or promises one, and says when it's usually busy."
      />
      <Text label="When it's busy" value={a.booking.busy_times} max={200} onChange={(v) => set((d) => void (d.booking.busy_times = v))} hint="Said to anyone wanting to turn up." />
      <Toggle label="Afternoon tea" checked={t.offered} onChange={(v) => set((d) => void (d.afternoon_tea.offered = v))} hint="Booked at your tables inside, at the sittings you set." />
      {t.offered ? (
        <>
          <Text label="What's in it" value={t.description} max={300} onChange={(v) => set((d) => void (d.afternoon_tea.description = v))} />
          <div className="two">
            <Pounds label="A person" pence={t.adult_pence} max={10_000} onChange={(v) => set((d) => void (d.afternoon_tea.adult_pence = v))} />
            <Pounds label={`Children under ${t.child_under}`} pence={t.child_pence} max={10_000} onChange={(v) => set((d) => void (d.afternoon_tea.child_pence = v))} />
          </div>
          <ListText
            label="Sittings" value={t.sittings} placeholder="12:00, 14:00, 15:30"
            onChange={(v) => set((d) => void (d.afternoon_tea.sittings = v.filter((x) => /^([01]\d|2[0-3]):[0-5]\d$/.test(x)).slice(0, 4)))}
            hint={`Up to four, as 14:00. Each lasts ${t.minutes} minutes, and is only offered on days you're open long enough.`}
          />
          <div className="two">
            <Select
              label="Book ahead" value={t.notice_days}
              options={[0, 1, 2, 3, 7].map((n) => ({ value: n, label: n ? `${n} day${n === 1 ? '' : 's'}` : 'Same day' }))}
              onChange={(v) => set((d) => { d.afternoon_tea.notice_days = v; d.afternoon_tea.diet_notice_days = Math.max(v, d.afternoon_tea.diet_notice_days); })}
            />
            <Select
              label="For a special diet" value={t.diet_notice_days}
              options={[0, 1, 2, 3, 7].filter((n) => n >= t.notice_days).map((n) => ({ value: n, label: n ? `${n} day${n === 1 ? '' : 's'}` : 'Same day' }))}
              onChange={(v) => set((d) => void (d.afternoon_tea.diet_notice_days = v))}
            />
          </div>
          <ListText label="Special diets you make it for" value={t.diets} placeholder="gluten-free, vegan" onChange={(v) => set((d) => void (d.afternoon_tea.diets = v.slice(0, 4)))} />
          <Num label="Up to" value={t.max_party} min={1} max={20} suffix="people" onChange={(v) => set((d) => void (d.afternoon_tea.max_party = v))} />
        </>
      ) : null}
    </div>
  );
}

function StepOrdering({ a, set }: Props) {
  const h = a.hours;
  return (
    <>
      <CollectionDelivery ordering={sectionOf(a, set, 'ordering')} path="ordering" sources={a.sources} />
      <TakeawayPayment legend="Paying for an order" value={a.money.payment} onChange={(v) => set((d) => void (d.money.payment = v))} />
      <p className="hint">
        Orders are taken until food stops{h.kitchen_closes_before ? `, ${h.kitchen_closes_before} minutes before closing` : ''}{h.breakfast_until ? `, and breakfast only until ${h.breakfast_until}` : ''}: both are set with your opening hours.
        Anything sold out today you switch off in your workspace, under Today.
      </p>
    </>
  );
}

function StepPolicies(props: Props) {
  const { a, set } = props;
  const p = a.policies;
  return (
    <Policies {...props}>
      <Choice
        legend="Dogs" value={p.dogs}
        options={[
          { value: 'inside', label: 'Welcome inside' },
          { value: 'outside_only', label: 'Outside only' },
          { value: 'no', label: 'No dogs' },
        ]}
        onChange={(v) => set((d) => void (d.policies.dogs = v))}
      />
      <p className="hint">Assistance dogs are always welcome, whatever this says.</p>
      <Toggle label="Cash as well as card" checked={a.money.cash} onChange={(v) => set((d) => void (d.money.cash = v))} hint="There's never an extra charge for card." />
      <Toggle label="Baby changing" checked={p.baby_changing} onChange={(v) => set((d) => void (d.policies.baby_changing = v))} />
      <Toggle label="Free tap water" checked={p.tap_water} onChange={(v) => set((d) => void (d.policies.tap_water = v))} />
      <Select
        label="Food hygiene rating" value={p.hygiene_rating ?? -1}
        options={[{ value: -1, label: 'Not said' }, ...[5, 4, 3, 2, 1, 0].map((n) => ({ value: n, label: `${n} out of 5` }))]}
        onChange={(v) => set((d) => void (d.policies.hygiene_rating = v < 0 ? null : v))}
      />
      <div className="two">
        <PolicyText a={a} set={set} k="children" label="Children" />
        <PolicyText a={a} set={set} k="accessibility" label="Access" />
        <PolicyText a={a} set={set} k="wifi" label="Wi-Fi" />
        <PolicyText a={a} set={set} k="laptops" label="Laptops" />
        <PolicyText a={a} set={set} k="parking" label="Parking" />
        <PolicyText a={a} set={set} k="reusable_cups" label="Your own cup" />
        <PolicyText a={a} set={set} k="hire" label="Hiring the café" />
        <PolicyText a={a} set={set} k="careers" label="Jobs" />
      </div>
      <Text label="Tips" value={a.money.tips} max={200} onChange={(v) => set((d) => void (d.money.tips = v))} />
    </Policies>
  );
}

export const cafeBuilder: BuilderDef<CafeAnswers, CafeStep> = {
  steps: STEPS,
  render: {
    basics: (p) => (
      <Basics
        {...p}
        copy={{
          name: 'Café name',
          style: 'What you serve',
          stylePlaceholder: 'Coffee, breakfast, light lunches and homemade cakes',
          styleHint: 'How the receptionist describes the café.',
          accentHint: 'Your workspace, floor plan and texts take this colour.',
        }}
      />
    ),
    hours: (p) => (
      <Hours
        {...p}
        options={{
          day: { label: 'Open', open: '08:00', close: '16:00' },
          first: { label: 'Open', open: '08:00', close: '16:00' },
          next: { label: 'Open', open: '16:00', close: '18:00' },
          copy: { from: 1, to: [2, 3, 4, 5], label: 'Copy Monday to Tuesday–Friday' },
        }}
      >
        <Select
          label="Breakfast until" value={p.a.hours.breakfast_until ?? 'all day'}
          options={[{ value: 'all day', label: 'All day' }, ...TIMES.slice(0, 6).map((t) => ({ value: t, label: t }))]}
          onChange={(v) => p.set((d) => void (d.hours.breakfast_until = v === 'all day' ? null : v))}
        />
        <Select
          label="Food stops" value={p.a.hours.kitchen_closes_before}
          options={[0, 15, 30, 45, 60].map((m) => ({ value: m, label: m ? `${m} minutes before closing` : 'At closing' }))}
          onChange={(v) => p.set((d) => void (d.hours.kitchen_closes_before = v))}
          hint="Drinks and cakes until close."
        />
      </Hours>
    ),
    seating: (p) => <StepSeating {...p} />,
    floor: (p) => <StepFloor {...p} />,
    booking: (p) => <StepBooking {...p} />,
    menu: ({ a, set, ws, me }) => (
      <MenuEditor
        menu={sectionOf(a, set, 'menu')} path="menu" sources={a.sources} workspace={ws.id}
        draftsLeft={Math.max(0, me.limits.drafts_per_day - me.used.drafts)} style={a.basics.style}
        takeaway={a.ordering.collection.enabled}
      />
    ),
    ordering: (p) => <StepOrdering {...p} />,
    policies: (p) => <StepPolicies {...p} />,
  },
  wide: { floor: true },
  review: {
    rows: (a) => [
      ['Café', <>{a.basics.name || <em>no name yet</em>}, {a.basics.town}</>],
      ['Tables', `${a.seating.tables.length} tables; bookings for ${a.booking.min_party} or more, smaller walk-in`],
      ['Afternoon tea', a.afternoon_tea.offered ? `${pounds(a.afternoon_tea.adult_pence)} a person, at ${a.afternoon_tea.sittings.join(', ')}` : 'not offered'],
      ['Menu', `${a.menu.categories.reduce((n, c) => n + c.items.length, 0)} items in ${a.menu.categories.length} sections`],
      ['Orders', a.ordering.collection.enabled ? `to collect, ready in about ${a.ordering.collection.prep_minutes} minutes, paid ${{ phone: 'on the phone', collection: 'on collection', either: 'either way' }[a.money.payment]}` : 'not taken'],
      ['Questions', <>{a.policies.faqs.length} of your own, plus the policies</>],
    ],
    start: 'Start builds your receptionist from these answers and fills the week ahead: group tables at lunchtime, busiest at the weekend, afternoon teas most days, and today’s orders to collect.',
    restart: 'Your changes are saved and the receptionist already uses them. To refill the diary to match (new tables, hours or sittings), reset the demo data.',
    ready: (r) => `Ready: ${r.bookings} booking${r.bookings === 1 ? '' : 's'} this week, made from your setup.`,
  },
};
