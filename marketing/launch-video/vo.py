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
"""

import importlib.util, json, os, re, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

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


def main():
    os.makedirs(os.path.join(OUT, "vo"), exist_ok=True)
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
                audio, sr = kok.create(spoken(s), voice=VOICE, speed=rate, lang=LANG)
                assert sr == SR
                clip = trim(audio)
                name = f"{n:02d}_{si}.wav"
                sf.write(os.path.join(OUT, "vo", name), clip, SR)
                d = len(clip) / SR
                words = word_times_measured(kok, s, clip)
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
                    voice=VOICE, scenes=scenes, lines=lines_out, clips=clips)
    with open(os.path.join(OUT, "timeline.json"), "w") as f:
        json.dump(timeline, f, indent=1, ensure_ascii=False)
    print(f"total {timeline['duration']:.2f}s")


if __name__ == "__main__":
    main()
