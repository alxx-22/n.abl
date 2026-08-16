import { EdgeCard, Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'
import { CategoryGlyph } from '../Visuals.jsx'

/* ============================================================
   03 — WHAT ARE YOU TRYING TO IMPROVE?

   The offer is organised by the problem the client arrives with,
   not by the disciplines we happen to practise. Nobody wakes up
   needing "optimisation"; they wake up knowing a job takes all
   morning and shouldn't. See business/README.md §1.
   ============================================================ */
export const CATEGORIES = [
  { n: '01', title: 'Save time', glyph: 'time', tag: 'The job that eats your week',
    body: 'Something gets done by hand, over and over, and it always takes longer than it should. We find where the hours go and hand that work to something that does not get bored.' },
  { n: '02', title: 'Reduce mistakes', glyph: 'accuracy', tag: 'The thing that keeps going wrong',
    body: 'Retyped numbers, missed steps, the spreadsheet only one person understands. We replace the fragile bit with something that does it the same way every time.' },
  { n: '03', title: 'Get more customers', glyph: 'customers', tag: 'The enquiries you never followed up',
    body: 'Leads that arrive and go cold, follow-ups that depend on someone remembering. We make capture and follow-up happen whether anyone remembers or not.' },
  { n: '04', title: 'Build something new', glyph: 'build', tag: 'The thing you do not have yet',
    body: 'A website, a booking flow, an internal tool, a portal for your customers. Scoped properly and quoted at a fixed price before anyone starts.' },
  { n: '05', title: 'Train your team', glyph: 'train', tag: 'The software you already pay for',
    body: 'Most businesses use a fraction of what they own. Sessions built around your actual work, not a generic course, so people leave able to do the thing.' },
  { n: '06', title: 'Fix something', glyph: 'fix', tag: 'The bit that broke',
    body: 'Something stopped working, or needs changing, or was never quite right. Buy credits and spend them when you need us — no monthly retainer to sit on standby.' },
]

export default function Problems() {
  return (
    <section id="what-we-do" className="section">
      <div className="shell">
        <Chapter index={1}>Your problem</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">
            Start with the problem.<br />Not the technology<span className="dot" />
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            Nobody arrives knowing which tool they need. They arrive knowing what is
            annoying them. Find the one that sounds like you.
          </p>
        </Reveal>

        <div className="grid grid--3 section__body">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.n} delay={0.1 + (i % 3) * 0.08}>
              <EdgeCard className="card-pad pillar">
                <div className="pillar__head">
                  <span className="pillar__num">{c.n}</span>
                  <CategoryGlyph kind={c.glyph} />
                </div>
                <h3 className="pillar__title">{c.title}</h3>
                <p className="pillar__body">{c.body}</p>
                <span className="pillar__tag">{c.tag}</span>
              </EdgeCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
