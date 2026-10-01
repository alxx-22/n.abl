"""
Joins each rendered picture to the mix and writes the captions.

  python3 package.py [--film ai] [16x9 1x1 4x5 9x16]

  out/<id>/nabl-<id>-<ratio>.mp4  H.264 High, 60 fps, ~3.7 Mbps two-pass, AAC 192k, faststart
  out/<id>/nabl-<id>.srt          sentence captions from the voiceover timings

A film rendered at twice the size (render.mjs --scale 2) is delivered at high
quality instead, in two sizes from the same frames:

  out/<id>/nabl-<id>-<ratio>.mp4     the usual size, scaled down from the
                                     large frames (sharper edges and type),
                                     ~12 Mbps two-pass, AAC 256k
  out/<id>/nabl-<id>-<ratio>-4k.mp4  the large frames (3840 x 2160 for 16:9),
                                     ~22 Mbps two-pass, under 100 MB
"""

import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILM = sys.argv[sys.argv.index("--film") + 1] if "--film" in sys.argv else "ai"
BUILD, OUT = os.path.join(HERE, "build", FILM), os.path.join(HERE, "out", FILM)
RATIOS = ["16x9", "1x1", "4x5", "9x16"]
SIZE = {"16x9": (1920, 1080), "1x1": (1080, 1080), "4x5": (1080, 1350), "9x16": (1080, 1920)}


