"""
Music, sound effects and the final mix.

Everything is synthesised here, on the film's own timeline, so nothing needs a
licence (the optional "band" arrangement plays a free SoundFont). The music is written against build/<id>/timeline.json (scenes start
on beats) in the shape films/<id>/film.py gives it, and the effects are placed
from build/<id>/cues.json, which the film itself emits, so a sound lands on
the frame that makes it.

  python3 audio.py [--film ai]

  music   by the film's MUSIC setting, with its sections and chords:
          (default) supersaw pads, offbeat stabs, plucked arpeggio, sub
                    bass and a kit, in D major
          garage    UK garage and tech house: swung drums, sliding sub,
                    organ stabs, hard-tuned vocal chops sung by the TTS model
          drums     a drum-led groove of stomps, layered claps and fills
          band      an upbeat pop band on sampled instruments (SoundFont)
  effects typing, paper, whooshes, scan, UI ticks and clicks, risers, impacts
  voice   high-passed, gently compressed, a little presence and room
  master  music ducked under the voice, limited, -14 LUFS integrated

Writes build/<id>/mix.wav (48 kHz, stereo, 24-bit) and build/<id>/stems/*.wav.
"""

import importlib.util, json, os, sys
import numpy as np
import soundfile as sf
from scipy import signal
import pyloudnorm as pyln

HERE = os.path.dirname(os.path.abspath(__file__))
FILM_ID = sys.argv[sys.argv.index("--film") + 1] if "--film" in sys.argv else "ai"
BUILD = os.path.join(HERE, "build", FILM_ID)
_spec = importlib.util.spec_from_file_location("film", os.path.join(HERE, "films", FILM_ID, "film.py"))
F = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(F)
SR = 48000
rng = np.random.default_rng(7)

TL = json.load(open(os.path.join(BUILD, "timeline.json")))
CUES = json.load(open(os.path.join(BUILD, "cues.json")))
DUR = TL["duration"]
N = int(DUR * SR) + SR
BEAT = TL["beat"]
S16 = BEAT / 4
SC = {s["id"]: s for s in TL["scenes"]}
cue_t = lambda kind: [c["t"] for c in CUES if c["type"] == kind]


# ---------------------------------------------------------------- helpers
def buf():
    return np.zeros((N, 2))

def at(t):
    return int(round(t * SR))

def add(dst, x, t, gain=1.0, pan=0.0):
    """Mix mono or stereo x into dst at time t, equal-power pan."""
    i = at(t)
    if i >= len(dst):
        return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l, x * r], 1) * np.sqrt(2)
    f = min(len(x), int(0.004 * SR))
    if f > 1:
        x = x.copy(); x[-f:] *= np.linspace(1, 0, f)[:, None] if x.ndim == 2 else np.linspace(1, 0, f)
    j = min(len(dst), i + len(x))
    if i < 0:
        x, i = x[-i:], 0
    dst[i:j] += x[: j - i] * gain

def tt(d):
    return np.arange(int(d * SR)) / SR

def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    sus = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, a, endpoint=False) if a else [],
                        np.linspace(1, s, d, endpoint=False) if d else [],
                        np.full(sus, s), np.linspace(s, 0, r)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]

def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, min(f, SR * .45), "low", fs=SR, output="sos"), x, axis=0)

def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "high", fs=SR, output="sos"), x, axis=0)

def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, min(hi, SR * .45)], "band", fs=SR, output="sos"), x, axis=0)

def sweep_lp(x, cutoff, block=256, q=0.9):
    """Low-pass whose cutoff follows the array `cutoff` (Hz per sample)."""
    y = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        f = float(np.clip(cutoff[min(i, len(cutoff) - 1)], 30, SR * .45))
        w0 = 2 * np.pi * f / SR
        al = np.sin(w0) / (2 * q)
        b = np.array([(1 - np.cos(w0)) / 2, 1 - np.cos(w0), (1 - np.cos(w0)) / 2])
        a = np.array([1 + al, -2 * np.cos(w0), 1 - al])
        sos = np.concatenate([b / a[0], a / a[0]])[None, :]
        seg = x[i:i + block]
        if zi is None:
            zi = np.zeros((1, 2) + seg.shape[1:])
        y[i:i + block], zi = signal.sosfilt(sos, seg, axis=0, zi=zi)
    return y

def peak_eq(x, f, gain_db, q=1.0):
    A = 10 ** (gain_db / 40); w0 = 2 * np.pi * f / SR; al = np.sin(w0) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w0), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w0), 1 - al / A]
    return signal.lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)

def noise(d):
    return rng.standard_normal(int(d * SR))

def saw(freq, d, phase=None):
    ph = (np.cumsum(np.full(int(d * SR), freq) / SR) + (rng.random() if phase is None else phase)) % 1.0
    return 2 * ph - 1

def make_ir(dur=2.6, decay=0.55, bright=5200, pre=0.012):
    n = int(dur * SR); t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for c in range(2):
        nz = rng.standard_normal(n) * np.exp(-t / decay * 3)
        nz = lp(nz, bright) * (0.6 + 0.4 * np.exp(-t / 0.4))
        ir[:, c] = nz
    ir[: int(pre * SR)] = 0
    for k, (dt, g) in enumerate([(0.017, .5), (0.023, .42), (0.031, .35), (0.043, .3), (0.057, .22)]):
        ir[at(dt), k % 2] += g
    return ir / np.sqrt((ir ** 2).sum() / 2)

IR_HALL = make_ir(2.8, 0.7, 4800)
IR_ROOM = make_ir(0.8, 0.18, 7000)

def reverb(x, ir, wet):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x + y * wet

def delay(x, dt, fb=0.35, mix=0.3, lpf=3500):
    d = at(dt); y = x.copy(); tap = x.copy()
    for k in range(1, 6):
        tap = lp(np.roll(tap, d, axis=0), lpf) * fb
        tap[:d] = 0
        y += (tap[:, ::-1] if k % 2 else tap) * mix
    return y


# ------------------------------------------------------------------ music
BARS = {"Bm": (35, [59, 62, 66, 73]), "G": (31, [55, 59, 62, 66]),
        "D": (38, [57, 62, 64, 66]), "A": (33, [57, 61, 64, 71]), "Asus": (33, [57, 62, 64, 69])}
def sections():
    """(start, end, kind, chords) on the beat grid, from the film."""
    return F.sections(SC, cue_t, BEAT, DUR)

def pad_note(m, d, cutoff, voices=5, spread=0.14, attack=0.35, release=0.9):
    """Supersaw note, stereo, with its own filter envelope."""
    f = mtof(m); n = int((d + release) * SR)
    out = np.zeros((n, 2))
    for v in range(voices):
        det = (v - (voices - 1) / 2) / ((voices - 1) / 2) if voices > 1 else 0
        s = saw(f * 2 ** (det * spread / 12), d + release)
        pan = det * 0.8
        out[:, 0] += s * np.cos((pan + 1) * np.pi / 4)
        out[:, 1] += s * np.sin((pan + 1) * np.pi / 4)
    out *= env_adsr(n, attack, 0.4, 0.8, release)[:, None] / voices
    return lp(out, cutoff, 2)

