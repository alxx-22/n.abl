/* ============================================================
   SHOW — the punch cut. A typed opener, the three pillars as words
   travelling away from you, then the six services as cards.

   22.6s. The shortest of the three, because every beat here is one
   idea and none of them needs explaining.
   ============================================================ */
CARDS.p1 = pillarCard(1, 'Innovation', 'Find better ways to do things.')
CARDS.p2 = pillarCard(2, 'Automation', "Take repetitive work off people's hands.")
CARDS.p3 = pillarCard(3, 'Optimisation', 'Get more from what you already have.')

const SHOW = [
  /* `turn` is the character the colour changes at — the setup stays
     cream, the claim goes amber, without a second line of type. */
  { id: 'typed', dur: 4.6, cam: null, text: null, type: true,
    head: "Your team loses a morning a week to work a computer should be doing.",
    turn: 32, at: 0.30, rate: 0.041,
    say: 'Your team loses a morning a week to work a computer should be doing.' },

  { id: 'innovate', dur: 2.0, cam: null, text: null, word: 'Innovate',
    from: 2.4, to: 0.74, say: 'Innovation.' },
  { id: 'automate', dur: 2.0, cam: null, text: null, word: 'Automate',
    from: 2.4, to: 0.74, say: 'Automation.' },
  { id: 'optimise', dur: 2.2, cam: null, text: null, word: 'Optimise',
    from: 2.4, to: 0.74, say: 'Optimisation.' },

  { id: 'automation', dur: 1.5, cam: null, text: null, card: 'automation', say: 'Work that repeats.' },
  { id: 'data',       dur: 1.5, cam: null, text: null, card: 'data',       say: 'Numbers you can decide from.' },
  { id: 'web',        dur: 1.5, cam: null, text: null, card: 'web',        say: 'A site that does the work.' },
  { id: 'ai',         dur: 1.5, cam: null, text: null, card: 'ai',         say: 'Answers, with the source.' },
  { id: 'software',   dur: 1.5, cam: null, text: null, card: 'software',   say: 'Checks built in.' },
  { id: 'training',   dur: 1.5, cam: null, text: null, card: 'training',   say: 'Your work, not the manual.' },

  { id: 'outro', dur: 2.8, cam: null, text: null, card: 'outro',
    say: "What's the job that shouldn't need a person?" },
]
