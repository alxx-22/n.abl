"""
The docs reel: n.abl's Document AI, in 16 seconds, cut to a supplied track
with no voice.

Light and editorial, after a product film the brief supplied for its look:
warm paper, ink type, the product's own interface recreated and driven by a
cursor, one accent (n.abl's amber), and shared shapes carrying one moment
into the next. The story is the site's own line for the service: it reads
invoices, forms and delivery notes, pulls out what matters and files it,
with a person checking anything it is unsure of. The headline is the
site's: Paperwork, read and filed. The brief is SCRIPT.md; the animation is
scenes.js.
"""

TITLE = "n.abl · Document AI"
COVER = 6.3           # seconds: the frame the cover images are taken from (the invoice read, the record matched)

# the track's tempo, measured: its first beat is 0.304 s in, a beat every 0.5405 s
BPM = 111.0
GRID_BPM = BPM
BEAT = 60 / BPM

# No voice: every shot is a fixed number of beats. The first runs to the
# track's fifth beat (it starts 0.304 s before its first), so every later cut
# lands on one. The near-silent beat in the track is the reading pause; the
# drop at 7.33 s is the pull back to the table.
VOICE_PROVIDER = "none"
VOICE, LANG, SPEED, SHORT_SPEED = "bm_fable", "en-gb", 1.2, 1.36
SAY = {"n.abl": "enable"}
SCENES = [
    dict(id="hook",  beats=4.5625, lines=[]),  # Invoices / Delivery notes / Forms / Paperwork, read and filed.
    dict(id="drop",  beats=3, lines=[]),       # three documents dragged in; on the silent beat, Reading 3 documents
    dict(id="read",  beats=6, lines=[]),       # the invoice read, its fields into the record, matched; a person approves the handwritten line
    dict(id="table", beats=4, lines=[]),       # on the drop, pulled back: the record is row one; the rest read and filed
    dict(id="count", beats=5, lines=[]),       # the count of documents read, with files floating past
    dict(id="brand", beats=4, lines=[]),       # the n. drawn a stroke a beat over four backdrops
    dict(id="end",   beats=3.04, lines=[]),    # n.abl, Document AI, Paperwork, read and filed., the address
]

# the supplied track, played as it is from its start (films/docs/music)
MUSIC = "track"
MUSIC_FILE, MUSIC_AT, MUSIC_TAIL = "track.wav", 0.0, 0.5
SFX_TRIM = {}
MUSIC_GAIN, SFX_GAIN = 0.5, 0.32       # the interface sounds sit under the track
SFX_DROWN = None
DROP_CLICK = 0.4

CEILING = -3.0            # the limiter: the track is mastered hot, and its fronts overshoot the AAC encoder
