"""
Voiceover and timeline.

Synthesises every sentence of the script with Kokoro (bf_emma, British
English), trims each clip to its speech, and lays the clips out scene by scene.
Every scene starts on a beat of the music grid, so the cuts land on the beat
and the music can be written to the same timeline afterwards.

Writes:
  build/vo/NN_M.wav   one clip per sentence, 24 kHz mono, trimmed
  build/timeline.json scenes, lines, sentences and word timings, in seconds

Word timings are estimated: the model does not report durations, so each
sentence's speech is shared between its words by phoneme count, with the
pauses the model left at commas found in the audio and used as anchors.
"""

import json, os, re, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
MODELS = os.environ.get("KOKORO_DIR", os.path.join(BUILD, "models"))
VOICE, LANG, SPEED = "bf_emma", "en-gb", 1.08
# One-word sentences come out drawn out at the normal rate.
LIST_SPEED = 1.22
SR = 24000

BPM = 110
BEAT = 60 / BPM

# The name is spoken, not spelled. Everything else is read as written.
SAY = {"n.abl": "enable"}

# lead: time from the scene's first frame to its first word.
# gap:  pause between two lines inside the scene.
# tail: minimum hold after the last word before the next scene may start.
# snap: lines whose start is pushed onto the next beat, for a hit to land on.
SCENES = [
    dict(id="hook",   lead=0.55, tail=0.30, lines=[
        "Somewhere in your business, someone reads a document… then types it all out again."]),
    dict(id="pile",   lead=0.20, tail=0.25, lines=[
        "Invoices. Referrals. Applications. A different layout every time. The same hours, every week."]),
    dict(id="turn",   lead=0.45, tail=0.55, lines=[
        "That's language work. And it's exactly where AI earns its place."]),
    dict(id="read",   lead=0.75, tail=0.40, gap=0.40, lines=[
        "We build AI that reads them, pulls out what matters, and fills in your records.",
        "Anything it isn't sure of goes to a person."]),
    dict(id="sort",   lead=0.50, tail=0.45, lines=[
        "It sorts your inbox by what each message means, and passes it to the right desk."]),
    dict(id="draft",  lead=0.50, tail=0.55, lines=[
        "It drafts replies from the records you already hold, and shows where every answer came from."]),
    dict(id="boring", lead=0.35, tail=0.35, gap=0.30, snap=[1], lines=[
        "And if the job doesn't need AI, we'll tell you, and build the boring version.",
        "It's cheaper, and it breaks less often."]),
    dict(id="terms",  lead=0.25, tail=0.35, lines=[
        "No retainer. A price before we start. You own what we build."]),
    dict(id="end",    lead=1.50, tail=3.10, snap=[0], lines=[
        "n.abl. AI, where it earns its place."]),
]

# Silence between sentences inside a line, by the mark that ends the first.
AFTER = {"…": 0.42, ".": 0.24, "?": 0.28}
# A run of one-word sentences is a list and is read quickly.
LIST_GAP = 0.14


def beat_ceil(t):
    return np.ceil(t / BEAT - 1e-6) * BEAT


def sentences(line):
    """Split a line after . … ? while keeping the mark on its sentence."""
    parts = re.findall(r"[^.…?]+[.…?]+|[^.…?]+$", line)
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


def trim(a, thr_db=-42, pre=0.015, post=0.07):
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


def main():
    os.makedirs(os.path.join(BUILD, "vo"), exist_ok=True)
    kok = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))

    t = 0.0
    scenes, lines_out, clips = [], [], []
    n = 0
    for sc in SCENES:
        start = beat_ceil(t)
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
                rate = LIST_SPEED if len(s.split()) == 1 and len(sents) > 2 else SPEED
                audio, sr = kok.create(spoken(s), voice=VOICE, speed=rate, lang=LANG)
                assert sr == SR
                clip = trim(audio)
                name = f"{n:02d}_{si}.wav"
                sf.write(os.path.join(BUILD, "vo", name), clip, SR)
                d = len(clip) / SR
                words = word_times(kok, s, clip)
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
        end = beat_ceil(cursor + sc["tail"])
        scenes.append(dict(id=sc["id"], start=round(start, 4), end=round(end, 4), lines=sc_lines))
        t = end
        print(f"{sc['id']:7s} {start:6.2f} → {end:6.2f}  ({end - start:5.2f}s)  vo ends {cursor:6.2f}")

    timeline = dict(bpm=BPM, beat=BEAT, fps=60, duration=round(scenes[-1]["end"], 4),
                    voice=VOICE, scenes=scenes, lines=lines_out, clips=clips)
    with open(os.path.join(BUILD, "timeline.json"), "w") as f:
        json.dump(timeline, f, indent=1, ensure_ascii=False)
    print(f"total {timeline['duration']:.2f}s")


if __name__ == "__main__":
    main()
