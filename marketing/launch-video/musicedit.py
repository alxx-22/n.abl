"""
Re-cut generated takes at their bar lines: play parts of them in a new order.

  python3 musicedit.py --film reel --src dark-melodic-minor-2 --out dark-melodic-minor-2-edit \\
      --parts 0-8.205,4.118-6.162,16.378-

Each part is start-end in seconds of the source (an open end runs to the
end of the take), or take:start-end to draw on another take made in the
same session and tempo; give them on the takes' own bar lines so the beat
never slips. Each join is crossfaded over the 20 ms just before it, so the
downbeat of the part coming in lands whole. Writes films/<film>/music/
<out>.wav with a .json of the recipe beside it, and an MP3 in
out/<film>/music-options/.
"""

import argparse, json, os, subprocess
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
XF = 0.02


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--film", default="reel")
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--parts", required=True)
    a = ap.parse_args()
    d = os.path.join(HERE, "films", a.film, "music")
    takes = {}
    def take(name):
        if name not in takes:
            takes[name] = sf.read(os.path.join(d, name + ".wav"), always_2d=True)
        return takes[name]
    sr = take(a.src)[1]
    xf = int(XF * sr)
    fade = np.sqrt(np.linspace(0, 1, xf))[:, None]
    parts = []
    for p in a.parts.split(","):
        name, span = p.split(":") if ":" in p else (a.src, p)
        y = take(name)[0]
        s, e = span.split("-")
        parts.append((y, int(round(float(s) * sr)), int(round(float(e) * sr)) if e else len(y)))
    y, s, e = parts[0]
    out = y[s:e].copy()
    for y, s, e in parts[1:]:
        pre = y[max(0, s - xf):s]
        pre = np.pad(pre, ((xf - len(pre), 0), (0, 0)))
        out[-xf:] = out[-xf:] * fade[::-1] + pre * fade
        out = np.concatenate([out, y[s:e]])
    sf.write(os.path.join(d, a.out + ".wav"), out, sr, subtype="FLOAT")
    src_meta = os.path.join(d, a.src + ".json")
    json.dump(dict(file=a.out + ".wav", src=a.src + ".wav", parts=a.parts, crossfade=XF,
                   src_meta=json.load(open(src_meta)) if os.path.exists(src_meta) else None),
              open(os.path.join(d, a.out + ".json"), "w"), indent=1)
    mp3 = os.path.join(HERE, "out", a.film, "music-options", a.out + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(d, a.out + ".wav"),
                    "-c:a", "libmp3lame", "-b:a", "192k", mp3], check=True)
    print(f"{a.out}: {len(out) / sr:.2f}s from {len(parts)} parts")


if __name__ == "__main__":
    main()
