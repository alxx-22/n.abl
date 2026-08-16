import { Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'

/* ============================================================
   04 — WHY N.ABL / HOW WE HELP

   The capability layer, named and nothing more. This section answers
   "can these people actually do the thing?" at the moment the visitor
   has just been told they do not need to know what the thing is.

   The detail — what each capability covers, and which tools — lives in
   section 06, after the method has been explained. Same six words in
   the same order in both places: a promise here, its receipt there.
   ============================================================ */
export const CAPABILITIES = [
  'Automation',
  'Data & Analytics',
  'Custom Software',
  'Web',
  'AI',
  'Training & Support',
]

export default function HowWeHelp() {
  return (
    <section id="why-nabl" className="section section--alt">
      <div className="shell">
        <Chapter index={2}>How we help</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">
            You don&rsquo;t need to know what technology you need<span className="dot" />
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            We listen first, understand how the work happens today, then recommend
            the right improvement.
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <ul className="caps section__body">
            {CAPABILITIES.map((c) => <li key={c} className="caps__item">{c}</li>)}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
