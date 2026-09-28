"""
Voiceover and timeline.

Synthesises every sentence of a film's script with Kokoro, trims each clip to
its speech, and lays the clips out scene by scene.
Every scene starts on a beat of the music grid, so the cuts land on the beat
and the music can be written to the same timeline afterwards.

The script, the voice and the tempo come from films/<id>/film.py.

  python3 vo.py [--film ai]

Writes:
  build/<id>/vo/NN_M.wav   one clip per sentence, 24 kHz mono, trimmed
  build/<id>/timeline.json scenes, lines, sentences and word timings, in seconds

Word timings are measured. The TTS model does not report durations, so each
clip is run through a speech recogniser that does (NVIDIA Parakeet TDT, via
sherpa-onnx), and its word starts are used. A sentence's first word starts
where its clip does: the recogniser puts its first token early, in the
silence before the speech. If the recogniser is not installed, or does not
hear the same number of words as the script has, the sentence falls back to
an estimate: its speech shared between its words by phoneme count, with the
pauses at commas found in the audio and used as anchors. That estimate ran up
to half a second late, which is why the recogniser is here.

  ALIGNER_DIR  the unpacked sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8 model,
               default build/models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8

Two voices. Kokoro (local, free, no setup) reads the words well but cannot be
directed: it has no control over emotion. Gemini TTS (Google's API, free tier)
takes written direction, so every line is read to the film's director's
notes: PROFILE and SCENE in film.py, and each scene's `tone`. Set in film.py
by VOICE_PROVIDER, or overridden by the environment:

  VOICE_PROVIDER   auto (Gemini when it answers, else Kokoro), gemini, kokoro
  GEMINI_API_KEY   a Google AI Studio key (free tier), for Gemini TTS; or leave
                   it unset and store the key as an API credential on the
                   cloud environment, which attaches it to Gemini's requests
  GEMINI_TTS_MODEL the model, default gemini-2.5-flash-preview-tts

Gemini's reads are kept in films/<id>/voice, named by a hash of the exact
prompt and voice, so a rebuild costs no requests (and needs no key) unless a
line or its direction changes.

  python3 vo.py --film web --fetch-only           fetch and keep Gemini's reads only
  python3 vo.py --film web --audition Puck,Achird two lines in each voice, to choose
"""

import base64, hashlib, importlib.util, json, os, re, sys, time, urllib.error, urllib.request
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
MODELS = os.environ.get("KOKORO_DIR", os.path.join(BUILD, "models"))
SR = 24000

# The film: its script, voice and tempo live in films/<id>/film.py.
#   python3 vo.py [--film ai]
FILM_ID = sys.argv[sys.argv.index("--film") + 1] if "--film" in sys.argv else "ai"
_spec = importlib.util.spec_from_file_location("film", os.path.join(HERE, "films", FILM_ID, "film.py"))
F = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(F)
VOICE, LANG, SPEED, SHORT_SPEED = F.VOICE, F.LANG, F.SPEED, F.SHORT_SPEED
BPM = F.BPM
BEAT = 60 / BPM
SAY, SCENES = F.SAY, F.SCENES
OUT = os.path.join(BUILD, FILM_ID)

GEMINI_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
GEMINI_API = "https://generativelanguage.googleapis.com/v1beta"


def gemini_reachable():
    """True when Gemini answers without a key in this process: the key is an API
    credential on the cloud environment, which its proxy adds to the request."""
    try:
        with urllib.request.urlopen(f"{GEMINI_API}/models?pageSize=1", timeout=10) as r:
            return r.status == 200
    except Exception:
        return False



GEMINI_MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
GEMINI_FALLBACK_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts", "gemini-2.5-flash-tts", "gemini-2.5-pro-tts"]
GEMINI_VOICE = getattr(F, "GEMINI_VOICE", "Puck")

# Silence between sentences inside a line, by the mark that ends the first.
AFTER = {"…": 0.35, ".": 0.18, "?": 0.22, "!": 0.2}
# A run of one-word sentences is a list and is read quickly.
LIST_GAP = 0.14


def beat_ceil(t, q=1):
    return np.ceil(t / (BEAT * q) - 1e-6) * BEAT * q


def sentences(line):
    """Split a line after . … ? ! while keeping the mark on its sentence."""
    parts = re.findall(r"[^.…?!]+[.…?!]+|[^.…?!]+$", line)
    out = []
    for p in parts:
        p = p.strip()
        # "n.abl." is one word, not a sentence break inside a name
        if out and out[-1].endswith("n.") and p.startswith("abl"):
            out[-1] += p
        else:
            out.append(p)
    return [p for p in out if p]


def spoken(text):
    for k, v in SAY.items():
        text = text.replace(k, v)
    return text


