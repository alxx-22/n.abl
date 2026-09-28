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
takes written direction, each model the way Google's guide asks for it
(tts-models.md):

  Gemini 3.8 (Flash, Flash-Lite) reads the text strictly as a transcript. Who
  is speaking is the voice itself (a prebuilt voice, or one made from
  VOICE_DESIGN with --design); each line carries only a few words of
  delivery, its scene's `style`, in the text part's speechMetadata.style.
  Long profiles and director's notes are, in Google's words, "the most
  common cause of voice drift" on 3.8, so they are not sent to it. A word
  marked *like this* in a scene's `read` is written in capitals, which is
  how 3.8 is told to stress it; inline tags such as <short pause> shape the
  read and are not spoken.

  Earlier models (3.1, 2.5) take one prompt: PROFILE and SCENE in film.py,
  the scene's `tone`, and NAME_NOTE on the lines that say the name, then the
  words, with tags in [brackets] (3.1) or none (2.5) and no capitals.

Set in film.py by VOICE_PROVIDER, GEMINI_TTS_MODEL and GEMINI_VOICE, or
overridden by the environment:

  VOICE_PROVIDER   auto (Gemini when it answers, else Kokoro), gemini, kokoro
  GEMINI_API_KEY   a Google AI Studio key (free tier), for Gemini TTS; or leave
                   it unset and store the key as an API credential on the
                   cloud environment, which attaches it to Gemini's requests
  GEMINI_TTS_MODEL the model, default gemini-3.8-flash-tts

Gemini's reads are kept in films/<id>/voice, one per whole line, named by a
hash of the model, voice, direction and words, so a rebuild costs no requests
(and needs no key) unless one of those changes.

  python3 vo.py --film web --fetch-only             fetch and keep Gemini's reads only
  python3 vo.py --film web --audition Achird,Puck   two lines in each voice, to choose
  python3 vo.py --film web --stand-in gemini-3.8-flash-lite-tts
                                                    read the lines still missing with another
                                                    model, until the film's own has quota again
  python3 vo.py --film web --design "n.abl founder" make a voice from VOICE_DESIGN (3.8 only),
                                                    and keep its sample to audition
  python3 vo.py --film web --quota                  the requests each model has used today

The free tier's limits are per project, per model and per day, and Google
no longer publishes them; the API states them when one is reached. vo.py
notes every limit it is told in quota-seen.json, and counts the requests
it makes in build/gemini-usage.json, by Pacific day, when they reset.

Scenes that share a `joint` name in film.py (a sentence that runs across
several shots) are read by Gemini in one request, as one sentence, and cut
into their shots where the recogniser hears one shot's words end.
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



GEMINI_MODEL = os.environ.get("GEMINI_TTS_MODEL") or getattr(F, "GEMINI_TTS_MODEL", "gemini-3.8-flash-tts")
# a fallback only for a model name the API does not know (404), never for a quota:
# one film is read by one model, so the voice stays the same throughout.
# All five are in the API's model list (tts-models.md). A read by one of them
# can also stand in for a line the film's model has not read yet (--stand-in).
GEMINI_FALLBACK_MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview",
                          "gemini-2.5-pro-preview-tts", "gemini-2.5-flash-preview-tts"]


def structured(model):
    """Gemini 3.8 TTS and later read the text strictly as a transcript and take
    the direction in the part's speech_metadata; earlier models take one prompt."""
    m = re.match(r"gemini-(\d+)\.(\d+)", model)
    return bool(m) and (int(m.group(1)), int(m.group(2))) >= (3, 8)


class QuotaExhausted(Exception):
    pass


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


def spoken(text, gemini=False):
    say = getattr(F, "GEMINI_SAY", SAY) if gemini else SAY
    for k, v in say.items():
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


def joint(sc):
    """The scenes read with this one in a single request: the scenes that share
    its `joint` name, in order, each of one line. A sentence that runs across
    several shots is read as one sentence, then cut into its shots."""
    group = [s for s in SCENES if sc.get("joint") and s.get("joint") == sc["joint"]]
    assert all(len(s["lines"]) == 1 for s in group), "a joint scene has one line"
    return group or [sc]


