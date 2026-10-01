# History before the restart (30 May – 21 August 2026)

Main's history was restarted on 21 August 2026. Its oldest commits
(`a38b520`, 21 August, and `f39859e`, 24 August) have no parents, so
nothing on main links back to the work done before them. That work lived on
two branches, `codex` and `claude/nabl-brand-strategy-align-n6lgoz`, which
share no commits with main.

Main carried their **files** across and has developed them since: every file
on those branches is either on main, superseded by something on main, or kept
here. What main did not carry is their **commits**: the dated record of what
changed and why. This folder keeps that record, so the two branches can be
deleted without losing anything.

Checked on 29 September 2026, before the branches were deleted:

- The final commits on `nabl-brand-strategy-align` (16–17 August) are
  97–100% present, line for line, in main. The lines that are not present are
  older code that later commits on that same branch rewrote. Main has the
  branch's end state and has moved on from it.
- `nabl-brand-strategy-align` has one file main lacks, `public/_redirects`.
  Its rules moved into `netlify.toml` and are live there.
- `codex` holds the original June site and a few files that exist nowhere
  else. They are copied into `codex-2026-06/`.
- Neither branch's history holds a secret. The only key is the Supabase anon
  key, which is public by design and served by the live site.

## What is here

| Path | What it is |
|---|---|
| `pre-restart-2026-05-to-08.bundle` | Both branches, every commit, exactly as they were (4 MB). A complete, restorable copy of the history. |
| `commits-pre-restart-2026-05-to-08.md` | All 132 commits of `nabl-brand-strategy-align`, oldest first: date, message, files changed. Readable without git. |
| `commits-codex-2026-06.md` | All 81 commits of `codex`, the same way. |
| `codex-2026-06/` | The files that existed only on `codex` (see below). |

### `codex-2026-06/`: files that exist nowhere else

- **`nabl website/`**: the first site, in static HTML. It has `index.html`,
  `portal.html`, `team.html` and `sales-intelligence.html` (the first CRM,
  with its Supabase persistence and AI research panel). The React site
  replaced all four on 14–15 August.
- **`logos/`**: the first logo files, before the redrawn wordmark of
  15 August.
- **`serve.ps1`**: a PowerShell script that served the static site locally.
- **`supabase/functions/sales-research/index.ts`**: the source of the
  `sales-research` edge function. It is the June version, which asks OpenAI
  with web search to find and research leads. The CRM stopped using it when
  the AI layer was removed (14–15 August), but it is still deployed on the
  live project (version 11, 1 June). If it is deleted there, this is the
  record of what it was.

## Milestones in the history

From the commit logs. The full detail is in the two `commits-*.md` files.

- **30 May – 2 June** (`codex`): the static site, the client portal and
  team pages, and the first sales-intelligence CRM. The CRM stored records in
  Supabase and used OpenAI to discover and research leads.
- **14 August**: the rebrand. The site was rebuilt as React and Vite, with a
  design system, logo and marketing site, the client portal, legal pages and
  the scroll journey. The CRM's AI layer was removed from the backend.
- **15 August**:
  - The team space and sales CRM were ported to React, with all AI removed,
    and the AI teardown was applied to the live database.
  - Portal security: a stronger portal credential, login rate limiting, and
    the access-key rotation.
  - The email pack was rebranded and the wordmark redrawn.
  - The site was repositioned as a technology implementation partner.
- **15–16 August**: the business plan and its sixteen step folders
  (`business/01` to `business/16`). The site was then realigned to the plan:
  homepage sections, the buyer's journey, the proof engine and the sales
  conversation.
- **16–17 August**: the SEO and legal gaps closed, privacy-respecting
  conversion measurement (`site_events`), and the last grants tightened.

## Restoring it

To look through the old history with git:

```sh
git clone history/pre-restart-2026-05-to-08.bundle old-history -b nabl-brand-strategy-align
cd old-history
git fetch origin codex:codex
git log --oneline nabl-brand-strategy-align    # 132 commits
git log --oneline codex                        # 81 commits
```

To put the branches back on GitHub, from a clone of this repository:

```sh
git fetch history/pre-restart-2026-05-to-08.bundle \
  nabl-brand-strategy-align:nabl-brand-strategy-align codex:codex
git push origin nabl-brand-strategy-align codex
```

The bundle was tested this way before the branches were deleted. Both came
back with every commit, and their tips were unchanged: `e3cd9cb` and
`a4c4d05`.