def trim(a, thr_db=-36, pre=0.012, post=0.05):
    env = np.abs(a)
    thr = env.max() * 10 ** (thr_db / 20)
    idx = np.where(env > thr)[0]
    s = max(0, idx[0] - int(pre * SR))
    e = min(len(a), idx[-1] + int(post * SR))
    out = a[s:e].copy()
    f = int(0.004 * SR)
    out[:f] *= np.linspace(0, 1, f)
    out[-f:] *= np.linspace(1, 0, f)
    return out


def quiet_runs(a, min_len=0.07, thr_db=-32):
    """Interior pauses in a clip, as (start, end) seconds."""
    fr = int(0.01 * SR)
    n = len(a) // fr
    rms = np.sqrt((a[: n * fr].reshape(n, fr) ** 2).mean(1))
    q = rms < rms.max() * 10 ** (thr_db / 20)
    runs, i = [], 0
    while i < n:
        if q[i]:
            j = i
            while j < n and q[j]:
                j += 1
            if i > 3 and j < n - 3 and (j - i) * 0.01 >= min_len:
                runs.append((i * 0.01, j * 0.01))
            i = j
        else:
            i += 1
    return runs


def word_times(kok, text, clip):
    """Estimate when each word of a sentence starts and ends inside its clip."""
    words = text.split()
    weight = []
    for w in words:
        core = re.sub(r"[^\w'’.-]", "", spoken(w)).strip(".")
        ph = kok.tokenizer.phonemize(core, LANG) if core else ""
        weight.append(max(2, len(ph.replace(" ", ""))))
    dur = len(clip) / SR
    commas = [i for i, w in enumerate(words[:-1]) if w.endswith(",")]
    runs = quiet_runs(clip)
    # anchors: speech segments between the pauses found at commas
    if commas and len(runs) == len(commas):
        bounds = [(0.0, None)] + [(r[0], r[1]) for r in runs] + [(None, dur)]
        groups, start = [], 0
        for c in commas + [len(words) - 1]:
            groups.append(list(range(start, c + 1)))
            start = c + 1
        spans = [(bounds[k][1] if k else 0.0, bounds[k + 1][0] if k + 1 < len(bounds) - 1 else dur)
                 for k in range(len(groups))]
    else:
        groups, spans = [list(range(len(words)))], [(0.0, dur)]
    out = [None] * len(words)
    for g, (s, e) in zip(groups, spans):
        tot = sum(weight[i] for i in g)
        t = s
        for i in g:
            d = (e - s) * weight[i] / tot
            out[i] = dict(w=words[i], start=round(t, 3), end=round(t + d, 3))
            t += d
    return out


ALIGNER = os.environ.get("ALIGNER_DIR", os.path.join(MODELS, "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"))
_rec = None


def recogniser():
    global _rec
    if _rec is None:
        if not os.path.exists(os.path.join(ALIGNER, "encoder.int8.onnx")):
            _rec = False
        else:
            import sherpa_onnx
            _rec = sherpa_onnx.OfflineRecognizer.from_transducer(
                encoder=os.path.join(ALIGNER, "encoder.int8.onnx"), decoder=os.path.join(ALIGNER, "decoder.int8.onnx"),
                joiner=os.path.join(ALIGNER, "joiner.int8.onnx"), tokens=os.path.join(ALIGNER, "tokens.txt"),
                model_type="nemo_transducer", num_threads=4)
    return _rec


def measured_starts(clip):
    """Word start times in a clip, from the recogniser, or None."""
    rec = recogniser()
    if not rec:
        return None
    from scipy.signal import resample_poly
    pad = 0.4
    a = resample_poly(clip, 16000, SR).astype(np.float32)
    a = np.concatenate([np.zeros(int(pad * 16000), np.float32), a, np.zeros(int(0.4 * 16000), np.float32)])
    st = rec.create_stream(); st.accept_waveform(16000, a); rec.decode_stream(st)
    starts = []
    for tok, ts in zip(st.result.tokens, st.result.timestamps):
        if tok.startswith(" ") or not starts:
            starts.append(ts - pad)
    return starts


def word_times_measured(kok, text, clip):
    est = word_times(kok, text, clip)
    got = measured_starts(clip)
    if not got or len(got) != len(est):
        if got is not None:
            print(f"  aligner heard {len(got)} words in {text!r}, script has {len(est)}: estimating")
        return est
    dur = len(clip) / SR
    starts = [0.012] + [max(0.012, min(dur - 0.05, g)) for g in got[1:]]
    # never out of order, never on top of each other
    for i in range(1, len(starts)):
        starts[i] = max(starts[i], starts[i - 1] + 0.06)
    ends = starts[1:] + [dur]
    return [dict(w=e["w"], start=round(s, 3), end=round(n, 3)) for e, s, n in zip(est, starts, ends)]


