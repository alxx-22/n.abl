"""
Music arranged to a film's sections, with Google's Lyria RealTime (the
Gemini API's live music model, reached with GEMINI_API_KEY). It plays at a
set tempo and key, and the style, instruments, density and brightness can be
changed while it plays, so one take can build, drop and change section by
section instead of looping one riff.

A plan is a JSON list of sections, each from `at` seconds (or `beat` beats)
into the take:

  [{"at": 0,   "prompts": {"Melodic Techno": 1, "Ominous Drone": 0.6}, "density": 0.2, "mute_drums": true},
   {"at": 1.2, "prompts": {"Melodic Techno": 1, "Tight Groove": 0.8}, "density": 0.6}]

  python3 lyria.py --film reel --take dark-house --bpm 118 --scale F_MAJOR_D_MINOR \\
      --seconds 34 --seed 1 --plan films/reel/music/plans/dark-house.json

The model streams audio as it makes it, so a change reaches the music a
little after it is sent; LEAD sends each one that much early. Writes
films/<film>/music/<take>-<seed>.wav (48 kHz stereo) with a .json of the
plan and settings beside it, and an MP3 in out/<film>/music-options/lyria/.
Its output carries Google's SynthID watermark.
"""

import argparse, asyncio, json, os, subprocess, time
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = "models/lyria-realtime-exp"
SR = 48000
LEAD = 2.0          # seconds: how far ahead of its time each change is sent


async def record(a, plan):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"], http_options={"api_version": "v1alpha"})
    want = int(a.seconds * SR) * 4                        # 16-bit stereo
    buf = bytearray()

    def cfg(sec):
        kw = dict(bpm=a.bpm, scale=getattr(types.Scale, a.scale), seed=a.seed, temperature=a.temperature,
                  guidance=a.guidance, density=sec.get("density"), brightness=sec.get("brightness"),
                  mute_drums=sec.get("mute_drums", False), mute_bass=sec.get("mute_bass", False))
        return types.LiveMusicGenerationConfig(**{k: v for k, v in kw.items() if v is not None})

    when = lambda sec: sec["at"] if "at" in sec else sec["beat"] * 60 / a.bpm

    async def apply(s, sec):
        await s.set_weighted_prompts(prompts=[types.WeightedPrompt(text=t, weight=w) for t, w in sec["prompts"].items()])
        await s.set_music_generation_config(config=cfg(sec))

    async with client.aio.live.music.connect(model=MODEL) as s:
        await apply(s, plan[0])
        await s.play()
        nxt = 1
        async for msg in s.receive():
            sc = msg.server_content
            if sc and sc.audio_chunks:
                for c in sc.audio_chunks:
                    buf.extend(c.data)
                got = len(buf) / 4 / SR
                while nxt < len(plan) and got >= when(plan[nxt]) - LEAD:
                    await apply(s, plan[nxt]); nxt += 1
                if len(buf) >= want:
                    break
            elif getattr(msg, "filtered_prompt", None):
                print("filtered:", msg.filtered_prompt)
    y = np.frombuffer(bytes(buf[:want]), dtype="<i2").reshape(-1, 2).astype(np.float32) / 32768
    return y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--film", default="reel")
    ap.add_argument("--take", required=True)
    ap.add_argument("--plan", required=True)
    ap.add_argument("--bpm", type=int, required=True)
    ap.add_argument("--scale", default="F_MAJOR_D_MINOR")
    ap.add_argument("--seconds", type=float, default=34)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--temperature", type=float, default=1.1)
    ap.add_argument("--guidance", type=float, default=4.0)
    a = ap.parse_args()
    plan = json.load(open(a.plan))
    t0 = time.time()
    y = asyncio.run(record(a, plan))
    peak = float(np.abs(y).max())
    if peak > 0:
        y = y / peak * 10 ** (-1 / 20)
    name = f"{a.take}-{a.seed}"
    out_dir = os.path.join(HERE, "films", a.film, "music")
    mp3_dir = os.path.join(HERE, "out", a.film, "music-options", "lyria")
    os.makedirs(out_dir, exist_ok=True); os.makedirs(mp3_dir, exist_ok=True)
    wav = os.path.join(out_dir, name + ".wav")
    sf.write(wav, y, SR, subtype="FLOAT")
    json.dump(dict(file=name + ".wav", model=MODEL, bpm=a.bpm, scale=a.scale, seconds=a.seconds, seed=a.seed,
                   temperature=a.temperature, guidance=a.guidance, lead=LEAD, plan=plan, raw_peak=round(peak, 3)),
              open(os.path.join(out_dir, name + ".json"), "w"), indent=1)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k",
                    os.path.join(mp3_dir, name + ".mp3")], check=True)
    print(f"{name}: {len(y) / SR:.1f}s in {time.time() - t0:.0f}s, raw peak {peak:.2f}", flush=True)


if __name__ == "__main__":
    main()
