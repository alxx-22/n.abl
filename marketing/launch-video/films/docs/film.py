"""
The docs reel: n.abl's Document AI, in 16 seconds, cut to a supplied track
with no voice.

Problem, then answer, every move on a hit of the track. The problem is the
tedium, not the volume: one document, and the dozens of fields finance,
legal and ops each need from it, typed in one at a time. One document: 47
fields stack up on the plucks; in the track's silence a VAT number is typed a
key at a time, One. At. A. Time.; the plucks come back as Copy. Paste. Check.
Repeat., over and over. The three build hits flash n.abl Document AI in and
out. On the drop the same form fills itself, every field; it goes to finance
and legal; 47 fields, none typed. Then the name, held. In the 2026-11 brand:
Manjari, the lit ground, ember for the problem, amber for n.abl, ice for the
AI at work. The brief is SCRIPT.md; the animation is scenes.js.
"""

TITLE = "n.abl · Document AI"
COVER = 14.6          # seconds: the frame the cover images are taken from (the name, the line, the address)

# the track's tempo, measured: its first beat is 0.304 s in, a beat every 0.5405 s
BPM = 111.0
GRID_BPM = BPM
BEAT = 60 / BPM

# No voice: every shot is a fixed number of beats. The first runs from 0 to
# the track's beat 5.5 (it starts 0.304 s, 0.5625 of a beat, before beat 0),
# so every later cut lands on the track's own grid. The track: plucks on the
# half beats from 0.33 s; silence from 3.3 s to 4.39 s (beats 5.5 to 7.5);
# the plucks again; three loud hits, kick and hat, on beats 12.5, 13 and
# 13.5 (7.06, 7.33, 7.60 s); the drop on beat 14 (7.87 s), then a kick on
# every beat and a clap on every other, and a new phrase on beat 22 (12.2 s).
VOICE_PROVIDER = "none"
VOICE, LANG, SPEED, SHORT_SPEED = "bm_fable", "en-gb", 1.2, 1.36
SAY = {"n.abl": "enable"}
SCENES = [
    dict(id="fields", beats=6.0625, lines=[]), # One document. 47 fields to fill: the form stacks up on the plucks, Finance, Legal, Ops
    dict(id="type",  beats=2, lines=[]),       # the silence: a VAT number typed a key at a time; One. At. A. Time., a word a key
    dict(id="loop",  beats=5, lines=[]),       # Copy. Paste. Check. Repeat., a word a pluck, then the line again and again
    dict(id="flash", beats=1.5, lines=[]),     # the three build hits: n.abl Document AI, flashed in and out on each
    dict(id="fix",   beats=8, lines=[]),       # the drop: the same form fills itself; every field, filled; sent to finance and legal; 47 fields, none typed
    dict(id="end",   beats=7.04, lines=[]),    # n.abl, Document AI, Paperwork, read and filed., the address, held
]

# the supplied track, played as it is from its start (films/docs/music)
MUSIC = "track"
MUSIC_FILE, MUSIC_AT, MUSIC_TAIL = "track.wav", 0.0, 0.5
SFX_TRIM = {}
MUSIC_GAIN, SFX_GAIN = 0.5, 0.32       # the sounds sit under the track, except the keys in its silence
SFX_DROWN = None
DROP_CLICK = 0.4

CEILING = -3.0            # the limiter: the track is mastered hot, and its fronts overshoot the AAC encoder