def build_music():
    pads, bass, keys, drums, fxm = buf(), buf(), buf(), buf(), buf()
    kicks = []
    for sec in sections():
        s, e, kind, ch = sec
        nb = int(round((e - s) / BEAT))
        # ---- pads: one chord per bar
        cut = {"intro": 900, "pulse": 1500, "build": 2200, "main": 4200, "break": 2400, "main2": 5000, "lift": 3200, "resolve": 5500}[kind]
        gain = {"intro": .9, "pulse": .7, "build": .7, "main": .62, "break": .7, "main2": .66, "lift": .75, "resolve": .55}[kind]
        b = 0
        while b < nb:
            name = ch[min(b // 4, len(ch) - 1)] if kind not in ("main", "main2") else ch[(b // 4) % len(ch)]
            d = min(4, nb - b) * BEAT
            root, notes = BARS[name]
            for m in notes:
                p = pad_note(m, d + (0.02 if kind != "resolve" else 0), cut, attack=0.25 if kind != "intro" else 0.8,
                             release=0.5 if kind != "resolve" else 3.0)
                add(pads, p, s + b * BEAT, gain * 0.2)
            if kind == "resolve":
                for m in [n + 12 for n in notes[1:]]:
                    add(pads, pad_note(m, d, 4200, release=3.0), s + b * BEAT, 0.04)
            # ---- bass
            if kind in ("main", "main2", "pulse", "lift", "resolve", "break"):
                f0 = mtof(root + 12) if kind != "pulse" else mtof(root + 12)
                if kind in ("main", "main2", "pulse"):
                    for k in range(min(4, nb - b) * 2):   # eighths, off-beat pushes
                        t0 = s + (b + k / 2) * BEAT
                        dd = BEAT * 0.48
                        x = tt(dd)
                        sub = np.sin(2 * np.pi * f0 * x) + 0.35 * np.sin(4 * np.pi * f0 * x)
                        mid = lp(saw(f0 * 2, dd), 420 if kind != "pulse" else 300)
                        v = (0.55 if k % 2 == 0 else 0.8) if kind != "pulse" else 0.5
                        note = (np.tanh(1.6 * sub) * 0.8 + mid * 0.35) * env_adsr(len(x), 0.004, 0.12, 0.6, 0.05) * v
                        add(bass, note, t0, 0.3 if kind != "pulse" else 0.22)
                else:
                    dd = d + (2.5 if kind == "resolve" else 0.1)
                    x = tt(dd)
                    sub = np.tanh(1.3 * (np.sin(2 * np.pi * f0 * x) + 0.25 * np.sin(4 * np.pi * f0 * x)))
                    add(bass, sub * env_adsr(len(x), 0.02, 0.3, 0.7, 0.8 if kind != "resolve" else 2.4), s + b * BEAT, 0.34)
            # ---- plucked arpeggio, sixteenths
            if kind in ("pulse", "main", "main2", "break", "resolve", "build"):
                seq = [0, 2, 1, 3, 2, 1, 3, 0, 1, 3, 2, 0, 3, 1, 2, 3]
                steps = min(4, nb - b) * 4
                for k in range(steps):
                    if kind in ("break", "resolve", "build") and k % 2:
                        continue
                    if kind == "pulse" and k % 4 == 3:
                        continue
                    m = notes[seq[k % 16]] + 12
                    t0 = s + b * BEAT + k * S16
                    dd = 0.32
                    x = tt(dd)
                    raw = saw(mtof(m), dd) * 0.6 + np.sign(np.sin(2 * np.pi * mtof(m) * x)) * 0.25
                    fc = 1400 + 5200 * np.exp(-x / 0.07)
                    y = sweep_lp(raw, fc, block=128) * np.exp(-x / 0.11)
                    acc = 1.0 if k % 4 == 0 else 0.7
                    lvl = {"pulse": .12, "main": .17, "main2": .18, "break": .14, "resolve": .11, "build": .1}[kind]
                    # the pulse section's arp opens up as it goes
                    if kind == "pulse":
                        y = lp(y, 700 + 3000 * (t0 - s) / (e - s))
                    add(keys, y * acc, t0, lvl, pan=0.35 * np.sin(k * 1.3))
            b += 4
        # ---- offbeat chord stabs, the lift that makes it a launch
        if kind in ("main", "main2"):
            for k in range(nb):
                name = ch[(k // 4) % len(ch)]
                for m in BARS[name][1][:3]:
                    add(keys, pad_note(m + 12, 0.09, 5200, voices=4, attack=0.004, release=0.09), s + (k + .5) * BEAT, 0.07, pan=0)
            add(drums, crash(), s, 0.22)
        if kind in ("resolve",):
            add(drums, crash(), s, 0.14)
        # ---- drums
        if kind in ("main", "main2"):
            for k in range(nb):
                t0 = s + k * BEAT
                kicks.append(t0)
                if k % 2 == 1:
                    add(drums, clap(), t0, 0.32)
            for k in range(nb * 2):
                t0 = s + k * BEAT / 2
                op = kind == "main2" and k % 2 == 1
                add(drums, hat(0.22 if op else 0.035), t0, (0.18 if k % 2 else 0.1) * (1.3 if op else 1), pan=0.25)
            for k in range(nb * 4):
                if k % 4 in (1, 3):
                    add(drums, hat(0.02), s + k * S16, 0.035, pan=-0.3)
        elif kind == "intro":
            for k in range(nb):  # a clock
                add(drums, tick_hat(), s + k * BEAT, 0.07 if k % 2 == 0 else 0.045, pan=0.4 if k % 2 else -0.4)
        elif kind == "break":
            for k in range(nb * 2):
                add(drums, hat(0.03), s + k * BEAT / 2, 0.07 if k % 2 else 0.04, pan=0.2)
        elif kind == "pulse":
            for k in range(nb):
                add(drums, tick_hat(), s + k * BEAT, 0.06, pan=0.3)
                add(drums, hat(0.03), s + (k + .5) * BEAT, 0.05, pan=-0.2)
            # soft heartbeat on 1 and the "and" of 1
            for k in range(0, nb, 4):
                add(drums, kick(0.55), s + k * BEAT, 0.5)
                add(drums, kick(0.35), s + (k + .75) * BEAT, 0.35)
    for k in kicks:
        add(drums, kick(1.0), k, 0.6)
    # the build to the drop: snare roll in the break's last beat and in the lift
    # a snare roll into every drop and into the dot landing on the logo
    rolls = [(t - 0.6, t, .15) for t in cue_t("impact")] + [(t - 2 * BEAT, t, .15) for t in cue_t("thud")]
    for (a, b_, lvl) in rolls:
        n = int(round((b_ - a) / (S16 / 2)))
        for k in range(n):
            add(drums, snare(), a + k * S16 / 2, lvl * (0.3 + 0.7 * k / n), pan=0.1)
    # sidechain: everything melodic breathes with the kick
    duck = np.ones(N)
    for k in kicks:
        i = at(k); x = np.arange(int(0.3 * SR)) / SR
        g = 1 - 0.55 * np.exp(-x / 0.09)
        j = min(N, i + len(g)); duck[i:j] = np.minimum(duck[i:j], g[: j - i])
    pads *= duck[:, None]; keys *= duck[:, None]; bass *= (0.4 + 0.6 * duck)[:, None]
    keys = delay(keys, BEAT * 0.75, fb=0.32, mix=0.28)
    keys = reverb(keys, IR_HALL, 0.25)
    pads = reverb(pads, IR_HALL, 0.35)
    drums = reverb(drums, IR_ROOM, 0.18)
    bass = hp(bass, 34)
    drums = hp(drums, 32)
    return pads, bass, keys, drums

def kick(v=1.0):
    x = tt(0.5)
    f = 45 + 95 * np.exp(-x / 0.045)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.16)
    click = hp(noise(0.5), 2500) * np.exp(-x / 0.004) * 0.3
    return np.tanh(1.8 * (body + click)) * v

def clap():
    x = tt(0.35); out = np.zeros(len(x))
    for k, dt in enumerate([0, 0.011, 0.023]):
        i = at(dt); nz = bp(noise(0.35), 900, 3200)[: len(x) - i]
        out[i:] += nz * np.exp(-x[: len(x) - i] / (0.012 if k < 2 else 0.09))
    return out * 0.8

def crash():
    d = 2.2; x = tt(d)
    return (hp(noise(d), 4500, 2) * np.exp(-x / 0.7) + bp(noise(d), 2500, 6000) * np.exp(-x / 0.12) * 0.5) * 0.7

def snare():
    x = tt(0.18)
    return (bp(noise(0.18), 1500, 7000) * np.exp(-x / 0.05) + np.sin(2 * np.pi * 190 * x) * np.exp(-x / 0.03) * 0.5) * 0.8

def hat(decay):
    d = max(0.08, decay * 5); x = tt(d)
    return hp(noise(d), 7500, 4) * np.exp(-x / decay)

def tick_hat():
    x = tt(0.06)
    return (hp(noise(0.06), 5000, 4) * np.exp(-x / 0.008) + np.sin(2 * np.pi * 3100 * x) * np.exp(-x / 0.01) * 0.3)


# ---------------------------------------------------------------- effects
def sfx_key(v):
    d = 0.06; x = tt(d)
    f = 150 + 70 * rng.random()
    thock = np.sin(2 * np.pi * f * x) * np.exp(-x / 0.012)
    clk = bp(noise(d), 2200, 6500) * np.exp(-x / 0.004)
    return (thock * 0.5 + clk * 0.9) * v

def sfx_whoosh(d, v=1.0, up=True):
    x = tt(d); p = x / d
    nz = noise(d)
    fc = (300 + 3200 * p ** 1.5) if up else (3500 - 3100 * p)
    y = sweep_lp(hp(nz, 150), fc, q=1.4)
    e = np.sin(np.pi * p) ** 1.6
    y = y * e * v
    pan = np.linspace(-0.7, 0.7, len(x))
    return np.stack([y * np.cos((pan + 1) * np.pi / 4), y * np.sin((pan + 1) * np.pi / 4)], 1) * 1.4

def sfx_paper(v):
    d = 0.22; x = tt(d)
    flap = bp(noise(d), 1200, 7000) * np.exp(-x / 0.035)
    thud = np.sin(2 * np.pi * (110 + 40 * np.exp(-x / .02)) * x) * np.exp(-x / 0.04) * 0.6
    return (flap * 0.55 + thud) * v

def sfx_tick(v):
    x = tt(0.12)
    return (np.sin(2 * np.pi * 1760 * x) * np.exp(-x / 0.03) + 0.5 * np.sin(2 * np.pi * 2640 * x) * np.exp(-x / 0.02)) * v * 0.5

def sfx_blip(v):
    x = tt(0.09); f = 900 + 500 * (x / 0.09)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.025) * v * 0.45

def sfx_pop(v):
    x = tt(0.14); f = 420 + 380 * (1 - np.exp(-x / 0.02))
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.035) + bp(noise(0.14), 800, 3000) * np.exp(-x / 0.006) * 0.4) * v * 0.6

def sfx_click():
    out = np.zeros(int(0.12 * SR))
    for dt, g in [(0, 1), (0.065, 0.6)]:
        x = tt(0.03); c = bp(noise(0.03), 1800, 6000) * np.exp(-x / 0.003) + np.sin(2 * np.pi * 420 * x) * np.exp(-x / 0.006) * .5
        i = at(dt); out[i:i + len(c)] += c * g
    return out * 0.8

def sfx_scan(d):
    x = tt(d + .3); p = np.clip(x / d, 0, 1)
    body = sweep_lp(noise(d + .3), 600 + 2500 * p, q=3) * 0.5
    tone = np.sin(2 * np.pi * (700 + 500 * p) * x) * 0.12
    e = np.minimum(1, x / 0.08) * np.where(x < d, 1, np.exp(-(x - d) / 0.08))
    return (body + tone) * e * 0.5

