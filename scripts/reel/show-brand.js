/* ============================================================
   SHOW — the brand cut. No camera, and no type outside the card.

   Structured as an iOS Live Activity: one container that morphs. It
   opens as the mark in a compact pill, grows into each of the three
   pillars, becomes each of the six services in turn, and settles back
   down to sign off. The container is continuous throughout — that
   continuity is the idea, and putting headlines around it would break
   the illusion that you are watching one object rather than a deck.

   25.6s. Fast: nothing here waits for a sentence to be spoken, and a
   silent morph reel earns its watch time by never repeating a shape.
   Deliberately short of the 30-40s band, where retention dips.
   ============================================================ */

/* The three pillars are brand architecture, not the service taxonomy —
   see Pillars.jsx. They open because they say what the business is
   like before anything says what it sells. */
CARDS.p1 = pillarCard(1, 'Innovation', 'Find better ways to do things.')
CARDS.p2 = pillarCard(2, 'Automation', "Take repetitive work off people's hands.")
CARDS.p3 = pillarCard(3, 'Optimisation', 'Get more from what you already have.')

const S = (id, dur, card) => ({ id, dur, card, cam: null, text: null })

const SHOW = [
  S('idle',       1.6, 'idle'),
  S('p1',         1.8, 'p1'),
  S('p2',         1.8, 'p2'),
  S('p3',         2.0, 'p3'),
  S('automation', 2.5, 'automation'),
  S('data',       2.5, 'data'),
  S('web',        2.5, 'web'),
  S('ai',         2.5, 'ai'),
  S('software',   2.5, 'software'),
  S('training',   2.5, 'training'),
  S('outro',      3.4, 'outro'),
]

/* Voiceover, if you want one. The cut reads without it. */
const VO = {
  idle: '(let the mark land)',
  p1: 'Innovation. Find better ways to do things.',
  p2: "Automation. Take repetitive work off people's hands.",
  p3: 'Optimisation. Get more from what you already have.',
  automation: 'Work that repeats, set up once and left to run.',
  data: 'Your data cleaned up, then reporting you can decide from.',
  web: 'A site that books, sells and takes the payment.',
  ai: 'Answers from your own documents, with the source.',
  software: 'Checks built into the process, not remembered.',
  training: 'Training on your actual work, not the manual.',
  outro: "What's the job that shouldn't need a person?",
}
for (const s of SHOW) s.say = VO[s.id] || ''
