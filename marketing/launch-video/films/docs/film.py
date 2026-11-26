"""
The docs reel: n.abl's Document AI, in 20 seconds, cut to 4 to 24 seconds of
a supplied clip's audio, with no voice and no sound but whooshes.

A story, told slowly, then the answer. A delivery arrives in a cream box; its
note goes to the computer, and someone has to type it all in, a letter at a
time; then onto the pile it goes. n.abl Document AI. A cursor picks the pile
up and drops it into Upload documents; one sheet fills, a row a document and
a column a field, in one wave; thousands of documents counted up; the name,
held. The music sits inside the story rather than cutting it: things settle
on plucks, lean in on the build, land on kicks and claps, type on the
sixteenths. In the 2026-11 brand: Manjari, the lit ground, ember for the
problem, amber for n.abl, ice for the AI at work. The brief is SCRIPT.md;
the animation is scenes.js.
"""

TITLE = "n.abl · Document AI"
COVER = 18.6          # seconds: the frame the cover images are taken from (the name, the line, the address)

# the track's tempo, measured: in the supplied clip its first beat is 0.304 s
# in, a beat every 0.5405 s; the film starts 4 s in, so its beats fall at
# 0.304 - 4 + k * BEAT. In the film: plucks on the half beats to 2.8 s, a
# swell at 1.7 s; three build hits at 3.06, 3.33 and 3.60 s; the drop at 3.87 s
# (beat 14), then a kick on every beat and a clap on every other, new phrases
# at 8.2, 12.5 and 16.8 s; at 19.0 s the kick drops out for the last second.
BPM = 111.0
GRID_BPM = BPM
BEAT = 60 / BPM

# No voice: every shot is a fixed number of beats, the first running to the
# drop (beat 14) so every later cut is on the grid.
VOICE_PROVIDER = "none"
VOICE, LANG, SPEED, SHORT_SPEED = "bm_fable", "en-gb", 1.2, 1.36
SAY = {"n.abl": "enable"}
SCENES = [
    dict(id="box",    beats=7.1625, lines=[]),  # a delivery arrives: a cream box drops on the swell and turns a step a pluck; the camera leans in on the build
    dict(id="desk",   beats=5, lines=[]),       # on the drop its note goes to the computer, set down on the clap; someone has to type it all in
    dict(id="stack",  beats=7, lines=[]),       # then onto the stack it goes: it grows on every kick, the camera stepping back and up
    dict(id="upload", beats=4, lines=[]),       # a cursor takes the stack on a clap and carries it, a step an eighth, into Upload documents
    dict(id="sheet",  beats=4, lines=[]),       # one sheet, a row a document and a column a field, a row filled each sixteenth; the rest stream past
    dict(id="count",  beats=3, lines=[]),       # thousands of documents read and filed, a jump each sixteenth, landing on a kick
    dict(id="end",    beats=6.8376, lines=[]),  # the name drawn on the clap, the line a word an eighth, the dot on every kick, still for the breakdown
]

# the supplied track, played as it is from its start (films/docs/music)
MUSIC = "track"
MUSIC_FILE, MUSIC_AT, MUSIC_TAIL = "track20.wav", 0.0, 0.6     # 4 s to 24 s of the supplied clip
SFX_TRIM = {}
MUSIC_GAIN, SFX_GAIN = 0.5, 0.32       # whooshes only, under the track
SFX_DROWN = None
DROP_CLICK = 0.4

LOUDNESS = -14.5          # a little under the other films
CEILING = -3.0            # the limiter: the track is mastered hot, and its fronts overshoot the AAC encoder
