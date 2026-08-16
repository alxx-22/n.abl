import { Reveal } from '../ui/index.jsx'

/* ============================================================
   11 — FINAL CTA

   The ask is an invitation to talk, not a test the problem has to
   pass. The old sub offered to tell the visitor when their problem
   "isn't worth it" — honest, and the wrong note to end on, because
   it puts us in judgement of a problem we have not heard yet. The
   arithmetic that produces that answer still happens; it belongs in
   Recommend, after listening, with the working shown.

   The four-hour response claim is gone. Nothing measured it, and an
   unmeasured promise on a page selling reliability is a bad trade.
   ============================================================ */
export default function Contact({ onBook }) {
  return (
    <section id="contact" className="section contact">
      <div className="contact__glow" aria-hidden="true" />
      <div className="shell contact__inner">
        <Reveal>
          <h2 className="contact__title">
            Tell us what&rsquo;s getting in the way<span className="dot" />
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="contact__sub">
            A free 30-minute conversation about what&rsquo;s working, what&rsquo;s
            frustrating, and what you&rsquo;d like to improve.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <button className="btn btn--accent contact__btn" onClick={onBook}>
            Book a discovery call
          </button>
        </Reveal>
        <Reveal delay={0.22}>
          <a className="contact__email" href="mailto:hello@nabl.agency">hello@nabl.agency</a>
        </Reveal>
      </div>
    </section>
  )
}
