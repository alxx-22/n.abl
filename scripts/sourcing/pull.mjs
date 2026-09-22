#!/usr/bin/env node
/* ============================================================
   Pull limited companies from the Companies House REST API.

   The logic lives in puller.mjs and is tested by pull-test.mjs without a
   key. This file is only the part that cannot be: reading the
   environment, calling the network, and writing the candidates file.

   Both keys are placeholders until somebody makes them. Neither goes in
   a tracked file — not this one, not .env.local.example. Put them in
   .env.local, which is gitignored, the easy way:

     ./scripts/set-keys.sh --companies-house        (prompts, typing hidden)
     ./scripts/set-keys.sh --gemini-discovery
     pwsh ./scripts/set-keys.ps1                    (asks for each)

   Then:

     npm run sourcing:pull:dry -- --location Nottingham --sic 432,433
         Makes no request. Prints the exact URL, which keys are present
         (masked), and what the pull would be deduplicated against. Run
         this first — it is how you know the placeholders are wired.

     npm run sourcing:pull -- --location Nottingham --sic 432,433 --since 2016-01-01
     npm run sourcing:pull -- --location Alcester --limit 100 --judge --only strong,possible

   FLAGS
     --location <text>     Companies House's location filter — a town or city
     --areas NG,B49        postcode areas to enforce afterwards (the API's
                           location match is free text, so this is the check)
     --sic 43210,432       SIC codes; a prefix expands to every code under it
     --since / --until     incorporated between, YYYY-MM-DD
     --types ltd,llp       company types (default ltd,llp — see puller.mjs)
     --name <text>         company name includes
     --limit <n>           most companies to pull (default 200)
     --judge               have the prospector argue which are worth a letter
                           (needs GEMINI_DISCOVERY_API_KEY)
     --only strong,possible   keep only these verdicts (with --judge)
     --dump-first          print the first raw API item, then carry on. For
                           the first live run: the response shape here is
                           the documented one, and this is how to check it.
     --dry-run             no network, no file written

   OUTPUT
     .sourcing/candidates-<date>-api-<tag>.json — the bulk fetcher's
     envelope and field names, so merge.mjs picks it up as a Companies
     House source and the rest of the pipeline runs unchanged. Nothing is
     written when a pull finds nothing new.
   ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import {
  CH_BASE, CH_LIMIT, DEFAULT_TYPES, buildSearchUrl, expandSic, createRateLimiter,
  pullPages, normaliseItem, admit, existingKeys, dedupe,
  prospectBatch, validateVerdicts, applyVerdicts, VERDICTS, resolveKeys, mask, ChKeyRejected,
} from './puller.mjs'
import { areasFrom } from './lib.mjs'

const argv = process.argv.slice(2)
const arg = (flag, fallback = null) => {
  const i = argv.indexOf(flag)
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const has = (flag) => argv.includes(flag)
const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : [])

const DIR = '.sourcing'
/* Overridable for the same reason GEMINI_BASE_URL is in gemini.mjs: so the
   runner can be driven end to end against a stand-in server before anybody
   has a key. Unset, it is the live API. */
const BASE = process.env.COMPANIES_HOUSE_BASE_URL || CH_BASE
const DRY = has('--dry-run')
const JUDGE = has('--judge')
const LIMIT = Math.max(1, Math.min(5000, Number(arg('--limit', 200)) || 200))
const TYPES = list(arg('--types')).length ? list(arg('--types')).map((t) => t.toLowerCase()) : [...DEFAULT_TYPES]
const AREAS = arg('--areas') ? areasFrom(arg('--areas')) : null
const ONLY = list(arg('--only')).map((v) => v.toLowerCase())
const TODAY = new Date().toISOString().slice(0, 10)

const query = {
  location: arg('--location'),
  sicCodes: expandSic(list(arg('--sic'))),
  since: arg('--since'),
  until: arg('--until'),
  nameIncludes: arg('--name'),
  types: TYPES,
}

const tick = '✓', cross = '✗'
const say = (s = '') => console.log(s)
const stop = (msg, code = 2) => { console.error(`\n  ${cross} ${msg}\n`); process.exit(code) }

/* ---- refuse the nonsensical before touching anything ---- */
for (const v of ONLY) if (!VERDICTS.includes(v)) stop(`--only ${v}: not a verdict. Use ${VERDICTS.join(', ')}.`)
if (ONLY.length && !JUDGE) stop('--only filters on verdicts, which only exist with --judge.')
for (const [flag, v] of [['--since', query.since], ['--until', query.until]]) {
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) stop(`${flag} ${v}: use YYYY-MM-DD.`)
}
if (!query.location && !query.sicCodes.length && !query.nameIncludes) {
  stop('Give at least one of --location, --sic or --name. An unfiltered pull is the whole register.')
}

/* ---- what we would be deduplicating against ----
   Every earlier candidates file, bulk or pulled, plus an export of the
   leads already in the CRM if one has been saved. The CRM export matters
   most: sales_leads has no unique constraint beyond its id, so the load
   step cannot catch a company that is already a lead. */
