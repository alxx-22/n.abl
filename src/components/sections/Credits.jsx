import { Reveal } from '../ui/index.jsx'
import { Horizon } from '../Visuals.jsx'

/* ============================================================
   09 — AFTERWARDS

   Promoted out of a pricing footnote. "You own it, and you buy help
   when you need it" is a reason to choose n.abl, not a detail about
   billing: a small business owner is far more comfortable buying
   support when something needs doing than committing to a monthly fee
   indefinitely.

   No pack size is named here. Credit pack sizes and prices are an open
   decision in business/13-credits, to be set against the first three
   real quotes, and a number invented for the website would be the
   first thing to fall apart in front of a client.
   ============================================================ */
export const CREDITS = [
  { title: 'Build', body: 'Small changes, new integrations, another automation.' },
  { title: 'Assist', body: 'Troubleshooting, repairs, configuration, support.' },
  { title: 'Educate', body: 'Training, workshops, documentation for your team.' },
]

export default function Credits() {
  return (
    <section id="credits" className="section">
      <div className="shell">
        <Reveal>
          <h2 className="section__title">You own what we build<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="section__sub prose">
            No retainer. Need us later? Use credits — bought when something actually
            needs doing, rather than paid monthly for us to sit on standby.
          </p>
        </Reveal>

        <div className="credits__grid section__body">
          {CREDITS.map((c, i) => (
            <Reveal key={c.title} delay={0.12 + i * 0.07}>
              <div className="credit">
                <span className="credit__name">{c.title}</span>
                <span className="credit__body">{c.body}</span>
              </div>
            </Reveal>
          ))}
        </div>

        <Horizon />
      </div>
    </section>
  )
}
