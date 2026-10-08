// The takeaway's builder (presets/takeaway.md §3): its seven steps with the
// server's own titles (src/presets/takeaway/steps.ts), the shared food steps
// for collection and delivery, the menu and paying, its own meal deals and
// kitchen, and what Review says about it. The preview pane lists the
// server's lines.

import { STEPS, type TakeawayStep } from '../../../../../src/presets/takeaway/steps.ts';
import type { TakeawayAnswers } from '../../../../../src/presets/takeaway/answers.ts';
import { Basics } from '../common/Basics.tsx';
import { Hours } from '../common/Hours.tsx';
import { PolicyText, Policies } from '../common/Policies.tsx';
import { DealsEditor } from '../food/Deals.tsx';
import { MenuEditor } from '../food/MenuEditor.tsx';
import { CollectionDelivery } from '../food/Ordering.tsx';
import { TakeawayPayment } from '../food/Payment.tsx';
import { Choice, ListText, Num, Pounds, Select, Toggle } from '../fields.tsx';
import type { BuilderDef, StepProps } from '../registry.ts';
import { sectionOf } from '../section.ts';

type Props = StepProps<TakeawayAnswers>;
const pounds = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

function StepOrdering({ a, set }: Props) {
  const k = a.kitchen;
  return (
    <>
      <CollectionDelivery ordering={sectionOf(a, set, 'ordering')} path="ordering" sources={a.sources} />
      <h3 className="sub">The kitchen</h3>
      <p className="hint">Collection and delivery share the kitchen: “Orders per slot” counts both, so on a busy night the receptionist gives the honest wait.</p>
      <div className="two">
        <Select
          label="Last orders" value={k.last_orders_minutes}
          options={[0, 10, 15, 20, 30, 45].map((m) => ({ value: m, label: m ? `${m} minutes before closing` : 'Right up to closing' }))}
          onChange={(v) => set((d) => void (d.kitchen.last_orders_minutes = v))}
          hint="Every order is handed over by closing, so the last delivery is earlier still."
        />
        <Num label="A big order" suffix="mains or more" min={2} max={30} value={k.big_order_mains} onChange={(v) => set((d) => void (d.kitchen.big_order_mains = v))} hint="Takes two of the kitchen's slots." />
      </div>
      <h3 className="sub">After the order</h3>
      <p className="hint">The receptionist never cancels, changes or refunds: a cancellation or change waits on the ticket for you to accept, and a complaint is a message for the manager.</p>
      <div className="two">
        <Select
          label="Late after" value={a.after.late_after_minutes}
          options={[10, 15, 20, 30, 45].map((m) => ({ value: m, label: `${m} minutes past the time given` }))}
          onChange={(v) => set((d) => void (d.after.late_after_minutes = v))}
          hint="Before then, a caller hears where their order is; after, the manager calls them back."
        />
        {a.ordering.delivery.enabled ? (
          <Choice
            legend="Something missing from a delivery" value={a.after.missing_items}
            options={[
              { value: 'manager', label: 'The manager calls back' },
              { value: 'send_out', label: 'Send it out', hint: 'with the next driver, once you accept' },
            ]}
            onChange={(v) => set((d) => void (d.after.missing_items = v))}
          />
        ) : null}
      </div>
    </>
  );
}

function StepMoney({ a, set }: Props) {
  const m = a.money;
  return (
    <>
      <TakeawayPayment legend="Paying for an order" value={m.payment} onChange={(v) => set((d) => void (d.money.payment = v))} />
      {a.ordering.delivery.enabled && m.payment !== 'phone' ? (
        <Choice
          legend="Your drivers take" value={m.pay_driver}
          options={[
            { value: 'cash_or_card', label: 'Cash or card', hint: 'the driver has a card machine' },
            { value: 'cash', label: 'Cash only', hint: 'the receptionist asks if they need change' },
            { value: 'no', label: 'Nothing', hint: 'deliveries are paid on the phone' },
          ]}
          onChange={(v) => set((d) => void (d.money.pay_driver = v))}
        />
      ) : null}
      <div className="two">
        <Toggle label="A minimum spend on card" checked={m.card_minimum_pence !== null} onChange={(v) => set((d) => void (d.money.card_minimum_pence = v ? 500 : null))} hint="Never a charge for card: a shop may not add one." />
        {m.card_minimum_pence !== null ? <Pounds label="Minimum on card" pence={m.card_minimum_pence} max={2000} onChange={(v) => set((d) => void (d.money.card_minimum_pence = v))} /> : null}
      </div>
      {a.ordering.delivery.enabled && m.payment !== 'phone' && m.pay_driver !== 'no' ? (
        <ListText
          label="Pay on the phone only" value={a.after.pay_on_phone_numbers} placeholder="07700 900804"
          onChange={(v) => set((d) => void (d.after.pay_on_phone_numbers = v))}
          hint="Numbers that refused a delivery: they pay by card on the phone, or collect. The receptionist never says why."
        />
      ) : null}
    </>
  );
}

