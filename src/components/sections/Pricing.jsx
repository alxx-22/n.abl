import { useEffect, useRef, useState } from 'react'
import { EdgeCard, Reveal, prefersReducedMotion } from '../ui/index.jsx'
import { Chapter, useParallax } from '../Journey.jsx'
import { Horizon } from '../Visuals.jsx'

/* ============================================================
   08 — PRICING

   This slot used to hold four counters: businesses transformed,
   client savings unlocked, average efficiency improvement. Every
   number was invented. A prospect can act on a number, so an
   invented one is not decoration — it is a false claim, and it is
   the first thing that falls apart in a room with a real client.
   The honest version of "impact" for a business at this stage is
   being straight about what it charges.
   ============================================================ */

/* The worked example from business/README.md §3. Illustrative
   arithmetic, not an average of past work — there is no client
   history to average, and inventing one would be a lie a
   prospect could act on. */
export const EXAMPLE = [
  { target: 240, prefix: '£', label: 'A month, doing it by hand' },
  { target: 40, prefix: '£', label: 'A month, once it is built' },
  { target: 200, prefix: '£', label: 'Saved every month' },
  { target: 2400, prefix: '£', label: 'Saved in the first year' },
]

export const CREDITS = [
  { title: 'Build', body: 'Small changes, new integrations, another automation.' },
  { title: 'Assist', body: 'Troubleshooting, repairs, configuration, support.' },
  { title: 'Educate', body: 'Training, workshops, documentation for your team.' },
]

/* ---------- Stat counter ---------- */
function Stat({ target, prefix = '', suffix = '', decimals = 0, label }) {
  const [val, setVal] = useState(prefersReducedMotion() ? target : 0)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        obs.unobserve(e.target)
        const start = performance.now()
        const dur = 1500
        const tick = (now) => {
          const t = Math.min(1, (now - start) / dur)
          const eased = 1 - Math.pow(1 - t, 3)
          setVal(target * eased)
          if (t < 1) requestAnimationFrame(tick)
          else setVal(target)
        }
        requestAnimationFrame(tick)
      })
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])
  // Group thousands, or £2400 reads as a part number rather than money.
  const shown = decimals === 0
    ? Math.round(val).toLocaleString('en-GB')
    : val.toFixed(decimals)
  return (
    <div className="stat" ref={ref}>
      <div className="stat__num">{prefix}{shown}{suffix}</div>
      <div className="stat__label">{label}</div>
    </div>
  )
}

export default function Pricing() {
  const statsRef = useParallax(0.06)

  return (
    <section id="pricing" className="section section--impact">
      <div className="shell">
        <Chapter index={4}>What it costs</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">No retainers. A price before we start<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            Two ways we price, depending on whether the problem can be counted.
          </p>
        </Reveal>

        <div className="grid grid--2 section__body">
          <Reveal delay={0.1}>
            <EdgeCard className="card-pad price">
              <span className="price__kind">Making something better</span>
              <h3 className="price__title">Priced on what it saves you</h3>
              <p className="price__body">
                When a process already costs you money, we work out what it costs now,
                what it will cost afterwards, and price against the difference. You can
                check the arithmetic yourself before you agree to anything.
              </p>
            </EdgeCard>
          </Reveal>
          <Reveal delay={0.18}>
            <EdgeCard className="card-pad price">
              <span className="price__kind">Building something new</span>
              <h3 className="price__title">Fixed price, agreed up front</h3>
              <p className="price__body">
                A portal, an app, a website — there is no before-and-after to measure,
                and a savings figure would be guesswork. So the scope is written down
                and the price is stated. Changes go through credits or a new quote.
              </p>
            </EdgeCard>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="worked">
            <div className="worked__head">
              <span className="eyebrow">A worked example</span>
              <p className="worked__lead">
                A job takes 12 hours a month. At £20 an hour, that is what it costs you
                today. Afterwards it takes two.
              </p>
            </div>
            <div className="stats worked__stats" ref={statsRef}>
              {EXAMPLE.map((s) => <Stat key={s.label} {...s} />)}
            </div>
            <p className="worked__note">
              Priced at roughly £800 to £1,500, that is about £1,200 once to remove
              about £2,400 a year of labour. Illustrative figures — yours depend on
              your own job and your own numbers, which is what the first call is for.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.14}>
          <div className="credits">
            <div className="credits__intro">
              <h3 className="credits__title">Afterwards: credits, not a retainer</h3>
              <p className="credits__body">
                You do not pay us monthly to be on standby. Buy a pack of credits and
                spend them when you actually need something. What we build is yours.
              </p>
            </div>
            <div className="credits__grid">
              {CREDITS.map((c) => (
                <div key={c.title} className="credit">
                  <span className="credit__name">{c.title}</span>
                  <span className="credit__body">{c.body}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Horizon />
      </div>
    </section>
  )
}