def sfx_swish(v):
    return sfx_whoosh(0.3, v * 0.8, up=True)

def sfx_type(d, v=0.5):
    out = np.zeros(int((d + 0.1) * SR)); n = max(2, int(d / 0.045))
    for k in range(n):
        c = sfx_key(v * (0.6 + 0.4 * rng.random())); i = at(k * d / n)
        out[i:i + len(c)] += c[: len(out) - i]
    return out

def sfx_alert(v):
    out = np.zeros(int(0.7 * SR))
    for dt, m in [(0, 81), (0.12, 76)]:
        x = tt(0.5); f = mtof(m)
        s = (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(4 * np.pi * f * x)) * np.exp(-x / 0.18) * np.minimum(1, x / 0.004)
        i = at(dt); out[i:i + len(s)] += s
    return out * v * 0.28

def sfx_riser(d):
    x = tt(d); p = x / d
    nz = sweep_lp(hp(noise(d), 300), 400 + 9000 * p ** 2, q=2)
    tone = np.sin(2 * np.pi * np.cumsum(180 + 900 * p ** 2) / SR) * 0.15
    e = p ** 2.2
    return (nz * 0.7 + tone) * e

def sfx_implode(d):
    x = tt(d); p = x / d
    rev = hp(noise(d), 1500) * p ** 3
    return reverb(rev, IR_HALL, 0.4)[:, 0] * 0.7

def sfx_impact(v):
    d = 2.8; x = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-x / 0.07)) / SR) * np.exp(-x / 0.6)
    crack = lp(noise(d), 3000) * np.exp(-x / 0.05)
    air = hp(noise(d), 4000) * np.exp(-x / 0.5) * 0.25
    return np.tanh(1.5 * (sub * 1.1 + crack * 0.6 + air)) * v

def sfx_shimmer(d, v=1.0):
    x = tt(d); out = np.zeros(len(x))
    for k, m in enumerate([86, 90, 93, 97, 98]):
        f = mtof(m)
        out += np.sin(2 * np.pi * f * x + k) * (0.6 + 0.4 * np.sin(2 * np.pi * (3 + k) * x)) * np.minimum(1, x / 0.25) * np.exp(-x / (d * 0.35))
    return out * 0.07 * v

def sfx_zip(d):
    return sfx_whoosh(d, 0.5, up=True)

def sfx_toggle():
    out = np.zeros(int(0.2 * SR))
    for dt, f in [(0, 700), (0.05, 520)]:
        x = tt(0.06); c = (np.sin(2 * np.pi * f * x) * np.exp(-x / 0.01) + bp(noise(0.06), 2000, 6000) * np.exp(-x / 0.003) * 0.5)
        i = at(dt); out[i:i + len(c)] += c
    return out * 0.7

def sfx_hit(v):
    d = 1.2; x = tt(d)
    body = kick(1.0)
    body = np.pad(body, (0, max(0, len(x) - len(body))))[: len(x)]
    cl = np.pad(clap(), (0, len(x)))[: len(x)]
    return (body * 0.7 + cl * 0.6 + hp(noise(d), 5000) * np.exp(-x / 0.15) * 0.2) * v

def sfx_draw(d):
    x = tt(d); p = x / d
    nz = bp(noise(d), 2500, 7000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 7 * x)))
    return nz * np.sin(np.pi * p) ** 0.6 * 0.18

def sfx_fall(d):
    x = tt(d); f = 1800 - 1300 * (x / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (x / d) ** 2 * 0.1 + sweep_lp(noise(d), 800 + 2500 * (x / d)) * (x / d) ** 2 * 0.25

def sfx_thud(v):
    d = 3.5; x = tt(d)
    sub = np.sin(2 * np.pi * np.cumsum(34 + 70 * np.exp(-x / 0.05)) / SR) * np.exp(-x / 0.9)
    k = np.pad(kick(1.0), (0, len(x)))[: len(x)]
    air = hp(noise(d), 3000) * np.exp(-x / 0.9) * 0.18
    return np.tanh(1.4 * (sub * 1.2 + k * 0.6 + air)) * v

def sfx_boot():
    out = np.zeros(int(1.4 * SR))
    for k, m in enumerate([69, 73, 76, 81]):
        x = tt(1.0); f = mtof(m)
        b = (np.sin(2 * np.pi * f * x) + .25 * np.sin(4 * np.pi * f * x)) * np.exp(-x / 0.35) * np.minimum(1, x / 0.004)
        i = at(k * 0.07); out[i:i + len(b)] += b
    return out * 0.25

def sfx_send():
    x = tt(0.22); p = x / 0.22
    chirp = np.sin(2 * np.pi * np.cumsum(600 + 900 * p) / SR) * np.exp(-x / 0.05) * 0.4
    air = sweep_lp(hp(noise(0.22), 800), 1500 + 6000 * p, q=1.2) * np.sin(np.pi * p) * 0.5
    return chirp + air

def sfx_recv():
    out = np.zeros(int(0.3 * SR))
    for dt, f in [(0, 988), (0.06, 1319)]:
        x = tt(0.2); b = np.sin(2 * np.pi * f * x) * np.exp(-x / 0.05) * np.minimum(1, x / 0.003)
        i = at(dt); out[i:i + len(b)] += b
    return out * 0.45

def sfx_whip():
    return sfx_whoosh(0.3, 1.2, up=True)

def sfx_flip():
    x = tt(0.06)
    return (bp(noise(0.06), 1500, 6000) * np.exp(-x / 0.008) + np.sin(2 * np.pi * 300 * x) * np.exp(-x / 0.01) * .4) * .6

def sfx_star(v):
    x = tt(0.4); f = 1568 * (1 + .12 * (v - .6) / .32)
    return (np.sin(2 * np.pi * f * x) + .4 * np.sin(2 * np.pi * f * 1.5 * x)) * np.exp(-x / 0.09) * np.minimum(1, x / 0.003) * 0.35

# --------------------------------------------------------- music: drum-led
# For films whose film.py sets MUSIC = "drums": the groove is the track.
# Stomps and wide layered claps, sixteenth hats and a shaker, a 3-3-2 rim
# figure, clap and tom fills into the cuts, a syncopated bass, offbeat stabs
# and a short plucked hook on top. The opening plays as if through a wall and
# opens up into the drop; the end lands on one last hit.

def kick_punch(v=1.0):
    x = tt(0.42)
    f = 50 + 160 * np.exp(-x / 0.028)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.19)
    click = hp(noise(0.42), 3000) * np.exp(-x / 0.003) * 0.45
    return np.tanh(2.4 * (body + click)) * v

def clap_layer(r):
    d = 0.45; x = tt(d); n = len(x); out = np.zeros(n)
    for k, dt in enumerate([0, 0.008, 0.017, 0.027]):
        i = at(dt); nz = bp(r.standard_normal(n), 950, 4800)[: n - i]
        out[i:] += nz * np.exp(-x[: n - i] / (0.007 if k < 3 else 0.15))
    out += bp(r.standard_normal(n), 350, 1000) * np.exp(-x / 0.025) * 0.7
    return out * 0.75

def stereo(l, r):
    n = max(len(l), len(r)); o = np.zeros((n, 2)); o[: len(l), 0] = l; o[: len(r), 1] = r
    return o

def rim(v=1.0):
    x = tt(0.08)
    return (bp(noise(0.08), 1800, 6500) * np.exp(-x / 0.004) * 0.8 + np.sin(2 * np.pi * 1750 * x) * np.exp(-x / 0.012) * 0.6
            + np.sin(2 * np.pi * 520 * x) * np.exp(-x / 0.01) * 0.4) * v

def shaker(v=1.0):
    x = tt(0.07)
    return hp(noise(0.07), 5500, 2) * np.minimum(1, x / 0.006) * np.exp(-x / 0.022) * v

def tom(f0, v=1.0):
    x = tt(0.35); f = f0 * (1 + 0.6 * np.exp(-x / 0.03))
    return (np.tanh(1.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.16)) + bp(noise(0.35), 200, 2000) * np.exp(-x / 0.01) * 0.2) * v

def bass_note(m, d, v=1.0):
    f0 = mtof(m); x = tt(d)
    sub = np.sin(2 * np.pi * f0 * x) + 0.35 * np.sin(4 * np.pi * f0 * x)
    mid = lp(saw(f0 * 2, d), 520)
    return (np.tanh(1.7 * sub) * 0.8 + mid * 0.4) * env_adsr(len(x), 0.004, 0.1, 0.65, 0.04) * v

