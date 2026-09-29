# Launch films

Short launch films for n.abl, each in every social format, all made by the
scripts in this folder from one shared stage. Each film has a folder in
`films/` with its script (`film.py`), its animation (`scenes.js`, `scenes.css`)
and its brief and shot list (`SCRIPT.md`). The finished films are in `out/`.

| Film | Length | What it is for | Brief |
|---|---|---|---|
| `web` · Websites that work | 38 s | Smart web apps, landing pages and booking systems | [`films/web/SCRIPT.md`](films/web/SCRIPT.md) |
| `ai` · Put AI to work | 37 s | The AI service: customer agents and everything else AI takes on | [`films/ai/SCRIPT.md`](films/ai/SCRIPT.md) |
| `reel` · AI that works | 32 s | Two AI services (the receptionist and the sales co-pilot), cut to music with no voice, in the style of a reference reel | [`films/reel/SCRIPT.md`](films/reel/SCRIPT.md) |
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
48 kHz, mastered to about −14 LUFS with true peak below −1 dBTP. The reel is
rendered at twice the size and delivered at high quality: each format at the
size above, scaled down from the large frames at about 12 Mbps (about 45 MB),
and again as `nabl-reel-<ratio>-4k.mp4` at twice the size (3840 × 2160 for
16:9) at about 22 Mbps, under 100 MB. That is what
X, LinkedIn, Instagram, TikTok and YouTube all normalise towards, so none of
them will turn it down. In 9:16 the content sits clear of the caption and
button overlays.

The MP4s are committed so they can be downloaded straight from the repository
(about 60 to 110 MB per film). The scripts below rebuild them.

## How it is made

