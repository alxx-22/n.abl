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
# For Gemini the name is written with life in it, so it lifts instead of
# landing flat like the end of a sentence.
GEMINI_SAY = {"n.abl.": "Enable!", "n.abl": "Enable"}

# ---- the read ------------------------------------------------------------
# Gemini TTS reads every line to these notes when a GEMINI_API_KEY is set
# (vo.py); Kokoro, the fallback, cannot be directed and reads them plainly.
VOICE_PROVIDER = "auto"
GEMINI_TTS_MODEL = "gemini-3.8-flash-tts"   # Google's most expressive TTS model (see tts-models.md)
GEMINI_VOICE = "Achird"        # "friendly, approachable, and warm", chosen by ear from Puck, Sadachbia, Achird, Fenrir
# Gemini 3.8: who is speaking is the voice. VOICE_DESIGN describes him for
# voice design (`vo.py --design`), which makes a voice of him to use as
# GEMINI_VOICE: permanent traits only, in a sentence or two, as Google advises.
# Each line then carries only its scene's `style`, a few words of delivery.
VOICE_DESIGN = dict(gender="male", language="en-GB",
                    description="A warm, quick-witted British man in his early thirties from the south of England, "
                                "with a bright, friendly voice that always has a smile in it and a natural, "
                                "conversational delivery.")
# Earlier models (3.1, 2.5) are directed in one prompt instead: PROFILE, SCENE,
# the line's tone and, on lines with the name, NAME_NOTE. Google names such
# long notes as the commonest cause of voice drift on 3.8, so 3.8 never gets them.
PROFILE =("A British man in his thirties from the south of England: the founder of a small studio that "
           "builds websites. Warm, quick and genuinely excited about what he makes, like a friend showing "
           "you something great, not an announcer. A smile in the voice. Natural and conversational, never "
           "shouty, never salesy.")
SCENE = ("A 36-second launch film for social media, cut fast to an upbeat electronic track. He is talking to "
         "small-business owners whose websites do nothing for them. The pace is brisk and the energy lifts "
         "from line to line, with real pauses where the punctuation is.")
NAME_NOTE = ("The name 'Enable' is the company's name and the hero of the line: say it with lift and energy, "
             "bright, rising through the word with a smile, the stress on 'NAY', never flat and never dropping "
             "at the end like the end of a sentence.")

# lead: time from the scene's first frame to its first word.
# gap:  pause between two lines inside the scene.
# tail: minimum hold after the last word before the next scene may start.
# snap: lines whose start is pushed onto the next beat, for a hit to land on.
# q:    the grid the scene's end snaps to, in beats.
# style: the line's delivery for Gemini 3.8, in a few words.
# tone: the director's note for the line, for earlier Gemini models.
# read: the lines as Gemini reads them, with inline expression tags such as
#       <short pause>, which shape the read and are not spoken, and *stress*
#       on a word, which 3.8 gets in capitals (Gemini only).
# land: a word of the line to put on the nearest beat, for the drop to land on.
SCENES = [
    dict(id="sit",     lead=0.35, tail=0.15, q=1, style="dry and wry, a little amused, unhurried",
         tone="Dry and a little amused, almost a shrug. Unhurried. Let 'just sit there' land flat, on purpose.",
         lines=["Most websites just sit there."]),
    dict(id="work",    lead=0.21, tail=0.45, q=1, land="work", style="energy lifting, grinning, confident",
         tone="The turn. The energy lifts, a grin in the voice. Hit 'work' hard, then 'for a living' with a confident smile.",
         lines=["Yours should work for a living!"],
         read=["Yours should *work* for a living!"]),
    dict(id="builds",  lead=0.12, tail=0.20, q=0.5, style="proud and upbeat, with rising momentum",
         read=["*n.abl* builds smart web apps, landing pages, and booking systems."],
         tone="Proud and upbeat, introducing what he makes. Lift on the name, 'Enable': bright and rising through the word, with a smile, like the name of something you love. Then the three things with rising momentum, each a little brighter than the last.",
         lines=["n.abl builds smart web apps, landing pages, and booking systems."]),
    dict(id="landing", lead=0.20, tail=0.20, q=0.5, style="quick, knowing and confident",
         read=["Landing pages that load *fast* and turn visitors into enquiries."],
         tone="Quick, knowing and confident. Lean into 'fast'. Let 'enquiries' land with satisfaction.",
         lines=["Landing pages that load fast and turn visitors into enquiries."]),
    dict(id="booking", lead=0.20, tail=0.20, q=0.5, style="rhythmic, with growing delight",
         tone="Rhythmic, ticking off three things with growing delight: fill your diary, take the deposit, send the reminders.",
         lines=["Booking systems that fill your diary, take the deposit, and send the reminders."]),
    dict(id="apps",    lead=0.20, tail=0.25, q=0.5, style="warm and sincere, then quick and crisp",
         tone="Warm and sincere on 'built around how you work', then quick and crisp on 'portals, quotes, dashboards', like snapping your fingers.",
         lines=["And web apps built around how you work: portals, quotes, dashboards."]),
    dict(id="screens", lead=0.12, tail=0.30, q=0.5, style="crisp and punchy, then soft and reassuring",
         tone="Three crisp, punchy hits: 'fast', 'sharp', 'on every screen'. Then soften, sincere and reassuring, on 'and yours to keep'.",
         lines=["Fast, sharp on every screen, and yours to keep."]),
    dict(id="end",     lead=1.20, tail=2.60, q=1, snap=[0], style="a bright, excited reveal, with a big, genuine smile",
         tone="Announce the name, 'Enable!', like a reveal: bright, lifted and rising through the word, with a smile, never dropping at the end. A short beat. Then 'Let's build yours!' with a big, genuine smile: an invitation, lifting at the end.",
         lines=["n.abl. Let's build yours!"],
         read=["*n.abl.* <short pause> Let's build yours!"]),
]

# ---- music ---------------------------------------------------------------
# Warm French-touch electronica, drum-led: clean punchy drums, a Moog-style
# bass, Rhodes chords, a filtered analog arpeggio and a soft pad
# (audio.py, build_music_electronica). The AI film uses the synth arrangement.
MUSIC = "electronica"
# The biggest effects, turned down for this film so nothing jumps out (dB).
SFX_TRIM = {"impact": -7, "implode": -6, "riser": -5, "shimmer": -7, "thud": -6, "whoosh": -3, "scan": -3, "wipe": -3}

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
