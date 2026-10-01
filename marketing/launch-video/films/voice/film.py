"""
The voice reel: n.abl's AI receptionist takes a booking, in 11 seconds, cut
to music with no voice.

The same grammar as the AI reel (films/reel): one continuous virtual camera
over a dark stage, glowing interface pieces that turn into each other
through light, every move on a beat. One story, the one a prospect sees in
their own demo (demo-products/voice-agent on voice-agent-DEV): the phone
rings and the AI answers, the booking lands on tonight's floor plan, the
guest gets the text. Then the offer: a personalised demo. Luca's Trattoria is
the demo's own sample restaurant, on a number reserved for drama. The brief
is SCRIPT.md; the animation is scenes.js.
"""

TITLE = "n.abl · Your AI receptionist"
COVER = 6.1           # seconds: the frame the cover images are taken from (table 12, booked)

# the melodic track's tempo; the reel is choreographed on it directly
BPM = 117.465
GRID_BPM = BPM
BEAT = 60 / BPM

# No voice: every shot is a fixed number of beats. The lines stay empty.
VOICE_PROVIDER = "none"
VOICE, LANG, SPEED, SHORT_SPEED = "bm_fable", "en-gb", 1.2, 1.36
SAY = {"n.abl": "enable"}

# beats: the shot's length. The drop lands 3 beats in, as the AI picks up;
# the second drop 11 beats in, as table 12 lights up.
SCENES = [
    dict(id="call", beats=8, lines=[]),   # the restaurant's phone rings; the AI answers and books a table for four
    dict(id="plan", beats=5, lines=[]),   # the booking falls onto tonight's floor plan: table 12, on the terrace
    dict(id="text", beats=4, lines=[]),   # the guest's phone: the confirmation lands
    dict(id="end",  beats=4, lines=[]),   # the name on the hit; book your personalised demo
]

MUSIC = "file"
# the opening of the AI reel's track (films/reel/film.py): the drop as the AI
# picks up, the drums falling away as the booking falls, the second drop as
# table 12 lights up, a breath, and the name on the hit
MUSIC_FILE, MUSIC_AT = "reel/music/dark-melodic-reel.wav", 4.1183
MUSIC_DROPS = [8.2047]
SFX_TRIM = {}
# the effects sit under the music, drowned, as in the AI reel
MUSIC_GAIN, SFX_GAIN = 0.42, 0.62
SFX_DROWN = dict(cut=2200, wobble=0.003, room=0.35)
