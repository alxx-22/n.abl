"""
Websites that work: the web service film.

Smart web apps, landing pages and booking systems. The script, the voice and
the music's shape: vo.py reads the first half, audio.py the second. The brief
and the shot list are in SCRIPT.md; the animation is scenes.js.
"""

TITLE = "n.abl · Websites that work"
COVER = 5.3           # seconds: the frame the cover images are taken from

# The same voice as the AI film: British English, and the liveliest read of
# the British voices (about twice their pitch movement).
VOICE, LANG, SPEED = "bm_fable", "en-gb", 1.2
SHORT_SPEED = 1.36

BPM = 144           # an upbeat pop tempo, faster than the AI film's 124
BEAT = 60 / BPM

# The name is spoken, not spelled. Everything else is read as written.
SAY = {"n.abl": "enable"}

# lead: time from the scene's first frame to its first word.
# gap:  pause between two lines inside the scene.
# tail: minimum hold after the last word before the next scene may start.
# snap: lines whose start is pushed onto the next beat, for a hit to land on.
# q:    the grid the scene's end snaps to, in beats.
SCENES = [
    dict(id="sit",     lead=0.35, tail=0.15, q=1, lines=["Most websites just sit there."]),
    dict(id="work",    lead=0.21, tail=0.45, q=1, lines=["Yours should work for a living!"]),
    dict(id="builds",  lead=0.12, tail=0.20, q=0.5, lines=["n.abl builds smart web apps, landing pages, and booking systems."]),
    dict(id="landing", lead=0.20, tail=0.20, q=0.5, lines=["Landing pages that load fast and turn visitors into enquiries."]),
    dict(id="booking", lead=0.20, tail=0.20, q=0.5, lines=["Booking systems that fill your diary, take the deposit, and send the reminders."]),
    dict(id="apps",    lead=0.20, tail=0.25, q=0.5, lines=["And web apps built around how you work: portals, quotes, dashboards."]),
    dict(id="screens", lead=0.12, tail=0.30, q=0.5, lines=["Fast, sharp on every screen, and yours to keep."]),
    dict(id="end",     lead=1.20, tail=2.60, q=1, snap=[0], lines=["n.abl. Let's build yours!"]),
]

# ---- music ---------------------------------------------------------------
# Minimal UK garage and tech house, the sound of current tech launch films:
# swung two-step drums, sub bass, organ stabs on minor-ninth chords and a
# pitched vocal-chop hook (audio.py, build_music_garage). The AI film uses
# the synth arrangement.
MUSIC = "garage"

# Chords by bar, from audio.py's BARS. I-V-vi-IV in D: brighter than the AI
# film's vi-IV-I-V, the same key so the two sit together.
PROG = ["D", "A", "Bm", "G"]


def sections(SC, cue_t, beat, dur):
    """(start, end, kind, chords) on the beat grid. Kinds are audio.py's."""
    import math
    boom = cue_t("impact")[0]                          # "work": the site comes alive
    groove = round(boom / beat) * beat                 # the beat "work" is spoken on
    dot = cue_t("thud")[0]                             # the logo's dot lands
    return [
        (0.0, SC["work"]["start"], "intro", ["Bm", "G"]),
        (SC["work"]["start"], groove, "build", ["A"]),
        (groove, SC["apps"]["start"], "main", PROG),
        (SC["apps"]["start"], SC["end"]["start"], "main2", PROG),
        (SC["end"]["start"], dot, "lift", ["A"]),
        (dot, dur, "resolve", ["D", "D", "D", "D"]),
    ]
