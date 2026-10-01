import { Reveal } from '../ui/index.jsx'

/* ============================================================
   10 — ABOUT

   Short on purpose. The site should make people feel the philosophy
   through how it behaves, not through how much of it is printed on
   the homepage. Three paragraphs became one.

   Rewritten for the move to AI implementation: the old line, "we
   aren't here to sell you a particular technology", is still true of
   how we work, but n.abl now leads with one. So this band says what
   stays the same: built around the business, no lock-in, a person in
   the loop, and an honest no when AI is the wrong answer.

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
            We don&rsquo;t sell you a product. We build AI around your business, and stay to
            keep it working<span className="dot" />
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="about__body prose">
            <p>
              No reseller agreements and no lock-in to one platform. We use whichever models and
              tools fit the job, and what we build connects to the systems you already pay for:
              your phone line, your booking system, your accounts, your inbox. A person stays in
              the loop wherever a mistake would matter. And if AI isn&rsquo;t the right answer,
              we&rsquo;ll say so.
            </p>
            <p className="about__based">Nottingham, Warwickshire and Bristol. Working with businesses beyond them.</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