def build_music_drums():
    pads, bass, keys, drums = buf(), buf(), buf(), buf()
    room = buf()                      # the opening, heard through a wall
    r = np.random.default_rng(99)
    claps = [stereo(clap_layer(r), clap_layer(r)) for _ in range(4)]
    SEC = sections()
    groove = next(s for s, e, k, c in SEC if k == "main")
    gbar = int(round(groove / (4 * BEAT)))
    lift0 = next(s for s, e, k, c in SEC if k == "lift")
    dot = next(s for s, e, k, c in SEC if k == "resolve")
    button = np.ceil((TL["lines"][-1]["end"] + 0.35) / BEAT - 1e-6) * BEAT
    kind_at = lambda t: next((k for s, e, k, c in SEC if s - 1e-3 <= t < e - 1e-3), "resolve")
    def chord_at(t, bar):
        for s, e, k, c in SEC:
            if s - 1e-3 <= t < e - 1e-3:
                if k in ("main", "main2"):
                    return c[(bar - gbar) % len(c)]
                return c[min(int((t - s) / (4 * BEAT)), len(c) - 1)]
        return "D"
    cuts = [x["start"] for x in TL["scenes"][1:-1] if x["start"] > groove + 1]
    kicks = []
    n16 = int(DUR / S16) + 1
    for g in range(n16):
        t0 = g * S16; st, bar = g % 16, g // 16
        kind = kind_at(t0)
        name = chord_at(t0, bar); root, notes = BARS[name]
        hv = [.55, .22, .8, .28][st % 4]
        if kind in ("intro", "build"):
            dst = room
            last_beat = kind == "build" and t0 >= groove - BEAT - 1e-3
            if st in (0, 8) and not last_beat:
                add(dst, kick_punch(0.9), t0, 0.55)
            if kind == "intro" and st in (4, 12):
                add(dst, claps[g % 4], t0, 0.5)
            if kind == "build":   # claps double up into the drop
                k = int(round((t0 - (groove - 2 * BEAT)) / S16))
                if (k < 4 and k % 2 == 0) or k >= 4:
                    add(dst, claps[g % 4], t0, 0.25 + 0.3 * k / 8)
            if st % 2 == 0:
                add(dst, hat(0.03), t0, 0.1 * hv, pan=0.25)
            if st in (0, 3, 6, 8, 11, 14):
                add(dst, bass_note(root + 12, S16 * (2 if st in (6, 14) else 3) * 0.95), t0, 0.28)
        elif kind in ("main", "main2"):
            m2 = kind == "main2"
            if st % 4 == 0:
                add(drums, kick_punch(1.0), t0, 0.62); kicks.append(t0)
            if st == 14 and bar % 2 == 1:
                add(drums, kick_punch(0.7), t0, 0.4); kicks.append(t0)
            if st in (4, 12):
                add(drums, claps[g % 4], t0, 0.62)
                add(drums, snare(), t0, 0.16, pan=0.05)
            fill = bar % 4 == 3 and st >= 12
            if fill and (not m2 or bar % 8 == 3):     # a clap run into the next bar
                if st > 12:
                    add(drums, claps[(g + 1) % 4], t0, 0.18 + 0.12 * (st - 12))
            elif fill and m2:                          # or a run down the toms
                add(drums, tom([196, 165, 131, 110][st - 12], 0.9), t0, 0.32, pan=[-.4, -.15, .15, .4][st - 12])
            elif st == 15 and bar % 2 == 1:
                add(drums, claps[(g + 2) % 4], t0, 0.16)
            add(drums, hat(0.025), t0, 0.1 * hv, pan=0.25)
            add(drums, shaker([.3, .8, .5, .9][st % 4]), t0, 0.07, pan=-0.45)
            if m2 and st % 4 == 2:
                add(drums, hat(0.16), t0, 0.07, pan=0.3)
            if st in (3, 6, 11, 14):
                add(drums, rim(0.9 if st in (6, 14) else 0.6), t0, 0.13, pan=0.4)
            # bass, 3-3-2, with the octave on the twos
            if st in (0, 3, 6, 8, 11, 14):
                oc = 12 if st in (6, 14) else 0
                add(bass, bass_note(root + 12 + oc, S16 * (2 if st in (6, 14) else 3) * 0.95), t0, 0.3)
            # offbeat stabs
            if st % 4 == 2:
                for m in notes[:3]:
                    add(keys, pad_note(m + 12, 0.09, 5600 if m2 else 4600, voices=4, attack=0.004, release=0.09), t0, 0.06 if m2 else 0.05)
            # the hook: five plucked notes a bar
            if st in (0, 3, 6, 10, 12):
                m = [notes[0], notes[2], notes[1], notes[3], notes[2]][[0, 3, 6, 10, 12].index(st)] + 24
                x = tt(0.3); raw = saw(mtof(m), 0.3) * 0.6 + np.sign(np.sin(2 * np.pi * mtof(m) * x)) * 0.25
                y = sweep_lp(raw, 1600 + 5200 * np.exp(-x / 0.06), block=128) * np.exp(-x / 0.1)
                add(keys, y, t0, 0.1 if m2 else 0.08, pan=0.3 * np.sin(g))
            if st == 0:
                d = 4 * BEAT
                for m in notes:
                    add(pads, pad_note(m, d, 2600, attack=0.2, release=0.5), t0, 0.035)
        elif kind == "lift":
            k = int(round((t0 - lift0) / S16)); left = int(round((dot - t0) / S16))
            if (left > 8 and st % 4 == 0) or (4 < left <= 8 and st % 2 == 0) or left <= 4:
                add(drums, claps[g % 4], t0, 0.3 + 0.25 * min(1, k / max(1, (dot - lift0) / S16)))
            if st % 2 == 0:
                add(drums, hat(0.03), t0, 0.08 * hv, pan=0.25)
            if st == 0 or k == 0:
                for m in notes:
                    add(pads, pad_note(m, 4 * BEAT, 2200, attack=0.3, release=0.4), t0, 0.06)
                add(bass, bass_note(root + 12, 4 * BEAT, 0.8), t0, 0.22)
        elif kind == "resolve":
            if t0 < button - 1e-3:
                if st % 4 == 0:
                    add(drums, kick_punch(1.0), t0, 0.5); kicks.append(t0)
                if st in (4, 12):
                    add(drums, claps[g % 4], t0, 0.5)
                add(drums, hat(0.025), t0, 0.08 * hv, pan=0.25)
                if st in (0, 3, 6, 8, 11, 14):
                    add(bass, bass_note(root + 12 + (12 if st in (6, 14) else 0), S16 * (2 if st in (6, 14) else 3) * 0.95), t0, 0.24)
                if st % 4 == 2:
                    for m in notes[:3]:
                        add(keys, pad_note(m + 12, 0.09, 4600, voices=4, attack=0.004, release=0.09), t0, 0.04)
    # the landing: dot, then the button
    for t in (dot,):
        add(drums, kick_punch(1.0), t, 0.62); add(drums, claps[0], t, 0.7); add(drums, crash(), t, 0.2); kicks.append(t)
    add(drums, kick_punch(1.0), button, 0.7); add(drums, claps[1], button, 0.8); add(drums, claps[2], button + 0.012, 0.4)
    add(drums, crash(), button, 0.26)
    root, notes = BARS["D"]
    for m in notes + [n + 12 for n in notes[1:]]:
        add(keys, pad_note(m + 12, 0.35, 5000, voices=5, attack=0.004, release=1.6), button, 0.07)
    x = tt(1.4); f0 = mtof(root + 12)
    add(bass, np.tanh(1.5 * (np.sin(2 * np.pi * f0 * x) + 0.3 * np.sin(4 * np.pi * f0 * x))) * np.exp(-x / 0.45), button, 0.3)
    for m in notes:
        add(pads, pad_note(m, button - dot, 3000, attack=0.4, release=1.2), dot, 0.05)
    # a crash on every cut after the drop
    for t in cuts:
        add(drums, crash(), t, 0.1)
    # snare rolls into the drop and into the dot
    for (a, b_) in [(t - 0.6, t) for t in cue_t("impact")]:
        n = int(round((b_ - a) / (S16 / 2)))
        for k in range(n):
            add(room if b_ <= groove + 1e-3 else drums, snare(), a + k * S16 / 2, 0.15 * (0.3 + 0.7 * k / n), pan=0.1)
    # the opening, through a wall: shut until "work", then open into the drop
    t = np.arange(N) / SR
    ws = SC["work"]["start"]
    cut = np.where(t < ws, 520.0, 520.0 * (14000 / 520) ** np.clip((t - ws) / max(0.05, groove - ws), 0, 1))
    cut[t >= groove] = 16000
    end = at(groove + 0.6)
    for c in range(2):
        room[:end, c] = sweep_lp(room[:end, c], cut[:end], block=128, q=1.1)
    drums += room * 1.15
    # sidechain: the melodic parts breathe with the kick
    duck = np.ones(N)
    for k in kicks:
        i = at(k); x = np.arange(int(0.26 * SR)) / SR
        gg = 1 - 0.5 * np.exp(-x / 0.08)
        j = min(N, i + len(gg)); duck[i:j] = np.minimum(duck[i:j], gg[: j - i])
    pads *= duck[:, None]; keys *= duck[:, None]; bass *= (0.45 + 0.55 * duck)[:, None]
    keys = delay(keys, BEAT * 0.75, fb=0.28, mix=0.22)
    keys = reverb(keys, IR_HALL, 0.22)
    pads = reverb(pads, IR_HALL, 0.35)
    drums = reverb(drums, IR_ROOM, 0.14)
    bass = hp(bass, 34)
    drums = hp(drums, 30)
    return pads, bass, keys, drums

# ------------------------------------------------------------ music: the band
# For films whose film.py sets MUSIC = "band": an upbeat pop band played by
# sampled acoustic instruments from a General MIDI SoundFont (GeneralUser GS,
# free for commercial music) instead of synthesised ones. Steel-string guitar
# strumming sixteenths, a bouncing piano on the offbeats, picked bass, a live
# kit stomping four to the floor with hand claps and a tambourine, a whistled
# hook doubled on glockenspiel, and brass hits on the drop, the dot and the
# last beat. Nothing is hit on the cuts: a line starts right after each one.
SOUNDFONT = os.environ.get("SOUNDFONT", os.path.join(HERE, "build", "models", "soundfont", "GeneralUser-GS.sf2"))

