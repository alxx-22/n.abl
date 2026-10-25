// The barber's builder (presets/barber.md §3): its seven steps with the
// server's own titles (src/presets/barber/steps.ts), the barbers and the
// price list as cards, the booking and deposit rules, and what Review says.
// The preview pane lists the server's lines.

import { STEPS, type BarberStep } from '../../../../../src/presets/barber/steps.ts';
import type { BarberAnswers } from '../../../../../src/presets/barber/answers.ts';
import { Basics } from '../common/Basics.tsx';
import { Hours } from '../common/Hours.tsx';
import { PolicyText, Policies } from '../common/Policies.tsx';
import { DayChips } from '../estate/steps.tsx';
import { Choice, ListText, Num, Pounds, Select, Text, Toggle } from '../fields.tsx';
import type { BuilderDef, StepProps } from '../registry.ts';

type Props = StepProps<BarberAnswers>;
const pounds = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_TEAM = 12;
const MAX_SERVICES = 30;

function StepTeam({ a, set }: Props) {
  const add = () => set((d) => void d.team.push({ key: `barber_${Date.now().toString(36)}`, name: '', aliases: [], days: [2, 3, 4, 5, 6], hours: [], services: d.services.map((s) => s.key), notes: '' }));
  return (
    <div className="fields">
      <p className="lead">Who cuts here, on which days, and what each does. Callers can ask for anyone by name; "any barber" gets the first free chair.</p>
      {a.team.map((t, i) => (
        <div className="group on area-card" key={t.key}>
          <div className="area-head">
            <input aria-label="Name" className="area-name" placeholder="First name" value={t.name} maxLength={30} onChange={(e) => set((d) => void (d.team[i].name = e.target.value))} />
            <button type="button" className="ghost small" onClick={() => set((d) => void d.team.splice(i, 1))}>Remove</button>
          </div>
          <ListText label="Also known as" value={t.aliases} placeholder="Optional" onChange={(v) => set((d) => void (d.team[i].aliases = v))} hint="Nicknames callers use." />
          <fieldset className="chips">
            <legend>What they do</legend>
            {a.services.filter((s) => s.name).map((s) => (
              <label key={s.key} className={t.services.includes(s.key) ? 'on' : ''}>
                <input type="checkbox" checked={t.services.includes(s.key)} onChange={(e) => set((d) => {
                  const b = d.team[i];
                  b.services = e.target.checked ? [...b.services, s.key] : b.services.filter((x) => x !== s.key);
                })} />
                {s.name}
              </label>
            ))}
          </fieldset>
          <DayChips legend="Working days" days={t.days} onChange={(v) => set((d) => {
            d.team[i].days = v;
            d.team[i].hours = d.team[i].hours.filter((h) => v.includes(h.day));
          })} />
          <Toggle
            label="Different hours on some days" checked={t.hours.length > 0}
            onChange={(on) => set((d) => void (d.team[i].hours = on ? d.team[i].days.slice(0, 1).map((day) => ({ day, open: '09:00', close: '17:00' })) : []))}
            hint="A later start or an early finish: they're only booked inside these."
          />
          {t.hours.map((h, j) => (
            <div className="three" key={j}>
              <Select label="Day" value={h.day} options={t.days.map((day) => ({ value: day, label: DAYS[day] }))} onChange={(v) => set((d) => void (d.team[i].hours[j].day = v))} />
              <Text label="Starts" value={h.open} max={5} onChange={(v) => set((d) => void (d.team[i].hours[j].open = v))} />
              <Text label="Finishes" value={h.close} max={5} onChange={(v) => set((d) => void (d.team[i].hours[j].close = v))} />
            </div>
          ))}
          {t.hours.length ? (
            <div className="row-tools">
              <button type="button" className="small" onClick={() => set((d) => void d.team[i].hours.push({ day: d.team[i].days[0] ?? 2, open: '09:00', close: '17:00' }))}>+ Another day</button>
            </div>
          ) : null}
          <Text label="What callers may hear about them" value={t.notes} max={160} placeholder="Skin fades, Afro and textured hair" onChange={(v) => set((d) => void (d.team[i].notes = v))} />
        </div>
      ))}
      <div className="row-tools">
        <button type="button" className="small" disabled={a.team.length >= MAX_TEAM} onClick={add}>+ Add a barber</button>
        <span className="hint">Up to {MAX_TEAM}.</span>
      </div>
    </div>
  );
}

