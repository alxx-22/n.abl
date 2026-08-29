import { useMemo, useState } from 'react'
import { EdgeCard, Reveal } from '../ui/index.jsx'

/* ============================================================
   ESTIMATOR — the pricing method, made operable.

   Pricing.jsx already promises that we work out what a process costs
   now, what it costs afterwards, and price against the difference —
   and that we show our working. This is that promise as a control the
   visitor can actually turn, rather than a paragraph asserting it.

   Every constant here comes from business/README.md §3, including the
   worked example the section already quotes: 12 hours a month at £20
   loaded becomes 2 hours, saving £2,400 a year, priced £800–£1,500.
   That example is the calibration — a fraction of 33% to 62% of
   first-year value — so the ranges below reproduce it rather than
   inventing a new model.

   What it deliberately does NOT do:

     - Ask for "monthly support tickets". That is a helpdesk metric and
       most of our buyers are not helpdesks. Hours a month is a number
       a plant hire firm and a dental practice can both answer.
     - Claim a fixed multiple. "10x efficiency" is a marketing number.
       The recovery rates below are estimates, are labelled as
       estimates, and differ per service because a training day and a
       automation build do not recover the same share of a process.
     - Stop at the saving. Anyone can compute a saving; the useful
       number is what it costs, so this ends on a price.
   ============================================================ */

/* Loaded cost per hour: salary plus employer NI, pension and overhead,
   which is what the hour actually costs the business. £20 is the
   figure business/README.md §3 works its example in. */
const RATE_MIN = 14, RATE_MAX = 45, RATE_DEFAULT = 20

/* Share of the process each kind of work typically removes. These are
   our estimates from how the work usually lands, not measurements, and
   the page says so. Automation matches the documented worked example
   (12 hours to 2); the rest fall away from it for honest reasons —
   an assistant that finds an answer faster still needs a person to
   read it, and training makes people quicker rather than absent. */
const KINDS = [
  { id: 'automation', label: 'A process that repeats between systems', service: 'Automation',   recover: 5 / 6 },
  { id: 'data',       label: 'Building the same report over again',    service: 'Data',         recover: 0.65 },
  { id: 'web',        label: 'Bookings or orders taken by hand',       service: 'Web',          recover: 0.70 },
  { id: 'ai',         label: 'Hunting for an answer in documents',     service: 'AI assistant', recover: 0.45 },
  { id: 'software',   label: 'Checking and correcting other people',   service: 'Software',     recover: 0.55 },
  { id: 'training',   label: 'Work slowed by how people were shown',   service: 'Training',     recover: 0.30 },
]

/* A fraction of first-year value, set so the estimator's OPENING STATE
   reproduces the documented worked example exactly — 12 hours a month at
   £20 becoming 2 hours, £2,400 recovered, priced £800 to £1,500. A
   visitor who has read the section below then turns the sliders and
   finds the same arithmetic, rather than a second, unexplained model. */
const PRICE_LO = 1 / 3, PRICE_HI = 0.625

/* Below this it is an afternoon, not an engagement, and we would say so
   rather than quote for it. */
const FLOOR = 800

const money = (n) => `£${Math.round(n).toLocaleString('en-GB')}`

export default function Estimator() {
  const [kindId, setKindId] = useState('automation')
  const [hours, setHours] = useState(12)
  const [people, setPeople] = useState(1)
  const [rate, setRate] = useState(RATE_DEFAULT)

  const kind = KINDS.find((k) => k.id === kindId)

  const sums = useMemo(() => {
    const nowMonth = hours * people * rate
    const afterMonth = nowMonth * (1 - kind.recover)
    const savedYear = (nowMonth - afterMonth) * 12
    const lo = Math.max(FLOOR, savedYear * PRICE_LO)
    const hi = Math.max(FLOOR * 1.4, savedYear * PRICE_HI)
    /* Months for the build to pay for itself, at the midpoint. */
    const payback = savedYear > 0 ? ((lo + hi) / 2) / (savedYear / 12) : 0
    return { nowMonth, afterMonth, savedYear, lo, hi, payback, tooSmall: savedYear * PRICE_HI < FLOOR }
  }, [hours, people, rate, kind])

  return (
    <div className="est">
      <div className="est__controls">
        <div className="est__field">
          <label className="est__label" htmlFor="est-kind">What the job is</label>
          <select id="est-kind" className="est__select" value={kindId}
            onChange={(e) => setKindId(e.target.value)}>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </div>

        <Slider id="est-hours" label="Hours a month it takes" value={hours} min={1} max={80}
          onChange={setHours} format={(v) => `${v} ${v === 1 ? 'hour' : 'hours'}`} />

        <Slider id="est-people" label="People it involves" value={people} min={1} max={12}
          onChange={setPeople} format={(v) => `${v} ${v === 1 ? 'person' : 'people'}`} />

        <Slider id="est-rate" label="What an hour of their time costs you" value={rate}
          min={RATE_MIN} max={RATE_MAX} onChange={setRate} format={(v) => `£${v}/hour`}
          help="Salary plus NI, pension and overhead — not the hourly wage." />
      </div>

      <div className="est__out">
        <Row k="Costs you now" v={`${money(sums.nowMonth)} a month`} />
        <Row k={`After the ${kind.service.toLowerCase()} work`} v={`${money(sums.afterMonth)} a month`} />
        <Row k="Recovered in a year" v={money(sums.savedYear)} strong />

        <div className="est__price">
          {sums.tooSmall ? (
            <>
              <span className="est__priceK">Probably not worth a project</span>
              <p className="est__note">
                At this size we would tell you so, and point you at the setting in
                the software you already have.
              </p>
            </>
          ) : (
            <>
              <span className="est__priceK">Indicative price</span>
              <span className="est__priceV">{money(sums.lo)} &ndash; {money(sums.hi)}</span>
              <p className="est__note">
                Pays for itself in about {Math.max(1, Math.round(sums.payback))}
                {Math.round(sums.payback) === 1 ? ' month' : ' months'}, then keeps
                going. It lands near there whatever you put in, which is what pricing
                on a share of the value means.
              </p>
            </>
          )}
        </div>
      </div>

      <p className="est__caveat">
        An estimate, not a quote. The share of the work each kind of project removes is
        our own figure from how these usually land, not a measurement of your process —
        we would check it against your actual numbers before quoting, and say so if it
        came out lower.
      </p>
    </div>
  )
}

function Slider({ id, label, value, min, max, onChange, format, help }) {
  return (
    <div className="est__field">
      <label className="est__label" htmlFor={id}>
        {label}<span className="est__value">{format(value)}</span>
      </label>
      <input id={id} className="est__range" type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={help ? `${id}-help` : undefined} />
      {help && <span id={`${id}-help`} className="est__help">{help}</span>}
    </div>
  )
}

const Row = ({ k, v, strong }) => (
  <div className={`est__row${strong ? ' est__row--strong' : ''}`}>
    <span className="est__rowK">{k}</span>
    <span className="est__rowV">{v}</span>
  </div>
)

export { Estimator }
