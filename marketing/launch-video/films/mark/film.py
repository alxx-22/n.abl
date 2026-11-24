"""
The mark reel: n.abl's mark, the n and its square full stop, revealed in
13 seconds, cut to music with no voice.

The full stop is where the energy lives: everything comes out of it and goes
back into it. Motes spiral in out of the dark to one point of light, which
pinches down into the amber square; on the drop the square fires and the n
sets white-hot from its right foot over the shoulder to its left foot. The
rest of the name ignites stroke by stroke, agency falls into focus beside it
and AI AUTOMATION SPECIALISTS decodes in under a line of light. Then it all
burns away into embers that spiral back into the square, which goes off and
settles as the full stop over the address. Drawn by its own WebGL renderer
(gl.js): the mark as exact distance fields, motion-blurred particles with
depth of field, bloom, light shafts and shockwaves. The brief is SCRIPT.md;
the animation is scenes.js.
"""

TITLE = "n.abl · The full stop"
COVER = 8.4           # seconds: the frame the cover images are taken from (the name and the line)

# the track's tempo, measured; the reel is choreographed on it directly
BPM = 120.52
GRID_BPM = BPM
BEAT = 60 / BPM

# No voice: every shot is a fixed number of beats. The lines stay empty.
VOICE_PROVIDER = "none"
VOICE, LANG, SPEED, SHORT_SPEED = "bm_fable", "en-gb", 1.2, 1.36
SAY = {"n.abl": "enable"}

# beats: the shot's length. The point pinches into the square half a beat
# before the drop; a breath; the square fires on the drop. The name starts on
# a bar, the line on the take's brightest section, the outro on its last.
SCENES = [
    dict(id="form", beats=8,  lines=[]),   # motes spiral into a point; it pinches to the square; on the drop the square fires and the n sets
    dict(id="name", beats=11, lines=[]),   # abl ignites stroke by stroke; agency falls into focus; AI AUTOMATION SPECIALISTS decodes in
    dict(id="out",  beats=7,  lines=[]),   # it burns away into the square, which goes off; the full stop and the address
]

# No music: sound design (audio.py's cinematic cues, from the film's own cues
# in scenes.js), none of it synthesised on a note: air moving for a bed,
# whooshes, reverse swells and the hall drawn in backwards before each hit,
# short punchy impacts in a room, crystalline glitter for light, crackle for
# embers, a split-flap board for the type decoding. The Lyria takes in music/
# are kept, unused. The tempo still sets the cuts.
MUSIC = "none"
SFX_TRIM = {}
MUSIC_GAIN, SFX_GAIN = 0.0, 1.0
SFX_DROWN = None          # full range: nothing under water
DROP_CLICK = 0
LOUDNESS = -14.5          # a little under the others, to leave the hits their headroom
CEILING = -3.0            # the limiter's ceiling: the hits' sharp fronts overshoot the AAC encoder by a decibel or so
