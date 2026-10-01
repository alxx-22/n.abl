# Prompt for the next session

Paste this into a new Claude Code session on the `alxx-22/n.abl` repository:

---

You're continuing work on n.abl's AI receptionist demo service, in
`demo-products/voice-agent`, on the branch `voice-agent-DEV`. Push your work
there. Don't push to `main` or open a pull request unless I ask.

Before anything else, read `demo-products/CLAUDE.md` (the rules and commands)
and `demo-products/HANDOFF.md` (where things stand, and my feedback with
what to do about it). Then read the status table in §10 of
`demo-products/DEMO-SERVICE-PLAN.md`.

Work through HANDOFF.md's list "Alex's feedback to act on" in order:

1. Make the seeded week look like a real, busy but bookable restaurant.
   Remove the Friday/Saturday 7–8pm "fully booked" exception.
2. Make walk-in tables obvious, and explain to me in one line why table 4
   had no bookings.
3. Stop the receptionist looking up an allergy on the menu during a
   booking.
4. Fix the website scout for https://www.picinottingham.co.uk/: the prices,
   and how the menu is split into sections.
5. A much better floor plan: easier moving of tables, and each seating area
   as its own sub-tab. Show me a short plan with options before building it.
6. A UI overhaul of everything under /demo to match the new website design
   on `main`. Merge `origin/main` into `voice-agent-DEV` first; the fetch is
   slow.

I'm not a developer: talk to me in plain words, and give step-by-step
instructions when I need to do something. Use only free services. Keep the
tests passing before every push. Run the live scenarios
(`npm run eval -- --only …`) whenever the receptionist's behaviour changes.
For UI work, send me screenshots from the Chromium walkthrough.