function StepServices({ a, set }: Props) {
  const add = () => set((d) => void d.services.push({ key: `service_${Date.now().toString(36)}`, name: '', minutes: 30, price_pence: 0, from: false, description: '', colour: false }));
  return (
    <div className="fields">
      <p className="lead">Your price list. The receptionist books each for its time, and says its price and nothing else.</p>
      {a.services.map((s, i) => (
        <div className="group on area-card" key={s.key}>
          <div className="area-head">
            <input aria-label="Service" className="area-name" placeholder="Skin fade" value={s.name} maxLength={60} onChange={(e) => set((d) => void (d.services[i].name = e.target.value))} />
            <button type="button" className="ghost small" onClick={() => set((d) => {
              d.services.splice(i, 1);
              for (const b of d.team) b.services = b.services.filter((k) => k !== s.key);
            })}>Remove</button>
          </div>
          <div className="two">
            <Num label="Takes" suffix="minutes" min={5} max={240} step={5} value={s.minutes} onChange={(v) => set((d) => void (d.services[i].minutes = v))} />
            <Pounds label="Price" pence={s.price_pence} max={50000} onChange={(v) => set((d) => void (d.services[i].price_pence = v))} />
          </div>
          <div className="two">
            <Toggle label='Said as "from"' checked={s.from} onChange={(v) => set((d) => void (d.services[i].from = v))} hint="The price can be more." />
            <Toggle label="Colour" checked={s.colour} onChange={(v) => set((d) => void (d.services[i].colour = v))} hint="Needs a skin test 48 hours before." />
          </div>
          <Text label="What it is" value={s.description} max={200} onChange={(v) => set((d) => void (d.services[i].description = v))} />
        </div>
      ))}
      <div className="row-tools">
        <button type="button" className="small" disabled={a.services.length >= MAX_SERVICES} onClick={add}>+ Add a service</button>
      </div>
    </div>
  );
}

function StepBooking({ a, set }: Props) {
  const b = a.booking;
  return (
    <div className="fields">
      <Toggle label="Walk-ins welcome" checked={b.walk_ins} onChange={(v) => set((d) => void (d.booking.walk_ins = v))} hint="When a chair is free; a booking always comes first." />
      <div className="two">
        <Select label="Times on the" value={b.slot_minutes} options={[10, 15, 20, 30].map((m) => ({ value: m, label: `${m}-minute mark` }))} onChange={(v) => set((d) => void (d.booking.slot_minutes = v))} />
        <Select label="Soonest by phone" value={b.lead_minutes} options={[0, 15, 30, 60, 120].map((m) => ({ value: m, label: m ? `${m} minutes from now` : 'Straight away' }))} onChange={(v) => set((d) => void (d.booking.lead_minutes = v))} />
        <Num label="Book up to" suffix="days ahead" min={1} max={90} value={b.horizon_days} onChange={(v) => set((d) => void (d.booking.horizon_days = v))} />
        <Num label="Running late" suffix="minutes is fine" min={0} max={30} value={b.late_grace_minutes} onChange={(v) => set((d) => void (d.booking.late_grace_minutes = v))} />
        <Num label="A group of more than" suffix="people" min={1} max={12} value={b.group_max} onChange={(v) => set((d) => void (d.booking.group_max = v))} hint="Is a message for you to arrange." />
        <Select
          label="Kids' price" value={b.kids_under ?? 0}
          options={[{ value: 0, label: 'No kids’ price' }, ...[10, 12, 14, 16].map((n) => ({ value: n, label: `Under ${n}` }))]}
          onChange={(v) => set((d) => void (d.booking.kids_under = v || null))}
        />
      </div>
      <Toggle label="Under-16s come with an adult" checked={b.under_16_with_adult} onChange={(v) => set((d) => void (d.booking.under_16_with_adult = v))} hint="Your policy: there's no legal age for a haircut." />
    </div>
  );
}

