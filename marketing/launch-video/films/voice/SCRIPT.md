# Your AI receptionist: the short reel

An 11-second reel (10.7 s) about one thing: n.abl's AI receptionist taking a
booking. Cut to music with no voice, in every social format from one
timeline: 16:9, 1:1, 4:5 and 9:16. It ends on an offer, a personalised demo.
It uses the grammar and the kit (`film/kit.js`) of the AI reel
([`films/reel/SCRIPT.md`](../reel/SCRIPT.md)), with its own track and its
own opening.

## 1. Why this theme

Three were on the table: a part of the AI services, the new demo platform
(`demo-products/` on `voice-agent-DEV`), or the voice agent for bookings with
a personalised demo at the end. The voice agent wins, and the demo platform
is the ending rather than the subject:

- **One idea fits 11 seconds.** "The phone rings, the AI books the table,
  the guest gets the text" reads at a glance. "A platform where you build your
  business and then ring it" is two ideas.
- **The demo platform is not public yet.** It is built and tested but not
  deployed (hosting, DNS and billing on the Gemini key are still to do), only
  the restaurant preset exists, and prospects reach it with a private key the
  team issues. A reel that sent people to try it themselves would promise
  more than it can give today.
- **The reel shows exactly what the demo shows.** The story is the demo's own
  walkthrough (a table for four on Friday at half seven, on the terrace; the
  booking lands on tonight's floor plan; the guest's phone gets the text), so
  what a prospect sees in their demo matches what the reel promised. The
  restaurant is the demo's own sample, Luca's Trattoria, on a number reserved
  for drama (0115 496 0321).
- **The ending sells the demo without promising self-serve access.** "Book
  your personalised demo" fits how the demo works (a private key, set up for
  their business), and leads to a call with the team.

When the demo service is live and has more presets, the platform itself
("try it on your own business in ten minutes") is a strong subject for a reel
of its own.

## 2. The reel

Same grammar as the AI reel: a near-black stage lit from above, cream
interface, colour only for meaning (amber for n.abl, ice blue for the
caller), one continuous 3D camera with motion blur from its own speed,
specks of light at every depth. What is new is how one shot becomes the
next: **one shape carries the booking from the first frame to the last**,
changing into each next thing instead of cutting to it. The ringing call is
a circle; the circle stretches into the live call; the call folds into an
amber block; the block lands as table 12; a copy of it opens into the
guest's text; the text closes to a square, and the square becomes the dot
of the name. The chapter title for the first two and a half seconds and a
short caption for each step, as before.

The tempo is the music's, 117.3 BPM; every move lands on its beat.

| Time | Shot | What happens | Camera |
|---|---|---|---|
| 0.00 | **Call** | One circle of ice-blue light with a phone in it, ringing: ripples go out on each trill. *Luca's Trattoria · Incoming call*. On the drop (1.53 s) the AI answers (*n.abl AI · on the call*): the circle stretches into a wide pill, the live call, its waveform ice blue while the caller speaks, *"Table for four, Friday at half seven?"*, and amber as the AI answers, *Booked. Friday, 7:30, on the terrace.* | Swings round from a low angle to face the circle on the drop, then drifts down with the conversation. |
| 3.58 | **Fold** | The call folds into a small amber block, the shape of a table, with *12* on it; the lines blur away. | Holds on it as it folds. |
| 3.80 | **Plan** | The block flies down the floor in an arc, turning over once, as tonight's floor plan (*Friday · 7:30 pm*) draws in below it: the room, the bar, the terrace dashed in amber, its tables, some already booked. On the second drop (5.63 s) it drops into place as table 12, which lights up with a ring of light: *Table 12 · 4 guests · 7:30 pm*, *Booked by AI*. | Cranes down the floor after it, tilting until the plan lies almost flat, then tilts up to face table 12 on the drop and whips right. |
| 6.65 | **Text** | A copy of the block lifts off with the whip and holds still as the world smears past, lands on the guest's phone and opens into the message: *Luca's Trattoria: Booked: Fri 7:30 pm, 4 people, terrace. Ref KX4Q7. To change it, call us and quote your reference.* In the breath before the name (8.44 s) the message closes back down to a square of amber. | Arrives out of the whip, settles on the message. |
| 8.70 | **Name** | On the hit the square flies up into its place as the dot of the wordmark while the letters draw themselves round it; it clicks in. *An AI receptionist, built for your business.* Then *Book your personalised demo*, a light across it, and *nabl.agency*. | Eases back as it settles. |

Captions: *Never miss a booking* (title), *Answers every call*, *Books the
table*, *Puts it on your floor plan*, *Texts your guest*.

All names, numbers and references are props: *Luca's Trattoria*, *KX4Q7*,
the phone number.

## 3. Sound

**Music**: its own track, dark melodic house in D minor made for this reel
with Lyria RealTime (`films/voice/music/fresh-melodic-1.wav`, its plan in
`music/plans/fresh-melodic.json`; two other takes, a darker tech-house one
and a deep-tech one, are in `out/voice/music-options/lyria`). The take is
cut once, inside the breath before the name, so the name lands on its move
from B♭ to F (`fresh-melodic-1-edit.wav`, cut with `musicedit.py`):
- **Before the drop:** a D minor drone and the first clicks of the
  percussion, the low end held back.
- **The drop** (1.53 s): the bass slides down into B♭ and the groove
  arrives, as the AI picks up. The drums thin out under the conversation, so
  it reads.
- **The second drop** (5.63 s), as table 12 lights up: the bass slides
  again, the clicky percussion at its fullest, with a rush of air into it
  and a low hit.
- **A breath** before the name, then a low hit under it on the chord change,
  the track thinning out under the offer.

**Effects**, drowned as in the AI reel (a low-pass at 2.2 kHz, a slow waver
in pitch, a short dark room), except for the front of every water drop,
which stays dry and bright (`DROP_CLICK`), so each drop clicks through the
mix: a soft double ring, a two-tone connect and a swish as the circle
stretches into the call, typing under the question, three quick drops as
the AI thinks, the arrival and a chime for the booking, a deep bubble and a
flip as the call folds, a rising whoosh for the flight and a falling tone
into the landing, a double drop as it lands on table 12 with a chime, a
swish for the tag, the arrival of the text with a drop, a bubble as it
closes, and an impact, shimmer and a drop as the dot clicks into the name.

**Mix**: the music about 1 dB over the effects; −14 LUFS integrated, true
peak below −1 dBTP on the delivered AAC.

## 4. Delivery

Rendered at twice the size, like the AI reel: each format at its usual size
(scaled down from the large frames) and as `-4k`; H.264 High, 60 fps, AAC
256k.