function StepPolicies(props: Props) {
  const { a, set } = props;
  const p = a.policies;
  return (
    <Policies {...props}>
      <Choice
        legend="Halal" value={p.halal}
        options={[
          { value: 'all', label: 'All our meat' },
          { value: 'chicken', label: 'Our chicken only' },
          { value: 'none', label: 'None of it' },
        ]}
        onChange={(v) => set((d) => void (d.policies.halal = v))}
      />
      <div className="two">
        <Select
          label="Food hygiene rating" value={p.hygiene_rating ?? -1}
          options={[{ value: -1, label: 'Not given' }, ...[5, 4, 3, 2, 1, 0].map((n) => ({ value: n, label: String(n) }))]}
          onChange={(v) => set((d) => void (d.policies.hygiene_rating = v < 0 ? null : v))}
          hint="Callers can check it on the Food Standards Agency's website."
        />
        <PolicyText a={a} set={set} k="parking" label="Parking when collecting" />
        <PolicyText a={a} set={set} k="offers" label="Offers" hint="Said as written. In the demo an offer never changes a total." />
        <PolicyText a={a} set={set} k="bags" label="Bags" />
        <PolicyText a={a} set={set} k="careers" label="Jobs with you" />
        <PolicyText a={a} set={set} k="tips" label="Tips for drivers" />
      </div>
    </Policies>
  );
}

export const takeawayBuilder: BuilderDef<TakeawayAnswers, TakeawayStep> = {
  steps: STEPS,
  render: {
    basics: (p) => (
      <Basics
        {...p}
        copy={{
          name: 'Takeaway name',
          style: 'What you serve',
          stylePlaceholder: 'Fried chicken, burgers and pizza',
          styleHint: 'Shapes the menu draft and how the receptionist describes you.',
          accentHint: 'Your workspace, kitchen board and texts take this colour.',
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
      />
    ),
    ordering: (p) => <StepOrdering {...p} />,
    menu: ({ a, set, ws, me }) => (
      <MenuEditor
        menu={sectionOf(a, set, 'menu')} path="menu" sources={a.sources} workspace={ws.id}
        draftsLeft={Math.max(0, me.limits.drafts_per_day - me.used.drafts)} style={a.basics.style} takeaway
      />
    ),
    deals: ({ a, set }) => <DealsEditor deals={sectionOf(a, set, 'deals')} menu={a.menu} />,
    money: (p) => <StepMoney {...p} />,
    policies: (p) => <StepPolicies {...p} />,
  },
  review: {
    rows: (a) => {
      const dl = a.ordering.delivery;
      return [
        ['Takeaway', <>{a.basics.name || <em>no name yet</em>}, {a.basics.town}</>],
        ['Orders', [a.ordering.collection.enabled && 'collection', dl.enabled && `delivery to ${dl.districts.length} districts`].filter(Boolean).join(' and ') || 'none yet'],
        ...(dl.enabled ? [['Delivery', `${pounds(dl.fee_pence)}, minimum ${pounds(dl.min_order_pence)}${dl.free_over_pence ? `, free over ${pounds(dl.free_over_pence)}` : ''}${dl.zones.length ? `; ${dl.zones.length} further out at their own price` : ''}`] as [string, string]] : []),
        ['Kitchen', `${a.ordering.collection.per_slot || 'no limit on'} orders every ${a.ordering.collection.slot_minutes} minutes; last orders ${a.kitchen.last_orders_minutes} minutes before closing`],
        ['Menu', `${a.menu.categories.reduce((n, c) => n + c.items.length, 0)} items in ${a.menu.categories.length} sections${a.menu.allergens_are_examples ? ', allergens still to check' : ''}`],
        ['Meal deals', a.deals.map((d) => d.name).join(', ') || 'none'],
        ['Drivers', dl.enabled ? dl.drivers.join(', ') || 'none yet' : 'no delivery'],
        ['Questions', <>{a.policies.faqs.length} of your own, plus the policies</>],
      ];
    },
    start: 'Start builds your receptionist from these answers and fills today’s orders so far, busy like a Friday night: deliveries out with your drivers and the kitchen full for the next forty minutes.',
    restart: 'Your changes are saved and the receptionist already uses them. To refill the kitchen to match (a new menu, deals or hours), reset the demo data.',
    ready: (r) => `Ready: ${r.orders} order${r.orders === 1 ? '' : 's'} today so far, made from your setup.`,
  },
};

