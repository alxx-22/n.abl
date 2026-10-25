# Prompt for the next session

Paste this into a new Claude Code session on the `alxx-22/n.abl` repository
(rewritten 24 October 2026):

---

You're continuing work on n.abl's AI receptionist demo service, in
`demo-products/`, on the branch `voice-agent-DEV`. Push your work there.
Don't push to `main` or open a pull request unless I ask.

Before anything else, read, in this order:

1. `demo-products/CLAUDE.md`: the rules and commands.
2. `demo-products/SESSIONS.md`: who else is working, what each owns, and
   any messages for you. Claim your work there before you start.
3. "Where things stand" at the top of `demo-products/HANDOFF.md`.

Seven kinds of business are built. The pub is at M2, with M3 next. The
demo is going on the Oracle server: the setup guide is
`demo-products/voice-agent/deploy/oracle/README.md`. To go live it still
needs my setup (the account, the server, the DNS record and the Worker
secret), `voice-agent-DEV` merged into `main`, and the scored 20-site run
of the website scout. (Gemini billing goes on when a client signs and pays;
no legal check is needed before keys go out: my decisions, 25 October.)

Decisions waiting for me: build or drop the hair salon, and who builds it;
what comes after the pub; when to merge into `main`. Ask me about any you
need.

Then tell me what you'll do first.

I'm not a developer: talk to me in plain words, and give step-by-step
instructions that say where to click when I need to do something. Use only
free services unless I agree otherwise. Keep the tests passing before every
push. For screen work, send me screenshots from the Chromium walkthrough.
