"""
The AI reel: two AI services in 36 seconds, cut to music with no voice.

Made in the style of a product reel for Opal (by mc-visuals): one continuous
virtual camera over a dark stage, a soft light from above, glowing
interface pieces that morph into each other through light, heavy
depth-of-field and blur-in, every cut on a kick. The analysis is in
SCRIPT.md; the animation is scenes.js; the music is audio.py's "reel".
"""

TITLE = "n.abl · AI that works"
COVER = 20.9          # seconds: the frame the cover images are taken from (the objection)

BPM = 117.465         # the music's tempo: every cut lands on its beat
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
# camera swings round to the agent's answer. The co-pilot and the name each
# start on a bar of the music.
SCENES = [
    dict(id="chat",   beats=n(9),    lines=[]),   # a voice note asks for Friday at 2; the agent answers and books it
    dict(id="book",   beats=n(7),    lines=[]),   # the booking becomes a point of light, then the booking, deposit and reminder
    dict(id="notify", beats=n(5),    lines=[]),   # the owner's phone: the new booking lands, and the calendar
    dict(id="phone",  beats=n(19),   lines=[]),   # a customer rings about an order; the agent answers, with its status
    dict(id="call",   beats=n(13),   lines=[]),   # the co-pilot drops into a call, transcribes, translates, flags an objection
    dict(id="coach",  beats=n(9),    lines=[]),   # pull out to its sidebar: the playbook and what to say next
    dict(id="cta",    beats=n(3, 3), lines=[]),   # the button, pressed on the beat
    dict(id="logo",   beats=n(7),    lines=[]),   # the wordmark blurs in; the address; out
]

MUSIC = "file"
# dark-melodic-reel: the melodic techno take from Lyria RealTime (lyria.py), in
# D minor at 117.465 BPM, bars from 0.032 s. Its first 8.2 s as made (the drop
# bar at 4.118 s lands on the reel's drop; the drums drop out from 6.2 s),
# then the riff bar again as a second drop on the bar at 8.205 s, then the
# same take made again from the same seed with the same instruments, arranged
# to the reel (musicedit.py; plans/melodic-reel-v5d.json): the groove through
# the notification and the order call and on into the co-pilot, a tense bar
# for the objection, the peak for what to say next, and the intro's pads
# under the name.
MUSIC_FILE, MUSIC_AT = "dark-melodic-reel.wav", 4.1183
MUSIC_DROPS = [8.2047]
SFX_TRIM = {}
# the effects sit under the music, drowned: SFX_DROWN is the low-pass, the
# wobble and the dark room every effect goes through
MUSIC_GAIN, SFX_GAIN = 0.42, 0.62
SFX_DROWN = dict(cut=2200, wobble=0.003, room=0.35)
