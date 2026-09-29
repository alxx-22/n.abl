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
    capability: 'Voice AI',
    problem: 'Calls go unanswered whenever everyone is with a client.',
    fix: 'An AI receptionist that answers, books the appointment and takes the deposit.',
    result: 'Every call answered, and the booking in the diary with the deposit paid.',
    tools: ['Voice AI', 'Booking system', 'Payments'],
  },
  {
    provenance: 'illustrative',
    client: null,
    capability: 'Document AI',
    problem: 'Supplier invoices are keyed in by hand every Friday.',
    fix: 'AI reads each invoice, matches it to the order and drafts the entry.',
    result: 'Friday’s keying becomes a short check of the ones it flagged.',
    tools: ['Document AI', 'Accounts software'],
  },
  {
    provenance: 'illustrative',
    client: null,
    capability: 'AI agent',
    problem: 'Overdue invoices get chased when someone remembers.',
    fix: 'An agent that checks the ledger every morning and drafts reminders for approval.',
    result: 'Nothing overdue slips through, and the owner approves in one tap.',
    tools: ['AI agent', 'Accounts', 'Email'],
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
        <Chapter index={4}>In practice</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">From problem to working AI<span className="dot" /></h2>
        </Reveal>
        {anyIllustrative && (
          <Reveal delay={0.12}>
            <p className="section__sub prose">
              The kind of job we take on, and what gets built to take it off your hands. Cards
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
