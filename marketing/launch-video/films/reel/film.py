"""
The AI reel: three AI services in 27 seconds, cut to music with no voice.

Made in the style of a product reel for Opal (by mc-visuals): one continuous
virtual camera over a dark stage, a soft light from above, glowing
interface pieces that morph into each other through light, heavy
depth-of-field and blur-in, every cut on a kick. The analysis is in
SCRIPT.md; the animation is scenes.js; the music is audio.py's "reel".
"""

TITLE = "n.abl · AI that works"
COVER = 11.9          # seconds: the frame the cover images are taken from

BPM = 100             # the music's tempo: every cut lands on its beat
GRID_BPM = 124        # the tempo the reel was choreographed on
BEAT = 60 / BPM
# a scene of k beats at GRID_BPM, as whole beats at BPM, so the reel keeps its
# length and pace at any tempo (scenes.js's q() does the same inside a scene)
n = lambda k, least=2: max(least, round(k * BPM / GRID_BPM))

# No voice: every shot is a fixed number of beats. The lines stay empty.
VOICE_PROVIDER = "none"
VOICE, LANG, SPEED, SHORT_SPEED = "bm_fable", "en-gb", 1.2, 1.36
SAY = {"n.abl": "enable"}

# beats: the shot's length on the grid. The drop lands 3 beats in, as the
# camera swings round to the agent's answer.
SCENES = [
    dict(id="chat",  beats=n(9),    lines=[]),   # a voice note asks for Friday at 2; the agent answers and books it
    dict(id="book",  beats=n(7),    lines=[]),   # the booking becomes a point of light, then the booking, deposit and reminder
    dict(id="call",  beats=n(10),   lines=[]),   # the co-pilot drops into a call, transcribes, translates, flags an objection
    dict(id="coach", beats=n(7),    lines=[]),   # pull out to its sidebar: the playbook and what to say next
    dict(id="docs",  beats=n(13),   lines=[]),   # any document riffled, scanned, broken into what matters and scored
    dict(id="cta",   beats=n(3, 3), lines=[]),   # the button, pressed on the beat
    dict(id="logo",  beats=n(7),    lines=[]),   # the wordmark blurs in; the address; out
]

MUSIC = "file"
# dark-trailer-1 from Stable Audio Open (musicgen.py): 100 BPM, D minor. Its
# two-bar phrases start at 0.012 s; the one at 4.812 s lands on the drop
MUSIC_FILE, MUSIC_AT = "dark-trailer-1.wav", 4.812
# D minor, a bar each from the drop: i VI III VII, then i VI VII and V to turn
# round (audio.py's REEL_PROG, with the stab and the hook for each chord)
SFX_TRIM = {}
# the effects sit under the music, drowned: SFX_DROWN is the low-pass, the
# wobble and the dark room every effect goes through
MUSIC_GAIN, SFX_GAIN = 0.42, 0.62
SFX_DROWN = dict(cut=2200, wobble=0.003, room=0.35)
