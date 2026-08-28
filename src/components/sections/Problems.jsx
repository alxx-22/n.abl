import { useRef, useState } from 'react'
import { EdgeCard, Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'
import { CategoryGlyph } from '../Visuals.jsx'
import { useFinePointer, useWipe } from '../scenes/CardWipe.jsx'
import { automation, data, software, web, training, ai } from '../scenes/index.js'

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
   what carries that — not the title. So each names a situation only
   one capability answers: a quote that could sit on three cards
   ("this takes longer than it should") tells the visitor nothing
   about which of them is theirs.

   The altitude matters as much as the aim. "Customers still have to
   ring us to book" points at web work, but only a business with a
   booking problem sees itself in it — booking is one workflow a new
   site brings, not the category. Each quote names the class of
   problem and lets the body list the instances.

   Nor can a quote assume where the visitor is starting from. The
   same card has to be recognised by someone with nothing at all and
   by someone whose version of it cannot do what they need, which
   rules out any wording that presumes the thing already exists.

   And the fix the quote implies has to be the one we would sell.
   "Two people edited it, nobody knows which number is right" reads
   as a problem solved by letting fewer people edit the file, so the
   card argued its way out of the work it was meant to introduce. A
   problem with a free procedural answer does not need software.

   "Fix something" was retired here. It described how we are engaged
   rather than what is wrong, and troubleshooting is already what
   Training & Support is, so it and "Train your team" both landed on
   the same row while AI had no card at all. The credits it named now
   sit with the training they follow.

   The order is set by hand rather than by how the six were written.
   It opens on automation, which is what most people arrive asking
   about, and closes on training, which is the one that carries on
   after everything else has been delivered. Section 06 lists the
   same six capabilities in an order of its own; the two need not
   agree, but if either is reordered, check whether the other should
   follow.
   ============================================================ */
export const CATEGORIES = [
  { n: '01', title: 'Save time', glyph: 'time', scene: automation, label: 'Automation',
    quote: 'We lose a morning a week to work that repeats itself.',
    body: 'The steps that repeat between your systems, set up once and then left to run.' },
  { n: '02', title: 'Understand your data', glyph: 'data', scene: data, label: 'Data & Analytics',
    quote: 'We have the data, but not the answers.',
    body: 'The data cleaned up first, then reporting you can actually make a decision from.' },
  { n: '03', title: 'Build something new', glyph: 'build', scene: web, label: 'Web',
    quote: "Whatever we've got online, it doesn't do anything.",
    body: 'Your first site, or the one that finally does the work — booking, ordering, payments, accounts.' },
  { n: '04', title: 'Find the answer', glyph: 'answer', scene: ai[0], label: 'AI — assistant',
    quote: 'The answer is in there somewhere. Nobody can find it.',
    body: 'An assistant that answers from your own documents, and shows you where it got it.' },
  { n: '05', title: 'Reduce mistakes', glyph: 'accuracy', scene: software, label: 'Software',
    quote: "Nothing catches a mistake until it's too late to fix.",
    body: 'An internal tool that runs the process, with the checks built in rather than remembered.' },
  { n: '06', title: 'Train your team', glyph: 'train', scene: training, label: 'Training & Support',
    quote: 'We paid for the software. People still work the old way.',
    body: 'Sessions built around your actual work, so people leave able to do the thing. Credits for afterwards.' },
]

/* One card. Its own words on one side of a travelling edge, what we would
   build for them on the other. Nothing opens and nothing overlays, so the
   card can say the thing and then show it without leaving the grid. */
function ProblemCard({ c, i, open, onOpen, onClose, fine }) {
  const card = useRef(null)
  const host = useRef(null)
  useWipe(card, host, c.scene, open)

  /* Under a mouse the card is not a control — it reveals on hover, and
     announcing it as a button would promise an activation that does
     nothing. Under a finger it genuinely is one. */
  const press = fine ? {} : {
    role: 'button',
    tabIndex: 0,
    'aria-expanded': open,
    onClick: () => (open ? onClose() : onOpen(i)),
    onKeyDown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      return open ? onClose() : onOpen(i)
    },
  }
  const hover = fine ? {
    tabIndex: 0,
    onMouseEnter: () => onOpen(i),
    onMouseLeave: onClose,
    onFocus: () => onOpen(i),      // keyboard gets the same reveal
    onBlur: onClose,
  } : {}

  return (
    <EdgeCard ref={card} className="card-pad problem" {...hover} {...press}>
      {/* clipping hides the face from the eye, not from a screen reader, so
          the card still reads as the sentence it is */}
      <div className="problem__face">
        <div className="problem__head">
          <span className="problem__num">{c.n}</span>
          <CategoryGlyph kind={c.glyph} />
        </div>
        <span className="problem__label">{c.title}</span>
        <h3 className="problem__quote">&ldquo;{c.quote}&rdquo;</h3>
        <p className="problem__body">{c.body}</p>
      </div>
      <div className="problem__scene" aria-hidden="true">
        <div className="problem__stage" ref={host} />
        <div className="problem__tag">
          <span className="problem__cap">{c.label}</span>
          <span className="problem__note">what we would build</span>
        </div>
      </div>
      <span className="problem__edge" aria-hidden="true" />
    </EdgeCard>
  )
}

export default function Problems() {
  /* Only ever one card open. Under a mouse that falls out of mouseleave;
     under a finger it has to be said, or six presses leave six cards open. */
  const [open, setOpen] = useState(-1)
  const fine = useFinePointer()
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
              <ProblemCard
                c={c} i={i} fine={fine}
                open={open === i}
                onOpen={setOpen}
                onClose={() => setOpen(-1)}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
