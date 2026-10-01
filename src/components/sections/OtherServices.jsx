import { Link } from 'react-router-dom'
import { Reveal } from '../ui/index.jsx'
import { CategoryGlyph } from '../Visuals.jsx'

/* ============================================================
   08 — OTHER SERVICES

   What n.abl sold before it was an AI business, kept rather than
   dropped: automation, data and analytics, and web. Not everything needs
   AI, and saying so is part of being trusted with the parts that do.
   The full detail lives on its own page, /services; this band only
   points at it. Custom software and training came off the site when
   the structure changed: training is part of the retainer now.
   ============================================================ */
export const OTHER = [
  { glyph: 'time', name: 'Automation', body: 'The steps that repeat between your systems, set up once and left to run.' },
  { glyph: 'data', name: 'Data & Analytics', body: 'Your numbers cleaned up, then reporting you can make a decision from.' },
  { glyph: 'build', name: 'Web', body: 'Sites that do the work: booking, ordering, payments and accounts.' },
]

export default function OtherServices() {
  return (
    <section id="other-services" className="section section--alt other">
      <div className="shell">
        <Reveal>
          <span className="eyebrow">Other services</span>
        </Reveal>
        <div className="other__grid">
          <Reveal delay={0.06}>
            <h2 className="section__title other__title">Not everything needs AI<span className="dot" /></h2>
            <p className="section__sub prose">
              We still build the ordinary things well. Sometimes the right answer is an
              automation, a dashboard or a better website, and we will say so.
            </p>
            <Link to="/services" className="btn btn--ghost other__link">See other services</Link>
          </Reveal>
          <ul className="other__list">
            {OTHER.map((o, i) => (
              <Reveal as="li" key={o.name} delay={0.1 + i * 0.07} className="other__item">
                <CategoryGlyph kind={o.glyph} />
                <div>
                  <h3 className="other__name">{o.name}</h3>
                  <p className="other__body">{o.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
