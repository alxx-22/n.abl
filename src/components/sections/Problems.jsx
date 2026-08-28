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

   Each card answers exactly one row of section 06, and the quote is
   what carries that — not the title. So each one names a situation
   only one capability answers: a quote that could sit on three cards
   ("this takes longer than it should") tells the visitor nothing
   about which of them is theirs.

   "Fix something" was retired here for the same reason. It described
   how we are engaged rather than what is wrong, and troubleshooting
   is already what Training & Support is, so it and "Train your team"
   both landed on the same row while AI had no card at all. The
   credits it named now sit in 05, beside the training they follow.
   ============================================================ */
export const CATEGORIES = [
  { n: '01', title: 'Save time', glyph: 'time',
    quote: 'The same details get typed into three systems.',
    body: 'The repeated steps between your systems, set up once and then left to run.' },
  { n: '02', title: 'Reduce mistakes', glyph: 'accuracy',
    quote: 'Two people edited it. Nobody knows which number is right.',
    body: 'A proper internal tool in place of the spreadsheet: one record, one place, one version.' },
  { n: '03', title: 'Understand your data', glyph: 'data',
    quote: 'We have the data, but not the answers.',
    body: 'The data cleaned up first, then reporting you can actually make a decision from.' },
  { n: '04', title: 'Build something new', glyph: 'build',
    quote: 'Customers still have to ring us to book.',
    body: 'Websites, booking flows, customer portals and payments, so people can do it themselves.' },
  { n: '05', title: 'Train your team', glyph: 'train',
    quote: 'We paid for the software. People still work the old way.',
    body: 'Sessions built around your actual work, so people leave able to do the thing. Credits for afterwards.' },
  { n: '06', title: 'Find the answer', glyph: 'answer',
    quote: 'The answer is in there somewhere. Nobody can find it.',
    body: 'An assistant that answers from your own documents, and shows you where it got it.' },
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
