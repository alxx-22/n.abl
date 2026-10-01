# Your AI receptionist: the short reel

An 11-second reel (10.7 s) about one thing: n.abl's AI receptionist taking a
booking. Cut to music with no voice, in every social format from one
timeline: 16:9, 1:1, 4:5 and 9:16. It ends on an offer, a personalised demo.
It uses the grammar, the kit (`film/kit.js`) and the opening of the music of
the AI reel ([`films/reel/SCRIPT.md`](../reel/SCRIPT.md)).

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
interface, colour only for meaning (amber for n.abl, ice blue for listening),
one continuous 3D camera with motion blur from its own speed, specks of light
at every depth, pieces that blur in and turn into each other through light.
The chapter title for the first three seconds and a short caption for each
step, as before.

The tempo is the music's, 117.5 BPM; every cut lands on its beat.

| Time | Shot | What happens | Camera |
|---|---|---|---|
| 0.00 | **Call** | *Luca's Trattoria · Reservations* is ringing. On the drop (1.53 s) the AI picks up (*n.abl AI answered*). The caller: *"Table for four, Friday at half seven?"* The AI: *Booked: Friday, 7:30, four of you, on the terrace.* The answer glows, flares white and becomes a point of light. | Swings in from a low angle to the ringing call, round to face it on the drop, pushes in down the conversation. |
| 4.09 | **Plan** | Tonight's floor plan (*Friday · 7:30 pm*), lying almost flat: the room inside, the bar, the terrace dashed in amber, its tables drawing in across it, some already booked. The point falls out of the dark; on the second drop (5.62 s) it lands on table 12, which lights up amber with a ring of light: *Table 12 · 4 guests · 7:30 pm*, *Booked by AI*. | Glides over the plan at a steep tilt, follows the point down, tilts up to face table 12 on the drop, then whips right. |
| 6.64 | **Text** | The guest's phone. *Luca's Trattoria: Booked: Fri 7:30 pm, 4 people, terrace. Ref KX4Q7. To change it, call us and quote your reference.* drops in. | Arrives out of the whip, settles on the message. |
| 8.68 | **Name** | The wordmark blurs in on the hit. *An AI receptionist, built for your business.* Then *Book your personalised demo*, a light across it, and *nabl.agency*. | Eases back as it settles. |

Captions: *Never miss a booking* (title), *Answers every call*, *Books the
table*, *Puts it on your floor plan*, *Texts your guest*.

All names, numbers and references are props: *Luca's Trattoria*, *KX4Q7*,
the phone number.

## 3. Sound

**Music**: the first 13.6 seconds of the AI reel's track (`MUSIC_FILE` in
`film.py` names it in `films/reel/music`), placed so its drops fall on this
reel's moments:
- **Before the drop:** pads and a drone; the kick and bass held back.
- **The drop** (1.53 s): the groove and the riff, as the AI picks up.
- **The drums fall away** as the booking falls onto the plan, and **come back
  in with the riff** on the second drop (5.62 s), as table 12 lights up, with
  a rush of air into it and a low hit.
- **A breath** before the name, then a low hit under it, the track thinning
  out under the offer.

**Effects**, drowned as in the AI reel (a low-pass at 2.2 kHz, a slow waver
in pitch, a short dark room): a soft double ring, a two-tone connect as the
AI picks up, typing for the question, bubbles under the dots, the arrival
and a chime for the booking, a deep bubble as the answer flares into a point,
a falling tone and a water drop as it lands on table 12 with a chime, a swish
for the tag, the arrival of the text, and an impact and shimmer for the name.

**Mix**: the music about 1 dB over the effects; −14 LUFS integrated, true
peak below −1 dBTP on the delivered AAC.

## 4. Delivery

Rendered at twice the size, like the AI reel: each format at its usual size
(scaled down from the large frames) and as `-4k`; H.264 High, 60 fps, AAC
256k.
