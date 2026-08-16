import { Reveal } from '../ui/index.jsx'

/* ============================================================
   10 — ABOUT

   Short on purpose. The site should make people feel the philosophy
   through how it behaves, not through how much of it is printed on
   the homepage. Three paragraphs became one.

   "We are not an AI company" was a strong line, and it defined the
   business by what it isn't. The promise in the hero does that job
   better, so this band states the positive version instead.

   The heading is a real h2 rather than a bare blockquote: the section
   had no heading at all, which left a hole in the document outline
   and an unnamed landmark.
   ============================================================ */
export default function About() {
  return (
    <section id="about" className="section section--alt">
      <div className="shell about">
        <Reveal>
          <h2 className="about__quote">
            We aren&rsquo;t here to sell you a particular technology. We&rsquo;re here to
            understand the problem and build what makes the business work better<span className="dot" />
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="about__body prose">
            <p>
              No reseller agreements, no migration upsell, no monthly retainer. Most of
              what we build runs inside the tools you already pay for — Microsoft 365,
              Google Workspace, your CRM, your booking system. If the answer is a licence
              you already hold, or an afternoon of training rather than a build, that is
              the answer we give you.
            </p>
            <p className="about__based">Based in the UK. Working with businesses everywhere.</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
