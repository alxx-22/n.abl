"""
Re-cut a generated take at its bar lines: play parts of it in a new order.

  python3 musicedit.py --film reel --src dark-melodic-minor-2 --out dark-melodic-minor-2-edit \\
      --parts 0-8.205,4.118-6.162,16.378-

Each part is start-end in seconds of the source (an open end runs to the
end of the take); give them on the take's own bar lines so the beat never
slips. Each join is crossfaded over the 20 ms just before it, so the
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
    y, sr = sf.read(os.path.join(d, a.src + ".wav"), always_2d=True)
    xf = int(XF * sr)
    fade = np.sqrt(np.linspace(0, 1, xf))[:, None]
    parts = []
    for p in a.parts.split(","):
        s, e = p.split("-")
        parts.append((int(round(float(s) * sr)), int(round(float(e) * sr)) if e else len(y)))
    out = y[parts[0][0]:parts[0][1]].copy()
    for s, e in parts[1:]:
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
