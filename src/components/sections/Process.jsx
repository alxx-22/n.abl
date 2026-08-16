import { EdgeCard, Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'

/* ============================================================
   05 — HOW WE WORK

   Five steps, not three. The old set started at "Understand", which
   quietly assumed the customer had already explained the problem and
   made the first move ours. Listening is the first step, and it is the
   one the whole positioning rests on.

   The economic measurement lives inside Recommend, phrased as
   something worked out together and shown — never as a gate the
   customer's problem has to pass before we will take it seriously.
   ============================================================ */
export const STEPS = [
  { n: '01', title: 'Listen',
    body: "Tell us what's getting in the way." },
  { n: '02', title: 'Understand',
    body: 'We look at how the work actually happens today, and the systems around it.' },
  { n: '03', title: 'Recommend',
    body: 'We explain what we think would help, what it involves, and what it should be worth to you. We show our working.' },
  { n: '04', title: 'Build',
    body: 'We choose whatever technology solves it properly, at the price agreed before we start.' },
  { n: '05', title: 'Hand over',
    body: "You own it. We train your team, and we're there when you need us." },
]

export default function Process() {
  return (
    <section id="how-we-work" className="section">
      <div className="shell">
        <Chapter index={3}>How we work</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">Five steps, and then we get out of the way<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            You never have to arrive knowing what you need. That part is our job.
          </p>
        </Reveal>

        <div className="grid grid--steps section__body">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={0.08 + i * 0.08}>
              <EdgeCard className="card-pad step">
                <span className="step__num">{s.n}</span>
                <h3 className="step__title">{s.title}</h3>
                <p className="step__body">{s.body}</p>
              </EdgeCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
