import { Reveal } from '../ui/index.jsx'

/* ============================================================
   10 — ABOUT
   ============================================================ */
export default function About() {
  return (
    <section id="about" className="section section--alt">
      <div className="shell about">
        <Reveal>
          <blockquote className="about__quote">
            We are not an AI company. We are the people who work out what the
            problem actually is, and then build the right thing<span className="dot" />
          </blockquote>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="about__body prose">
            <p>
              n.abl is a technology implementation partner for small businesses. Some of what
              we build uses AI. Most of it does not, because most problems do not need it —
              they need a process understood properly and then built properly.
            </p>
            <p>
              No reseller agreements, no migration upsell, no monthly retainer. If the answer
              is a licence you already hold, or an afternoon of training rather than a build,
              that is the answer we give you.
            </p>
            <p className="about__based">Based in the UK. Working with businesses everywhere.</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