def ts(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


MAX = 42  # characters per caption line, two lines per caption


def wrap(text):
    """Two balanced lines when one will not do."""
    if len(text) <= MAX:
        return text
    words = text.split()
    fits = [i for i in range(1, len(words)) if max(len(" ".join(words[:i])), len(" ".join(words[i:]))) <= MAX] or range(1, len(words))
    score = lambda i: abs(len(" ".join(words[:i])) - len(" ".join(words[i:]))) - (14 if words[i - 1].endswith(",") else 0)
    best = min(fits, key=score)
    return " ".join(words[:best]) + "\n" + " ".join(words[best:])


def chunks(sentence):
    """Split a sentence at commas, by its word timings, until each piece fits two lines."""
    ws = sentence["words"]
    groups, cur = [], []
    for w in ws:
        cur.append(w)
        if w["w"].endswith(",") and len(" ".join(x["w"] for x in cur)) >= 18:
            groups.append(cur); cur = []
    if cur:
        groups.append(cur)
    # join neighbours back while they still fit
    out = [groups[0]]
    for g in groups[1:]:
        if len(" ".join(x["w"] for x in out[-1] + g)) <= 2 * MAX - 6:
            out[-1] = out[-1] + g
        else:
            out.append(g)
    return [(g[0]["start"], g[-1]["end"], " ".join(x["w"] for x in g)) for g in out]


def captions(tl):
    cues = []
    for line in tl["lines"]:
        for s in line["sentences"]:
            for a, b, text in chunks(s):
                # the name never takes a full stop straight after it
                text = re.sub(r"\bn\.abl\.(?=\s|$)", "n.abl", text)
                # a run of one-word sentences reads better as one caption
                if cues and len(text.split()) == 1 and len(cues[-1][2].split()) <= 3 and a - cues[-1][1] < .4:
                    cues[-1] = (cues[-1][0], b, cues[-1][2] + " " + text)
                else:
                    cues.append((a, b, text))
    out = []
    for i, (a, b, text) in enumerate(cues, 1):
        nxt = cues[i][0] if i < len(cues) else b + 1
        out.append(f"{i}\n{ts(a)} --> {ts(min(b + .35, nxt - .02))}\n{wrap(text)}\n")
    return "\n".join(out)


def true_peak(path):
    """True peak of a file as a player decodes it, in dBTP."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", "0:a", "-af", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])


def size(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    return tuple(int(v) for v in r.strip().split(","))


def encode(master, pic, log, rate, peak, level, vf=None, preset="slow"):
    """Two-pass H.264 High at an average rate, peaks capped (k bits/s)."""
    common = ["-i", master, "-an", *(["-vf", vf] if vf else []), "-c:v", "libx264", "-preset", preset, "-tune", "film",
              "-profile:v", "high", "-level", level, "-b:v", f"{rate}k", "-maxrate", f"{peak}k", "-bufsize", f"{peak * 3 // 2}k",
              "-pix_fmt", "yuv420p", "-g", "120", "-passlogfile", log,
              "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *common, "-pass", "1", "-f", "mp4", os.devnull], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *common, "-pass", "2", pic], check=True)


def audio(rate=192):
    """The mix as AAC, with its decoded true peak held at or below -1 dBTP.

    The encoder overshoots sharp transients by up to about a decibel, and by a
    different amount at each bitrate, so the peak is measured after encoding
    and the gain trimmed until it fits."""
    dst, gain = os.path.join(BUILD, "audio.m4a"), 0.0
    for _ in range(6):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(BUILD, "mix.wav"),
                        "-af", f"volume={gain:.2f}dB", "-c:a", "aac", "-b:a", f"{rate}k", "-ar", "48000", dst], check=True)
        tp = true_peak(dst)
        if tp <= -1.0:
            break
        gain -= tp + 1.0 + 0.15
    print(f"audio: trim {gain:.2f} dB, true peak {tp:.1f} dBTP")
    return dst


def main():
    os.makedirs(OUT, exist_ok=True)
    tl = json.load(open(os.path.join(BUILD, "timeline.json")))
    srt = os.path.join(OUT, f"nabl-{FILM}.srt")
    if tl["lines"]:
        with open(srt, "w") as f:
            f.write(captions(tl))
    elif os.path.exists(srt):                  # a film with no voice has no captions
        os.remove(srt)
    only = [a for a in sys.argv[1:] if a in RATIOS]
    todo = [r for r in only or RATIOS if os.path.exists(os.path.join(BUILD, f"video_{r}.mp4"))]
    for r in set(only or RATIOS) - set(todo):
        print(f"skip {r}: no picture yet")
    hq = any(size(os.path.join(BUILD, f"video_{r}.mp4"))[0] > SIZE[r][0] for r in todo)
    aac = audio(256 if hq else 192)
    for r in todo:
        master = os.path.join(BUILD, f"video_{r}.mp4")
        big = size(master)[0] > SIZE[r][0]
        # Each delivered picture is only re-encoded when the master is newer.
        # At the usual size the render is a ~10 Mbps master and the delivered
        # picture a two-pass encode at about 3.7 Mbps: inside every platform's
        # upload spec, and under 30 MB. Rendered large, the usual size is
        # scaled down from the large frames and given about 12 Mbps, and the
        # large frames are delivered too, at about 22 Mbps.
        outs = [(f"deliver_{r}.mp4", f"nabl-{FILM}-{r}.mp4",
                 dict(rate=12000, peak=18000, level="4.2", vf="scale={}:{}:flags=lanczos".format(*SIZE[r])) if big else
                 dict(rate=3700, peak=6000, level="4.2"))]
        if big:
            outs.append((f"deliver_{r}_4k.mp4", f"nabl-{FILM}-{r}-4k.mp4", dict(rate=22000, peak=30000, level="5.2", preset="medium")))
        for pic, name, enc in outs:
            pic = os.path.join(BUILD, pic)
            if not os.path.exists(pic) or os.path.getmtime(pic) < os.path.getmtime(master):
                encode(master, pic, os.path.join(BUILD, f"pass_{r}"), **enc)
            dst = os.path.join(OUT, name)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", pic, "-i", aac, "-map", "0:v", "-map", "1:a",
                            "-c", "copy", "-shortest", "-movflags", "+faststart",
                            "-metadata", f"title={tl['title']}", dst], check=True)
            print(f"{dst}  {os.path.getsize(dst) / 2**20:.1f} MiB")


if __name__ == "__main__":
    main()
