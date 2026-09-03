import { useMemo, useState } from 'react'

/* ============================================================
   ESTIMATOR — the three pricing categories, made operable.

   business/README.md §3 sells three things and prices them three ways.
   An earlier version of this put all six services on a share of value,
   which is wrong twice over: a portal has no measurable before, and
   training is bought with credits.

     A. Efficiency  — an existing process made cheaper. Priced on a
                      share of first-year value. Computable, so it is.
     B. Capability  — something the business did not have. Fixed price
                      against defined scope. NOT computable, so this
                      shows the annual cost being weighed against it and
                      then stops, rather than inventing a band.
     C. Credits     — the operating layer afterwards. Build, Assist and
                      Educate. Training lives here.

   The efficiency arithmetic reproduces the documented worked example
   exactly: 12 hours a month at £20 loaded becomes 2 hours, £2,400
   recovered, priced £800 to £1,500.
   ============================================================ */

const RATE_MIN = 14, RATE_MAX = 45, RATE_DEFAULT = 20

/* Share of the process each kind of efficiency work removes. Estimates
   from how the work usually lands, labelled as such on the page.
   Automation matches the documented example (12 hours to 2). */
const KINDS = [
  { id: 'automation', mode: 'efficiency', service: 'Automation', recover: 5 / 6,
    label: 'A process that repeats between systems' },
  { id: 'data', mode: 'efficiency', service: 'Data', recover: 0.65,
    label: 'Building the same report over again' },
  { id: 'web', mode: 'capability', service: 'Web',
    label: 'A site that takes bookings, orders or payments' },
  { id: 'ai', mode: 'capability', service: 'AI assistant',
    label: 'An assistant that answers from your documents' },
  { id: 'software', mode: 'capability', service: 'Software',
    label: 'An internal tool that runs the process' },
  { id: 'training', mode: 'credits', service: 'Training',
    label: 'Getting your team able to run it' },
]

/* A fraction of first-year value, set so the opening state reproduces
   the documented example rather than approximating it. */
const PRICE_LO = 1 / 3, PRICE_HI = 0.625

/* Below this it is an afternoon, not an engagement. */
const FLOOR = 800

/* ---- C. Credits -------------------------------------------------
   One credit is one hour of our time. Not a token with an invented
   exchange rate: the whole point of the layer is that a client can see
   what they are buying.

   Packs get cheaper with size, and cheaper again bought alongside an
   implementation, which is what §3C promises. The taper runs £95 down
   to £75, sitting just under the effective hourly rate the efficiency
   worked example implies — pre-bought time carries no scoping risk, so
   it should not cost the same as scoped project time.

   business/README.md §3C says to set these alongside the first three
   real quotes rather than before them. These are set before, at the
   client's instruction, and should be revisited once three exist. */
const PACKS = [
  { name: 'Starter', credits: 5, price: 475, withProject: 380 },
  { name: 'Standard', credits: 10, price: 885, withProject: 710 },
  { name: 'Team', credits: 25, price: 2040, withProject: 1630 },
  { name: 'Programme', credits: 50, price: 3750, withProject: 3000 },
]

/* Credits are good for 24 months. An expiry any shorter turns "buy
   support when you need support" back into a retainer with extra steps. */
const CREDIT_MONTHS = 24

/* A session is three hours of our time — preparation, delivery and the
   written follow-up — and one more for every six people past the first
   six, because a room of eighteen is three rooms. */
const sessionCredits = (people) => 3 + Math.max(0, Math.ceil((people - 6) / 6))

const money = (n) => `£${Math.round(n).toLocaleString('en-GB')}`

