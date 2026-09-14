#!/usr/bin/env node
/* ============================================================
   SEO INVARIANTS, ASSERTED RATHER THAN HOPED FOR

   On 14 September 2026 the live home page answered every crawler with
   2,583 bytes containing zero characters of readable text, and had done
   for weeks. Nothing was broken in a way anyone would notice: the site
   looked right in a browser, the build passed, the headers were clean.
   It was invisible only to things that do not run JavaScript, and
   nothing was watching those.

   That is the failure mode this file exists for. Every check below is
   something that was true, silently stopped being true, or would have.

     node scripts/check-seo.mjs              # built output in dist/
     node scripts/check-seo.mjs --live       # the deployed site
     node scripts/check-seo.mjs --live --origin https://staging.example

   Exits non-zero on any failure, so it can gate a deploy.

   WHAT IT DELIBERATELY DOES NOT DO

   It does not check rankings. Rank is not an invariant, it is a result,
   and a script that fails when a competitor publishes a page is a
   script people learn to ignore. Position belongs in Search Console,
   which is free and which nobody has set up yet.
   ============================================================ */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const LIVE = process.argv.includes('--live')
const ORIGIN = arg('--origin', 'https://nabl.agency')

/* The four public URLs. Same list as sitemap.xml and src/prerender.jsx;
   if a page is added it goes in all three, in the same commit. */
const ROUTES = [
  { path: '/', file: 'index.html', title: /Technology implementation/i },
  { path: '/privacy', file: 'privacy/index.html', title: /Privacy Policy/i },
  { path: '/terms', file: 'terms/index.html', title: /Terms of Service/i },
  { path: '/cookies', file: 'cookies/index.html', title: /Cookie Policy/i },
]

/* The threshold is deliberately low. It is not a quality bar — it is the
   difference between "React did not run" and "React ran". The home page
   currently renders about 7,800 characters, so 500 catches a regression
   to zero without failing every time the copy is trimmed. */
const MIN_TEXT = 500

let failures = 0
let checks = 0

function check(name, ok, detail = '') {
  checks++
  if (ok) {
    console.log(`  ok    ${name}`)
  } else {
    failures++
    console.log(`  FAIL  ${name}${detail ? `\n          ${detail}` : ''}`)
  }
}

/* Visible text as a crawler that does not run JavaScript would see it:
   scripts stripped first, then tags, then whitespace collapsed. This is
   the same measurement the baseline in
   business/03-website/seo-baseline-2026-09-14.md records. */
function visibleText(html) {
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)
  if (!body) return ''
  return body[1]
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const get = async (url) => {
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
  return { status: res.status, location: res.headers.get('location'), body: await res.text() }
}

async function main() {
  console.log(LIVE ? `SEO checks against ${ORIGIN}\n` : 'SEO checks against dist/\n')

  for (const r of ROUTES) {
    console.log(`${r.path}`)
    let html
    if (LIVE) {
      const res = await get(ORIGIN + r.path)
      /* The whole point of html_handling: "drop-trailing-slash" in
         wrangler.jsonc. Before it, /privacy answered 307 to /privacy/,
         so the sitemap pointed at a redirect and the page it reached
         named the redirecting URL as its canonical. */
      check(`${r.path} answers 200, not a redirect`, res.status === 200,
        res.status === 307 ? `got ${res.status} → ${res.location}` : `got ${res.status}`)
      if (res.status !== 200) { console.log(''); continue }
      html = res.body
    } else {
      html = await readFile(join(DIST, r.file), 'utf8')
    }

    const text = visibleText(html)
    check(`renders ≥ ${MIN_TEXT} chars without JavaScript`, text.length >= MIN_TEXT,
      `got ${text.length} chars — the shell is shipping empty again`)

    const title = /<title>([^<]*)<\/title>/i.exec(html)
    check('has its own <title>', !!title && r.title.test(title[1]),
      title ? `got "${title[1]}"` : 'no <title>')

    const canonical = /<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(html)
    const want = ORIGIN + (r.path === '/' ? '/' : r.path)
    check('canonical points at itself', !!canonical && canonical[1] === want,
      canonical ? `got ${canonical[1]}, want ${want}` : 'no canonical')

    check('declares en-GB', /<html[^>]+lang="en-GB"/i.test(html))
    check('no stray noindex', !/content="[^"]*noindex/i.test(html))
    console.log('')
  }

  /* Structured data. Checked on the home page only — it is the same
     organisation on every route, and a second copy would not be a
     second fact. */
  console.log('structured data')
  const home = LIVE ? (await get(ORIGIN + '/')).body : await readFile(join(DIST, 'index.html'), 'utf8')
  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i.exec(home)
  check('JSON-LD present', !!ld)
  if (ld) {
    let data = null
    try { data = JSON.parse(ld[1]) } catch (err) { /* reported by the next check */ }
    check('JSON-LD parses', !!data)
    if (data) {
      check('is a ProfessionalService', data['@type'] === 'ProfessionalService', `got ${data['@type']}`)
      check('names an area served', Array.isArray(data.areaServed) && data.areaServed.length > 0)
      /* These are the claims that would be false today. The check is
         here so that adding one is a deliberate act with a commit
         attached, rather than something a generator does helpfully.
         When the trading address exists, delete "address" from this
         list in the same commit that adds it. */
      for (const key of ['address', 'telephone', 'priceRange', 'aggregateRating', 'review']) {
        check(`claims no ${key} (there is none to claim)`, !(key in data))
      }
    }
  }
  console.log('')

  if (LIVE) {
    console.log('crawler access')
    const agents = {
      Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot',
      ClaudeBot: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
      PerplexityBot: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    }
    for (const [name, ua] of Object.entries(agents)) {
      const res = await fetch(ORIGIN + '/', { headers: { 'user-agent': ua }, signal: AbortSignal.timeout(15_000) })
      const text = visibleText(await res.text())
      /* Cloudflare changed its AI-crawler defaults on 15 September 2026.
         This is the check that would catch a dashboard toggle quietly
         undoing the prerendering work. */
      check(`${name} gets 200 with content`, res.ok && text.length >= MIN_TEXT,
        `status ${res.status}, ${text.length} chars`)
    }
    console.log('')

    console.log('robots and sitemap')
    for (const path of ['/robots.txt', '/sitemap.xml']) {
      const res = await fetch(ORIGIN + path, { signal: AbortSignal.timeout(15_000) })
      check(`${path} is reachable`, res.ok, `got ${res.status}`)
    }
    const sm = await (await fetch(ORIGIN + '/sitemap.xml')).text()
    for (const r of ROUTES) {
      const loc = ORIGIN + (r.path === '/' ? '/' : r.path)
      check(`sitemap lists ${loc}`, sm.includes(`<loc>${loc}</loc>`))
    }
    console.log('')
  }

  console.log(`${checks - failures}/${checks} checks passed`)
  if (failures) {
    console.error(`\n${failures} failed.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
