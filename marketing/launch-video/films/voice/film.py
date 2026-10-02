"""
The voice reel: n.abl's AI receptionist takes a booking, in 13 seconds, cut
to music with no voice.

The same grammar as the AI reel (films/reel): one continuous virtual camera
over a dark stage, every move on a beat, and one shape that carries the
booking through the reel, changing into each next thing: the ringing call,
the live call, table 12, the guest's text, the dot of the name. One story,
the one a prospect sees in their own demo (demo-products/voice-agent on
voice-agent-DEV): the phone rings and the AI answers, the booking lands on
tonight's floor plan, the guest gets the text. Then the offer: a
personalised demo. Luca's Trattoria is the demo's own sample restaurant, on
a number reserved for drama. The brief is SCRIPT.md; the animation is
scenes.js.
"""

TITLE = "n.abl · Your AI receptionist"
COVER = 6.3           # seconds: the frame the cover images are taken from (table 12, booked)

# the track's tempo, measured; the reel is choreographed on it directly
BPM = 117.28
GRID_BPM = BPM
BEAT = 60 / BPM

# No voice: every shot is a fixed number of beats. The lines stay empty.
VOICE_PROVIDER = "none"
VOICE, LANG, SPEED, SHORT_SPEED = "bm_fable", "en-gb", 1.2, 1.36
SAY = {"n.abl": "enable"}

# beats: the shot's length. The drop lands 3 beats in, as the AI picks up;
# the second drop 11 beats in, as table 12 lights up.
SCENES = [
    dict(id="call", beats=8, lines=[]),   # the phone rings; the AI answers and books a table for four; the call folds into the booking
    dict(id="plan", beats=5, lines=[]),   # the booking flies down onto tonight's floor plan: table 12, on the terrace
    dict(id="text", beats=4, lines=[]),   # the guest's phone: the confirmation lands
    dict(id="end",  beats=8, lines=[]),   # the name on the hit; book your personalised demo, rolling over to nabl.agency 4 beats in
]

MUSIC = "file"
# its own track (films/voice/music), dark melodic house in D minor, cut once
# inside the breath before the name so the name lands on the chord change
# (musicedit.py; the recipe is beside the take): the drop as the AI picks up,
# the drums thinning while the call plays, back in as the booking flies, the
# second drop as table 12 lights up, a breath, and the name on the move to F
MUSIC_FILE, MUSIC_AT = "fresh-melodic-1-edit.wav", 3.8636
MUSIC_DROPS = [7.9563]
SFX_TRIM = {}
# the effects sit under the music, drowned, as in the AI reel; the water
# drops keep a dry click on their front, so they cut through
MUSIC_GAIN, SFX_GAIN = 0.42, 0.62
SFX_DROWN = dict(cut=2200, wobble=0.003, room=0.35)
DROP_CLICK = 0.6