Nothing is stock. Every part is generated here, except the Rhodes in the web
film's music, which is played from the free
[GeneralUser GS](https://www.schristiancollins.com/generaluser) SoundFont:

1. **`vo.py`** reads a film's script (`films/<film>/film.py`). With a
   `GEMINI_API_KEY` in the environment it uses Google's Gemini 3.8 Flash TTS
   (`gemini-3.8-flash-tts`, the most expressive of the TTS models the API
   offers; all of them are listed in [`tts-models.md`](tts-models.md)), in
   the voice `Achird`. It is directed the way Google's guide asks: each whole
   line is sent as a verbatim transcript, with a few words of delivery (each
   scene's `style` in `film.py`) in the request's style field. Who is
   speaking is the voice itself, a prebuilt one or one made with voice design
   from `VOICE_DESIGN` (`vo.py --design`). A scene's `read` can add inline
   expression tags such as `<short pause>`, which shape the read and are not
   spoken, and `*stress*` on a word, sent in capitals. The earlier models
   (3.1, 2.5) are sent the long notes they were built for instead (`PROFILE`,
   `SCENE`, each scene's `tone`, `NAME_NOTE`). Gemini's reads are kept in `films/<film>/voice`, named by
   the model, voice, direction and words, so the film rebuilds without a key
   or any requests (`vo.py --fetch-only` fetches them; `--audition` compares
   voices, into `voice/audition/<model>/`). Without a key it
   falls back to [Kokoro](https://github.com/hexgrad/kokoro) (Apache-2.0,
   local), voice `bm_fable`, British English, at 1.2× speed, which reads the
   words well but cannot be directed. Each sentence is trimmed and laid out shot
   by shot, and every shot starts on a beat, or half a beat, of the film's
   music grid (124 BPM for the AI films, 144 for the web film). Every clip is then run through a speech recogniser with word
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
   the frames piped to ffmpeg, `--covers` for the cover images. `--scale 2`
   renders at twice the size, for sharper type and edges. The light film
   grain is added by ffmpeg at encode, where it also dithers the dark gradients
   against banding; drawing it in the page cost a third of every frame.
4. **`audio.py`** makes the music with the film's own tempo, chords and
   sections from its `film.py`. For the AI films it synthesises supersaw
   pads, offbeat stabs, plucked sixteenths and sub bass over
   four-on-the-floor in D. For the web film it is warm
   French-touch electronica, drum-led: clean punchy drums, a Moog-style
   bass, Rhodes chords, a filtered analog arpeggio and a soft pad, behind a
   filter that opens into the drop, at a steady level under the voice. It synthesises every effect from the cue list, with
   per-film trims.
   It processes the voice, ducks the music under it from the script's own
   timings, limits and normalises the result.
5. **`package.py`** makes the delivered picture (a two-pass encode of the
   render; both sizes at high quality when it was rendered large), encodes
   the audio with its true peak held at −1 dBTP after AAC, muxes them and
   writes the captions.

## Rebuilding

Needs Python 3.11, Node 22, ffmpeg with libx264, and Chromium through
Playwright. From this folder:

```bash
pip install -r requirements.txt
pip install --no-deps tinysoundfont          # offline rendering only; skips its audio-playback dependency
mkdir -p build/models/soundfont && cd build/models \
  && curl -L -o soundfont/GeneralUser-GS.sf2 https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/main/GeneralUser-GS.sf2 \
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

The reel is rendered large: `F=reel`, and add `--scale 2` to the `--video`
and `--covers` steps. Its music is a take from Lyria RealTime, the Gemini
API's live music model, kept in `films/reel/music`, so a rebuild needs no
model; `lyria.py` makes takes from a plan of sections (with `GEMINI_API_KEY`)
and `musicedit.py` cuts them together at their bar lines.

The long cut (`ai-long`) is the first version of the AI film, made before the
stage was shared between films. Its scripts are the ones in commit `95ec345`;
to rebuild it, check that commit out in a worktree
(`git worktree add ../ai-long 95ec345`), apply the end-card seam fix from
`endCard()` in `film/stage.js` to the same line in its `film/film.js`, and run
the same six steps there without `--film`.

To preview a film live, serve the repository root (for example
`npx serve .`) and open
`/marketing/launch-video/film/index.html?film=web&w=1080&h=1920&t=12`. Change
`w` and `h` for the format and `t` for the moment. Run `vo.py` first so the
timeline exists.

## Making another film

Copy `films/web` to `films/<name>` and change:

- **Words.** The lines in `film.py`, and keep `SCRIPT.md` in step. A film
  with no voice (the reel) gives each scene a length in beats instead
  (`beats=`) and no lines. The
  animation finds its cues by word (`wt(line, 'deposit')`), so a changed word
  that the film keys off needs the same change in `scenes.js`.
- **Voice.** For an expressive read, get a free API key from Google AI
  Studio (aistudio.google.com, "Get API key") and either set it as the
  environment variable `GEMINI_API_KEY`, or, in a Claude Code cloud
  environment on a Pro or Max plan, store it as an API credential for
  `generativelanguage.googleapis.com` with the header `x-goog-api-key` (no
  prefix), which keeps the key out of the session. `vo.py` then reads every
  line with Gemini TTS to the notes in `film.py`. The free tier limits
  requests per day, per model and per project (ten a day for
  `gemini-3.8-flash-tts`; Google shows the limits only in AI Studio, so
  `vo.py` keeps the ones the API reports in `quota-seen.json`, and
  `vo.py --quota` shows what each model has used today; everything known is
  in [`tts-models.md`](tts-models.md)); reads are kept, so if it stops at the daily quota, run it again after
  midnight Pacific and it carries on. Meanwhile `vo.py --stand-in
  gemini-3.8-flash-lite-tts` reads the missing lines with the lighter model,
  on its own quota, in the same voice, so the whole film can be heard;
  `--fetch-only` later replaces those reads with the film's model's.
  Scenes that share a `joint` name are one sentence across several shots,
  read in one request and cut into the shots. `GEMINI_TTS_MODEL` picks the model and
  `GEMINI_VOICE` the voice: `Achird` is warm and friendly; Gemini 3.8 also
  takes the 1,000 voices of its extended library by id (`GET
  /v1beta/voices`), such as `en-gb-assistant-10` or `en-gb-commercial-7`,
  southern English men (see [`tts-models.md`](tts-models.md)), and a
  designed voice by its `voice_…` id (`vo.py --design NAME` makes one from
  `VOICE_DESIGN` and keeps its sample in `voice-design/`).
  `VOICE_PROVIDER=kokoro` forces the local voice. For Kokoro, `VOICE` in
  `film.py`. Other British voices are `bf_emma`,
  `bf_isabella`, `bm_george` and `bm_lewis`; `bf_emma` is the calmest.
- **Pace.** `SPEED` in `film.py`. Everything downstream follows the new timings.
- **Music.** `BPM`, `PROG` and `sections()` in `film.py`, and `MUSIC`: leave
  it out for the synth arrangement (the AI films) or set
  `MUSIC = "electronica"` for French-touch electronica (the web film).
  `MUSIC = "reel"` is the reel's earlier synthesised house track, cued by
  marks the animation leaves (the drop, the muffled stretch, the silence
  before the name); `MUSIC = "file"` plays a generated take instead
  (`MUSIC_FILE`, with `MUSIC_AT` the downbeat that lands on the drop), fitted
  to the same marks, and `BPM` is set to the take's own tempo;
  `SFX_DROWN` puts every effect under water. Earlier web film arrangements are still there to try: `"perc"`,
  `"drums"`, `"garage"` and `"band"`. `"electronica"`, `"perc"` and `"band"`
  play the SoundFont: `pip install --no-deps tinysoundfont` and put
  [GeneralUser GS](https://www.schristiancollins.com/generaluser) at
  `build/models/soundfont/GeneralUser-GS.sf2`. `SFX_TRIM` turns effects down
  by type for one film. The parts are written in `audio.py`.
- **Pictures.** One builder per shot in `scenes.js`, registered in its
  `setup()`, which also returns the background's colour keyframes.
