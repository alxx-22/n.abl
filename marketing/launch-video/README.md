# Launch film: Put AI to work

A 33-second film for the n.abl AI service, in every social format. The
creative brief, voiceover and scene-by-scene animation script are in
[`SCRIPT.md`](SCRIPT.md).

| File in `out/` | Size | Use it for |
|---|---|---|
| `nabl-ai-launch-16x9.mp4` | 1920 × 1080 | X, LinkedIn, YouTube, the website |
| `nabl-ai-launch-1x1.mp4` | 1080 × 1080 | X, LinkedIn and Instagram feeds |
| `nabl-ai-launch-4x5.mp4` | 1080 × 1350 | Instagram and Facebook feeds |
| `nabl-ai-launch-9x16.mp4` | 1080 × 1920 | Reels, TikTok, Shorts, Stories |
| `nabl-ai-launch-cover-*.jpg` | per format | cover or thumbnail image |
| `nabl-ai-launch.srt` | | captions, for platforms that take a sidecar file |

All four are H.264 High at 60 fps (two-pass, about 3.7 Mbps, under 30 MB
each) with AAC stereo at 48 kHz, mastered to about
−14 LUFS with true peak below −1 dBTP. That is what X, LinkedIn, Instagram,
TikTok and YouTube all normalise towards, so none of them will turn it down.
In 9:16 the content sits clear of the caption and button overlays.

The MP4s are not committed; the scripts below rebuild them. The captions and
cover images are committed.

## How it is made

Nothing is stock and nothing is licensed. Every part is generated here:

1. **`vo.py`** reads the script with [Kokoro](https://github.com/hexgrad/kokoro)
   (Apache-2.0), voice `bm_fable`, British English, at 1.2× speed. Each
   sentence is trimmed and laid out shot by shot, and every shot starts on a
   beat, or half a beat, of the 124 BPM music grid. Every clip is then run
   through a speech recogniser with word timestamps (NVIDIA Parakeet TDT, via
   sherpa-onnx) so the words on screen land when they are spoken. Writes
   `build/timeline.json` with the start and end of every word.
2. **`film/`** is the animation: one HTML page, sampled by time.
   `window.seek(t)` draws the frame at `t` seconds. It uses the site's own
   fonts, easing curves (`src/components/scenes/engine.js`), the drawn wordmark
   and the AI spark mark. Transitions (whip pans with directional blur, square
   wipes, fly-throughs) and camera moves are shared helpers at the top of
   `film.js`. The layout adapts to each aspect ratio rather than cropping one.
   As it builds, it records a cue for every sound its animation makes.
3. **`render.mjs`** drives headless Chromium through Playwright:
   `--stills` for review frames, `--cues` for the sound cue list, `--video` for
   the frames piped to ffmpeg, `--covers` for the cover images. The light film
   grain is added by ffmpeg at encode, where it also dithers the dark gradients
   against banding; drawing it in the page cost a third of every frame.
4. **`audio.py`** synthesises the music (124 BPM, four-on-the-floor, offbeat
   supersaw stabs, plucked sixteenths, sub bass; vi–IV–I–V in D with a drop on
   "AI!" and a resolve to D on the logo) and every effect from the cue list. It
   processes the voice, ducks the music under it from the script's own
   timings, limits and normalises the result.
5. **`package.py`** makes the delivered picture (a two-pass encode of the
   render), encodes the audio with its true peak held at −1 dBTP after AAC,
   muxes them and writes the captions.

## Rebuilding

Needs Python 3.11, Node 22, ffmpeg with libx264, and Chromium through
Playwright. From this folder:

```bash
pip install -r requirements.txt
mkdir -p build/models && cd build/models \
  && curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx \
  && curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin \
  && curl -L https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2 | tar xj \
  && cd ../..

python3 vo.py                       # voice and timeline
node render.mjs --cues              # sound cues from the animation
python3 audio.py                    # music, effects, mix
node render.mjs --video --jobs 4    # picture, all four formats
node render.mjs --covers            # cover images
python3 package.py                  # final MP4s and captions
```

To preview the animation live, serve the repository root (for example
`npx serve .`) and open
`/marketing/launch-video/film/index.html?w=1080&h=1920&t=12`. Change `w` and
`h` for the format and `t` for the moment. Run `vo.py` first so the timeline
exists.

## Changing it

- **Words.** Edit the lines in `vo.py` and keep `SCRIPT.md` in step. The
  animation finds its cues by word ("appointments", "escalate", "chases"), so a changed
  word that the film keys off needs the same change in `film/film.js`.
- **Voice.** `VOICE` in `vo.py`. Other British voices are `bf_emma`,
  `bf_isabella`, `bm_george` and `bm_lewis`; `bf_emma` is the calmest.
- **Pace.** `SPEED` in `vo.py`. Everything downstream follows the new timings.
- **Music.** `sections()` and `BARS` in `audio.py`.
