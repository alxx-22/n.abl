# demo-products: working rules

The AI receptionist (`voice-agent/`) and its demo service at
`nabl.agency/demo`. Read `HANDOFF.md` first for where things stand, then
`DEMO-SERVICE-PLAN.md` (the status table is in §10).

## Rules

- **Branch**: work and push on `voice-agent-DEV`. Never push to `main`, and
  don't open a pull request unless Alex asks.
- **Shared Supabase project** `auivrancfnrdwyiqoakt`, which also holds another
  member's chatbot.
  - Only ever create or change `voice_`-prefixed objects.
  - Migrations live in `voice-agent/src/db/migrations/voice_000N_*.sql`. Apply
    them through the Supabase connector and record each in
    `voice_schema_migrations`.
  - `test/db.test.ts` checks the prefix and the list of migrations.
- **Nothing paid without asking.** Alex wants free services only. Payments
  in the demo are pretend, with placeholder cards; no real card data
  anywhere.
- **Gemini**: the free tier is for the team's own testing. Google's terms
  (23 March 2026) allow only paid services for apps offered to people in the
  UK, EEA or Switzerland, so billing goes on the key before prospects use it.
- **Secrets** never go in the repo. Never disable TLS verification.
- **No model names or IDs** in commits, code or docs.
- **Talking to Alex**: Alex is not a developer. Use plain words and
  step-by-step instructions that say where to click.

## Commands (in `voice-agent/`)

| Command | What |
|---|---|
| `npm run dev` | The app on :8787 (`/demo/admin` console, `/demo/reception` prospect side); local PGlite database |
| `npm run check` | Typecheck and the unit and HTTP tests (no key needed) |
| `npm run check:all` | Also the Chromium walkthrough of the whole demo (`test-e2e/demo-ui.ts`) |
| `npm run eval -- --only id1,id2` | Simulated callers against the live model (`src/eval/scenarios.ts`); needs `GEMINI_API_KEY` |
| `npm run e2e:scout -- <url>` | The website scout against a real site, real model |
| `node scripts/check-worker-routes.mjs` (repo root) | The site Worker's `/demo/*` forwarding |

- Node 22 runs the server's TypeScript directly; only `web/` has a build step.
- PGlite allows one process at a time.

## How work is done here

- Run the tests before every push.
- When a change affects what the receptionist does, add or run an eval
  scenario too: unit tests can't show what the model actually says.
- Reproduce a bug from Alex's call before fixing it (make a restaurant with
  `defaultAnswers()` and `compileRestaurant`, seed it, call `runTool`).
- Comments say why, not what. Copy is British English, plain and short.
- The demo wears the site's design. When the site's `src/styles/tokens.css`
  changes, copy it into `voice-agent/web/src/tokens.css` (a test checks).
- For UI work, send Alex screenshots from the Chromium walkthrough
  (`eval-results/demo-ui/`).
- Commit messages say what changed for the user, and why.
