import { EdgeCard, Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'

/* ============================================================
   05 — HOW WE WORK
   ============================================================ */
export const STEPS = [
  { n: '01', title: 'Understand', body: 'A conversation, and a proper look at how the work happens today. Where it is measurable, we put a number on what it is costing you.' },
  { n: '02', title: 'Build', body: 'Price agreed before we start. Built inside the tools you already run — no new servers, no migration project, no new subscription to carry.' },
  { n: '03', title: 'Hand over', body: 'It is yours, and it keeps working without us. Buy credits if you want us on hand, and spend them only when something actually needs doing.' },
]

export default function Process() {
  return (
    <section id="how-we-work" className="section">
      <div className="shell">
        <Chapter index={2}>How we work</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">Three steps, and then we get out of the way<span className="dot" /></h2>
        </Reveal>

        <div className="grid grid--3 section__body">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={0.08 + i * 0.1}>
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
