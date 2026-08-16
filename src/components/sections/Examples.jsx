import { EdgeCard, Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'

/* ============================================================
   07 — WHAT THIS LOOKS LIKE

   Every card has the same three parts: the problem, the fix, the
   result. Same shape every time, so the section reads as a method
   rather than as three anecdotes.

   PROVENANCE IS PART OF THE DATA, NOT PART OF THE COPY.

   `provenance: 'illustrative'` means nobody paid for this — it is the
   kind of job we take on, written to show the shape of the work. The
   component renders that label itself, on the card, so the disclaimer
   cannot be lost in a copy edit and cannot survive after the example
   becomes real.

   Replacing one with genuine proof is a data change and nothing else:
   set provenance to 'client', add the client name, and swap problem /
   fix / result for numbers they have agreed in writing. One card at a
   time — see business/17-proof-and-case-studies.
   ============================================================ */
export const CASES = [
  {
    provenance: 'illustrative',
    client: null,
    capability: 'Automation',
    problem: '12 hours of manual reporting every month.',
    fix: 'An automated reporting pipeline.',
    result: '10 hours returned to the business every month.',
    tools: ['Power Automate', 'Excel', 'Power BI'],
  },
  {
    provenance: 'illustrative',
    client: null,
    capability: 'Data & Analytics',
    problem: 'Sales, stock and hours sit in three systems that never agree.',
    fix: 'One cleaned dataset, and a dashboard built on top of it.',
    result: 'One set of numbers, current every morning.',
    tools: ['Power BI', 'SQL'],
  },
  {
    provenance: 'illustrative',
    client: null,
    capability: 'Web',
    problem: 'Every booking needs a phone call, always at the worst moment.',
    fix: 'A booking flow with payment, on the website.',
    result: 'The straightforward bookings take themselves.',
    tools: ['Web', 'Payments', 'Calendar sync'],
  },
]

function Provenance({ item }) {
  if (item.provenance === 'client' && item.client) {
    return <span className="case__prov case__prov--client">{item.client}</span>
  }
  return <span className="case__prov">Illustrative example</span>
}

export default function Examples() {
  const anyIllustrative = CASES.some((c) => c.provenance !== 'client')

  return (
    <section id="cases" className="section">
      <div className="shell">
        <Chapter index={5}>In practice</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">From problem to solution<span className="dot" /></h2>
        </Reveal>
        {anyIllustrative && (
          <Reveal delay={0.12}>
            <p className="section__sub prose">
              The kind of problem we take on, and what gets built to solve it. Cards
              marked <em>illustrative</em> are examples rather than client work — we
              name clients only with written permission, and not before there is
              something worth naming.
            </p>
          </Reveal>
        )}

        <div className="grid grid--3 section__body">
          {CASES.map((c, i) => (
            <Reveal key={c.problem} delay={0.08 + i * 0.08}>
              <EdgeCard className="card-pad case">
                <div className="case__head">
                  <span className="case__label">{c.capability}</span>
                  <Provenance item={c} />
                </div>

                <dl className="case__facts">
                  <dt className="case__term">The problem</dt>
                  <dd className="case__def">{c.problem}</dd>
                  <dt className="case__term">The fix</dt>
                  <dd className="case__def">{c.fix}</dd>
                  <dt className="case__term">The result</dt>
                  <dd className="case__def case__def--result">{c.result}</dd>
                </dl>

                <div className="case__tools">
                  {c.tools.map((t) => <span key={t} className="chip chip--sm">{t}</span>)}
                </div>
              </EdgeCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
