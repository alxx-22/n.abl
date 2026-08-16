import { EdgeCard, Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'

/* ============================================================
   08 — PRICING

   This slot used to hold four counters: businesses transformed,
   client savings unlocked, average efficiency improvement. Every
   number was invented. A prospect can act on a number, so an
   invented one is not decoration — it is a false claim, and it is
   the first thing that falls apart in a room with a real client.
   The honest version of "impact" for a business at this stage is
   being straight about what it charges.

   The worked example survives because it is checkable arithmetic and
   it shows how we think. It is now three lines rather than four
   animated counters and a paragraph: it was taking a third of the
   section, which made the pricing method look like the main sales
   pitch. The figures match business/README.md §3 exactly.
   ============================================================ */

export default function Pricing() {
  return (
    <section id="pricing" className="section section--impact">
      <div className="shell">
        <Chapter index={6}>What it costs</Chapter>
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
              <span className="price__kind">Efficiency improvements</span>
              <h3 className="price__title">Priced around the value they create</h3>
              <p className="price__body">
                When a process already costs you money, we work out what it costs now,
                what it will cost afterwards, and price against the difference. We show
                our working, and you can check the arithmetic before you agree to
                anything.
              </p>
            </EdgeCard>
          </Reveal>
          <Reveal delay={0.18}>
            <EdgeCard className="card-pad price">
              <span className="price__kind">New capabilities</span>
              <h3 className="price__title">Fixed price, agreed before work starts</h3>
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
            <span className="eyebrow">A worked example</span>
            <p className="worked__line">A 12-hour monthly process becomes a 2-hour process.</p>
            <p className="worked__line worked__line--figures">
              £240 → £40 per month. Around £2,400 a year.
            </p>
            <p className="worked__note">
              Your numbers are calculated from your business, not ours.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
