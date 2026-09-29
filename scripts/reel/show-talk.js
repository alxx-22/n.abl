/* ============================================================
   SHOW — "talk over it". Twelve sections, a camera that moves
   between four framings, 50 seconds.
   ============================================================ */

/* ------------------------------------------------------------------
   THE RUN OF SHOW

   Timed for a 50-second read at roughly three words a second. The
   shape is from what currently works on Reels: a hook that lands
   inside three seconds, a complete visual change every four at the
   outside, and the whole thing sitting in the 45-60s band that
   rewards teaching rather than the 30-40s one that does not.

   `say` is what you say out loud. `head` is what appears on screen.
   They are deliberately not the same words — reading your own caption
   aloud is the tell of a video made from a script rather than by a
   person.
   ------------------------------------------------------------------ */
const SHOW = [
  { id: 'hook', dur: 4.0, cam: FULL, text: 'upper',
    kicker: null,
    head: 'A morning a week',
    say: 'Your team loses a morning a week to work a computer should be doing.' },

  { id: 'problem', dur: 5.2, cam: HALF_B, text: 'upper',
    kicker: 'WHERE IT GOES',
    lines: ['The same order, keyed twice.', 'Timesheets, chased.', "Last month's spreadsheet, rebuilt."],
    say: "Rekeying the same order twice. Chasing timesheets. Rebuilding last month's spreadsheet." },

  { id: 'title', dur: 2.2, cam: null, text: 'centre',
    kicker: 'n.abl',
    head: 'Six things we build',
    say: "Here's what we actually build." },

  { id: 'automation', dur: 3.8, cam: null, scene: 'automation', from: 5.4, text: 'above',
    kicker: '01 · AUTOMATION',
    head: 'Set up once, left running',
    say: 'Work that repeats — set up once, then left to run.' },

  { id: 'data', dur: 3.8, cam: null, scene: 'data', from: 5.6, text: 'above',
    kicker: '02 · DATA',
    head: 'Numbers you can decide from',
    say: 'Your data cleaned up, then reporting you can actually decide from.' },

  { id: 'web', dur: 3.8, cam: null, scene: 'web', from: 5.0, text: 'above',
    kicker: '03 · WEB',
    head: 'A site that does the work',
    say: 'A site that books, sells, and takes the payment.' },

  { id: 'mid', dur: 3.4, cam: HALF_T, text: 'under',
    kicker: null,
    head: 'None of it off the shelf',
    say: "None of it's off the shelf." },

  { id: 'ai', dur: 3.8, cam: null, scene: 'ai', from: 4.8, text: 'above',
    kicker: '04 · AI',
    head: 'The answer, and where it came from',
    say: 'Answers from your own documents — and where they came from.' },

  { id: 'software', dur: 3.8, cam: null, scene: 'software', from: 7.6, text: 'above',
    kicker: '05 · SOFTWARE',
    head: 'Checks built in, not remembered',
    say: 'Checks built into the process, not remembered.' },

  { id: 'training', dur: 3.8, cam: null, scene: 'training', from: 9.8, text: 'above',
    kicker: '06 · TRAINING',
    head: 'Your work, not the manual',
    say: 'Training on your actual work, not the manual.' },

  { id: 'how', dur: 6.0, cam: HALF_B, text: 'upper',
    kicker: 'HOW IT GOES',
    lines: ['Built.', 'Handed over.', 'Explained to your team.'],
    say: "We're in Nottingham. We build it, hand it over, and show your team how to run it." },

  { id: 'cta', dur: 6.4, cam: FULL, text: 'lower',
    kicker: null,
    head: 'nabl.agency',
    sub: "What's the job that shouldn't need a person?",
    say: "If there's a job in your week that shouldn't need a person — that's the one to send me." },
]
