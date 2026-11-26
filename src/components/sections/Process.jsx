import { Reveal } from '../ui/index.jsx'
import { WipeGrid } from '../WipeCard.jsx'
import { listen, map, buildIt, launch, improve } from '../film/cards.js'
import { Chapter } from '../Journey.jsx'

/* ============================================================
   04 — HOW WE WORK

   Listening is still the first step: the positioning rests on it, and it
   is the one that means the visitor never has to arrive knowing what
   they need. What changed is the end. The old last step was "hand over,
   then get out of the way"; AI is not something you hand over and leave.
   Models change, the business changes, and the work should keep getting
   better, so the last step is the monthly partnership the pricing
   section below describes.
   ============================================================ */
/* Each step's line icon, drawn in a hairline circle on its card, the way the
   scenes draw theirs: one hairline weight, no fills. */
const ICONS = {
  // a conversation, and the sound of it
  listen: <><path d="M4 6.6A2.6 2.6 0 0 1 6.6 4h10.8A2.6 2.6 0 0 1 20 6.6v6.8a2.6 2.6 0 0 1-2.6 2.6H10.5L6.5 20v-4H6.6A2.6 2.6 0 0 1 4 13.4z" /><path d="M9 8.6v2.8M12 7.4v5.2M15 8.6v2.8" /></>,
  // the way the work runs today: points joined up
  map: <><circle cx="6" cy="6" r="2.1" /><circle cx="18" cy="12" r="2.1" /><circle cx="6" cy="18" r="2.1" /><path d="M8 6.9l8 4.2M16 12.9l-8 4.2" /></>,
  // set to your process and your tone
  build: <><path d="M4 6.5h9M17.5 6.5H20M4 12h3.5M11.5 12H20M4 17.5h11M19 17.5h1" /><circle cx="15.3" cy="6.5" r="2" /><circle cx="9.5" cy="12" r="2" /><circle cx="17" cy="17.5" r="2" /></>,
  // switched on
  launch: <><rect x="3" y="7.2" width="18" height="9.6" rx="4.8" /><circle cx="16.2" cy="12" r="2.7" /></>,
  // and kept running
  improve: <><path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3M4.5 12a7.5 7.5 0 0 1 12.8-5.3" /><path d="M17.6 3.4v3.4h-3.4M6.4 20.6v-3.4h3.4" /></>,
}
function StepIcon({ kind }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICONS[kind]}</svg>
  )
}

export const STEPS = [
  { n: '01', title: 'Listen', scene: listen, icon: 'listen', label: 'Discovery call',
    body: 'Tell us where the time goes, and what slips through the cracks.' },
  { n: '02', title: 'Map', scene: map, icon: 'map', label: 'Process map',
    body: 'We look at how the work happens today: the calls, the inbox, the paperwork and the systems around them.' },
  { n: '03', title: 'Build around you', scene: buildIt, icon: 'build', label: 'Build and test',
    body: 'We design the AI to fit your process and your tone, test it on your real cases, and agree the checks it has to pass.' },
  { n: '04', title: 'Launch', scene: launch, icon: 'launch', label: 'Go live',
    body: 'It goes live alongside your team, with a person in the loop until you trust it.' },
  { n: '05', title: 'Run and improve', scene: improve, icon: 'improve', label: 'Every month',
    body: 'Every month we look after it, tune it and add to it. You get a report, and time with us.' },
].map((s) => ({
  ...s,
  note: 'what happens',
  /* The step card's own front, in the brand's card language: the step's
     number in Thin, its line icon in a hairline circle, the title and the
     words, and at the foot what the card turns over to show. The line along
     the top of the five cards is the journey, warm at the first step and
     cool at the last (home.css, Steps). */
  face: (
    <>
      <div className="step__head">
        <span className="step__num">{s.n}</span>
        <span className="step__icon"><StepIcon kind={s.icon} /></span>
      </div>
      <h3 className="step__title">{s.title}</h3>
      <p className="step__body">{s.body}</p>
      <span className="step__peek">
        <span className="step__peek-label">{s.label}</span>
        <svg className="step__peek-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M5 12h13M13 7l5 5-5 5" />
        </svg>
      </span>
    </>
  ),
}))

export default function Process() {
  return (
    <section id="how-we-work" className="section section--alt">
      <div className="shell">
        <Chapter index={2}>How we work</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">Built around you, then kept running<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            You never have to arrive knowing what you need, or what AI can do. That part is our job.
          </p>
        </Reveal>

        {/* Each step wipes across to what it looks like, like the cards above. */}
        <WipeGrid items={STEPS} className="grid grid--steps" cardClass="step" />
      </div>
    </section>
  )
}