def gemini_prompt(text, tone):
    """The director's notes and the line, in the shape Gemini TTS is prompted with."""
    return (f"# AUDIO PROFILE\n{F.PROFILE}\n\n## THE SCENE\n{F.SCENE}\n\n"
            f"### DIRECTOR'S NOTES\n{tone}\nRead only the transcript, exactly as written, nothing else.\n\n"
            f"#### TRANSCRIPT\n{text}")


def gemini_request(model, prompt, voice):
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["AUDIO"],
                             "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}},
    }).encode()
    headers = {"Content-Type": "application/json"}
    if GEMINI_KEY:                                          # otherwise the environment's proxy adds it
        headers["x-goog-api-key"] = GEMINI_KEY
    req = urllib.request.Request(f"{GEMINI_API}/models/{model}:generateContent", data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
    rate = int(re.search(r"rate=(\d+)", part.get("mimeType", "")).group(1)) if "rate=" in part.get("mimeType", "") else 24000
    pcm = np.frombuffer(base64.b64decode(part["data"]), dtype="<i2").astype(np.float32) / 32768
    if rate != SR:
        from scipy.signal import resample_poly
        pcm = resample_poly(pcm, SR, rate).astype(np.float32)
    return pcm


# Gemini's reads are kept with the film, so the film rebuilds without a key.
VOICE_DIR = os.path.join(HERE, "films", FILM_ID, "voice")

_model = [None]
def gemini_tts(text, tone, voice=None):
    """One sentence from Gemini TTS, read to its direction; cached by prompt."""
    voice = voice or GEMINI_VOICE
    prompt = gemini_prompt(text, tone)
    path = read_path(text, tone, voice)
    if os.path.exists(path):
        return sf.read(path, dtype="float32")[0]
    if not GEMINI_KEY and not gemini_reachable():
        raise SystemExit(f"no Gemini read cached for {text!r} and no GEMINI_API_KEY to fetch one")
    models = [_model[0]] if _model[0] else [GEMINI_MODEL] + [m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]
    last = None
    for model in models:
        for attempt in range(6):
            try:
                pcm = gemini_request(model, prompt, voice)
                _model[0] = model
                os.makedirs(os.path.dirname(path), exist_ok=True)
                sf.write(path, pcm, SR)
                return pcm
            except urllib.error.HTTPError as e:
                last = f"{model}: HTTP {e.code} {e.read()[:300]!r}"
                if e.code == 404:
                    break                                   # no such model: try the next one
                if e.code in (429, 500, 503):
                    wait = min(60, 5 * 2 ** attempt)        # the free tier's rate limit: back off and retry
                    print(f"  gemini {e.code}, retrying in {wait}s")
                    time.sleep(wait)
                    continue
                raise SystemExit(f"Gemini TTS failed: {last}")
    raise SystemExit(f"Gemini TTS failed: {last}")


def read_path(text, tone, voice):
    prompt = gemini_prompt(text, tone)
    return os.path.join(HERE, "films", FILM_ID, "voice", hashlib.sha1(f"{voice}|{prompt}".encode()).hexdigest()[:16] + ".wav")


def all_kept():
    """True when Gemini's read of every sentence is already kept with the film."""
    return all(os.path.exists(read_path(spoken(s), sc.get("tone", ""), GEMINI_VOICE))
               for sc in SCENES for line in sc["lines"] for s in sentences(line))


PROVIDER = os.environ.get("VOICE_PROVIDER") or getattr(F, "VOICE_PROVIDER", "kokoro")
if PROVIDER == "auto":
    PROVIDER = "gemini" if all_kept() or GEMINI_KEY or gemini_reachable() else "kokoro"


def synth(kok, s, tone, rate):
    if PROVIDER == "gemini":
        a = gemini_tts(spoken(s), tone)
        # a read that says more than the line (the notes read aloud) is retried once, more plainly
        got = measured_starts(trim(a))
        if got is not None and len(got) > 1.5 * len(s.split()) + 2:
            print(f"  gemini read extra words for {s!r}; retrying with a plain prompt")
            a = gemini_tts(spoken(s), f"{tone} (Say only these words.)")
        return a, SR
    return kok.create(spoken(s), voice=VOICE, speed=rate, lang=LANG)


def fetch():
    """Fetch and cache Gemini's read of every sentence, without building the timeline.
    For a machine that has the key but not the models: the reads land in
    films/<id>/voice, and vo.py builds the timeline from them anywhere."""
    todo = [(s, sc.get("tone", "")) for sc in SCENES for line in sc["lines"] for s in sentences(line)]
    done = 0
    for s, tone in todo:
        try:
            a = gemini_tts(spoken(s), tone)
            done += 1
            print(f"  ok   {len(a) / SR:5.2f}s  {s}")
        except SystemExit as e:
            print(f"  stop {s}: {e}")
            break
    print(f"{FILM_ID}: {done} of {len(todo)} sentences read by Gemini ({_model[0] or GEMINI_MODEL}, {GEMINI_VOICE})")
    return done == len(todo)


def audition(voices):
    """The same two lines in several of Gemini's voices, to choose one by ear."""
    picks = [SCENES[1], SCENES[-1]]
    out = os.path.join(VOICE_DIR, "audition")
    os.makedirs(out, exist_ok=True)
    for v in voices:
        clips = []
        for sc in picks:
            for s in sentences(sc["lines"][0]):
                clips += [gemini_tts(spoken(s), sc.get("tone", ""), voice=v), np.zeros(int(0.35 * SR), np.float32)]
        sf.write(os.path.join(out, f"{v}.wav"), np.concatenate(clips), SR)
        print(f"  audition {v}: ok")


def main():
    os.makedirs(os.path.join(OUT, "vo"), exist_ok=True)
    print(f"voice: {PROVIDER}" + (f" ({GEMINI_MODEL}, {GEMINI_VOICE})" if PROVIDER == "gemini" else f" ({VOICE})"))
    from kokoro_onnx import Kokoro
    kok = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))

    t = 0.0
    scenes, lines_out, clips = [], [], []
    n = 0
    for sc in SCENES:
        start = t
        cursor = start + sc["lead"]
        sc_lines = []
        for li, line in enumerate(sc["lines"]):
            if li:
                cursor += sc.get("gap", 0.35)
            if li in sc.get("snap", []):
                cursor = beat_ceil(cursor)
            n += 1
            line_start = cursor
            sents = sentences(line)
            s_out = []
            for si, s in enumerate(sents):
                rate = SHORT_SPEED if len(s.split()) <= 4 else SPEED
                audio, sr = synth(kok, s, sc.get("tone", ""), rate)
                assert sr == SR
                clip = trim(audio)
                name = f"{n:02d}_{si}.wav"
                sf.write(os.path.join(OUT, "vo", name), clip, SR)
                d = len(clip) / SR
                words = word_times_measured(kok, s, clip)
                # land: push the line so this word starts on a beat (the drop lands on it)
                land = sc.get("land")
                if land and si == 0 and li == 0:
                    hit = next((w["start"] for w in words if re.sub(r"[^\w']", "", w["w"].lower()) == land), None)
                    if hit is not None:
                        target = round((cursor + hit) / BEAT) * BEAT
                        if target - hit < start + 0.08:        # never before the scene starts
                            target += BEAT
                        cursor = target - hit
                        line_start = cursor
                for w in words:
                    w["start"] = round(cursor + w["start"], 3)
                    w["end"] = round(cursor + w["end"], 3)
                s_out.append(dict(text=s, start=round(cursor, 3), end=round(cursor + d, 3), words=words))
                clips.append(dict(file=f"vo/{name}", start=round(cursor, 3), dur=round(d, 3)))
                cursor += d
                if si < len(sents) - 1:
                    one_word = len(s.split()) == 1 and len(sents[si + 1].split()) == 1
                    cursor += LIST_GAP if one_word else AFTER.get(s[-1], 0.24)
            lo = dict(n=n, text=line, start=round(line_start, 3), end=round(cursor, 3), sentences=s_out)
            lines_out.append(lo)
            sc_lines.append(n)
        end = beat_ceil(cursor + sc["tail"], sc.get("q", 1))
        scenes.append(dict(id=sc["id"], start=round(start, 4), end=round(end, 4), lines=sc_lines))
        t = end
        print(f"{sc['id']:7s} {start:6.2f} → {end:6.2f}  ({end - start:5.2f}s)  vo ends {cursor:6.2f}")

    timeline = dict(film=FILM_ID, title=F.TITLE, cover=F.COVER, bpm=BPM, beat=BEAT, fps=60, duration=round(scenes[-1]["end"], 4),
                    voice=(f"gemini:{_model[0] or GEMINI_MODEL}:{GEMINI_VOICE}" if PROVIDER == "gemini" else VOICE),
                    scenes=scenes, lines=lines_out, clips=clips)
    with open(os.path.join(OUT, "timeline.json"), "w") as f:
        json.dump(timeline, f, indent=1, ensure_ascii=False)
    print(f"total {timeline['duration']:.2f}s")


if __name__ == "__main__":
    if "--audition" in sys.argv:
        audition(sys.argv[sys.argv.index("--audition") + 1].split(","))
    elif "--fetch-only" in sys.argv:
        sys.exit(0 if fetch() else 1)
    else:
        main()
