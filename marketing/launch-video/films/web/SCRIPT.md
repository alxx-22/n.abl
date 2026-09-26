# Websites that work

A 32-second launch film for n.abl's web builds (smart web apps, landing
pages and booking systems), cut for every social format from one timeline:
16:9, 1:1, 4:5 and 9:16.

Everything in it (the voice, the music, the sound effects and every frame) is
made by the scripts in this folder. The music is composed there and played on
sampled instruments from the GeneralUser GS SoundFont, which is free for
commercial music. No stock footage, stock music or licensed voice is involved.
See [`README.md`](../../README.md) to rebuild it.

---

## 1. The idea

Most small-business websites are a brochure: a page that sits there. The
film opens on exactly that, a wall of grey look-alike websites, all still,
and *0 enquiries this week*. On "Yours" one of them lights up and the camera
dives into it, and on "work" it repaints itself and starts earning: an
enquiry, a booking, a deposit, a reminder, one after another.

Then it names the three things n.abl builds and gives each one a few seconds
of doing its job:

- **Landing pages** load fast and turn visitors into enquiries.
- **Booking systems** fill the diary, take the deposit and send the reminders.
- **Web apps** are built around how the business works: client portals,
  quotes, dashboards.

It closes on the promise every build shares (fast, sharp on every screen,
yours to keep) and the line: **Let's build yours.**

It is the companion to the AI film (`films/ai`): same voice, same key, same
brand system, so the two can run back to back. It runs faster, at 144 BPM
against the AI film's 124, on a band rather than synthesisers.

## 2. Brand notes

- Warm espresso ground, cream light, amber as the accent. The websites in the
  film are cream with amber calls to action, so they read as the thing being
  sold against the dark stage. The sites that "just sit there" are the only
  grey things in it.
- Space Grotesk for display, Inter Tight for interface, JetBrains Mono for
  labels and figures. The self-hosted files from `public/fonts/`.
- The square dot again: the square wipe, and the three devices gathering into
  the dot that the wordmark draws itself around.
- No invented clients, statistics or testimonials. The business in the
  mock-ups is "Your business"; its prices, quotes, dashboard figures and page
  speed score are props in an interface, not claims.
- "Yours to keep" is the site's own hand-over promise: *You own it*
  (`src/components/sections/Process.jsx`).
- The name is voiced "enable".

## 3. Voiceover

Voice: Kokoro `bm_fable` (British English, Apache-2.0 model) at 1.2× speed,
the same read as the AI film.

| # | Shot | Line |
|---|---|---|
| 1 | Sit | Most websites just sit there. |
| 2 | Work | Yours should work for a living! |
| 3 | Builds | n.abl builds smart web apps, landing pages, and booking systems. |
| 4 | Landing | Landing pages that load fast and turn visitors into enquiries. |
| 5 | Booking | Booking systems that fill your diary, take the deposit, and send the reminders. |
| 6 | Apps | And web apps built around how you work: portals, quotes, dashboards. |
| 7 | Screens | Fast, sharp on every screen, and yours to keep. |
| 8 | End | n.abl *(beat)* Let's build yours! |

"Work" is placed on the beat the music drops on.

## 4. Animation script

Each shot starts on a beat; the words on screen carry the story for anyone
watching muted.

**01 · Sit.** A wall of dated websites, dimmed and all alike (image
placeholders, grey headings, grey lines), drifting slowly past the camera.
Nothing on it moves. "Most websites just sit there" writes itself in the
middle, and a tag drops in under it: *0 enquiries this week*. Everything in
the shot is flat and still, so the only motion is the camera's.

**02 · Work.** On "Yours" one site on the wall gets an amber outline, the
line swaps out, and the camera dives into that one until it fills the
browser, while the rest of the wall rushes past and falls away. On "work" an
amber scan line runs down the page and repaints it as a modern site (*Book
in seconds*, *Book now*, *Next free slot · Today 2:00pm*), a bloom and three
rings go off on the drop, and *work* lands in amber with an underline. Four
notifications stack up beside it: *New enquiry*, *Booking confirmed*,
*Deposit paid*, *Reminder sent*. The camera flies through.

