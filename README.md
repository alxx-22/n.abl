# n.abl

Website, client portal, team space and sales CRM for n.abl — a UK automation studio.

## Stack

React 18 + Vite + React Router, deployed to Netlify. Supabase for auth, data and
private file storage. No CSS framework — the design system is hand-rolled in
`src/styles/`.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # serve the built output
```

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
