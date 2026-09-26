"""
Put AI to work: the AI service film.

The script, the voice and the music's shape. vo.py reads the first half,
audio.py the second. The brief and the shot list are in SCRIPT.md; the
animation is scenes.js.
"""

TITLE = "n.abl · Put AI to work"
COVER = 3.97          # seconds: the frame the cover images are taken from

# bm_fable has about twice the pitch movement of the other British voices
# (interquartile range 7.5 semitones against 3.4 for bf_emma), which is what
# makes a read sound lively rather than level.
VOICE, LANG, SPEED = "bm_fable", "en-gb", 1.2
# Short sentences come out drawn out at the normal rate, so they are read
# faster: the model lengthens a phrase's last word, and in a short phrase
# that is most of it.
SHORT_SPEED = 1.36

BPM = 124
BEAT = 60 / BPM

# The name is spoken, not spelled. Everything else is read as written.
SAY = {"n.abl": "enable"}

# lead: time from the scene's first frame to its first word.
# gap:  pause between two lines inside the scene.
# tail: minimum hold after the last word before the next scene may start.
# snap: lines whose start is pushed onto the next beat, for a hit to land on.
# q:    the grid the scene's end snaps to, in beats. Half beats keep it moving.
SCENES = [
    dict(id="boot",  lead=0.30, tail=0.10, q=1, lines=["The world just got a new operating system."]),
    dict(id="ai",    lead=0.12, tail=0.30, q=1, lines=["It's called AI!"]),
    dict(id="into",  lead=0.10, tail=0.12, q=0.5, lines=["And n.abl builds it into your business."]),
    dict(id="book",  lead=0.18, tail=0.05, q=0.5, lines=["Customer agents that book appointments,"]),
    dict(id="faq",   lead=0.10, tail=0.05, q=0.5, lines=["answer questions, day or night,"]),
    dict(id="care",  lead=0.10, tail=0.15, q=0.5, lines=["and handle complaints before they escalate."]),
    dict(id="wall",  lead=0.20, tail=0.15, q=0.5, lines=["Plus AI that reads your paperwork, sorts your inbox, drafts your replies, and chases every lead."]),
    dict(id="gains", lead=0.12, tail=0.15, q=0.5, lines=["Less admin. Faster answers. Happier customers."]),
    dict(id="yours", lead=0.10, tail=0.15, q=0.5, lines=["Built for your business. Yours to keep."]),
    dict(id="end",   lead=1.20, tail=2.60, q=1, snap=[0], lines=["n.abl. Put AI to work!"]),
]


# ---- music ---------------------------------------------------------------
# Chords by bar, from audio.py's BARS. vi-IV-I-V in D.
PROG = ["Bm", "G", "D", "A"]


def sections(SC, cue_t, beat, dur):
    """(start, end, kind, chords) on the beat grid. Kinds are audio.py's."""
    import math
    boom = cue_t("impact")[0]                          # "AI!": the drop
    groove = math.ceil(boom / beat - 1e-6) * beat      # the groove starts on the next beat
    dot = cue_t("thud")[0]                             # the logo's dot lands
    return [
        (0.0, SC["ai"]["start"], "pulse", ["Bm", "G"]),
        (SC["ai"]["start"], groove, "build", ["A"]),
        (groove, SC["wall"]["start"], "main", PROG),
        (SC["wall"]["start"], SC["yours"]["start"], "main2", PROG),
        (SC["yours"]["start"], SC["end"]["start"], "break", ["G", "A"]),
        (SC["end"]["start"], dot, "lift", ["A"]),
        (dot, dur, "resolve", ["D", "D", "D", "D"]),
    ]
