// The restaurant's builder: its eight steps with the server's own titles
// (src/presets/restaurant/steps.ts), the preview pane's seats and menu, and
// what Review says about it. The summary keeps today's markup, text node for
// text node, so it renders exactly as it did.

import type { ReactNode } from 'react';
import { STEPS, type RestaurantStep } from '../../../../../src/presets/restaurant/steps.ts';
import type { RestaurantAnswers, RestaurantPreview } from '../../types.ts';
import { Basics } from '../common/Basics.tsx';
import { Hours } from '../common/Hours.tsx';
import { MenuEditor } from '../food/MenuEditor.tsx';
import { Select } from '../fields.tsx';
import type { BuilderDef } from '../registry.ts';
import { sectionOf } from '../section.ts';
import { StepFloor } from './StepFloor.tsx';
import { StepMoney, StepPolicies, StepSeating, StepServe } from './steps.tsx';

const takesBookings = (a: RestaurantAnswers) => a.serve.reservations;

export const restaurantBuilder: BuilderDef<RestaurantAnswers, RestaurantStep> = {
  steps: STEPS,
  render: {
    basics: (p) => (
      <Basics
        {...p}
        copy={{
          name: 'Restaurant name',
          style: 'Style or cuisine',
          stylePlaceholder: 'Neapolitan pizza and fresh pasta',
          styleHint: 'Shapes the menu draft and how the receptionist describes you.',
          accentHint: 'Your workspace, floor plan and texts take this colour.',
        }}
      />
    ),
    hours: (p) => (
      <Hours
        {...p}
        options={{
          day: { label: 'Dinner', open: '17:30', close: '22:00' },
          first: { label: 'Lunch', open: '12:00', close: '14:30' },
          next: { label: 'Dinner', open: '17:30', close: '22:00' },
          copy: { from: 2, to: [3, 4, 5, 6], label: 'Copy Tuesday to Wednesday–Saturday' },
        }}
      >
        <Select
          label="Last booking" value={p.a.hours.last_booking_before_close}
          options={[0, 30, 45, 60, 75, 90, 120].map((m) => ({ value: m, label: m ? `${m} minutes before close` : 'Right up to close' }))}
          onChange={(v) => p.set((d) => void (d.hours.last_booking_before_close = v))}
          hint="The latest start time the receptionist offers in each service."
        />
      </Hours>
    ),
    serve: (p) => <StepServe {...p} />,
    seating: (p) => <StepSeating {...p} />,
    floor: (p) => <StepFloor {...p} />,
    menu: ({ a, set, ws, me }) => (
      <MenuEditor
        menu={sectionOf(a, set, 'menu')} path="menu" sources={a.sources} workspace={ws.id}
        draftsLeft={Math.max(0, me.limits.drafts_per_day - me.used.drafts)} style={a.basics.style}
        takeaway={a.serve.collection.enabled || a.serve.delivery.enabled}
      />
    ),
    money: (p) => <StepMoney {...p} />,
    policies: (p) => <StepPolicies {...p} />,
  },
  show: { seating: takesBookings, floor: takesBookings },
  wide: { floor: true },
  preview(a, ws) {
    const p = ws.preview as unknown as RestaurantPreview;
    return (
      <>
        <p className="say">“{p.greeting}”</p>
        {p.hours ? <p className="small"><b>Hours.</b> {p.hours}</p> : null}
        {a.serve.reservations && p.covers.length ? (
          <p className="small">
            <b>Seats.</b> {p.covers.map((c) => `${c.label} ${c.covers}`).join(' · ')} · {p.bookable_tables} bookable tables
            {p.pairs.length ? ` · ${p.pairs.length} pairs push together` : ''}
          </p>
        ) : null}
        <p className="small"><b>Menu.</b> {p.dishes} dishes{a.menu.allergens_are_examples ? ', allergens still to check' : ''}.</p>
        <p className="small muted">What it tells callers first:</p>
        <ul className="facts">
          {p.core_facts.map((f, n) => <li key={n}>{f}</li>)}
        </ul>
      </>
    );
  },
  review: {
    rows: (a, ws) => {
      const tables = a.seating.tables;
      const dep = a.money.deposit;
      return [
        ['Restaurant', <>{a.basics.name || <em>no name yet</em>}, {a.basics.town}</>],
        ['Hours', ws.preview?.hours],
        ['Serving', [a.serve.reservations && 'table bookings', a.serve.walk_ins && 'walk-ins', a.serve.collection.enabled && 'click and collect', a.serve.delivery.enabled && 'delivery'].filter(Boolean).join(', ') || 'questions only'],
        ...(a.serve.reservations ? [['Seating', <>{a.seating.areas.map((x) => x.label).join(', ')}: {tables.length} tables, {tables.reduce((n, t) => n + t.seats, 0)} covers</>] as [string, ReactNode]] : []),
        ['Menu', <>{(ws.preview as unknown as RestaurantPreview | null)?.dishes ?? 0} dishes in {a.menu.categories.length} sections</>],
        ['Deposits', dep.mode === 'none' ? 'none' : `£${(dep.amount_pence / 100).toFixed(2)} ${dep.mode === 'per_person' ? 'a head' : 'a booking'} for ${dep.min_party}+`],
        ['Questions', <>{a.policies.faqs.length} of your own, plus the policies</>],
      ];
    },
    start: 'Start builds your receptionist from these answers and fills a week of bookings and today’s orders, shaped by your own tables, hours and menu.',
    restart: 'Your changes are saved and the receptionist already uses them. To refill the diary to match (new tables, hours or menu), reset the demo data.',
    ready: (r) => `Ready: ${r.bookings} bookings this week and ${r.orders} orders today, made from your setup.`,
  },
};
