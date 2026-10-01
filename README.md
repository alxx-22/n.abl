# n.abl

Website, client portal, team space and sales CRM for n.abl — a UK automation studio.

## Stack

React 18 + Vite + React Router, served by a Cloudflare Worker (`wrangler.jsonc`). Supabase for auth, data and
private file storage. No CSS framework — the design system is hand-rolled in
`src/styles/`.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # serve the built output
```

## Branches and releasing

| Branch | What it is |
|---|---|
| `main` | Production. Every push to it builds and deploys nabl.agency. |
| `dev` | Where work is built and tested. Pushing to it deploys nothing. |

Work goes to `dev`. When a batch is ready, it goes to `main` in one merge,
so a day of commits costs one deploy rather than one each:

```bash
git checkout dev && git pull
# ...work, commit, push to dev as often as you like...
npm run build && npm run preview   # the production build, served locally
npm run test:compliance            # and whichever checks the change touches

git checkout main && git pull
git merge --no-ff dev              # one release, one deploy
git push origin main
git checkout dev && git merge main && git push origin dev   # keep dev level with main
```

A hotfix can go straight to `main`; merge `main` back into `dev` afterwards.

What keeps `dev` from deploying:

- **Cloudflare (the live site).** Workers Builds, *Settings → Build → Branch
  control*: production branch `main`, and **non-production branch builds
  off**. With them on, every push to `dev` runs a preview build, which is the
  cost this branch exists to avoid.
- **Netlify (the old host, still connected).** `netlify.toml` skips every
  branch but `main`.

`dev` does not have its own database. Migrations and edge functions still go
to the one live Supabase project when they are applied, whichever branch the
code is on.

## Routes

| Route | Surface |
|---|---|
| `/` | Marketing site |
| `/portal` | Client portal — sign in with an access key |
| `/team` | Internal team space — Supabase Auth, hidden from public nav |
| `/sales-intelligence` | Sales CRM (team only) |
| `/privacy`, `/terms`, `/cookies` | Legal documents |

`/team` is deliberately unlinked from the public navigation. There are two
discreet routes to it in the footer: the full stop in "© n.abl." and a small
square in the bottom-right corner. Both are intentional — please leave them
unlabelled.

## Design system

Tokens live in `src/styles/tokens.css`:

- **Base** — warm espresso `#0E0C0A`, not a flat corporate black
- **Light** — cream `#F0E7D8`, which is also the glow colour
- **Accent** — amber `#E9AC57`
- Glows are deliberately low-opacity: a bloom, not neon

Contrast is verified: every cream step reads AAA on every surface, and the
accent reads AAA as text.

Shared components are in `src/components/ui/`. Every animation is neutralised
under `prefers-reduced-motion`, and the preference is honoured live: the CSS
half always was, because a media query is live, and the JS half now subscribes
through `useReducedMotion()` rather than sampling once at mount. Turning the
preference on mid-visit stops the motion there and then, without a reload.
`npm run test:motion` proves both halves agree, and that the hero canvas is
idle whenever it is scrolled out of sight or its tab is in the background.

## Supabase

See [`supabase/README.md`](supabase/README.md) for the schema, the access model
and the migration that removes the CRM's old AI layer.

Two Supabase clients coexist and must stay separate (`src/lib/supabase.js`):
the team client persists its session; the portal client is built per access key,
sends it as a header, and never persists.

## Email templates

Six branded templates live in `nabl-emails/`. Edit the `.html` and `.txt` files,
then regenerate the `.eml` build output:

```bash
cd nabl-emails && ./build-eml.sh
```

Never hand-edit a `.eml` — it is generated.
