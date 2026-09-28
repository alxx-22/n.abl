"""
The AI reel: three AI services in 17 seconds, cut to music with no voice.

Made in the style of a product reel for Opal (by mc-visuals): one continuous
virtual camera over a dark stage, a soft light from above, glowing
interface pieces that morph into each other through light, heavy
depth-of-field and blur-in, every cut on a kick. The analysis is in
SCRIPT.md; the animation is scenes.js; the music is audio.py's "reel".
"""

TITLE = "n.abl · AI that works"
COVER = 6.9           # seconds: the frame the cover images are taken from

BPM = 132             # the reference's tempo, near enough (132.5)
BEAT = 60 / BPM

# No voice: every shot is a fixed number of beats. The lines stay empty.
VOICE_PROVIDER = "none"
VOICE, LANG, SPEED, SHORT_SPEED = "bm_fable", "en-gb", 1.2, 1.36
SAY = {"n.abl": "enable"}

# beats: the shot's length on the grid. The drop lands 3 beats in, as the
# first shot tilts up to face the camera.
SCENES = [
    dict(id="chat",  beats=5, lines=[]),   # a chat and a call lying flat, tilting up: the voice is understood
    dict(id="book",  beats=5, lines=[]),   # a point of light becomes the booking, then the confirmation and reminder
    dict(id="call",  beats=6, lines=[]),   # the co-pilot joins a call, transcribes, translates, spots an objection
    dict(id="coach", beats=3, lines=[]),   # pull out to its sidebar: the playbook and what to say next
    dict(id="docs",  beats=8, lines=[]),   # any document read, scanned and broken into what matters
    dict(id="cta",   beats=2, lines=[]),   # the button, pressed on the beat
    dict(id="logo",  beats=9, lines=[]),   # the wordmark blurs in; the address; out
]

MUSIC = "reel"
# D minor: i, VI, III, VII, two beats each after the drop
PROG = ["Dm9", "Bbmaj7", "Fmaj7", "C6"]
SFX_TRIM = {}
