"""
The mark reel: n.abl's mark, the n and its square full stop, revealed in
13 seconds, cut to music with no voice.

The idea comes from the mark itself (public/brand/mark.svg): the n is one
13-unit stroke, and the full stop is a 13-unit square. Dragged along the
n's path, the square draws the n exactly. So the reel opens on the site's
own headline being typed, AI, built into your business, and ending on its
square full stop; the full stop leaves the sentence and, close up, draws
the n; the camera slams back to reveal the mark as the square drops into
place beside it; a pendant lamp swings in and lights it; and the rest of
the name draws in under the light. The brief and the frame-by-frame study
of the reference are SCRIPT.md; the animation is scenes.js.
"""

TITLE = "n.abl · The full stop"
COVER = 11.8          # seconds: the frame the cover images are taken from (the name, under the lamp)

# the track's tempo, measured; the reel is choreographed on it directly
BPM = 120.52
GRID_BPM = BPM
BEAT = 60 / BPM

# No voice: every shot is a fixed number of beats. The lines stay empty.
VOICE_PROVIDER = "none"
VOICE, LANG, SPEED, SHORT_SPEED = "bm_fable", "en-gb", 1.2, 1.36
SAY = {"n.abl": "enable"}

# beats: the shot's length. The drop lands on the cut into the full stop;
# the second drop on the reveal, after a breath.
SCENES = [
    dict(id="line",  beats=4, lines=[]),   # the headline types out on a cream page and ends on its square full stop
    dict(id="write", beats=8, lines=[]),   # close up, the full stop draws the n; the camera slams back to the mark
    dict(id="light", beats=8, lines=[]),   # a pendant lamp swings in and lights the mark
    dict(id="name",  beats=6, lines=[]),   # the rest of the name draws in under the lamp; the address
]

MUSIC = "file"
MUSIC_FILE, MUSIC_AT = "mark-1.wav", 4.0647
MUSIC_DROPS = []
SFX_TRIM = {}
# the effects sit under the music, drowned, as in the other reels; the
# water drops keep a dry click on their front, so they cut through
MUSIC_GAIN, SFX_GAIN = 0.42, 0.62
SFX_DROWN = dict(cut=2600, wobble=0.002, room=0.3)
DROP_CLICK = 0.6