function loadExisting() {
  const records = []
  const sources = []
  if (fs.existsSync(DIR)) {
    for (const f of fs.readdirSync(DIR).filter((n) => /^candidates-.*\.json$/.test(n)).sort()) {
      try {
        const doc = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
        const rows = Array.isArray(doc.candidates) ? doc.candidates : []
        records.push(...rows)
        sources.push(`${f} (${rows.length})`)
      } catch { sources.push(`${f} (unreadable, skipped)`) }
    }
    const crm = path.join(DIR, 'existing-leads.json')
    if (fs.existsSync(crm)) {
      try {
        const rows = JSON.parse(fs.readFileSync(crm, 'utf8'))
        const arr = Array.isArray(rows) ? rows : rows.leads || []
        records.push(...arr)
        sources.push(`existing-leads.json (${arr.length}, from the CRM)`)
      } catch { sources.push('existing-leads.json (unreadable, skipped)') }
    }
  }
  return { records, sources }
}

const keys = resolveKeys(process.env, { judge: JUDGE })
const existing = loadExisting()

say(`\n  LEAD PULL${DRY ? ' — dry run, nothing requested, nothing written' : ''}\n`)
say(`  request   ${buildSearchUrl({ ...query, size: Math.min(LIMIT, 1000), startIndex: 0 }, BASE)}`)
if (query.sicCodes.length) say(`  sic       ${query.sicCodes.length} code${query.sicCodes.length === 1 ? '' : 's'}${list(arg('--sic')).some((s) => s.replace(/\D/g, '').length < 5) ? ' (prefixes expanded)' : ''}`)
say(`  types     ${TYPES.join(', ')}${AREAS ? `   areas ${AREAS.join(',')}` : ''}   limit ${LIMIT}`)
say(`  keys      COMPANIES_HOUSE_API_KEY  ${mask(keys.ch)}`)
say(`            GEMINI_DISCOVERY_API_KEY ${mask(keys.gemini)}${JUDGE ? '' : '   (not needed without --judge)'}`)
say(`  dedupe    against ${existing.records.length} record${existing.records.length === 1 ? '' : 's'}${existing.sources.length ? ':' : ' — nothing saved yet'}`)
for (const s of existing.sources) say(`              ${s}`)
if (!existing.sources.some((s) => s.startsWith('existing-leads.json'))) {
  say(`            ${cross} no CRM export at .sourcing/existing-leads.json — a company that is already`)
  say(`              a lead will not be caught here, and the load step will not catch it either.`)
}

if (DRY) {
  const one = keys.missing.length === 1
  say(keys.ok ? `\n  ${tick} Keys present. Drop --dry-run to pull.\n`
    : `\n  ${cross} Missing: ${keys.missing.join(', ')}. The dry run does not need ${one ? 'it' : 'them'}; the real run will.\n`)
  process.exit(0)
}
if (!keys.ok) {
  stop(`Missing ${keys.missing.join(' and ')}.\n\n` +
    `    Put ${keys.missing.length > 1 ? 'them' : 'it'} in .env.local, which is gitignored:\n` +
    `      ./scripts/set-keys.sh${keys.missing.includes('COMPANIES_HOUSE_API_KEY') ? ' --companies-house' : ''}${keys.missing.includes('GEMINI_DISCOVERY_API_KEY') ? ' --gemini-discovery' : ''}\n\n` +
    `    Never in .env.local.example — that file is tracked.` +
    (keys.missing.includes('GEMINI_DISCOVERY_API_KEY') && process.env.GEMINI_API_KEY
      ? `\n\n    GEMINI_API_KEY is set, and is deliberately not used here: it is the writer's\n    quota, and spending it on prospecting would stop the writer.`
      : ''))
}

/* ---- pull ---- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/* 600 in five minutes is one every half second on average. Pacing at
   exactly that would never trip the window; the window stays as the
   backstop for anything that retries. */
const take = createRateLimiter({ ...CH_LIMIT, minGapMs: 500, sleep })

let pulled
try {
  pulled = await pullPages({
    fetchImpl: fetch, key: keys.ch, query, limit: LIMIT, take, sleep, base: BASE,
    log: (m) => say(m),
  })
} catch (err) {
  stop(err instanceof ChKeyRejected ? err.message : `The pull failed: ${err.message}`)
}

if (has('--dump-first') && pulled.items[0]) {
  say('\n  FIRST RAW ITEM — compare against normaliseItem() in puller.mjs\n')
  say(JSON.stringify(pulled.items[0], null, 2).split('\n').map((l) => `    ${l}`).join('\n'))
}

say(`\n  ${pulled.items.length} returned` +
  `${pulled.hits !== null ? ` of ${pulled.hits.toLocaleString()} matching` : ''}` +
  ` — ${pulled.requests} request${pulled.requests === 1 ? '' : 's'}, ${pulled.pages} page${pulled.pages === 1 ? '' : 's'}`)

