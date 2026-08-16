import { EdgeCard, Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'

/* ============================================================
   07 — WHAT THIS LOOKS LIKE

   Illustrative of the kind of problem we take on and what gets built
   to solve it. Deliberately not dressed as a client list.
   ============================================================ */
export const CASES = [
  { label: 'Save time', title: 'A morning of reporting, down to nothing',
    body: 'A pack that two people rebuilt by hand every week assembles itself overnight and is sitting there before the Monday meeting.',
    tools: ['Power Automate', 'Excel', 'Power BI'] },
  { label: 'Reduce mistakes', title: 'Orders that stopped being retyped',
    body: 'Orders arriving by email were copied into the system by hand, and occasionally copied wrong. Now they arrive already in it, and anything unusual is flagged rather than guessed at.',
    tools: ['Python', 'API integration'] },
  { label: 'Build something new', title: 'A booking page that fills the diary',
    body: 'Enquiries came by phone, always at the worst moment. A booking flow on the site takes the ones that never needed a conversation.',
    tools: ['Web', 'Payments', 'Calendar sync'] },
]

export default function Examples() {
  return (
    <section id="cases" className="section">
      <div className="shell">
        <Chapter index={5}>In practice</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">What this actually looks like<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            The kind of problem we take on, and the sort of thing that gets built to
            solve it. Examples, not a client list — we name clients only with
            permission, and not before there is something worth naming.
          </p>
        </Reveal>

        <div className="grid grid--3 section__body">
          {CASES.map((c, i) => (
            <Reveal key={c.title} delay={0.08 + i * 0.08}>
              <EdgeCard className="card-pad case">
                <span className="case__label">{c.label}</span>
                <h3 className="case__title">{c.title}</h3>
                <p className="case__body">{c.body}</p>
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
