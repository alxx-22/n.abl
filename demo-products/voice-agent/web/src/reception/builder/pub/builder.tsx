// The pub's builder (presets/pub.md §3): its steps with the server's own
// titles (src/presets/pub/steps.ts). Seating and the floor plan are the
// restaurant's; the menu is the shared editor; the food times, bookings and
// children, and the policies are the pub's own. The preview pane lists the
// server's lines.

import { STEPS, type PubStep } from '../../../../../src/presets/pub/steps.ts';
import type { PubAnswers } from '../../types.ts';
import { Basics } from '../common/Basics.tsx';
import { Hours } from '../common/Hours.tsx';
import { PolicyText, Policies } from '../common/Policies.tsx';
import { MenuEditor } from '../food/MenuEditor.tsx';
import { ListText, Num, Select, Text, Toggle } from '../fields.tsx';
import type { BuilderDef, StepProps } from '../registry.ts';
import { StepFloor } from '../restaurant/StepFloor.tsx';
import { StepSeating } from '../restaurant/steps.tsx';
import { sectionOf } from '../section.ts';

type Props = StepProps<PubAnswers>;
const halfHours = (from: number, to: number) => Array.from({ length: (to - from) * 2 + 1 }, (_, i) => `${String(from + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

function StepBooking({ a, set }: Props) {
  return (
    <div className="fields">
      <p className="lead">Tables are booked for food, in the bar and the dining room. The garden is first come.</p>
      <Select
        label="Children welcome until" value={a.children.until ?? 'any'}
        options={[{ value: 'any', label: 'Any time' }, ...halfHours(18, 22).map((t) => ({ value: t, label: t }))]}
        onChange={(v) => set((d) => void (d.children.until = v === 'any' ? null : v))}
        hint="With an adult. A table with children finishes by then; after, it's adults only. Said as your policy, never as the law."
      />
      <Num
        label="Hold a table for someone running late" value={a.booking.late_grace_minutes} min={0} max={60} suffix="minutes"
        onChange={(v) => set((d) => void (d.booking.late_grace_minutes = v))}
      />
      <p className="hint">Dogs are welcome everywhere; a dog on a booking is noted for the team. Assistance dogs are always welcome.</p>
    </div>
  );
}

function StepPolicies(props: Props) {
  const { a, set } = props;
  const p = a.policies;
  return (
    <Policies {...props}>
      <Toggle label="Cash as well as card" checked={a.money.cash} onChange={(v) => set((d) => void (d.money.cash = v))} hint="There's never an extra charge for card." />
      <Toggle label="Baby changing" checked={p.baby_changing} onChange={(v) => set((d) => void (d.policies.baby_changing = v))} />
      <Select
        label="Food hygiene rating" value={p.hygiene_rating ?? -1}
        options={[{ value: -1, label: 'Not said' }, ...[5, 4, 3, 2, 1, 0].map((n) => ({ value: n, label: `${n} out of 5` }))]}
        onChange={(v) => set((d) => void (d.policies.hygiene_rating = v < 0 ? null : v))}
      />
      <div className="two">
        <PolicyText a={a} set={set} k="children" label="Children" />
        <PolicyText a={a} set={set} k="id" label="ID" hint="Challenge 25 and what you accept. It's always the staff's call on the night." />
        <PolicyText a={a} set={set} k="accessibility" label="Access" />
        <PolicyText a={a} set={set} k="parking" label="Parking" />
        <PolicyText a={a} set={set} k="smoking" label="Smoking" />
        <PolicyText a={a} set={set} k="vaping" label="Vaping" />
        <PolicyText a={a} set={set} k="own_cake" label="A cake of their own" />
        <PolicyText a={a} set={set} k="own_drink" label="Drinks of their own" />
        <PolicyText a={a} set={set} k="taxi" label="A taxi firm" />
        <PolicyText a={a} set={set} k="hire" label="Hiring the room upstairs" />
        <PolicyText a={a} set={set} k="christmas" label="Christmas" />
        <PolicyText a={a} set={set} k="careers" label="Jobs" />
      </div>
      <Text label="Tips" value={a.money.tips} max={200} onChange={(v) => set((d) => void (d.money.tips = v))} />
    </Policies>
  );
}

export const pubBuilder: BuilderDef<PubAnswers, PubStep> = {
  steps: STEPS,
  render: {
    basics: (p) => (
      <Basics
        {...p}
        copy={{
          name: 'Pub name',
          style: 'What you serve',
          stylePlaceholder: 'Cask ales, pub classics and Sunday roasts',
          styleHint: 'How the receptionist describes the pub.',
          accentHint: 'Your workspace, floor plan and texts take this colour.',
        }}
      />
    ),
    hours: (p) => (
      <Hours
        {...p}
        options={{
          day: { label: 'Open', open: '12:00', close: '23:00' },
          first: { label: 'Open', open: '12:00', close: '23:00' },
          next: { label: 'Open', open: '17:00', close: '23:00' },
          copy: { from: 1, to: [2, 3, 4], label: 'Copy Monday to Tuesday–Thursday' },
        }}
      >
        <div className="three">
          <Select label="Food from" value={p.a.hours.food.from} options={halfHours(11, 14).map((t) => ({ value: t, label: t }))} onChange={(v) => p.set((d) => void (d.hours.food.from = v))} />
          <Select label="Food until" value={p.a.hours.food.until} options={halfHours(18, 22).map((t) => ({ value: t, label: t }))} onChange={(v) => p.set((d) => void (d.hours.food.until = v))} hint="Tables are booked to eat, until half an hour before." />
          <Select
            label="On Sundays until" value={p.a.hours.food.sunday_until ?? 'same'}
            options={[{ value: 'same', label: 'The same' }, ...halfHours(15, 21).map((t) => ({ value: t, label: t }))]}
            onChange={(v) => p.set((d) => void (d.hours.food.sunday_until = v === 'same' ? null : v))}
          />
        </div>
      </Hours>
    ),
    seating: (p) => <StepSeating {...p} />,
    floor: (p) => <StepFloor {...p} />,
    booking: (p) => <StepBooking {...p} />,
    menu: ({ a, set, ws, me }) => (
      <>
        <MenuEditor
          menu={sectionOf(a, set, 'menu')} path="menu" sources={a.sources} workspace={ws.id}
          draftsLeft={Math.max(0, me.limits.drafts_per_day - me.used.drafts)} style={a.basics.style}
          takeaway={false}
        />
        <ListText
          label="Ales on tap" value={a.drinks.on_tap} placeholder="Lace Market Bitter, Trent Pale"
          onChange={(v) => set((d) => void (d.drinks.on_tap = v.slice(0, 12)))}
          hint="The usual list. Mark a drink gluten-free on the menu only if it's labelled so."
        />
      </>
    ),
    policies: (p) => <StepPolicies {...p} />,
  },
  wide: { floor: true },
  review: {
    rows: (a) => [
      ['Pub', <>{a.basics.name || <em>no name yet</em>}, {a.basics.town}</>],
      ['Tables', `${a.seating.tables.length} tables in ${a.seating.areas.length} rooms; booked for food`],
      ['Food', `${a.hours.food.from} to ${a.hours.food.until}${a.hours.food.sunday_until ? `, Sundays to ${a.hours.food.sunday_until}` : ''}`],
      ['Children', a.children.until ? `welcome until ${a.children.until}` : 'welcome any time'],
      ['Menu', `${a.menu.categories.reduce((n, c) => n + c.items.length, 0)} items in ${a.menu.categories.length} sections`],
      ['Questions', <>{a.policies.faqs.length} of your own, plus the policies</>],
    ],
    start: 'Start builds your receptionist from these answers and fills the week ahead: dinners busiest on Friday and Saturday, Sunday lunch the busiest of all, and a party on Saturday.',
    restart: 'Your changes are saved and the receptionist already uses them. To refill the diary to match (new tables or hours), reset the demo data.',
    ready: (r) => `Ready: ${r.bookings} booking${r.bookings === 1 ? '' : 's'} this week, made from your setup.`,
  },
};
