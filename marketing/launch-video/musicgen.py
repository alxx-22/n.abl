"""
Music from a written brief, with Stable Audio Open 1.0 (Stability AI), run
here on the CPU through diffusers. It makes up to 47 seconds of stereo audio
at 44.1 kHz from a text prompt, and is free to use commercially for
organisations under US $1M a year in revenue (the Stability AI Community
License).

The model is gated on Hugging Face: accept its terms on the model page
(huggingface.co/stabilityai/stable-audio-open-1.0) with your account, make a
read token, and put it in the environment as HF_TOKEN. The environment must
also be allowed to reach huggingface.co and its file hosts.

  python3 musicgen.py --film reel --take dark1 --seconds 30 --seeds 1,2,3 \\
      --prompt "dark cinematic electronic, 100 BPM, ..."

writes films/<film>/music/<take>-<seed>.wav (kept with the film, so a render
never needs the model) with <take>-<seed>.json beside it: the prompt,
negative prompt, seconds, steps and seed, so any take can be made again
exactly. One file per take, so takes made in parallel never collide. An MP3
to listen to goes in out/<film>/music-options/sao/. audio.py plays a chosen
take with MUSIC = "file".
"""

import argparse, json, os, subprocess, time

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = "stabilityai/stable-audio-open-1.0"
NEGATIVE = "low quality, distorted, vocals, singing, speech, cheerful, happy, jolly, chiptune, 8-bit, kids, ukulele, whistling"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--film", default="reel")
    ap.add_argument("--take", required=True, help="a name for this brief")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--negative", default=NEGATIVE)
    ap.add_argument("--seconds", type=float, default=30.0)
    ap.add_argument("--steps", type=int, default=100)
    ap.add_argument("--cfg", type=float, default=7.0)
    ap.add_argument("--seeds", default="1")
    a = ap.parse_args()

    import numpy as np, soundfile as sf, torch
    from diffusers import StableAudioPipeline

    torch.set_num_threads(os.cpu_count() or 4)
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    pipe = StableAudioPipeline.from_pretrained(MODEL, torch_dtype=torch.float32, token=token)
    pipe = pipe.to("cpu")
    out_dir = os.path.join(HERE, "films", a.film, "music")
    mp3_dir = os.path.join(HERE, "out", a.film, "music-options", "sao")
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(mp3_dir, exist_ok=True)
    for seed in [int(s) for s in a.seeds.split(",")]:
        t0 = time.time()
        g = torch.Generator("cpu").manual_seed(seed)
        audio = pipe(a.prompt, negative_prompt=a.negative, num_inference_steps=a.steps,
                     audio_end_in_s=a.seconds, num_waveforms_per_prompt=1, guidance_scale=a.cfg,
                     generator=g).audios[0]
        y = audio.T.float().cpu().numpy()                       # (samples, channels)
        # the model's output can run past full scale: bring its peak to -1 dBFS
        # and keep it as float, or a 16-bit file clips it hard
        peak = float(np.abs(y).max())
        if peak > 0:
            y = y / peak * 10 ** (-1 / 20)
        name = f"{a.take}-{seed}"
        wav = os.path.join(out_dir, name + ".wav")
        sf.write(wav, y, pipe.vae.sampling_rate, subtype="FLOAT")
        json.dump(dict(file=name + ".wav", model=MODEL, prompt=a.prompt, negative=a.negative, seconds=a.seconds,
                       steps=a.steps, cfg=a.cfg, seed=seed, raw_peak=round(peak, 3)),
                  open(os.path.join(out_dir, name + ".json"), "w"), indent=1)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k",
                        os.path.join(mp3_dir, name + ".mp3")], check=True)
        print(f"{name}: {len(y) / pipe.vae.sampling_rate:.1f}s in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