def sf_part(notes, bank, preset, drums=False):
    """Render (time, key, velocity, duration) notes with one SoundFont preset."""
    import tinysoundfont
    syn = tinysoundfont.Synth(samplerate=SR)
    sid = syn.sfload(SOUNDFONT)
    ch = 9 if drums else 0
    syn.program_select(ch, sid, bank, preset, drums)
    ev = sorted([(t, 1, k, v) for t, k, v, d in notes] + [(t + d, 0, k, 0) for t, k, v, d in notes], key=lambda e: (e[0], e[1]))
    out = np.zeros((N, 2)); pos = 0
    def run(i):
        nonlocal pos
        while pos < i:
            n = min(i - pos, SR)
            out[pos:pos + n] = np.frombuffer(syn.generate(n), np.float32).reshape(-1, 2)
            pos += n
    for t, on, k, v in ev:
        run(min(N, max(pos, at(t))))
        if on:
            syn.noteon(ch, int(k), int(np.clip(round(v), 1, 127)))
        else:
            syn.noteoff(ch, int(k))
    run(N)
    return out

def to_lufs(x, target):
    loud = pyln.Meter(SR).integrated_loudness(x)
    return x * 10 ** ((target - loud) / 20) if np.isfinite(loud) else x

# open-position guitar chords, low string to high; piano right hand; bass roots
GTR = {"D": [50, 57, 62, 66], "A": [45, 52, 57, 61, 64], "Bm": [47, 54, 59, 62, 66], "G": [43, 47, 50, 55, 59, 67]}
PNO = {"D": [62, 66, 69], "A": [61, 64, 69], "Bm": [62, 66, 71], "G": [62, 67, 71]}
ROOT = {"D": 38, "A": 33, "Bm": 35, "G": 31}
# the hook, four bars over D A Bm G: (sixteenth, note, length in sixteenths)
HOOK = [(0, 78, 2), (3, 81, 1), (4, 81, 2), (6, 83, 2), (8, 81, 4), (12, 78, 2), (14, 74, 2),
        (16, 76, 2), (19, 78, 1), (20, 76, 2), (22, 73, 2), (24, 76, 6),
        (32, 74, 2), (35, 78, 1), (36, 78, 2), (38, 81, 2), (40, 83, 4), (44, 81, 2), (46, 78, 2),
        (48, 79, 2), (51, 78, 1), (52, 76, 2), (54, 74, 2), (56, 76, 6)]
# the strum: sixteenth, direction, weight
STRUM = [(0, 1, 1.0), (3, -1, .5), (4, 1, .75), (6, -1, .65), (8, 1, .9), (10, -1, .6), (11, -1, .42), (12, 1, .8), (14, -1, .62)]
K_KICK, K_SNARE, K_CLAP, K_OHAT, K_CRASH, K_TAMB, K_SHAKE = 36, 38, 39, 46, 49, 54, 70
TOMS = [50, 48, 47, 45]

def build_music_band():
    hr = np.random.default_rng(144)
    jit = lambda: hr.normal(0, 0.004)
    hv = lambda v: v + hr.integers(-6, 7)
    kit, gtr, mute, pno, bas, whis, glock, brass = [], [], [], [], [], [], [], []
    claps = []                                # a layer of synthesised claps under the kit's, for width
    kicks = []                                # and a little weight under the kit's kick
    SEC = sections()
    groove = next(s for s, e, k, c in SEC if k == "main")
    lift0 = next(s for s, e, k, c in SEC if k == "lift")
    dot = next(s for s, e, k, c in SEC if k == "resolve")
    button = np.ceil((TL["lines"][-1]["end"] + 0.35) / BEAT - 1e-6) * BEAT
    kind_at = lambda t: next((k for s, e, k, c in SEC if s - 1e-3 <= t < e - 1e-3), "resolve")
    def strum(t, name, w, direction, dur, vel=104):
        ns = GTR[name] if direction > 0 else GTR[name][-4:][::-1]
        for i, k in enumerate(ns):
            gtr.append((t + i * 0.011 + jit(), k, hv(vel * w), dur))
    def chord(lst, t, notes, vel, dur):
        for k in notes:
            lst.append((t + jit(), k, hv(vel), dur))
    g0, g1 = -int(np.floor(groove / S16 + 1e-6)), int((DUR - groove) / S16)
    for g in range(g0, g1 + 1):
        t0 = groove + g * S16
        if t0 < -1e-6:
            continue
        st, bar = g % 16, g // 16
        kind = kind_at(t0)
        if kind in ("intro", "build"):
            name = {-1: "A", -2: "G"}.get(bar, "Bm")
        elif kind in ("main", "main2"):
            name = ["D", "A", "Bm", "G"][bar % 4]
        else:
            name = "A" if kind == "lift" else "D"
        if kind == "intro":
            if st in (0, 8):
                kit.append((t0, K_KICK, hv(84), .2))
            if st in (4, 12):
                kit.append((t0 + jit(), K_CLAP, hv(96), .2)); claps.append((t0, .22))
            if st % 4 == 2:
                kit.append((t0 + jit(), K_TAMB, hv(72), .1))
            if st % 2 == 0:
                r = ROOT[name] + 12
                for k in (r, r + 7, r + 12):
                    mute.append((t0 + jit(), k, hv(92 if st % 4 == 0 else 78), .1))
            if st in (0, 8):
                bas.append((t0 + jit(), ROOT[name] + 12, hv(88), .32))
        elif kind == "build":
            k = int(round((t0 - (groove - 2 * BEAT)) / S16))
            if k % 2 == 0 or k >= 4:
                kit.append((t0 + jit(), K_SNARE, 50 + 60 * k / 8, .1))
                kit.append((t0 + jit(), K_CLAP, 60 + 50 * k / 8, .1)); claps.append((t0, .1 + .2 * k / 8))
            if k % 2 == 0:
                strum(t0, "A", .55 + .45 * k / 8, 1, S16 * 1.8)
                bas.append((t0 + jit(), ROOT["A"] + 12, hv(92), S16 * 1.8))
            if k == 0:
                kit.append((t0, K_KICK, 100, .2))
        elif kind in ("main", "main2") or (kind == "resolve" and dot - 1e-3 <= t0 < button - 1e-3):
            m2 = kind == "main2"
            fin = kind == "resolve"
            if st % 4 == 0:
                kit.append((t0, K_KICK, hv(120), .2)); kicks.append(t0)
            if st in (4, 12):
                kit.append((t0 + jit(), K_SNARE, hv(96), .2))
                kit.append((t0 + jit(), K_CLAP, hv(116), .2)); claps.append((t0, .34))
            if st % 2 == 0:
                kit.append((t0 + jit(), K_TAMB, hv(106 if st % 4 == 2 else 74), .1))
            else:
                kit.append((t0 + jit(), K_SHAKE, hv(62), .1))
            if m2 and st % 4 == 2:
                kit.append((t0 + jit(), K_OHAT, hv(70), .2))
            if st == 0 and (bar % 4 == 0 or fin and t0 < dot + S16):
                kit.append((t0, K_CRASH, hv(96), 1.0))
            if not fin and bar % 4 == 3 and st >= 12:          # fills into each four-bar phrase
                if m2 and bar % 8 == 7:
                    kit.append((t0, TOMS[st - 12], hv(100), .2))
                else:
                    kit.append((t0 + jit(), K_SNARE, 70 + 13 * (st - 12), .1))
            for s_, d_, w in STRUM:
                if st == s_:
                    strum(t0, name, w, d_, S16 * (1.9 if w > .7 else .9))
            if st % 4 == 2:
                chord(pno, t0, PNO[name], 90 if m2 else 84, .12)
            if m2 and st == 0:
                chord(pno, t0, [n - 12 for n in PNO[name]], 76, .3)
            if st % 2 == 0:
                bas.append((t0 + jit(), ROOT[name] + (24 if st == 14 else 12), hv(104 if st % 4 == 0 else 90), .19))
            if not fin:
                ph = g % 64
                for (hs, note, ln) in HOOK:
                    if hs == ph:
                        whis.append((t0 + jit(), note, hv(98), ln * S16 * 0.92))
                        if m2:
                            glock.append((t0, note + 12, hv(92), ln * S16))
        elif kind == "lift":
            left = int(round((dot - t0) / S16))
            if (left > 8 and st % 4 == 0) or (4 < left <= 8 and st % 2 == 0) or left <= 4:
                kit.append((t0 + jit(), K_CLAP, 84 + 36 * (1 - min(1, left / 16)), .1)); claps.append((t0, .2 + .15 * (1 - min(1, left / 16))))
            if left <= 8:
                kit.append((t0 + jit(), K_SNARE, 55 + 55 * (1 - left / 8), .1))
            if st % 2 == 0:
                kit.append((t0 + jit(), K_TAMB, hv(64), .1))
            if st % 4 == 0:
                strum(t0, "A", .8, 1, BEAT * .9, vel=96)
    # hits: the drop, the dot and the button
    root_chord = lambda name: [n + 12 for n in PNO[name]] + [PNO[name][0]]
    chord(brass, groove, root_chord("D"), 116, .32)
    kit.append((groove, K_CRASH, 112, 1.5))
    bas.append((lift0, ROOT["A"] + 12, 96, dot - lift0 - .02))
    chord(pno, lift0, [57, 61, 64, 69], 70, dot - lift0)
    chord(brass, dot, root_chord("D"), 116, .3)
    kit.append((dot, K_KICK, 118, .2)); kit.append((dot, K_CRASH, 110, 1.5)); claps.append((dot, .4))
    strum(dot, "D", 1.0, 1, .5, vel=112)
    chord(brass, button, root_chord("D"), 118, 1.1)
    kit += [(button, K_KICK, 120, .2), (button, K_CRASH, 116, 2), (button, K_CLAP, 120, .2), (button, K_SNARE, 110, .2)]
    claps.append((button, .45))
    strum(button, "D", 1.0, 1, 2.2, vel=118)
    bas.append((button, ROOT["D"] + 12, 110, 1.3))
    chord(pno, button, [50, 57, 62, 66, 69, 74], 96, 1.8)
    glock.append((button, 86, 100, 1.2)); glock.append((button, 90, 90, 1.2))
    # render
    UP = 5.0                                  # the band sits this much above the targets below
    P_ = lambda notes, bank, pre, lufs, drums=False: to_lufs(sf_part(notes, bank, pre, drums), lufs + UP) if notes else buf()
    drums = P_(kit, 128, 0, -19.0, True)
    thump = buf()
    for t in kicks + [groove, dot, button]:
        add(thump, lp(kick_punch(1.0), 180), t, 1.0)
    drums += to_lufs(thump, -24.0 + UP)
    r = np.random.default_rng(99)
    cl = [stereo(clap_layer(r), clap_layer(r)) for _ in range(4)]
    for i, (t, v) in enumerate(claps):
        add(drums, cl[i % 4], t, v * 0.5)
    guitar = P_(gtr, 0, 25, -21.5)
    muted = P_(mute, 0, 28, -25.0)
    piano = P_(pno, 0, 0, -26.5)
    bass = P_(bas, 0, 34, -21.0)
    whistle = P_(whis, 11, 78, -25.5)
    glk = P_(glock, 0, 9, -30.0)
    brs = P_(brass, 0, 61, -27.0)
    # a little air on everything, a room on the kit; the guitar and piano
    # step out of the voice's consonants, and the hook, which sits right in
    # the voice's range, steps back while anyone is speaking
    guitar = reverb(peak_eq(peak_eq(hp(guitar, 90), 2400, -4.5, 0.7), 1100, -2.0, 0.9), IR_HALL, 0.14)
    muted = hp(muted, 90)
    piano = reverb(peak_eq(peak_eq(hp(piano, 120), 2400, -4.5, 0.7), 1100, -2.0, 0.9), IR_HALL, 0.18)
    whistle = reverb(whistle, IR_HALL, 0.24)
    glk = reverb(glk, IR_HALL, 0.3)
    talk = np.zeros(N)
    for l in TL["lines"]:
        talk[at(l["start"] - 0.1):at(l["end"] + 0.15)] = 1
    rel = np.exp(-1 / (0.1 * SR))
    talk = signal.lfilter([1 - rel], [1, -rel], talk)
    lead_duck = 10 ** (-10.0 * np.clip(talk, 0, 1) / 20)[:, None]
    whistle *= lead_duck; glk *= lead_duck
    chord_duck = 10 ** (-6.0 * np.clip(talk, 0, 1) / 20)[:, None]   # the strumming and piano make room too
    guitar *= chord_duck; muted *= chord_duck; piano *= chord_duck; brs *= chord_duck
    brs = reverb(brs, IR_HALL, 0.22)
    drums = hp(reverb(drums, IR_ROOM, 0.12), 30)
    bass = hp(bass, 34)
    keys = guitar + muted + whistle + glk
    pads = piano + brs
    return pads, bass, keys, drums