/* ---- shape, admit, dedupe ---- */
const shaped = pulled.items.map((it) => normaliseItem(it, { pulledOn: TODAY }))
const refused = {}
const admitted = []
for (const c of shaped) {
  const verdict = admit(c, { types: TYPES, areas: AREAS })
  if (verdict.ok) { admitted.push(c); continue }
  /* Grouped by reason, with the postcode taken out so forty companies
     outside the area are one line rather than forty. */
  const why = verdict.why.replace(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/g, '<postcode>')
  refused[why] = (refused[why] || 0) + 1
}
const { fresh, duplicates } = dedupe(admitted, existingKeys(existing.records))

say(`  ${admitted.length} admitted, ${shaped.length - admitted.length} refused, ${duplicates.length} already known, ${fresh.length} new`)
for (const [why, n] of Object.entries(refused).sort((a, b) => b[1] - a[1])) say(`      ${String(n).padStart(4)}  ${why}`)
if (duplicates.length) {
  const how = duplicates.reduce((m, d) => { m[d.how] = (m[d.how] || 0) + 1; return m }, {})
  for (const [h, n] of Object.entries(how)) say(`      ${String(n).padStart(4)}  known by ${h}`)
}

/* ---- the prospector ---- */
let final = fresh
if (JUDGE && fresh.length) {
  const { createClient, AllModelsExhausted } = await import('./gemini.mjs')
  const gemini = createClient({
    keyEnv: 'GEMINI_DISCOVERY_API_KEY',
    stateFile: path.join(DIR, 'gemini-discovery-state.json'),
    log: (m) => say(m),
  })
  const BATCH = 20
  const all = new Map()
  let rejected = 0, routes = 0, unjudged = 0
  say(`\n  prospector: ${fresh.length} companies, ${Math.ceil(fresh.length / BATCH)} call${fresh.length > BATCH ? 's' : ''}`)
  for (let i = 0; i < fresh.length; i += BATCH) {
    const chunk = fresh.slice(i, i + BATCH)
    const { system, user, idMap } = prospectBatch(chunk)
    let raw = null, model = null
    try {
      const r = await gemini.ask('judge', { system, user, temperature: 0.2 })
      model = r.model
      try { raw = JSON.parse(String(r.text).replace(/^```(?:json)?\s*|\s*```$/g, '').trim()) } catch { raw = null }
    } catch (err) {
      if (err instanceof AllModelsExhausted) { say(`  ${cross} the discovery project's daily quota is spent; the rest go unjudged`); unjudged += fresh.length - i; break }
      say(`  ${cross} batch ${i / BATCH + 1}: ${err.message}`)
    }
    const v = validateVerdicts(raw, idMap)
    for (const [num, verdict] of v.verdicts) all.set(num, { ...verdict, model })
    rejected += v.rejected.length
    routes += v.contactRoutes
    unjudged += v.unjudged
  }
  final = applyVerdicts(fresh, all)

  const tally = VERDICTS.map((v) => `${final.filter((c) => c.prospect?.verdict === v).length} ${v}`).join(', ')
  say(`  verdicts: ${tally}; ${unjudged} unjudged, ${rejected} refused`)
  if (routes) say(`  ${cross} ${routes} answer${routes === 1 ? '' : 's'} carried a contact route and ${routes === 1 ? 'was' : 'were'} refused whole. Worth reading the prompt.`)
  if (ONLY.length) {
    const before = final.length
    final = final.filter((c) => ONLY.includes(c.prospect?.verdict))
    say(`  --only ${ONLY.join(',')}: kept ${final.length} of ${before}`)
  }
}

/* ---- write ---- */
if (!final.length) {
  say(`\n  Nothing new to write.\n`)
  process.exit(0)
}
const tag = [query.location, ...list(arg('--sic')).slice(0, 3)].filter(Boolean).join('-')
  .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'pull'
fs.mkdirSync(DIR, { recursive: true })
let out = path.join(DIR, `candidates-${TODAY}-api-${tag}.json`)
for (let n = 2; fs.existsSync(out); n++) out = path.join(DIR, `candidates-${TODAY}-api-${tag}-${n}.json`)

fs.writeFileSync(out, JSON.stringify({
  snapshot: TODAY,
  source: 'companies_house_api',
  query: { ...query, areas: AREAS, limit: LIMIT, judged: JUDGE, only: ONLY },
  areas: AREAS || [],
  generated_at: new Date().toISOString(),
  count: final.length,
  candidates: final,
}, null, 2))

say(`\n  ${tick} ${final.length} written → ${out}`)
say(`\n  Next, unchanged from the bulk path:`)
say(`    node scripts/sourcing/merge.mjs  →  triage  →  find-websites  →  extract-contacts  →  promote`)
say(`\n  Every one arrives do_not_contact. Pulling a company is not approving it.\n`)
