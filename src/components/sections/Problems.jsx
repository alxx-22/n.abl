import { EdgeCard, Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'
import { CategoryGlyph } from '../Visuals.jsx'

/* ============================================================
   03 — WHAT ARE YOU TRYING TO IMPROVE?

   The customer-problem layer, and the only one of the three that
   faces the visitor. Brand (the pillars) is what they remember;
   capabilities (automation, data, software, web, AI, training) are
   what we deliver; this is how they enter the conversation.

   Each card leads with the sentence the owner would actually say.
   Nobody wakes up needing "optimisation" — they wake up knowing a
   job takes all morning and shouldn't.

   "Get more customers" was removed: lead capture, follow-up and
   conversion are internal growth infrastructure, not something the
   business can credibly sell yet. See business/01-positioning.
   ============================================================ */
export const CATEGORIES = [
  { n: '01', title: 'Save time', glyph: 'time',
    quote: 'This takes longer than it should.',
    body: 'Give your team hours back by removing repetitive work.' },
  { n: '02', title: 'Reduce mistakes', glyph: 'accuracy',
    quote: 'We keep having to check this.',
    body: 'Replace fragile manual processes with systems that do the job consistently.' },
  { n: '03', title: 'Understand your data', glyph: 'data',
    quote: 'We have the data, but not the answers.',
    body: 'Turn spreadsheets, systems and reporting into something you can make decisions with.' },
  { n: '04', title: 'Build something new', glyph: 'build',
    quote: "We need something that doesn't exist yet.",
    body: 'Websites, internal tools, applications, portals and software built for you.' },
  { n: '05', title: 'Train your team', glyph: 'train',
    quote: "We have the tools, but we're not getting enough from them.",
    body: 'Sessions built around your actual work, so people leave able to do the thing.' },
  { n: '06', title: 'Fix something', glyph: 'fix',
    quote: "It works. Until it doesn't.",
    body: 'Something broke, or was never quite right. Buy credits and spend them when you need us.' },
]

export default function Problems() {
  return (
    <section id="what-we-do" className="section">
      <div className="shell">
        <Chapter index={1}>Your problem</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">What are you trying to improve<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">Which of these sounds familiar?</p>
        </Reveal>

        {/* Staggered by full index rather than by column, so the six
            arrive in sequence and read as a diagnostic being worked
            through, not as a menu of six services dealt onto the page. */}
        <div className="grid grid--3 section__body">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.n} delay={0.06 + i * 0.07}>
              <EdgeCard className="card-pad problem">
                <div className="problem__head">
                  <span className="problem__num">{c.n}</span>
                  <CategoryGlyph kind={c.glyph} />
                </div>
                <span className="problem__label">{c.title}</span>
                <h3 className="problem__quote">&ldquo;{c.quote}&rdquo;</h3>
                <p className="problem__body">{c.body}</p>
              </EdgeCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
