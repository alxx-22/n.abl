# Phase 0 spike results, 29 September 2026

What the Live models actually do with phone-quality audio, on the free-tier
key. Produced by `npm run spike:audio` (source: `src/spike/audio.ts`); the raw
JSON is written to `spike-output/`, which is not committed.

## Method

- A five-turn booking call to Luca's Trattoria: ask about Sunday hours, ask
  for a table for four at seven, give a name and number, say yes, say bye.
- Caller lines spoken by `gemini-2.5-flash-preview-tts`, squeezed through
  8 kHz μ-law and back to 16 kHz (the real phone path), with the TTS clip's
  leading and trailing silence trimmed, then streamed in real time in 20 ms
  frames, with silence frames between turns as a phone line would send.
- A representative prompt (about 1,000 tokens) and four tools with canned
  answers.
- **Latency** is from the last frame of caller speech to the first frame of
  agent audio. It includes Gemini's own end-of-speech detection (default
  settings in the spike), the model and any tool round trip. The first audio
  is often a holding line ("Let me check"), which is the point.
- Each model was run more than once. The runs differed, and that difference
  is itself the main finding.

## Setup fields

| Field | 3.8 Live | 3 Flash Live (`gemini-3.1-flash-live-preview`) | 3.8 Live Extended Thinking | 2.5 Native Audio |
|---|---|---|---|---|
| Input and output transcription | ✓ | ✓ | ✓ | ✓ |
| Named voice (`Kore`) | ✓ | ✓ | ✓ | ✓ |
| `languageCode: en-GB` | ✓ | ✓ | ✓ | **rejected** ("Unsupported language code") |
| VAD tuning (silence, padding, sensitivity) | ✓ | ✓ | ✓ | ✓ |
| Session resumption | ✓ | ✓ | ✓ | ✓ |
| Context-window compression | ✓ | ✓ | ✓ | ✓ |
| Opens without `thinkingLevel` | ✓ | ✓ | **no** | ✓ |

## Results

| Model | Run | Greeting, first audio | Reply latency per turn (s) | Median | Completed the booking? | Tokens per minute of call |
|---|---|---|---|---|---|---|
| **3.8 Live** | A | 0.95 s | 0.77 · 1.53 · 1.63 · 2.21 · 1.20 | **1.5 s** | Yes, correctly | 16.8K |
| | B | 2.54 s | 2.62 · 3.67 · 10.24 · 25.20 · — | 6.9 s | Yes, but very slowly | 9.5K |
| | untrimmed audio | 0.90 s | 2.05 · 2.40 · — · — · — | — | **No: went silent after turn 2** | — |
| **3 Flash Live** | A | 1.17 s | 4.41 · 2.34 · 2.09 · 2.22 · 2.40 | **2.3 s** | Yes, correctly | 14.3K |
| | B | 0.69 s | 1.68 · 2.43 · 2.18 · 2.33 · 2.25 | **2.3 s** | Yes, correctly | 15.8K |
| | untrimmed audio | 0.58 s | (includes clip silence) | — | Yes, correctly | — |
| 3.8 Live Extended Thinking | untrimmed audio | 0.66 s | 1.20 · — · 5.45 · 1.53 · — | — | **No.** Holding lines, then tool calls after its turn had ended; once said "a system error occurred" | — |
| 2.5 Native Audio | untrimmed audio | **5.49 s** | no reply to any spoken turn | — | **No** | — |

**Tokens.** The prompt count grows every turn (about 1.0K at the greeting,
about 3.4K by the fifth turn), because each turn re-counts the whole context.
A call uses **roughly 10–17K tokens a minute**. Against the free-tier cap of
65K a minute, that is **about four simultaneous calls per model**, or eight
across 3.8 Live and 3 Flash Live together. The production setup turns on
context-window compression, which bounds the growth on long calls.

**Transcription.** Built-in input transcription was accurate on phone-quality
audio for 3.8 Live and 3 Flash Live: every caller line came back word for
word, including "My number is 07700900123". 2.5 Native Audio heard "Minumber
or 770 or 900 123". **The separate Transcribe Live model is not needed.**

**Behaviour.**

- 3 Flash Live, three runs out of three: checked hours and availability with
  tools, read back the name, date, time and number, asked before booking,
  gave the reference, and called `end_call` after goodbye.
- 3.8 Live followed the same sequence when it worked, and never claimed a
  booking before `create_booking` returned. It once added "This conversation
  has concluded." after its goodbye. One run went silent after turn 2 with no
  close event (the spike had no close logging then; the call orchestrator now
  logs closes and resumes the session from its handle).
