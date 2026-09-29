"""
Put AI to work: the AI service film.

The script, the voice and the music's shape. vo.py reads the first half,
audio.py the second. The brief and the shot list are in SCRIPT.md; the
animation is scenes.js.
"""

TITLE = "n.abl · Put AI to work"
COVER = 4.8           # seconds: the frame the cover images are taken from

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
# The same man as the web film.
VOICE_DESIGN = dict(gender="male", language="en-GB",
                    description="A warm, quick-witted British man in his early thirties from the south of England, "
                                "with a bright, friendly voice that always has a smile in it and a natural, "
                                "conversational delivery.")
# Earlier models (3.1, 2.5) are directed in one prompt instead: PROFILE, SCENE,
# the line's tone and, on lines with the name, NAME_NOTE. Google names such
# long notes as the commonest cause of voice drift on 3.8, so 3.8 never gets them.
PROFILE =("A British man in his thirties from the south of England: the founder of a small studio that "
           "builds AI into businesses. Warm, quick and genuinely excited about what AI can now do, like a "
           "friend telling you something big, not an announcer. A smile in the voice. Natural and "
           "conversational, never shouty, never salesy.")
SCENE = ("A 37-second launch film for social media about the AI service, cut fast to a driving electronic "
         "track. He is talking to small-business owners. Brisk and energetic, with real pauses where the "
         "punctuation is.")
NAME_NOTE = ("The name 'Enable' is the company's name and the hero of the line: say it with lift and energy, "
             "bright, rising through the word with a smile, the stress on 'NAY', never flat and never dropping "
             "at the end like the end of a sentence.")

# lead: time from the scene's first frame to its first word.
# gap:  pause between two lines inside the scene.
# tail: minimum hold after the last word before the next scene may start.
# snap: lines whose start is pushed onto the next beat, for a hit to land on.
# q:    the grid the scene's end snaps to, in beats. Half beats keep it moving.
# style: the line's delivery for Gemini 3.8, in a few words.
# tone: the director's note for the line, for earlier Gemini models.
# read: the lines as Gemini reads them, with inline expression tags such as
#       <short pause>, which shape the read and are not spoken, and *stress*
#       on a word, which 3.8 gets in capitals (Gemini only).
# land: a word of the line to put on the nearest beat, for the drop to land on.
# joint: scenes that share one are a single sentence across several shots;
#       Gemini reads it in one go, as one sentence, and vo.py cuts it into
#       its shots (Gemini only).
SCENES = [
    dict(id="boot",  lead=0.30, tail=0.10, q=1, style="big news, a little awed, building",
         tone="Big news, a little awed, like telling a friend something huge. Build through the line and lean into 'new operating system'.",
         lines=["The world just got a new operating system."]),
    dict(id="ai",    lead=0.12, tail=0.30, q=1, land="ai", style="excited and punchy, grinning",
         tone="The reveal. Excited and punchy, with a grin. Hit 'AI' hard.",
         lines=["It's called AI!"]),
    dict(id="into",  lead=0.10, tail=0.12, q=0.5, style="proud and confident, warm",
         read=["And *n.abl* builds it into your business."],
         tone="Proud and confident. Lift on the name, 'Enable': bright and rising through the word, with a smile. Then 'into your business' warm and direct, to the listener.",
         lines=["And n.abl builds it into your business."]),
    dict(id="book",  lead=0.18, tail=0.05, q=0.5, joint="agents", style="upbeat and practical",
         tone="Upbeat and practical, the start of a list: quick, with the list still going at the end.",
         lines=["Customer agents that book appointments,"]),
    dict(id="faq",   lead=0.10, tail=0.05, q=0.5, joint="agents", style="light and easy, with a little smile",
         tone="Keep the list moving, light and easy. 'Day or night' with a little smile.",
         lines=["answer questions, day or night,"]),
    dict(id="care",  lead=0.10, tail=0.15, q=0.5, joint="agents", style="calm, reassuring and in control",
         tone="Reassuring and a touch knowing. 'Before they escalate' calm and in control.",
         lines=["and handle complaints before they escalate."]),
    dict(id="wall",  lead=0.20, tail=0.15, q=0.5, style="fast and fun, with growing delight",
         tone="Fast and fun, rattling off four jobs with growing delight, each a little brighter, landing 'chases every lead' with a grin.",
         lines=["Plus AI that reads your paperwork, sorts your inbox, drafts your replies, and chases every lead."]),
    dict(id="gains", lead=0.12, tail=0.15, q=0.5, style="crisp and punchy, satisfied",
         tone="Three crisp, punchy hits, each with its own beat. Satisfied.",
         lines=["Less admin. Faster answers. Happier customers."]),
    dict(id="yours", lead=0.10, tail=0.15, q=0.5, style="sincere and warm, then soft and reassuring",
         tone="Sincere and warm. 'Built for your business' steady; 'Yours to keep' softer and reassuring.",
         lines=["Built for your business. Yours to keep."]),
    dict(id="end",   lead=1.20, tail=2.60, q=1, snap=[0], style="warm and proud, a clear 'Enable', then energy and a big smile",
         tone="Announce the name, 'Enable!', like a reveal: bright, lifted and rising through the word, with a smile, never dropping at the end. A short beat. Then 'Put AI to work!' with energy and a big smile, lifting at the end.",
         lines=["n.abl. Put AI to work!"],
         read=["n.abl, <short pause> put AI to work!"]),
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
