"""
The docs reel: n.abl's Document AI, in 16 seconds, cut to a supplied track
with no voice.

Problem, then answer, every move on a hit of the track. Up to the build it is
the problem, exaggerated: Monday, 9am, and the paperwork piles up on every
pluck; in the track's silence one supplier's name is typed in by hand, a key
at a time; the plucks come back and the week flips past, a whole week gone.
The three build hits flash n.abl Document AI in and out. On the drop it is
Monday, 9am again: the pile goes in, is read, checked and filed, and it is
all done by 9:02. Then the name, held. In the site's own brand: espresso,
cream, the amber of the square full stop. The brief is SCRIPT.md; the
animation is scenes.js.
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
    dict(id="pile",  beats=6.0625, lines=[]),  # Monday, 9am. The paperwork lands on every pluck and piles up past the frame
    dict(id="type",  beats=2, lines=[]),       # the silence: one supplier's name typed in by hand, a key at a time. Invoice 1 of 500
    dict(id="week",  beats=5, lines=[]),       # the days flip on the plucks; a whole week, gone
    dict(id="flash", beats=1.5, lines=[]),     # the three build hits: n.abl Document AI, flashed in and out on each
    dict(id="fix",   beats=8, lines=[]),       # the drop: Monday, 9am again. The pile goes in; read, checked, filed; done by 9:02
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
