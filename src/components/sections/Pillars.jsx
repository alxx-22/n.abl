import { Reveal } from '../ui/index.jsx'

/* ============================================================
   02 — THE THREE PILLARS

   Brand architecture, not offer architecture. These are what people
   remember n.abl by; they are deliberately NOT the service taxonomy
   and must never become it. The customer-facing structure is the
   problem set in the section below.

   See business/02-brand/brand-promise.md for the distinction and the
   worked example that settles it.
   ============================================================ */
export const PILLARS = [
  { term: 'Innovation',  def: 'Find better ways to do things.' },
  { term: 'Automation',  def: "Take repetitive work off people's hands." },
  { term: 'Optimisation', def: 'Get more from the people, processes, systems and data you already have.' },
]

export default function Pillars() {
  return (
    <section id="pillars" className="section section--alt pillars">
      <div className="shell">
        <div className="pillars__list">
          {PILLARS.map((p, i) => (
            <Reveal key={p.term} delay={i * 0.08}>
              <div className="pillars__row">
                <span className="pillars__term">{p.term}</span>
                <span className="pillars__def">{p.def}</span>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.26}>
          <p className="pillars__rule">
            One rule: start with the problem, not the technology<span className="dot" />
          </p>
        </Reveal>
      </div>
    </section>
  )
}