# ------------------------------------------------------------ music: garage
# For films whose film.py sets MUSIC = "garage": the sound of current tech
# launch films rather than stock "uplifting" music. A minimal UK garage and
# tech house groove in B minor: swung two-step drums that go four to the
# floor for the second half, crisp claps and snaps, a deep sub bass that
# slides, house organ stabs on minor-ninth chords, and a hook of pitched,
# chopped vocal syllables that answers the voice in the gaps between lines.
# The chops are sung by the film's own TTS model, one syllable at a time.
G_STAB = {"Bm9": [62, 66, 69, 73], "Gmaj9": [59, 62, 66, 69], "Em9": [62, 66, 67, 71], "F#m7": [57, 61, 64, 66]}
G_ROOT = {"Bm9": 35, "Gmaj9": 31, "Em9": 40, "F#m7": 30}
G_LOOP = ["Bm9", "Gmaj9", "Em9", "F#m7"]
# the hook, two bars: (sixteenth, syllable, note, length in sixteenths)
G_HOOK = [(0, "oh", 66, 2), (3, "oh", 64, 1), (4, "yeah", 62, 2), (6, "oh", 59, 2), (10, "ay", 62, 2), (12, "oh", 64, 3),
          (16, "ooh", 66, 2), (19, "oh", 69, 1), (20, "oh", 66, 2), (23, "yeah", 64, 2), (26, "hey", 62, 2), (30, "oh", 59, 2)]
CHOP_VOICE = "af_bella"
_CHOPS = {}

def chop_source(syl):
    """One sung syllable from the TTS model: its voiced part and its pitch through time."""
    if syl in _CHOPS:
        return _CHOPS[syl]
    path = os.path.join(BUILD, "chops", f"{syl}.wav")
    if not os.path.exists(path):
        from kokoro_onnx import Kokoro
        models = os.environ.get("KOKORO_DIR", os.path.join(HERE, "build", "models"))
        k = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))
        a, sr = k.create(syl.capitalize() + "!", voice=CHOP_VOICE, speed=1.0, lang="en-us")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        sf.write(path, a, sr)
    a, sr = sf.read(path, dtype="float64")
    a = signal.resample_poly(a, SR, sr)
    env = np.abs(a); on = np.argmax(env > env.max() * 0.08)
    a = a[on:]
    # pitch every 5 ms, from the autocorrelation, held through unvoiced frames
    fr, hop = int(0.03 * SR), int(0.005 * SR)
    lo, hi = int(SR / 600), int(SR / 120)
    ts, fs = [], []
    for i in range(0, len(a) - fr, hop):
        w = a[i:i + fr] * np.hanning(fr); ac = np.correlate(w, w, "full")[fr - 1:]
        j = lo + np.argmax(ac[lo:hi])
        if ac[0] > 0 and ac[j] > 0.35 * ac[0]:
            ts.append(i + fr / 2); fs.append(SR / j)
    fs = signal.medfilt(np.array(fs), 5) if len(fs) >= 5 else np.array(fs or [220.0])
    ts = np.array(ts or [0.0])
    f0 = np.interp(np.arange(len(a)), ts, fs)
    a = a / (np.sqrt((a[: int(0.2 * SR)] ** 2).mean()) + 1e-9) * 0.1
    _CHOPS[syl] = (a, f0)
    return _CHOPS[syl]

def chop(syl, note, d):
    """The syllable hard-tuned to a note: read at whatever rate holds its pitch on it."""
    a, f0 = chop_source(syl)
    target = mtof(note)
    n = int(d * SR)
    pos = np.zeros(n); p_ = 0.0
    for i in range(n):
        pos[i] = p_
        p_ += target / f0[min(int(p_), len(f0) - 1)]
        if p_ >= len(a) - 1:
            pos = pos[: i + 1]
            break
    y = np.interp(pos, np.arange(len(a)), a)
    e = np.ones(len(y)); f = min(len(y), int(0.004 * SR)); e[:f] = np.linspace(0, 1, f)
    g = min(len(y), int(0.03 * SR)); e[-g:] *= np.linspace(1, 0, g)
    return hp(y * e, 180)

def organ(notes, d, v=1.0):
    """A house organ stab: a few sine partials each, a percussive envelope, a key click."""
    x = tt(d + 0.25); out = np.zeros(len(x))
    for m in notes:
        f = mtof(m)
        for h, a in zip([1, 2, 3, 4, 6, 8], [1, .55, .38, .22, .1, .06]):
            out += a * np.sin(2 * np.pi * f * h * x * (1 + 0.0007 * (h - 1))) * np.exp(-x / (0.16 / (1 + 0.35 * h)))
    env = np.minimum(1, x / 0.002) * np.where(x < d, 1, np.exp(-(x - d) / 0.05))
    click = bp(noise(d + 0.25), 1500, 6000) * np.exp(-x / 0.003) * 0.15
    return lp((out / np.sqrt(len(notes)) * 0.35 + click) * env, 5200) * v

def sub(m, d, v=1.0, from_m=None, glide=0.05):
    """Sine sub with a saturated octave so phones still hear it, sliding in from the last note."""
    x = tt(d)
    f = np.full(len(x), mtof(m))
    if from_m is not None:
        f = mtof(m) + (mtof(from_m) - mtof(m)) * np.exp(-x / glide * 3)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.18 * np.sin(2 * ph)
    y = np.tanh(1.6 * y) * 0.75 + 0.12 * np.tanh(4 * np.sin(2 * ph))
    return y * env_adsr(len(x), 0.003, 0.08, 0.85, 0.03) * v

def reese(m, d, v=1.0):
    x = tt(d)
    y = saw(mtof(m) * 2 ** (0.1 / 12), d) + saw(mtof(m) * 2 ** (-0.1 / 12), d)
    y = np.tanh(2.2 * sweep_lp(y, 420 + 380 * np.exp(-x / 0.08), block=128))
    return y * env_adsr(len(x), 0.005, 0.1, 0.8, 0.04) * v

