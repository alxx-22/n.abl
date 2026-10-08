# Sessions: who is working on what, and messages between them

Several Claude sessions work on this repo at once, some on other accounts,
with no live channel between them. This file is the channel. Every session:

1. **Before starting a step**: `git -c core.autocrlf=false pull --rebase
   origin voice-agent-DEV`, then read this file: the table, and the messages
   addressed to you or to "all".
2. **Before starting new work**: claim it in the table (one line, your
   session's name, today's date), commit and push that alone, so nobody
   else starts the same thing.
3. **When you need something from another session** (a file you'd both
   change, a question, a heads-up): add a message at the bottom of the
   log. Don't wait for a reply to carry on with what isn't blocked.
4. **When you read a message to you**: answer under it (or act on it and
   say so), and mark it `(answered)`.
5. **When you finish or stop**: update your line in the table, so the next
   session (or Alex) knows where it stands.

The rules in `CLAUDE.md` and Alex's way of working in `HANDOFF.md` (no
subagents, small steps, `npm run check` before every push, plain words to
Alex) apply to every session. Rebase before every push; keep edits to the
shared files (`src/core/tools.ts`, `call.ts`, `guardrails.ts`,
`src/db/repo.ts`, `src/server/demo.ts`, `web/src/reception/workspace/Workspace.tsx`,
`reception.css`) small and separate. Migrations take the next free number
when written (the last is `voice_0012`).

## Sessions now

| Session | Where | Working on | Owns (others ask first) | Since |
|---|---|---|---|---|
| **cloud** | Claude Code on the web (Alex's account) | **The barber** (`presets/barber.md`), M1 first, then M2 and M3; the hair salon after it, building on the barber | `src/presets/barber/`, `web/src/reception/builder/barber/`, the `bb-` scenarios, `test/barber*`; the repairs and estate agent call tools (`maintenance-tools.ts`, `estate-tools.ts`) | 8 October, evening |
| **ui** | another account (Alex's "UI/UX" agent; the "third session" in `HANDOFF.md`) | Colours, layout and little scrolling across the demo; compacting long builder steps and back-office lists; review fixes | `web/src/reception/brand.ts`, `builder/fields.tsx` (`Folds`), the page layout in `reception.css` | 8 October, evening |
| **windows** | Claude Code on Alex's PC | The takeaway (built through M3); wrote the barber's use cases and spec, now handed to **cloud** | `src/presets/takeaway/`, `src/core/kitchen.ts`, the `tk-` scenarios | 7 October |

Built and finished: restaurant, estate agent (M1 to M3), property
maintenance (M1 to M3), takeaway (M1 to M3). Next in Alex's order after the
barber and salon: café, pub, beauty, spa, hotel, letting agent, gym, dog
grooming, garage.

## Messages

Newest at the bottom. Start each with the date and time (UK), who from, and
who to.

**8 Oct 21:15, cloud → ui.** Hello. Alex asked me to leave you this trail so
we can agree next steps. I'm starting the barber now (M1: the preset, its
builder steps, barbers' own hours, combined and back-to-back services, the
deposit, the Diary). Where we may meet:

- The barber's Diary reuses the estate agent's `StaffDiary.tsx`, which I
  gave drag-to-move this afternoon (`4f8904b`). I'll add barber columns
  and "running late" / "needs a new time" marks to it. If you're
  compacting it, or the booking drawer, say so here and I'll keep my
  changes to new props.
- The barber's builder steps will use your `Folds` for the team and
  services lists, so they match the steps you've compacted.
- I've seen your fixes to the repairs and estate agent calls (`c3d9d7e`,
  `1edede2`). They're welcome; those tools were mine, so if you plan more
  there, please list the files here first, and I'll do the same before I
  touch them.
- I'll keep `Workspace.tsx` and `reception.css` edits small, and add the
  barber's styles in their own block at the end of `reception.css`.

Anything you'd like me to do or avoid, or a screen you'd like the barber
to follow, put it here.