def gemini_line(sc, li, model=None):
    """The words Gemini reads for a scene's line: the script, the name as it is
    said (GEMINI_SAY), and any inline expression tags from the scene's `read`,
    such as <short pause>. Tags shape the delivery and are not spoken. A word
    marked *like this* is written in capitals for 3.8, which stresses it, and
    plainly for earlier models. For scenes read jointly, the whole sentence."""
    text = " ".join(spoken(s.get("read", s["lines"])[li], True) for s in joint(sc))
    upper = structured(model or GEMINI_MODEL)
    return re.sub(r"\*([^*]+)\*", lambda m: m.group(1).upper() if upper else m.group(1), text)


def gemini_style(sc, li, model=None, extra=""):
    """The direction for a line. For 3.8, the scene's `style`: a few words of
    delivery, the voice being the speaker. For earlier models, who is
    speaking, the scene, and the line's own note; for scenes read jointly,
    each part's note on its own words."""
    group = joint(sc)
    if structured(model or GEMINI_MODEL):
        return ", then ".join(s.get("style") or s.get("tone", "") for s in group)
    if len(group) > 1:
        note = "One sentence, read in one flowing run with natural pauses at the commas. " + " ".join(
            f"On '{spoken(s['lines'][0], True).strip(' ,.')}': {s.get('tone', '')}" for s in group)
    else:
        note = sc.get("tone", "")
    if any("n.abl" in s["lines"][li] for s in group) and getattr(F, "NAME_NOTE", ""):
        note = f"{note} {F.NAME_NOTE}"
    return (f"{F.PROFILE}\n\nThe scene: {F.SCENE}\n\nThis line: {note} {extra}").strip()


def gemini_body(model, text, style, voice):
    if structured(model):
        # the text is the verbatim transcript; the direction rides alongside it
        parts = [{"text": text, "speechMetadata": {"speaker": "Narrator", "style": style}}]
        voice_config = {"voice": voice}
    else:
        # older models take the direction in the prompt, with tags in [brackets]
        # (3.1) or none (2.5)
        text = re.sub(r"<([^<>]+)>", r"[\1]" if model.startswith("gemini-3") else "", text)
        text = re.sub(r"\s+", " ", text).strip()
        parts = [{"text": f"# DIRECTOR'S NOTES\n{style}\nRead only the transcript, exactly as written, "
                          f"nothing else.\n\n## TRANSCRIPT\n{text}"}]
        voice_config = {"prebuiltVoiceConfig": {"voiceName": voice}}
    return {"contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": voice_config}}}


