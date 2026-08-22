# Moving the site to Cloudflare Pages

**Why.** Netlify paused production deploys on 22 August — the team ran out of
credits for the billing cycle. Two pushes were *skipped*, not failed, so the
site silently stayed on a build from before 21 August while every commit
landed on `main` as normal. Nothing was wrong with the code; the host stopped
listening.

Cloudflare Pages is free at this scale, has no build-credit meter to run out
of, and reads the same `_redirects` and `_headers` files Netlify does.

**Everything in the repo is already done.** What follows is the part that has
to happen in a browser.

---

## What was prepared

| | |
|---|---|
| `public/_redirects` | Already existed and needed no change — Cloudflare reads the same format |
| `public/_headers` | **New.** Every security header lived only in `netlify.toml`, which Cloudflare does not read |
| `.node-version` | Pins Node 22, which `netlify.toml` set through an env var Cloudflare ignores |
| `scripts/check-headers.mjs` | Fails the build if the two hosts' headers disagree |

That second row is the one that would have bitten. Without `_headers` the site
would have deployed perfectly and served no Content-Security-Policy, no HSTS
and no `X-Frame-Options`, and looked completely normal while doing it.

## It is a Worker, not a Pages project

Cloudflare's dashboard now routes this through **Workers Builds** rather than
Pages. The build succeeded on the first attempt — both guards passed — and the
*deploy* step failed:

```
Detected Project Settings:
 - Worker Name: n-abl
 - Framework: Vite
✘ The version of Vite used in the project ("5.4.21") cannot be automatically
  configured. Please update the Vite version to at least "6.0.0".
```

With no `wrangler.jsonc` present, wrangler tried to auto-detect the framework
and wire up the Cloudflare Vite plugin, which needs Vite 6.

**The fix was not to upgrade Vite.** Nothing here needs that plugin: the build
already produces a directory of static files, and the job is to upload it.
`wrangler.jsonc` now declares an assets-only Worker, so wrangler stops
guessing. No `main`, no `binding` — both are only valid with a Worker script,
and this site has none.

`_headers` and `_redirects` are supported natively by Workers Static Assets
exactly as they were by Pages, so nothing about the security headers changes.
SPA routing is set explicitly with `not_found_handling`, which the migration
guide notes Workers requires deliberately: Pages inferred it, and inference is
how a misconfiguration goes unnoticed.

## Steps

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.**
   Authorise GitHub, pick `alxx-22/n.abl`.

2. **Build settings.** Framework preset: *None*. Then:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Production branch: `main`

   Nothing else. No environment variables — the Supabase URL and anon key are
   compiled in, and the anon key is designed to be public.

3. **Deploy.** It will build from the current `main`. Check the log ends with
   `76 tokens declared`, `11 headers across 4 paths` and `✓ built`.

4. **Check it on the `*.pages.dev` URL before touching DNS.** Specifically:
   - `/crm` shows the ribbon with Insights, Leads and Board
   - `/privacy` no longer contains "we do not scrape at volume"
   - `curl -I` on the pages.dev URL returns `content-security-policy` and
     `strict-transport-security`. **If those two headers are missing, stop** —
     `_headers` did not make it into the output and the DNS move would take the
     site's security posture down with it.

5. **Point the domain.** Cloudflare Pages → Custom domains → add
   `nabl.agency` and `www.nabl.agency`, then follow the DNS instructions. If
   the domain's nameservers are already Cloudflare's this is a click; if they
   are elsewhere it is a CNAME change and up to a few hours to propagate.

6. **Leave Netlify alone for a week.** Do not delete the site. If something is
   wrong, pointing DNS back is the fastest possible rollback, and it only works
   if the old deploy still exists.

## Afterwards

Once the move is settled, delete `netlify.toml` **and**
`scripts/check-headers.mjs` in the same commit. Two copies of a security
policy is a policy that will eventually disagree with itself; the check exists
only to hold them together while both hosts are live.

## What this does not change

Supabase, the CRM, the compliance layer and the sourcing pipeline are all
untouched — none of them care where the static files are served from. The
client portal and team space authenticate directly against Supabase from the
browser.