def snap(v=1.0):
    x = tt(0.12)
    return (bp(noise(0.12), 1300, 5200) * np.exp(-x / 0.011) + np.sin(2 * np.pi * 2300 * x) * np.exp(-x / 0.006) * 0.3) * v

def build_music_garage():
    hr = np.random.default_rng(136)
    jit = lambda: hr.normal(0, 0.002)
    drums, bass, stabs, chops = buf(), buf(), buf(), buf()
    room = buf()
    SEC = sections()
    groove = next(s for s, e, k, c in SEC if k == "main")
    lift0 = next(s for s, e, k, c in SEC if k == "lift")
    dot = next(s for s, e, k, c in SEC if k == "resolve")
    button = np.ceil((TL["lines"][-1]["end"] + 0.35) / BEAT - 1e-6) * BEAT
    kind_at = lambda t: next((k for s, e, k, c in SEC if s - 1e-3 <= t < e - 1e-3), "resolve")
    SW = 0.2 * S16                                      # the swing on every other sixteenth
    r = np.random.default_rng(99)
    claps = [stereo(clap_layer(r), clap_layer(r)) for _ in range(4)]
    kicks = []
    last_bass = [None]
    def kick(dst, t, v):
        add(dst, kick_punch(v), t, 0.6); kicks.append(t)
    def bassn(t, m, d, v=1.0):
        add(bass, sub(m, d, v, last_bass[0]), t, 0.5); last_bass[0] = m
    g0, g1 = -int(np.floor(groove / S16 + 1e-6)), int((DUR - groove) / S16)
    for g in range(g0, g1 + 1):
        t0 = groove + g * S16
        if t0 < -1e-6:
            continue
        st, bar = g % 16, g // 16
        ts = t0 + (SW if st % 2 else 0)                 # swung position
        kind = kind_at(t0)
        name = G_LOOP[bar % 4] if kind in ("main", "main2") else {"intro": ["Bm9", "Gmaj9", "F#m7"][min(2, max(0, bar + 3))], "build": "F#m7", "lift": "Gmaj9" if t0 < (lift0 + dot) / 2 else "F#m7"}.get(kind, "Bm9")
        root, chordn = G_ROOT[name], G_STAB[name]
        hv = [.5, .22, .85, .3][st % 4]
        if kind == "intro":
            if st in (0, 10):
                kick(room, t0, 0.8)
            if st in (4, 12):
                add(room, claps[g % 4], t0, 0.45)
            if st % 2 == 0:
                add(room, hat(0.03), ts, 0.1 * hv, pan=0.25)
            if st in (3, 11):
                add(room, organ(chordn, 0.12), ts, 0.5)
            if st == 0:
                add(room, sub(root, 4 * BEAT * 0.9, 0.9), t0, 0.5)
        elif kind == "build":
            k = int(round((t0 - (groove - 2 * BEAT)) / S16))
            if k < 7:                                   # the last sixteenth before the drop is silent
                add(chops, chop("oh", 59 + [0, 2, 3, 5, 7, 9, 10][k], S16 * 0.9), t0, 0.5 + 0.08 * k)
                add(drums, hat(0.025), t0, 0.08, pan=0.25)
        elif kind in ("main", "main2") or (kind == "resolve" and dot - 1e-3 <= t0 < button - 1e-3):
            four = kind != "main"
            fin = kind == "resolve"
            # drums
            if four and st % 4 == 0:
                kick(drums, t0, 1.0)
            if not four and (st in (0, 10) or (st == 7 and bar % 2 == 1)):
                kick(drums, ts, 1.0 if st != 7 else 0.7)
            if st in (4, 12):
                add(drums, claps[g % 4], t0 + jit(), 0.6)
                add(drums, snap(1.0), t0 + 0.004, 0.18, pan=-0.1)
            if st == 15 and bar % 2 == 1:
                add(drums, rim(0.8), ts, 0.14, pan=0.35)
            add(drums, hat(0.022), ts + jit(), 0.12 * hv, pan=0.25)
            if four and st % 4 == 2:
                add(drums, hat(0.11), ts, 0.07, pan=-0.2)
            add(drums, shaker([.3, .8, .5, .9][st % 4]), ts, 0.05, pan=-0.45)
            if st == 0 and bar % 4 == 0 and not fin:
                add(drums, crash(), t0, 0.1)
            # bass: bouncing two-step, rolling offbeats when it goes four to the floor
            if not four:
                for s_, o_, l_ in [(0, 0, 3), (3, 12, 2), (6, 0, 3), (10, 0, 2), (12, 7, 2), (14, 12, 2)]:
                    if st == s_:
                        bassn(t0 + (SW if s_ % 2 else 0), root + o_, l_ * S16 * 0.92)
            else:
                if st in (0, 2, 6, 10, 14) or (st == 11 and bar % 2 == 1):
                    bassn(ts, root + (12 if st in (6, 14) else 0), (2 if st else 3) * S16 * 0.9)
                if st == 14 and bar % 2 == 1:
                    add(bass, reese(root + 12, 2 * S16 * 0.9), ts, 0.12)
            # stabs
            for s_, v_ in ([(3, .8), (6, .7), (11, .9)] if not four else [(2, .7), (6, .75), (10, .7), (14, .85)]):
                if st == s_:
                    add(stabs, organ(chordn, 0.11, v_), t0 + (SW if s_ % 2 else 0), 0.55)
            # the hook
            if not fin:
                ph = g % 32
                for hs, syl, note, ln in G_HOOK:
                    if hs == ph:
                        add(chops, chop(syl, note, ln * S16 * 0.95), t0 + (SW if hs % 2 else 0), 0.8, pan=0.15 * np.sin(g))
        elif kind == "lift":
            left = int(round((dot - t0) / S16))
            if (left > 8 and st % 4 == 0) or (4 < left <= 8 and st % 2 == 0) or left <= 4:
                add(drums, claps[g % 4], t0, 0.25 + 0.3 * (1 - min(1, left / 16)))
            if st % 2 == 0 and left > 1:
                add(drums, hat(0.03), ts, 0.07, pan=0.25)
            if t0 < lift0 + 1e-3 or (st == 0 and left > 8):
                add(stabs, organ(chordn, min(4 * BEAT, dot - t0) * 0.95, 0.8), t0, 0.45)
            if st in (0, 8) and left > 4:
                add(chops, chop("ooh", [66, 64][(st // 8)], 3 * S16), t0, 0.7)
    # snare rolls into the drop and into the dot
    for (a_, b_) in [(t - 0.6, t) for t in cue_t("impact")] + [(dot - 2 * BEAT, dot)]:
        n = int(round((b_ - a_) / (S16 / 2)))
        for k in range(n):
            add(drums, snare(), a_ + k * S16 / 2, 0.14 * (0.3 + 0.7 * k / n), pan=0.1)
    # the drop, the dot and the button
    for t, v in ((groove, 1.0), (dot, 1.0)):
        add(drums, crash(), t, 0.2); kick(drums, t, 1.0)
    add(chops, chop("hey", 66, 0.2), dot + 4 * S16, 0.7)
    kick(drums, button, 1.0); add(drums, claps[0], button, 0.8); add(drums, crash(), button, 0.22)
    add(stabs, organ(G_STAB["Bm9"], 0.3, 1.0), button, 0.7)
    tail = sub(G_ROOT["Bm9"], 1.6, 1.0); tail *= np.exp(-np.arange(len(tail)) / SR / 0.4)
    add(bass, tail, button, 0.5)
    add(chops, chop("oh", 66, 0.35), button, 0.8)
    # the opening, through a wall: shut until "work", then open into the drop
    t = np.arange(N) / SR
    ws = SC["work"]["start"]
    cut = np.where(t < ws, 600.0, 600.0 * (15000 / 600) ** np.clip((t - ws) / max(0.05, groove - ws), 0, 1))
    cut[t >= groove] = 16000
    end = at(groove + 0.6)
    for c in range(2):
        room[:end, c] = sweep_lp(room[:end, c], cut[:end], block=128, q=1.1)
    drums += room * 1.1
    # the house pump: bass and stabs breathe with the kick
    duck = np.ones(N)
    for k in kicks:
        i = at(k); x = np.arange(int(0.22 * SR)) / SR
        gg = 1 - 0.55 * np.exp(-x / 0.07)
        j = min(N, i + len(gg)); duck[i:j] = np.minimum(duck[i:j], gg[: j - i])
    stabs *= duck[:, None]; bass *= (0.35 + 0.65 * duck)[:, None]
    # the hook answers the voice: full in the gaps, well back while anyone speaks
    talk = np.zeros(N)
    for l in TL["lines"]:
        talk[at(l["start"] - 0.08):at(l["end"] + 0.12)] = 1
    rel = np.exp(-1 / (0.08 * SR))
    talk = signal.lfilter([1 - rel], [1, -rel], talk)
    chops *= 10 ** (-13.0 * np.clip(talk, 0, 1) / 20)[:, None]
    stabs *= 10 ** (-4.0 * np.clip(talk, 0, 1) / 20)[:, None]
    chops = delay(chops, BEAT * 0.75, fb=0.3, mix=0.28, lpf=4500)
    chops = reverb(peak_eq(chops, 3200, 2.0, 0.8), IR_HALL, 0.28)
    stabs = reverb(peak_eq(stabs, 2400, -3.0, 0.8), IR_HALL, 0.2)
    drums = hp(reverb(drums, IR_ROOM, 0.1), 30)
    bass = hp(bass, 28)
    UP = 5.0
    drums = to_lufs(drums, -18.5 + UP)
    bass = to_lufs(bass, -20.0 + UP)
    stabs = to_lufs(stabs, -25.0 + UP)
    chops = to_lufs(chops, -25.0 + UP)
    return stabs, bass, chops, drums

def build_sfx():
    out = buf()
    for c in CUES:
        t, v = c["t"], c.get("v", 1.0)
        k = c["type"]
        if k == "key":
            add(out, sfx_key(v), t, 0.22, pan=rng.uniform(-.15, .15))
        elif k == "space":
            add(out, sfx_key(0.8), t, 0.18)
        elif k == "stamp":
            add(out, sfx_paper(v) * 0.6 + np.pad(sfx_key(1), (0, at(0.22) - at(0.06)))[: at(0.22)] * 0.3, t, 0.22)
        elif k == "whoosh":
            d = c.get("d", .5); add(out, sfx_whoosh(d, v), t - d * 0.55, 0.22)
        elif k == "paper":
            add(out, sfx_paper(v), t, 0.3, pan=c.get("pan", 0) * 0.6)
        elif k == "tick":
            add(out, sfx_tick(v), t, 0.2, pan=rng.uniform(-.3, .3))
        elif k == "blip":
            add(out, sfx_blip(v), t, 0.16, pan=rng.uniform(-.3, .3))
        elif k == "pop":
            add(out, sfx_pop(v), t, 0.22)
        elif k == "click":
            add(out, sfx_click(), t, 0.4, pan=0.2)
        elif k == "scan":
            add(out, sfx_scan(c["d"]), t, 0.2, pan=-0.2)
        elif k == "swish":
            add(out, sfx_swish(v), t - 0.1, 0.12)
        elif k == "type":
            add(out, sfx_type(c.get("d", .2), v), t, 0.16, pan=0.25)
        elif k == "alert":
            add(out, sfx_alert(v), t, 0.35)
        elif k == "riser":
            d = c["d"]; add(out, sfx_riser(d), t - d, 0.17)
        elif k == "implode":
            d = c["d"]; add(out, sfx_implode(d), t - d, 0.3)
        elif k == "impact":
            add(out, reverb(sfx_impact(v), IR_HALL, 0.35), t, 0.4)
        elif k == "shimmer":
            add(out, reverb(sfx_shimmer(c.get("d", 2), v), IR_HALL, 0.6), t, 0.55)
        elif k == "zip":
            add(out, sfx_zip(c.get("d", .4)), t, 0.1)
        elif k == "toggle":
            add(out, sfx_toggle(), t, 0.3)
        elif k == "hit":
            add(out, reverb(sfx_hit(v), IR_ROOM, 0.3), t, 0.3)
        elif k == "draw":
            add(out, sfx_draw(c["d"]), t, 0.5)
        elif k == "fall":
            add(out, sfx_fall(c["d"]), t, 0.5)
        elif k == "boot":
            add(out, reverb(sfx_boot(), IR_HALL, 0.3), t, 0.5)
        elif k == "send":
            add(out, sfx_send(), t - 0.05, 0.3, pan=0.3)
        elif k == "recv":
            add(out, sfx_recv(), t, 0.28 * v if v != 1.0 else 0.28, pan=-0.25)
        elif k == "whip":
            add(out, sfx_whip(), t - 0.15, 0.3)
        elif k == "wipe":
            add(out, sfx_whoosh(0.3, 1.0, up=True), t - 0.28, 0.28)
            add(out, reverb(kick(0.8), IR_ROOM, 0.3), t, 0.3)
        elif k == "flip":
            add(out, sfx_flip(), t, 0.25 * v / .35, pan=rng.uniform(-.4, .4))
        elif k == "star":
            add(out, reverb(sfx_star(v), IR_HALL, 0.3), t, 0.35)
        elif k == "thud":
            # the hit is the moment, but the tagline follows it within a second
            th = sfx_thud(v); th *= np.exp(-np.arange(len(th)) / SR / 0.5)
            add(out, reverb(th, IR_ROOM, 0.3), t, 0.45)
        else:
            raise ValueError(k)
    return out


# ------------------------------------------------------------------ voice
def build_vo():
    vo = np.zeros(N)
    for c in TL["clips"]:
        a, sr = sf.read(os.path.join(BUILD, c["file"]), dtype="float64")
        a = signal.resample_poly(a, SR, sr)
        i = at(c["start"]); vo[i:i + len(a)] += a[: N - i]
    vo = hp(vo, 75, 4)
    vo = peak_eq(vo, 180, -1.5, 0.8)       # a little less box
    vo = peak_eq(vo, 3200, 2.5, 0.9)       # presence
    vo = peak_eq(vo, 11000, 1.5, 0.7)      # air
    # gentle RMS compressor, 3:1 above -20 dBFS
    env = np.sqrt(signal.lfilter([0.002], [1, -0.998], vo ** 2) + 1e-12)
    lvl = 20 * np.log10(env / np.abs(vo).max() + 1e-9)
    gr = np.where(lvl > -20, (lvl + 20) * (1 - 1 / 3), 0)
    vo = vo * 10 ** (-gr / 20)
    vo = vo / np.abs(vo).max() * 0.8
    st = reverb(vo, IR_ROOM, 0.06)
    # how present the voice is, for ducking the music under it
    e = np.abs(vo)
    att, rel = np.exp(-1 / (0.03 * SR)), np.exp(-1 / (0.35 * SR))
    # a fast follower is too slow in pure python; approximate with two one-pole filters
    fast = signal.lfilter([1 - att], [1, -att], e)
    slow = signal.lfilter([1 - rel], [1, -rel], np.maximum(fast, 0))
    presence = np.clip(np.maximum(fast, slow) / 0.08, 0, 1)
    presence = signal.lfilter([1 - rel], [1, -rel], presence)
    return st, np.clip(presence * 1.6, 0, 1)


# ------------------------------------------------------------------ master
def limiter(x, ceiling_db=-1.2, look=0.004, release=0.08):
    """Look-ahead peak limiter on a 4x oversampled peak estimate."""
    ceil = 10 ** (ceiling_db / 20)
    up = np.abs(signal.resample_poly(x, 4, 1, axis=0)).max(1)
    pk = np.pad(up, (0, 4 * len(x) - len(up)))[: 4 * len(x)].reshape(-1, 4).max(1)
    need = np.minimum(1, ceil / np.maximum(pk, 1e-9))
    la = int(look * SR)
    need = np.minimum.reduce([np.roll(need, -k) for k in range(0, la, max(1, la // 8))])
    rel = np.exp(-1 / (release * SR))
    g = signal.lfilter([1 - rel], [1, -rel], need - 1) + 1
    g = np.minimum(g, need)
    return x * g[:, None]

def main():
    os.makedirs(os.path.join(BUILD, "stems"), exist_ok=True)
    style = getattr(F, "MUSIC", "synth")
    drum_led = style in ("drums", "band", "garage")
    pads, bass, keys, drums = {"drums": build_music_drums, "band": build_music_band, "garage": build_music_garage}.get(style, build_music)()
    music = pads * 1.0 + bass * 1.0 + keys * 1.0 + drums * (1.0 if drum_led else 0.9)
    music = peak_eq(music, 2800, 3.0, 0.6)
    music = peak_eq(music, 90, -2.0, 0.8)
    sfx = build_sfx()
    vo, presence = build_vo()
    speaking = np.zeros(N)
    for l in TL["lines"]:
        speaking[at(l["start"] - 0.12):at(l["end"] + 0.25)] = 1
    rel = np.exp(-1 / (0.12 * SR))
    speaking = signal.lfilter([1 - rel], [1, -rel], speaking)
    # drums and a band sit further down under the voice: claps and chords share its range
    duck_db = {"band": -9.0, "garage": -8.0, "drums": -7.5}.get(style, -6.0) * np.clip(speaking, 0, 1)
    music *= 10 ** (duck_db / 20)[:, None]
    # the last seconds breathe out
    fade = np.clip((DUR - np.arange(N) / SR) / 1.4, 0, 1) ** 1.5
    fade_in = np.clip(np.arange(N) / SR / 0.05, 0, 1)
    mix = (music * 0.46 + sfx * 0.45 + vo * 1.0) * (fade * fade_in)[:, None]
    mix = mix[: int(DUR * SR)]
    for name, st in [("music", music * 0.46), ("sfx", sfx * 0.45), ("vo", vo)]:
        sf.write(os.path.join(BUILD, "stems", name + ".wav"), st[: int(DUR * SR)], SR, subtype="PCM_24")
    meter = pyln.Meter(SR)
    # a little over -14: package.py trims the AAC by about this much to hold its true peak
    target = -13.4
    for _ in range(3):
        loud = meter.integrated_loudness(mix)
        mix = mix * 10 ** ((target - loud) / 20)
        mix = limiter(mix, -2.0)
    loud = meter.integrated_loudness(mix)
    tp = 20 * np.log10(np.abs(signal.resample_poly(mix, 4, 1, axis=0)).max())
    sf.write(os.path.join(BUILD, "mix.wav"), mix, SR, subtype="PCM_24")
    print(f"mix: {len(mix) / SR:.2f}s  {loud:.1f} LUFS  true peak {tp:.2f} dBTP")


if __name__ == "__main__":
    main()