**03 · Builds.** The wordmark and *builds*, then three cards flip in, each on
its own word: *Smart web apps* (a dashboard whose bars grow), *Landing pages*
(a hero whose button pulses), *Booking systems* (a calendar filling amber).
Whip pan.

**04 · Landing pages.** A landing page with a quote form, blank and
shimmering until "load": the address bar's progress line runs, the page drops
in section by section, and a *Page speed 100* badge snaps on at "fast". On
"turn visitors into enquiries" a stream of visitors flies in from the edge of
frame, hits *Send enquiry*, turns amber and lands in an *Enquiries* inbox
beside it, which stacks up and counts. Whip pan.

**05 · Booking systems.** A phone and the week's diary. A customer taps
Friday 2:00pm and the same slot fills in the diary, then the rest of the week
fills in a cascade on "fill your diary". The phone slides to *Secure your
slot* and *Pay £20.00* turns to *Paid* on "deposit", then to the lock screen,
where the reminder drops in on "reminders" and every booking in the diary gets
a bell. Whip pan.

**06 · Web apps.** Three app windows appear empty and assemble themselves
from flying pieces while "built around how you work" is said. They swing into
a carousel that turns to each one as it is named: a *Client portal* whose
project steps fill, a *Quote* that totals itself and gets stamped *Accepted*,
a *Dashboard* whose figures count up and whose chart draws. Square wipe.

**07 · Every screen.** A desktop, dark. On "Fast" speed lines streak across and
the site loads in one go; on "sharp" it snaps from soft to crisp with a glint;
on "every screen" the desktop slides aside for a tablet and a phone with the
same site reflowed for each. *Yours to keep.* Then all three devices fall into
a single amber square.

**08 · End card.** That square is the dot. It glides to its place while the
wordmark draws itself around it, and lands on "n.abl" with a hit and a ring.
*Let's build yours*, then *Book a free discovery call · nabl.agency*.

## 5. Sound

- **Music.** An upbeat pop band at 144 BPM in D major, with a bright
  I–V–vi–IV progression, played on sampled acoustic instruments (the
  GeneralUser GS SoundFont) rather than synthesisers:
  - steel-string guitar strumming a sixteenth-note pattern, with down- and
    upstrokes spread across the strings;
  - piano bouncing on the offbeats;
  - picked bass driving eighths with an octave jump at the end of each bar;
  - a live kit stomping four to the floor, hand claps and snare on two and
    four, tambourine and shaker on every sixteenth, and snare or tom fills
    into each four-bar phrase;
  - a whistled four-bar hook, doubled on glockenspiel for the web apps and
    the devices;
  - brass hits on the drop, on the dot and on the last beat.

  Under the grey wall it is just muted guitar, bass, a soft kick, claps and
  tambourine. As the line turns to "Yours" the snare and claps roll and the
  guitar strums up to the drop on "work", where the whole band comes in with
  a brass hit and a crash. Before the logo it strips back to guitar and
  accelerating claps, lands on the dot with the band and a brass hit, plays
  out under "Let's build yours" and stops on one last chord.
- **Effects.** A tick for *0 enquiries*, the dive into "Yours", a riser,
  scan and impact on "work", notification chimes, whip
  pans, card flips, the load zip and tick, blips as visitors convert, taps,
  the deposit hit, the reminder chime, the carousel swishes, the square wipe,
  the gather into the dot, the drawing of the wordmark and the hit when the
  dot lands.
- **Mix.** Music ducks 9 dB under the voice from the script's own timings;
  while anyone is speaking the guitar and piano step back a further 6 dB and
  the hook 10 dB, and both are cut a little around 1 to 2.5 kHz, so the
  consonants stay clear. Between lines the band is at full level. Master
  at −14 LUFS integrated, true peak below −1 dBTP on the delivered AAC.
