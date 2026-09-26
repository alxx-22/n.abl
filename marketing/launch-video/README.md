# Launch films

Short launch films for n.abl, each in every social format, all made by the
scripts in this folder from one shared stage. Each film has a folder in
`films/` with its script (`film.py`), its animation (`scenes.js`, `scenes.css`)
and its brief and shot list (`SCRIPT.md`). The finished films are in `out/`.

| Film | Length | What it is for | Brief |
|---|---|---|---|
| `web` · Websites that work | 33 s | Smart web apps, landing pages and booking systems | [`films/web/SCRIPT.md`](films/web/SCRIPT.md) |
| `ai` · Put AI to work | 33 s | The AI service: customer agents and everything else AI takes on | [`films/ai/SCRIPT.md`](films/ai/SCRIPT.md) |
| `ai-long` · AI, where it earns its place | 58 s | The first, longer cut of the AI film: three jobs in depth | [`films/ai-long/SCRIPT.md`](films/ai-long/SCRIPT.md) |

Every film comes in four formats:

| File in `out/<film>/` | Size | Use it for |
|---|---|---|
| `nabl-<film>-16x9.mp4` | 1920 × 1080 | X, LinkedIn, YouTube, the website |
| `nabl-<film>-1x1.mp4` | 1080 × 1080 | X, LinkedIn and Instagram feeds |
| `nabl-<film>-4x5.mp4` | 1080 × 1350 | Instagram and Facebook feeds |
| `nabl-<film>-9x16.mp4` | 1080 × 1920 | Reels, TikTok, Shorts, Stories |
| `nabl-<film>-cover-*.jpg` | per format | cover or thumbnail image |
| `nabl-<film>.srt` | | captions, for platforms that take a sidecar file |

All are H.264 High at 60 fps (two-pass, under 30 MB each) with AAC stereo at
48 kHz, mastered to about −14 LUFS with true peak below −1 dBTP. That is what
X, LinkedIn, Instagram, TikTok and YouTube all normalise towards, so none of
them will turn it down. In 9:16 the content sits clear of the caption and
button overlays.

The MP4s are committed so they can be downloaded straight from the repository
(about 60 to 110 MB per film). The scripts below rebuild them.

## How it is made

Nothing is stock and nothing is licensed. Every part is generated here:

1. **`vo.py`** reads a film's script (`films/<film>/film.py`) with
   [Kokoro](https://github.com/hexgrad/kokoro) (Apache-2.0), voice `bm_fable`,
   British English, at 1.2× speed. Each sentence is trimmed and laid out shot
   by shot, and every shot starts on a beat, or half a beat, of the 124 BPM
   music grid. Every clip is then run through a speech recogniser with word
   timestamps (NVIDIA Parakeet TDT, via sherpa-onnx) so the words on screen
   land when they are spoken. Writes `build/<film>/timeline.json` with the
   start and end of every word.
2. **`film/`** is the stage every film shares: one HTML page, sampled by time.
   `window.seek(t)` draws the frame at `t` seconds. `stage.js` holds what the
   films have in common: the site's own fonts and easing curves
   (`src/components/scenes/engine.js`), the drawn wordmark and the AI spark,
   transitions (whip pans with directional blur, square wipes, fly-throughs),
   camera moves, the scene labels and the end card. `?film=<film>` loads that
   film's timeline and its `scenes.js`. The layout adapts to each aspect ratio
   rather than cropping one. As it builds, the film records a cue for every
   sound its animation makes.
3. **`render.mjs`** drives headless Chromium through Playwright:
   `--stills` for review frames, `--cues` for the sound cue list, `--video` for
   the frames piped to ffmpeg, `--covers` for the cover images. The light film
   grain is added by ffmpeg at encode, where it also dithers the dark gradients
   against banding; drawing it in the page cost a third of every frame.
4. **`audio.py`** synthesises the music (124 BPM, four-on-the-floor, offbeat
   supersaw stabs, plucked sixteenths, sub bass, in D, with the film's own
   chords and sections from its `film.py`) and every effect from the cue list.
   It processes the voice, ducks the music under it from the script's own
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

F=web                                        # or ai
python3 vo.py --film $F                      # voice and timeline
node render.mjs --film $F --cues             # sound cues from the animation
python3 audio.py --film $F                   # music, effects, mix
node render.mjs --film $F --video --jobs 4   # picture, all four formats
node render.mjs --film $F --covers           # cover images
python3 package.py --film $F                 # final MP4s and captions
```

The long cut (`ai-long`) is the first version of the AI film, made before the
stage was shared between films. Its scripts are the ones in commit `95ec345`;
to rebuild it, check that commit out in a worktree
(`git worktree add ../ai-long 95ec345`) and run the same six steps there
without `--film`.

To preview a film live, serve the repository root (for example
`npx serve .`) and open
`/marketing/launch-video/film/index.html?film=web&w=1080&h=1920&t=12`. Change
`w` and `h` for the format and `t` for the moment. Run `vo.py` first so the
timeline exists.

## Making another film

Copy `films/web` to `films/<name>` and change:

- **Words.** The lines in `film.py`, and keep `SCRIPT.md` in step. The
  animation finds its cues by word (`wt(line, 'deposit')`), so a changed word
  that the film keys off needs the same change in `scenes.js`.
- **Voice.** `VOICE` in `film.py`. Other British voices are `bf_emma`,
  `bf_isabella`, `bm_george` and `bm_lewis`; `bf_emma` is the calmest.
- **Pace.** `SPEED` in `film.py`. Everything downstream follows the new timings.
- **Music.** `PROG` and `sections()` in `film.py`; the instruments are in
  `audio.py`.
- **Pictures.** One builder per shot in `scenes.js`, registered in its
  `setup()`, which also returns the background's colour keyframes.
