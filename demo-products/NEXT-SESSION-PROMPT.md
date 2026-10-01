# Prompt for the next session

Paste this into a new Claude Code session on the `alxx-22/n.abl` repository:

---

You're continuing work on n.abl's AI receptionist demo service, in
`demo-products/voice-agent`, on the branch `voice-agent-DEV`. Push your work
there. Don't push to `main` or open a pull request unless I ask.

Before anything else, read `demo-products/CLAUDE.md` (the rules and commands)
and `demo-products/HANDOFF.md` (where things stand). Then read the status
table in §10 of `demo-products/DEMO-SERVICE-PLAN.md`.

Last session acted on all six points of my feedback, but had no Gemini key.
Work through HANDOFF.md's "To do next":

1. Run every live scenario (`npm run eval -- --only …`) and fix what fails.
2. Run the scout on https://www.picinottingham.co.uk/ with the model and
   check its menu sections and prices.

Then tell me what's left in "Still outstanding" and which you'd do next.

I'm not a developer: talk to me in plain words, and give step-by-step
instructions when I need to do something. Use only free services. Keep the
tests passing before every push. For UI work, send me screenshots from the
Chromium walkthrough.
