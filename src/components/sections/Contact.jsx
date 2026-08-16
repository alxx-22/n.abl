import { Reveal } from '../ui/index.jsx'

/* ============================================================
   11 — FINAL CTA
   ============================================================ */
export default function Contact({ onBook }) {
  return (
    <section id="contact" className="section contact">
      <div className="contact__glow" aria-hidden="true" />
      <div className="shell contact__inner">
        <Reveal>
          <h2 className="contact__title">
            What is the job you wish you never had to do again<span className="dot" />
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="contact__sub">
            A free 30-minute call. Describe the problem and we&rsquo;ll tell you what it
            would take to fix — including when the honest answer is that it isn&rsquo;t worth it.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <button className="btn btn--accent contact__btn" onClick={onBook}>
            Book your free discovery call
          </button>
        </Reveal>
        <Reveal delay={0.22}>
          <a className="contact__email" href="mailto:hello@nabl.agency">hello@nabl.agency</a>
          <p className="contact__note">We typically respond within 4 hours.</p>
        </Reveal>
      </div>
    </section>
  )
}