- Speaking "Let me check…" before a tool call happened unprompted, and the
  production prompt asks for it.

**TTS.** `gemini-3.8-flash-tts` returns 429 on this key (no free-tier
allowance). `gemini-2.5-flash-preview-tts` works, and is the default
`TTS_MODEL` for evaluation fixtures.

## Decisions taken from this

- **D7, primary model: 3 Flash Live (`gemini-3.1-flash-live-preview`), with
  3.8 Live as the fallback.** This reverses the plan's provisional choice. 3.8
  Live is faster at its best (1.5 s median against 2.3 s), but a sales demo
  needs the same behaviour every time, and 3 Flash Live gave it in every run
  while 3.8 Live gave it in one of three. It is a one-line change
  (`LIVE_MODEL_PRIMARY`), and the evaluation suite re-tests both.
- **Extended Thinking and 2.5 Native Audio are out** of the live chain. 2.5
  also cannot take `en-GB`.
- **Transcribe Live is not needed**: built-in transcription is good enough.
- **VAD**: production sets end-of-speech silence to 600 ms (`VAD_SILENCE_MS`)
  with 200 ms prefix padding. Phone callers pause mid-sentence, so this should
  not go much lower; the evaluation suite measures whether it clips callers.
- **Capacity**: plan for four simultaneous calls per model on the free tier,
  and cap concurrency accordingly in Phase 7.

## Not measured yet

- Latency through a real Twilio call (network legs to Twilio's edge and from
  Fly's London region). Phase 5.
- Behaviour with background noise and strong accents. The evaluation suite's
  noise fixtures.
- ~~How much the 600 ms VAD setting saves over the default.~~ Measured on 29
  September with the production prompt and phone-quality audio on 3 Flash
  Live: **6.9 s** from the end of the caller's speech to the reply with
  Google's defaults, **1.2 to 1.5 s** with 600 ms of silence and 200 ms of
  prefix padding.

## Later the same day: a model that goes deaf

After the evaluation suite had run twice, 3 Flash Live stopped hearing audio
on this key while still answering text prompts. The same recording it had
heard in four out of four trials earlier went unheard in five out of five,
with or without background noise and whatever the silence before it; 3.8 Live
heard it at once and replied in 0.66 s. It recovered on its own later. The
likeliest cause is a free-tier limit, but that is inference. The call now
carries a watchdog that hands over to the other model (`src/core/call.ts`),
and the phone test booked a table with the primary deliberately deafened.


## 30 September: taking turns ourselves

Google's detection ends a caller's turn after a fixed silence (0.6 s here).
A caller who pauses mid-order ("a margherita and, um...") was answered
mid-sentence, and one who asked the family what they wanted got a reply to
that too. `npm run spike:turns` checked whether the server can take over:
automatic activity detection off, each turn marked with `activityStart` and
`activityEnd`.

| Question | 3 Flash Live | 3.8 Live |
|---|---|---|
| Replies to a text cue (the greeting) with detection off | yes | yes |
| Audio sent outside a turn | ignored: not transcribed, no reply | same |
| Caller transcribed while the turn is still open | **no**: all of it arrives about 0.4 s after `activityEnd` | same |
| `activityStart` while the agent talks | interrupts it in 48 ms | 78 ms |
| Reply after `activityEnd` | 1.0 to 1.2 s | 1.0 s |
| One turn holding a 1.5 s pause, "hang on, let me ask the kids", the family's answer and the real request | correct reply: "two margheritas, a garlic bread and a spaghetti carbonara" | correct, though its transcript dropped two of the phrases |
| "Mm-hm" sent outside a turn while the agent talks | ignored; it kept talking | same |

Because the receptionist only transcribes a turn after it closes, deciding
"they said um, wait" needs the words from somewhere else.
`src/spike/transcriber.ts` fed the same audio to **Transcribe Live**
(`gemini-3.5-transcribe-live`, automatic detection, 300 ms silence): each
phrase came back whole, 1.0 to 1.2 s after it ended ("Can I get a margarita
and um", "Jack, do you want pizza or pasta?"). Too slow to decide every
turn, fast enough for the longer waits that matter.

What was built from this is described in `README.md` ("How it takes turns")
and `src/core/turns.ts`. `npm run e2e:turns` plays a scripted caller through
the real call against live Gemini and checks each behaviour.
