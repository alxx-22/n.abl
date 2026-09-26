"""
Music, sound effects and the final mix.

Everything is synthesised here, on the film's own timeline, so nothing needs a
licence. The music is written against build/timeline.json (110 BPM, scenes
start on beats) and the effects are placed from build/cues.json, which the
film itself emits, so a sound lands on the frame that makes it.

  music   warm supersaw pads, plucked arpeggio, sub bass and a soft kit,
          vi-IV-I-V in D major, resolving to D on the logo
  effects typing, paper, whooshes, scan, UI ticks and clicks, risers, impacts
  voice   high-passed, gently compressed, a little presence and room
  master  music ducked under the voice, limited, -14 LUFS integrated

Writes build/mix.wav (48 kHz, stereo, 24-bit) and build/stems/*.wav.
"""

import json, os
import numpy as np
import soundfile as sf
from scipy import signal
import pyloudnorm as pyln

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
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
T_BOOM = cue_t("impact")[0]                       # "AI!": the drop
T_GROOVE = np.ceil(T_BOOM / BEAT - 1e-6) * BEAT   # the groove starts on the next beat
T_DOT = cue_t("thud")[0]                          # the logo's dot lands


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
PROG = ["Bm", "G", "D", "A"]

def sections():
    """(start, end, kind, chords) on the beat grid."""
    return [
        (0.0, SC["ai"]["start"], "pulse", ["Bm", "G"]),
        (SC["ai"]["start"], T_GROOVE, "build", ["A"]),
        (T_GROOVE, SC["wall"]["start"], "main", PROG),
        (SC["wall"]["start"], SC["yours"]["start"], "main2", PROG),
        (SC["yours"]["start"], SC["end"]["start"], "break", ["G", "A"]),
        (SC["end"]["start"], T_DOT, "lift", ["A"]),
        (T_DOT, DUR, "resolve", ["D", "D", "D", "D"]),
    ]

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
    for (a, b_, lvl) in [(T_BOOM - 0.6, T_BOOM, .15), (T_DOT - 2 * BEAT, T_DOT, .15)]:
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
    pads, bass, keys, drums = build_music()
    music = pads * 1.0 + bass * 1.0 + keys * 1.0 + drums * 0.9
    music = peak_eq(music, 2800, 3.0, 0.6)
    music = peak_eq(music, 90, -2.0, 0.8)
    sfx = build_sfx()
    vo, presence = build_vo()
    speaking = np.zeros(N)
    for l in TL["lines"]:
        speaking[at(l["start"] - 0.12):at(l["end"] + 0.25)] = 1
    rel = np.exp(-1 / (0.12 * SR))
    speaking = signal.lfilter([1 - rel], [1, -rel], speaking)
    duck_db = -6.0 * np.clip(speaking, 0, 1)
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
