import { EdgeCard, Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'

/* ============================================================
   04 — HOW WE WORK

   Listening is still the first step: the positioning rests on it, and it
   is the one that means the visitor never has to arrive knowing what
   they need. What changed is the end. The old last step was "hand over,
   then get out of the way"; AI is not something you hand over and leave.
   Models change, the business changes, and the work should keep getting
   better, so the last step is the monthly partnership the pricing
   section below describes.
   ============================================================ */
export const STEPS = [
  { n: '01', title: 'Listen',
    body: 'Tell us where the time goes, and what slips through the cracks.' },
  { n: '02', title: 'Map',
    body: 'We look at how the work happens today: the calls, the inbox, the paperwork and the systems around them.' },
  { n: '03', title: 'Build around you',
    body: 'We design the AI to fit your process and your tone, test it on your real cases, and agree the checks it has to pass.' },
  { n: '04', title: 'Launch',
    body: 'It goes live alongside your team, with a person in the loop until you trust it.' },
  { n: '05', title: 'Run and improve',
    body: 'Every month we look after it, tune it and add to it. You get a report, and time with us.' },
]

export default function Process() {
  return (
    <section id="how-we-work" className="section section--alt">
      <div className="shell">
        <Chapter index={3}>How we work</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">Built around you, then kept running<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            You never have to arrive knowing what you need, or what AI can do. That part is our job.
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
