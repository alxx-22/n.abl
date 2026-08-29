/* ============================================================
   SHOW — the punch cut.

   A typed opening line, the six services as one card that keeps
   changing, and an ending that finishes the sentence the opening
   started.

   No pillars. As big single words over a burst they read as a film
   trailer, which is the opposite register to this business. What the
   services do is more persuasive than what the values are called.

   The label alternates below the card and above it, so six beats of the
   same shape never land in the same place twice running.
   ============================================================ */

const S = (id, card, label, above) => ({
  id, dur: 2.2, cam: null, text: null, card, label, above,
})

const SHOW = [
  { id: 'typed', dur: 4.4, cam: null, text: null, type: true,
    head: 'Your team loses a morning a week to work a computer should be doing.',
    turn: 32, at: 0.30, rate: 0.040,
    say: 'Your team loses a morning a week to work a computer should be doing.' },

  S('automation', 'automation', 'Runs itself',        false),
  S('data',       'data',       'Answers, not rows',  true),
  S('web',        'web',        'Books itself',       false),
  S('ai',         'ai',         'Finds the answer',   true),
  S('software',   'software',   'Catches mistakes',   false),
  S('training',   'training',   'And it sticks',      true),

  /* The mark alone in the card, held long enough to register as a
     signature rather than as another service. */
  { id: 'mark', dur: 1.7, cam: null, text: null, card: 'outro',
    say: '(hold on the mark)' },

  /* Then the card shuts and the question it was all leading to arrives
     a word at a time, with the address under it. */
  { id: 'close', dur: 4.6, cam: null, text: null, card: 'outro', collapse: true,
    end: "What's the job that shouldn't need a person?",
    say: "What's the job that shouldn't need a person?" },
]

const VO = { typed: SHOW[0].say }
for (const s of SHOW) if (!s.say) s.say = VO[s.id] || ''