export default function Estimator() {
  const [kindId, setKindId] = useState('automation')
  const [hours, setHours] = useState(12)
  const [people, setPeople] = useState(1)
  const [rate, setRate] = useState(RATE_DEFAULT)
  const [trainees, setTrainees] = useState(6)
  const [sessions, setSessions] = useState(2)
  const [alongside, setAlongside] = useState(true)

  const kind = KINDS.find((k) => k.id === kindId)

  const cost = useMemo(() => {
    const nowMonth = hours * people * rate
    return { nowMonth, nowYear: nowMonth * 12 }
  }, [hours, people, rate])

  const eff = useMemo(() => {
    if (kind.mode !== 'efficiency') return null
    const afterMonth = cost.nowMonth * (1 - kind.recover)
    const savedYear = (cost.nowMonth - afterMonth) * 12
    const lo = Math.max(FLOOR, savedYear * PRICE_LO)
    const hi = Math.max(FLOOR * 1.4, savedYear * PRICE_HI)
    const payback = savedYear > 0 ? ((lo + hi) / 2) / (savedYear / 12) : 0
    return { afterMonth, savedYear, lo, hi, payback, tooSmall: savedYear * PRICE_HI < FLOOR }
  }, [kind, cost])

  const cred = useMemo(() => {
    if (kind.mode !== 'credits') return null
    const needed = sessions * sessionCredits(trainees)
    const pack = PACKS.find((p) => p.credits >= needed) || PACKS[PACKS.length - 1]
    const price = alongside ? pack.withProject : pack.price
    return { needed, pack, price, per: price / pack.credits, spare: pack.credits - needed }
  }, [kind, trainees, sessions, alongside])

  return (
    <div className="est">
      <div className="est__controls">
        <div className="est__field">
          <label className="est__label" htmlFor="est-kind">What you need</label>
          <select id="est-kind" className="est__select" value={kindId}
            onChange={(e) => setKindId(e.target.value)}>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </div>

        {kind.mode === 'credits' ? (
          <>
            <Slider id="est-trainees" label="People to train" value={trainees} min={1} max={40}
              onChange={setTrainees} format={(v) => `${v} ${v === 1 ? 'person' : 'people'}`} />
            <Slider id="est-sessions" label="Sessions" value={sessions} min={1} max={12}
              onChange={setSessions} format={(v) => `${v} ${v === 1 ? 'session' : 'sessions'}`}
              help="Half a day each, including the written follow-up." />
            <label className="est__check">
              <input type="checkbox" checked={alongside}
                onChange={(e) => setAlongside(e.target.checked)} />
              <span>Bought alongside an implementation</span>
            </label>
          </>
        ) : (
          <>
            <Slider id="est-hours" label="Hours a month it takes now" value={hours} min={1} max={80}
              onChange={setHours} format={(v) => `${v} ${v === 1 ? 'hour' : 'hours'}`} />
            <Slider id="est-people" label="People it involves" value={people} min={1} max={12}
              onChange={setPeople} format={(v) => `${v} ${v === 1 ? 'person' : 'people'}`} />
            <Slider id="est-rate" label="What an hour of their time costs you" value={rate}
              min={RATE_MIN} max={RATE_MAX} onChange={setRate} format={(v) => `£${v}/hour`}
              help="Salary plus NI, pension and overhead — not the hourly wage." />
          </>
        )}
      </div>

      <div className="est__out">
        {kind.mode === 'efficiency' && (
          <>
            <Row k="Costs you now" v={`${money(cost.nowMonth)} a month`} />
            <Row k="After the automation work" v={`${money(eff.afterMonth)} a month`} />
            <Row k="Recovered in a year" v={money(eff.savedYear)} strong />
            <div className="est__price">
              {eff.tooSmall ? (
                <>
                  <span className="est__priceK est__priceK--no">Probably not worth a project</span>
                  <p className="est__note">
                    At this size we would tell you so, and point you at the setting in the
                    software you already have.
                  </p>
                </>
              ) : (
                <>
                  <span className="est__priceK">Indicative price</span>
                  <span className="est__priceV">{money(eff.lo)} &ndash; {money(eff.hi)}</span>
                  <p className="est__note">
                    A share of what it recovers in the first year. Pays for itself in about{' '}
                    {Math.max(1, Math.round(eff.payback))} months, then keeps going &mdash; it lands
                    near there whatever you put in, which is what pricing on a share of the value means.
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {kind.mode === 'capability' && (
          <>
            <Row k="Doing it by hand costs you" v={`${money(cost.nowMonth)} a month`} />
            <Row k="Over a year" v={money(cost.nowYear)} strong />
            <div className="est__price">
              <span className="est__priceK">Fixed price, quoted</span>
              <p className="est__note">
                A {kind.service.toLowerCase()} build is something you do not have yet, so there is no
                honest before-and-after to price against. We define the scope, state the price, and
                it does not move &mdash; changes go through credits or a new quote.
              </p>
              <p className="est__note">
                What the figure above is for is the number you weigh the quote against.
              </p>
            </div>
          </>
        )}

        {kind.mode === 'credits' && (
          <>
            <Row k="Credits needed" v={`${cred.needed} (${sessionCredits(trainees)} a session)`} />
            <Row k="Pack that covers it" v={`${cred.pack.name} — ${cred.pack.credits} credits`} />
            <Row k="Left over for later" v={`${cred.spare} ${cred.spare === 1 ? 'credit' : 'credits'}`} strong />
            <div className="est__price">
              <span className="est__priceK">{alongside ? 'With an implementation' : 'On its own'}</span>
              <span className="est__priceV">{money(cred.price)}</span>
              <p className="est__note">
                {money(cred.per)} a credit. One credit is one hour of our time, on training,
                troubleshooting or small build work, good for {CREDIT_MONTHS} months. You do not pay
                us monthly to be on standby &mdash; you buy support when you need support.
              </p>
            </div>
          </>
        )}
      </div>

      <p className="est__caveat">
        {kind.mode === 'efficiency'
          ? 'An estimate, not a quote. The share of the work each project removes is our own figure from how these usually land, not a measurement of your process — we would check it against your actual numbers before quoting, and say so if it came out lower.'
          : kind.mode === 'capability'
          ? 'The cost above is your arithmetic, not ours — it is only as good as the hours you put in. The quote comes after we have seen the scope.'
          : 'Credits are hours, not tokens. Unused ones stay yours for two years and can go on anything in the Build, Assist or Educate list.'}
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

export { PACKS, KINDS }