function StepMoney({ a, set }: Props) {
  const m = a.money;
  return (
    <div className="fields">
      <div className="two">
        <Toggle label="Take a deposit when booking" checked={m.deposit_pence !== null} onChange={(v) => set((d) => void (d.money.deposit_pence = v ? 500 : null))} hint="It comes off the price." />
        {m.deposit_pence !== null ? <Pounds label="Deposit" pence={m.deposit_pence} max={5000} onChange={(v) => set((d) => void (d.money.deposit_pence = v))} /> : null}
      </div>
      {m.deposit_pence !== null ? (
        <Toggle label="A booking needs the deposit" checked={m.deposit_required} onChange={(v) => set((d) => void (d.money.deposit_required = v))} hint="Off: a caller who'd rather pay in the shop keeps the booking." />
      ) : null}
      <Select
        label="Free to cancel or move with" value={m.notice_hours}
        options={[0, 12, 24, 48].map((h) => ({ value: h, label: h ? `${h} hours' notice` : 'Any notice' }))}
        onChange={(v) => set((d) => void (d.money.notice_hours = v))}
        hint="Later than that, the deposit is kept, and never more. The receptionist says your policy, never “by law”."
      />
      <Choice
        legend="Paying" value={m.payment}
        options={[
          { value: 'either', label: 'In the shop, or by card when booking' },
          { value: 'shop', label: 'In the shop' },
          { value: 'phone', label: 'By card when booking' },
        ]}
        onChange={(v) => set((d) => void (d.money.payment = v))}
      />
    </div>
  );
}

function StepPolicies(props: Props) {
  const { a, set } = props;
  const p = a.policies;
  return (
    <Policies {...props}>
      <Choice
        legend="The skin test before colour" value={p.skin_test}
        options={[
          { value: 'every_time', label: 'Before every colour', hint: "as the dye's instructions say" },
          { value: 'six_months', label: 'Every six months', hint: 'only with your insurer’s agreement' },
        ]}
        onChange={(v) => set((d) => void (d.policies.skin_test = v))}
      />
      <Select
        label="Not happy with a cut" value={p.fix_days ?? 0}
        options={[{ value: 0, label: 'A message for me' }, ...[3, 7, 14].map((n) => ({ value: n, label: `A free fix within ${n} days` }))]}
        onChange={(v) => set((d) => void (d.policies.fix_days = v || null))}
      />
      <div className="two">
        <PolicyText a={a} set={set} k="access" label="Access and quiet times" />
        <PolicyText a={a} set={set} k="parking" label="Parking" />
        <PolicyText a={a} set={set} k="products" label="Products for sale" />
        <PolicyText a={a} set={set} k="tips" label="Tips" />
        <PolicyText a={a} set={set} k="careers" label="Jobs and apprentices" />
        <PolicyText a={a} set={set} k="home_visits" label="Home visits" />
      </div>
    </Policies>
  );
}

export const barberBuilder: BuilderDef<BarberAnswers, BarberStep> = {
  steps: STEPS,
  render: {
    basics: (p) => (
      <Basics
        {...p}
        copy={{
          name: 'Shop name',
          style: 'What you do',
          stylePlaceholder: 'Fades, classic cuts, beards and hot towel shaves',
          styleHint: 'How the receptionist describes the shop.',
          accentHint: 'Your workspace and texts take this colour.',
        }}
      />
    ),
    hours: (p) => (
      <Hours
        {...p}
        options={{
          day: { label: 'Open', open: '09:00', close: '18:00' },
          first: { label: 'Open', open: '09:00', close: '18:00' },
          next: { label: 'Open', open: '18:00', close: '20:00' },
          copy: { from: 2, to: [3, 4, 5], label: 'Copy Tuesday to Wednesday–Friday' },
        }}
      />
    ),
    team: (p) => <StepTeam {...p} />,
    services: (p) => <StepServices {...p} />,
    booking: (p) => <StepBooking {...p} />,
    money: (p) => <StepMoney {...p} />,
    policies: (p) => <StepPolicies {...p} />,
  },
  review: {
    rows: (a) => [
      ['Shop', <>{a.basics.name || <em>no name yet</em>}, {a.basics.town}</>],
      ['Barbers', a.team.map((t) => t.name).filter(Boolean).join(', ') || 'none yet'],
      ['Services', `${a.services.filter((s) => s.name).length} on the price list`],
      ['Walk-ins', a.booking.walk_ins ? 'welcome when a chair is free' : 'appointments only'],
      ['Deposit', a.money.deposit_pence ? `${pounds(a.money.deposit_pence)}, free to cancel with ${a.money.notice_hours} hours' notice` : 'none'],
      ['Questions', <>{a.policies.faqs.length} of your own, plus the policies</>],
    ],
    start: 'Start builds your receptionist from these answers and fills the week ahead: each barber booked on their days, Saturday busiest, and a couple of regulars to ring as.',
    restart: 'Your changes are saved and the receptionist already uses them. To refill the diary to match (new barbers, services or hours), reset the demo data.',
    ready: (r) => `Ready: ${r.bookings} booking${r.bookings === 1 ? '' : 's'} this week, made from your setup.`,
  },
};