def gemini_request(model, text, style, voice):
    body = json.dumps(gemini_body(model, text, style, voice)).encode()
    headers = {"Content-Type": "application/json"}
    if GEMINI_KEY:                                          # otherwise the environment's proxy adds it
        headers["x-goog-api-key"] = GEMINI_KEY
    req = urllib.request.Request(f"{GEMINI_API}/models/{model}:generateContent", data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.load(r)
    part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
    raw = base64.b64decode(part["data"])
    if raw[:4] == b"RIFF":                                  # 3.8 answers with a WAV file
        import io
        pcm, rate = sf.read(io.BytesIO(raw), dtype="float32")
        if pcm.ndim > 1:
            pcm = pcm.mean(1)
    else:                                                   # earlier models with raw 16-bit PCM
        m = re.search(r"rate=(\d+)", part.get("mimeType", ""))
        rate = int(m.group(1)) if m else 24000
        pcm = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768
    if rate != SR:
        from scipy.signal import resample_poly
        pcm = resample_poly(pcm, SR, rate).astype(np.float32)
    return pcm


# Gemini's reads are kept with the film, so the film rebuilds without a key.
VOICE_DIR = os.path.join(HERE, "films", FILM_ID, "voice")


def read_path(model, text, style, voice):
    """A read is named by everything that shapes it: model, voice, direction and words."""
    key = hashlib.sha1(f"{model}|{voice}|{style}|{text}".encode()).hexdigest()[:16]
    return os.path.join(VOICE_DIR, key + ".wav")


def line_path(sc, li, model, voice, extra=""):
    """Where a model's read of a scene's line is kept: each model is sent the
    words and direction in its own form, so each has its own name for a line."""
    return read_path(model, gemini_line(sc, li, model), gemini_style(sc, li, model, extra), voice)


def kept_by(sc, li, voice, extra=""):
    """The model whose kept read of a line is used: the film's own, else a
    fallback's or a stand-in's."""
    for model in [GEMINI_MODEL] + GEMINI_FALLBACK_MODELS:
        if os.path.exists(line_path(sc, li, model, voice, extra)):
            return model
    return None


def kept_read(sc, li, voice):
    """The kept read of a line, from the film's model or, if it was ever used, a fallback."""
    model = kept_by(sc, li, voice)
    return line_path(sc, li, model, voice) if model else None


# ---- the free tier's quota -------------------------------------------------
# Limits are per project, per model and per day (reset at midnight Pacific),
# and Google shows them only in AI Studio. A 429 names the limit it hit
# (a QuotaFailure with quotaId and quotaValue): those are kept here, with the
# day they were seen, so tts-models.md can give the measured numbers.
QUOTA_SEEN = os.path.join(HERE, "quota-seen.json")
USAGE = os.path.join(BUILD, "gemini-usage.json")


def pacific_day():
    """Today in California, where the free tier's day starts and ends."""
    try:
        from datetime import datetime
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")
    except Exception:                                       # no time zone data: Pacific daylight time
        return time.strftime("%Y-%m-%d", time.gmtime(time.time() - 7 * 3600))


def _load(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def count_request(model, outcome):
    """Count a request against today's quota: 'ok', or the HTTP status it failed
    with. Failed 500 and 503 answers are counted too: users report that they use
    the day's quota (tts-models.md)."""
    usage = _load(USAGE)
    day = usage.setdefault(pacific_day(), {}).setdefault(model, {})
    day[str(outcome)] = day.get(str(outcome), 0) + 1
    os.makedirs(BUILD, exist_ok=True)
    with open(USAGE, "w") as f:
        json.dump(usage, f, indent=1, sort_keys=True)


def note_quota(model, body):
    """Keep the limits a 429 names, and print them."""
    try:
        details = json.loads(body)["error"].get("details", [])
    except (ValueError, KeyError, AttributeError):
        return
    seen = _load(QUOTA_SEEN)
    for d in details:
        for v in d.get("violations", []):
            if "quotaId" not in v:
                continue
            m = v.get("quotaDimensions", {}).get("model", model)
            seen.setdefault(m, {})[v["quotaId"]] = dict(value=int(v.get("quotaValue", 0)), seen=pacific_day())
            print(f"  quota: {m} {v['quotaId']} = {v.get('quotaValue')}")
    with open(QUOTA_SEEN, "w") as f:
        json.dump(seen, f, indent=1, sort_keys=True)


def quota_report():
    """The requests each model has made today, against the limits seen."""
    today = _load(USAGE).get(pacific_day(), {})
    seen = _load(QUOTA_SEEN)
    print(f"Gemini requests on {pacific_day()} (Pacific), against the free tier's limits as seen:")
    for model in sorted(set(today) | set(seen) | set(GEMINI_FALLBACK_MODELS)):
        used = today.get(model, {})
        per_day = {k: v["value"] for k, v in seen.get(model, {}).items() if "PerDay" in k}
        print(f"  {model:32s} {sum(used.values()):3d} made ({', '.join(f'{k} {n}' for k, n in sorted(used.items())) or 'none'})"
              + (f"; limit {', '.join(f'{v}/day' for v in per_day.values())}" if per_day else "; limit not seen yet"))


_model = [None]
_used = set()                                               # the models whose reads the film uses
def gemini_read(sc, li, voice, fresh=False, models=None, extra=""):
    """One read of a line from Gemini TTS; kept once fetched. fresh: fetch the
    film's own model's read even when another model's is kept. models: the
    models to try. extra: a note added to an earlier model's direction."""
    have = kept_by(sc, li, voice, extra)
    if have and (have == GEMINI_MODEL or not fresh):
        _used.add(have)
        return sf.read(line_path(sc, li, have, voice, extra), dtype="float32")[0]
    if not GEMINI_KEY and not gemini_reachable():
        raise SystemExit(f"no Gemini read kept for {gemini_line(sc, li)!r} and no GEMINI_API_KEY to fetch one")
    models = models or ([_model[0]] if _model[0] else
                        [GEMINI_MODEL] + [m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL])
    last = None
    for model in models:
        text, style = gemini_line(sc, li, model), gemini_style(sc, li, model, extra)
        busy = 0
        for attempt in range(4):
            try:
                pcm = gemini_request(model, text, style, voice)
                count_request(model, "ok")
                _model[0] = model
                _used.add(model)
                os.makedirs(VOICE_DIR, exist_ok=True)
                sf.write(read_path(model, text, style, voice), pcm, SR)
                return pcm
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", "replace")
                last = f"{model}: HTTP {e.code} {body[:300]}"
                if e.code == 404:
                    break                                   # no such model: try the next name
                count_request(model, e.code)
                if e.code == 429:
                    note_quota(model, body)
                    # the free tier counts requests per minute and per day; a day's quota
                    # does not come back by waiting, so stop at once and keep what is fetched
                    if "PerDay" in body or "per day" in body.lower():
                        raise QuotaExhausted(f"{model}: the free tier's daily quota is used up")
                    m = re.search(r'"retryDelay":\s*"(\d+)', body)
                    wait = int(m.group(1)) + 2 if m else 30
                    print(f"  gemini per-minute limit, waiting {wait}s")
                    time.sleep(wait)
                    continue
                if e.code in (500, 503) and busy < 1:
                    # one retry only: a failed answer may still use a request of the day's quota
                    busy += 1
                    print(f"  gemini HTTP {e.code}, retrying once in 30s")
                    time.sleep(30)
                    continue
                raise SystemExit(f"Gemini TTS failed: {last}")
        else:
            raise QuotaExhausted(f"{model}: still rate limited after retries ({last})")
    raise SystemExit(f"Gemini TTS failed: {last}")


def quietest(a, lo, hi, win=0.02):
    """The middle of the quietest stretch of `win` seconds between lo and hi."""
    fr, hop = int(win * SR), int(0.005 * SR)
    s0 = max(0, int(lo * SR))
    s1 = max(s0 + fr + hop, int(hi * SR))
    best = min(range(s0, min(s1, len(a)) - fr, hop), key=lambda s: float(np.sum(a[s:s + fr] ** 2)))
    return (best + fr / 2) / SR


def split_read(a, group):
    """A joint read cut into one clip per scene, in the quietest moment between
    the last word of one scene's words and the first of the next's."""
    counts = [len(s["lines"][0].split()) for s in group]
    got = measured_starts(a)
    if got and len(got) == sum(counts):
        cuts, i = [], 0
        for c in counts[:-1]:
            i += c
            lo, hi = got[i - 1] + 0.12, got[i] - 0.01
            cuts.append(quietest(a, *((lo, hi) if hi - lo > 0.03 else (got[i - 1], got[i]))))
    else:
        # the recogniser did not hear the words one for one: cut at the longest pauses
        runs = sorted(quiet_runs(a), key=lambda r: r[0] - r[1])[:len(group) - 1]
        if len(runs) < len(group) - 1:
            raise SystemExit(f"cannot cut the joint read of {[s['id'] for s in group]} into its scenes")
        print(f"  aligner heard {len(got or [])} words in the joint read, script has {sum(counts)}: cutting at its pauses")
        cuts = sorted((s + e) / 2 for s, e in runs)
    edges = [0] + [int(c * SR) for c in cuts] + [len(a)]
    return [a[edges[k]:edges[k + 1]] for k in range(len(group))]


def gemini_tts(sc, li, voice=None, extra="", **kw):
    """One whole line from Gemini TTS, read to its direction; kept once fetched.
    Scenes read jointly are fetched as one read, then cut into their scenes."""
    voice = voice or GEMINI_VOICE
    pcm = gemini_read(sc, li, voice, extra=extra, **kw)
    group = joint(sc)
    return split_read(pcm, group)[group.index(sc)] if len(group) > 1 else pcm


def all_kept():
    """True when Gemini's read of every line is already kept with the film."""
    return all(kept_read(sc, li, GEMINI_VOICE) for sc in SCENES for li in range(len(sc["lines"])))


PROVIDER = os.environ.get("VOICE_PROVIDER") or getattr(F, "VOICE_PROVIDER", "kokoro")
if PROVIDER == "auto":
    PROVIDER = "gemini" if all_kept() or GEMINI_KEY or gemini_reachable() else "kokoro"


def synth(kok, sc, li, s, rate):
    if PROVIDER == "gemini":
        a = gemini_tts(sc, li)
        # a read that says more than the line (the notes read aloud) is retried once, more
        # plainly; only earlier models take notes in the prompt, 3.8 reads the words alone
        got = measured_starts(trim(a))
        if got is not None and len(got) > len(s.split()) and not structured(kept_by(sc, li, GEMINI_VOICE) or GEMINI_MODEL):
            print(f"  gemini read {len(got)} words for the {len(s.split())} in {s!r}; retrying")
            a = gemini_tts(sc, li, extra="(Say only these words.)")
        return a, SR
    return kok.create(spoken(s), voice=VOICE, speed=rate, lang=LANG)


def fetch(stand_in=None):
    """Fetch and keep Gemini's read of every line, without building the timeline.
    For a machine that has the key but not the models: the reads land in
    films/<id>/voice, and vo.py builds the timeline from them anywhere. One
    request per line, or per group of scenes read jointly. A line with only a
    stand-in's read is fetched again from the film's model.

    stand_in: a model from GEMINI_FALLBACK_MODELS that reads, for now, only the
    lines no model has read yet, for a whole film while the film's own model is
    out of quota. Its reads give way to the film's model's once those are kept."""
    todo, seen = [], set()
    for sc in SCENES:
        for li in range(len(sc["lines"])):
            key = line_path(sc, li, GEMINI_MODEL, GEMINI_VOICE)     # scenes read jointly share one
            if key not in seen:
                seen.add(key)
                todo.append((sc, li))
    by = lambda t: kept_by(*t, GEMINI_VOICE)
    assert not stand_in or stand_in in GEMINI_FALLBACK_MODELS, "a stand-in must be one of GEMINI_FALLBACK_MODELS"
    print(f"{FILM_ID}: {sum(by(t) == GEMINI_MODEL for t in todo)} of {len(todo)} reads kept from "
          f"{GEMINI_MODEL}, {GEMINI_VOICE}" + (f"; standing in with {stand_in}" if stand_in else ""))
    for t in todo:
        have = by(t)
        if have == GEMINI_MODEL or (stand_in and have):
            continue
        try:
            a = gemini_read(*t, GEMINI_VOICE, fresh=True, models=[stand_in] if stand_in else None)
            print(f"  ok   {len(a) / SR:5.2f}s  {gemini_line(*t, stand_in)}")
        except QuotaExhausted as e:
            print(f"  stop: {e}")
            break
    own = sum(by(t) == GEMINI_MODEL for t in todo)
    other = sum(bool(by(t)) and by(t) != GEMINI_MODEL for t in todo)
    print(f"{FILM_ID}: {own} of {len(todo)} reads by {GEMINI_MODEL}, {GEMINI_VOICE}"
          + (f", {other} by a stand-in" if other else "")
          + ("" if own == len(todo) else "; run again once the daily quota resets (midnight Pacific) to fetch the rest"))
    return own == len(todo) if not stand_in else own + other == len(todo)


def audition(voices):
    """The same two lines in several of Gemini's voices, to choose one by ear.
    The film's own voice reuses (and keeps) its reads of those lines."""
    picks = [SCENES[1], SCENES[-1]]
    out = os.path.join(VOICE_DIR, "audition", GEMINI_MODEL)
    os.makedirs(out, exist_ok=True)
    for v in voices:
        clips = []
        try:
            for sc in picks:
                clips += [gemini_tts(sc, 0, voice=v), np.zeros(int(0.35 * SR), np.float32)]
        except QuotaExhausted as e:
            print(f"  stop: {e}")
            break
        sf.write(os.path.join(out, f"{v}.wav"), np.concatenate(clips), SR)
        print(f"  audition {v}: ok")


# Voices made with voice design, shared by the films: a voice belongs to the
# project, not to one film, and lasts a year.
DESIGN_DIR = os.path.join(HERE, "voice-design")


def design_voice(name):
    """Make a voice from film.py's VOICE_DESIGN with Gemini 3.8's voice design,
    and keep its id and the sample the API returns with it, to audition. To
    use it, set GEMINI_VOICE in film.py to the id it prints."""
    d = F.VOICE_DESIGN
    model = GEMINI_MODEL if structured(GEMINI_MODEL) else "gemini-3.8-flash-tts"
    body = {"store": True, "voice": {"model": model, "type": "prompted", "displayName": name,
                                     "gender": d["gender"], "languageCode": d["language"],
                                     "prompted": {"input": d["description"]}}}
    headers = {"Content-Type": "application/json"}
    if GEMINI_KEY:
        headers["x-goog-api-key"] = GEMINI_KEY
    req = urllib.request.Request(f"{GEMINI_API}/voices", data=json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            voice = json.load(r)
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", "replace")
        count_request(f"voices:{model}", e.code)
        if e.code == 429:
            note_quota(f"voices:{model}", err)
        raise SystemExit(f"voice design failed: HTTP {e.code} {err[:500]}")
    count_request(f"voices:{model}", "ok")
    voice = voice.get("voice", voice)
    vid = voice.get("id") or voice.get("name", "").split("/")[-1]
    sample = voice.pop("sampleAudio", None) or voice.pop("sample_audio", None)
    os.makedirs(DESIGN_DIR, exist_ok=True)
    with open(os.path.join(DESIGN_DIR, f"{vid}.json"), "w") as f:
        json.dump(dict(voice, description=d["description"], film=FILM_ID), f, indent=1)
    if sample:
        raw = base64.b64decode(sample.get("data", "") if isinstance(sample, dict) else sample)
        if raw[:4] == b"RIFF":
            with open(os.path.join(DESIGN_DIR, f"{vid}.wav"), "wb") as f:
                f.write(raw)
        else:                                               # raw 16-bit PCM at 24 kHz
            sf.write(os.path.join(DESIGN_DIR, f"{vid}.wav"), np.frombuffer(raw, dtype="<i2"), 24000, subtype="PCM_16")
    print(f"designed voice {vid!r} ({name}); sample {'kept' if sample else 'not returned'} in voice-design/")
    return vid


def main():
    os.makedirs(os.path.join(OUT, "vo"), exist_ok=True)
    voiced = any(sc["lines"] for sc in SCENES)
    print(f"voice: {PROVIDER}" + (f" ({GEMINI_MODEL}, {GEMINI_VOICE})" if PROVIDER == "gemini" else f" ({VOICE})")
          if voiced else "no voice: scenes of fixed length on the beat grid")
    kok = None
    if voiced:
        from kokoro_onnx import Kokoro
        kok = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))

    t = 0.0
    scenes, lines_out, clips = [], [], []
    n = 0
    for sc in SCENES:
        start = t
        cursor = start + sc.get("lead", 0)
        sc_lines = []
        for li, line in enumerate(sc["lines"]):
            if li:
                cursor += sc.get("gap", 0.35)
            if li in sc.get("snap", []):
                cursor = beat_ceil(cursor)
            n += 1
            line_start = cursor
            # Gemini reads a whole line at once, so its direction always matches its words
            sents = [line] if PROVIDER == "gemini" else sentences(line)
            s_out = []
            for si, s in enumerate(sents):
                rate = SHORT_SPEED if len(s.split()) <= 4 else SPEED
                audio, sr = synth(kok, sc, li, s, rate)
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
        # beats: a scene of fixed length, for a film cut to music with no voice
        end = start + sc["beats"] * BEAT if "beats" in sc else beat_ceil(cursor + sc["tail"], sc.get("q", 1))
        scenes.append(dict(id=sc["id"], start=round(start, 4), end=round(end, 4), lines=sc_lines))
        t = end
        print(f"{sc['id']:7s} {start:6.2f} → {end:6.2f}  ({end - start:5.2f}s)  vo ends {cursor:6.2f}")

    timeline = dict(film=FILM_ID, title=F.TITLE, cover=F.COVER, bpm=BPM, beat=BEAT, fps=60, duration=round(scenes[-1]["end"], 4),
                    voice=("none" if not voiced else
                           f"gemini:{'+'.join(sorted(_used, key=lambda m: m != GEMINI_MODEL)) or GEMINI_MODEL}:{GEMINI_VOICE}"
                           if PROVIDER == "gemini" else VOICE),
                    scenes=scenes, lines=lines_out, clips=clips)
    with open(os.path.join(OUT, "timeline.json"), "w") as f:
        json.dump(timeline, f, indent=1, ensure_ascii=False)
    print(f"total {timeline['duration']:.2f}s")


if __name__ == "__main__":
    if "--audition" in sys.argv:
        audition(sys.argv[sys.argv.index("--audition") + 1].split(","))
    elif "--fetch-only" in sys.argv:
        sys.exit(0 if fetch() else 2)
    elif "--stand-in" in sys.argv:
        sys.exit(0 if fetch(stand_in=sys.argv[sys.argv.index("--stand-in") + 1]) else 2)
    elif "--design" in sys.argv:
        design_voice(sys.argv[sys.argv.index("--design") + 1])
    elif "--quota" in sys.argv:
        quota_report()
    else:
        main()
