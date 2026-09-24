/* The research loop: what happens to a business whose website the
   guesser could not find.

   Pure, like prospect.mjs: no network, no environment. The edge function
   supplies the tools and the model calls; scripts/check-prospector.mjs
   drives the same loop with fakes.

   WHY THERE IS NO WEB SEARCH HERE

   The obvious tool is a search engine, and on the Gemini API that means
   Grounding with Google Search. Its terms forbid exactly this use: grounded
   results may not be cached, stored or analysed, and grounding may not be
   used "to extract or collect" links for another purpose (read 24
   September 2026; business/10-lead-sourcing/ai-discovery.md section 1).
   crt.sh's certificate search was the next idea; its robots.txt disallows
   every path. So the investigator works with what may lawfully be read by
   a program:

     register_history   Companies House: previous names, the other
                        companies its directors run (names only, never a
                        person's), the companies that control it
     guess_domains      domains guessed from a name the investigator
                        chooses: a previous name, a sister company
     check_domain       a domain's own front page, read politely, and
                        whether it names the business
     archived_copy      the Internet Archive's copy of a domain whose live
                        site turned us away or has gone
     conclude           the answer

   THE RULES, IN CODE

   - The investigator never names a domain of its own invention: it may
     only check a domain code has offered it (a guess that resolved, a
     domain the guesser already found, a site linked from a page it read).
     No contact route ever comes from a model.
   - A domain is theirs only when code finds the business on the page.
     A postcode or company number on the page settles it. The name alone
     does not: a second agent, the checker, has to agree that the page is
     this business, and without that the conclusion is refused.
   - Directory and social sites are never a business's own site.
   - What the investigator reads of a page has its contact routes and the
     company number taken out first. */

import { contactRouteIn } from './puller.mjs'

export const DIRECTORIES = new Set([
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
  'yell.com', 'checkatrade.com', 'trustatrader.com', 'ratedpeople.com', 'mybuilder.com', 'trustpilot.com', 'google.com',
  'bing.com', 'yelp.com', 'yelp.co.uk', 'thomsonlocal.com', 'scoot.co.uk', 'cylex-uk.co.uk', 'endole.co.uk',
  'companieshouse.gov.uk', 'find-and-update.company-information.service.gov.uk', 'opencorporates.com', 'bizdb.co.uk',
  'companycheck.co.uk', 'duedil.com', 'gov.uk', 'wix.com', 'wordpress.com', 'squarespace.com', 'godaddy.com',
  'bark.com', 'houzz.co.uk', 'houzz.com', 'which.co.uk', 'freeindex.co.uk', 'hotfrog.co.uk', 'tripadvisor.co.uk',
  'tripadvisor.com', 'booking.com', 'airbnb.co.uk', 'airbnb.com', 'wa.me', 'whatsapp.com', 'archive.org',
])

/** A bare, lower-case host from whatever was given: no scheme, path, port
    or leading www. Null for anything that is not shaped like a domain. */
export function normaliseDomain(x) {
  let s = String(x ?? '').trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '')
  if (s.length > 253 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) return null
  if (!/\.[a-z]{2,}$/.test(s)) return null
  return s
}

export function isDirectory(domain) {
  const d = normaliseDomain(domain)
  if (!d) return true
  for (const dir of DIRECTORIES) if (d === dir || d.endsWith(`.${dir}`)) return true
  return false
}

/** Domains named in the guesser's outcome ("x.co.uk: does not mention
    them; y.com: exists but turned us away (403)"): the first offers. */
export function domainsInOutcome(outcome) {
  const out = []
  for (const m of String(outcome ?? '').matchAll(/([a-z0-9-]+(?:\.[a-z0-9-]+)+):/gi)) {
    const d = normaliseDomain(m[1])
    if (d && !isDirectory(d) && !out.includes(d)) out.push(d)
  }
  return out
}

/** Other sites a business's page links to - a sister company, a trading
    name. Offered to the investigator, never trusted. */
export function linkedDomains(html, ownHost, max = 8) {
  const own = normaliseDomain(ownHost)
  const out = []
  for (const m of String(html ?? '').matchAll(/<a\b[^>]*\bhref\s*=\s*["'](https?:\/\/[^"'#\s]+)["']/gi)) {
    const d = normaliseDomain(m[1])
    if (!d || d === own || isDirectory(d) || out.includes(d)) continue
    out.push(d)
    if (out.length >= max) break
  }
  return out
}

/* ---------- the Internet Archive ---------- */

/** The snapshot the availability API offers, or null. */
export function parseAvailability(json) {
  const c = json?.archived_snapshots?.closest
  if (!c || c.available !== true || String(c.status ?? '') !== '200') return null
  const ts = String(c.timestamp ?? '')
  if (!/^\d{14}$/.test(ts)) return null
  const original = String(c.url ?? '').replace(/^https?:\/\/web\.archive\.org\/web\/\d{14}[a-z_]*\//, '')
  return { timestamp: ts, original, date: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` }
}

/** The raw page as archived, without the archive's own toolbar. */
export const archivedUrl = (timestamp, original) => `https://web.archive.org/web/${timestamp}id_/${original}`

/** A stored archived website, taken apart: when, and of what. */
export function readArchivedUrl(url) {
  const m = String(url ?? '').match(/^https:\/\/web\.archive\.org\/web\/(\d{14})id_\/(https?:\/\/.+)$/)
  return m ? { timestamp: m[1], original: m[2], date: `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}` } : null
}

/* ---------- the tools the investigator is given ---------- */

export const TOOLS = [
  {
    name: 'register_history',
    description: 'What Companies House shows beyond the basic record: names the company was registered under before, other companies its directors run (company names only), and any company that controls it. Use it to find a trading name or sister company whose website might be theirs.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'guess_domains',
    description: 'Guess the domains a UK business with this name would use (.co.uk, .com, .uk; joined, hyphenated, with "and", with "ltd") and return the ones that exist. Give a name you have a reason to try: a previous name, a sister company, a trading name seen on a page.',
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'a business name, e.g. "Bramley and Son"' } }, required: ['name'] },
  },
  {
    name: 'check_domain',
    description: 'Read the live front page of a domain you have been offered, and say whether it names this business. Returns the verdict, the page title, a short extract with contact details removed, and other domains the page links to.',
    parameters: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] },
  },
  {
    name: 'archived_copy',
    description: "Read the Internet Archive's most recent copy of a domain you have been offered - for a site that turned us away, is down, or has gone - and say whether it names this business. Returns the date of the copy.",
    parameters: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] },
  },
  {
    name: 'conclude',
    description: 'Finish. Give the domain you have shown to be theirs and whether it was read live or from the archive, or give domain null if you could not find their site. Say why in one or two sentences.',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', nullable: true },
        how: { type: 'string', enum: ['live', 'archived'] },
        why: { type: 'string' },
      },
      required: ['why'],
    },
  },
]
const TOOL_NAMES = new Set(TOOLS.map((t) => t.name))

/** The request body for one investigator turn: the whole conversation so
    far, and the tools, with a tool call required every turn. */
export function investigatorBody({ system, contents, temperature = 0.3 }) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    tools: [{ functionDeclarations: TOOLS }],
    toolConfig: { functionCallingConfig: { mode: 'ANY' } },
    generationConfig: { temperature, topP: 0.95 },
  }
}

/** One tool call, checked before code runs it. */
export function checkCall(call, offered) {
  const name = String(call?.name ?? '')
  if (!TOOL_NAMES.has(name)) return { ok: false, why: `"${name || '?'}" is not a tool you have` }
  const args = call?.args && typeof call.args === 'object' ? call.args : {}
  if (name === 'guess_domains') {
    const n = String(args.name ?? '').trim()
    if (n.length < 2 || n.length > 80) return { ok: false, why: 'give a business name of 2 to 80 characters' }
    if (contactRouteIn(n)) return { ok: false, why: 'give a name, not a contact route' }
    return { ok: true, name, args: { name: n } }
  }
  if (name === 'check_domain' || name === 'archived_copy') {
    const d = normaliseDomain(args.domain)
    if (!d) return { ok: false, why: `"${String(args.domain ?? '')}" is not a domain` }
    if (isDirectory(d)) return { ok: false, why: `${d} is a directory or platform, never a business's own site` }
    if (!offered.has(d)) return { ok: false, why: `${d} has not been offered to you: only domains from a tool's answer may be checked` }
    return { ok: true, name, args: { domain: d } }
  }
  if (name === 'conclude') {
    const why = String(args.why ?? '').trim().slice(0, 600)
    if (args.domain === null || args.domain === undefined || args.domain === '' || args.domain === 'null') {
      return { ok: true, name, args: { domain: null, how: null, why } }
    }
    const d = normaliseDomain(args.domain)
    if (!d) return { ok: false, why: `"${String(args.domain)}" is not a domain` }
    const how = args.how === 'archived' ? 'archived' : 'live'
    return { ok: true, name, args: { domain: d, how, why } }
  }
  return { ok: true, name, args: {} }
}

/* A page's verdict, from what confirms() found on it. */
export function pageVerdict(reasons = [], conflict = null) {
  if (conflict) return 'not_theirs'
  if (reasons.some((r) => r === 'postcode' || r === 'company number')) return 'theirs'
  if (reasons.length) return 'name_only'
  return 'not_theirs'
}

const partsOf = (content) => (Array.isArray(content?.parts) ? content.parts : [])

/** The investigator's loop, to a conclusion or out of steps.

    `tools` are the code implementations, each returning a plain object;
    check_domain and archived_copy results carry { verdict, reasons, url,
    date?, excerpt?, links? } and are remembered, because a conclusion
    may only name a domain a tool has already shown to be theirs.
    `callChecker` is asked about a name-only match and must say "theirs". */
export async function runLookup({
  system, opening, offered: first = [], maxSteps = 10, deadline = Infinity,
  callInvestigator, callChecker, tools, onMove, now = () => Date.now(),
}) {
  const offered = new Set(first.map(normaliseDomain).filter(Boolean))
  const seen = new Map()
  const contents = [{ role: 'user', parts: [{ text: `${opening}\n\nDOMAINS OFFERED SO FAR: ${[...offered].join(', ') || 'none'}` }] }]
  let model = null
  let refusals = 0

  for (let step = 1; step <= maxSteps; step++) {
    if (now() > deadline) return { found: null, why: 'out of time for this business', steps: step - 1, model, timedOut: true }
    const reply = await callInvestigator({ system, contents, pin: model })
    model = model ?? reply.model
    const content = reply.content
    const calls = partsOf(content).filter((p) => p?.functionCall).map((p) => p.functionCall)
    await onMove({ from: 'investigator', to: 'code', model: reply.model, said: JSON.stringify(partsOf(content)),
      decision: calls.length ? calls.map((c) => c.name).join(',') : 'no_call' })
    contents.push({ role: 'model', parts: partsOf(content) })

    if (!calls.length) {
      contents.push({ role: 'user', parts: [{ text: 'Call one of your tools. When you are done, call conclude.' }] })
      await onMove({ from: 'code', to: 'investigator', decision: 'answered', said: 'no tool was called', guard: 'the reply called no tool' })
      continue
    }

    const answers = []
    const guards = []
    for (const call of calls.slice(0, 3)) {
      const c = checkCall(call, offered)
      if (!c.ok) { answers.push({ name: call?.name ?? 'unknown', response: { error: c.why } }); guards.push(c.why); continue }

      if (c.name === 'conclude') {
        if (!c.args.domain) {
          await onMove({ from: 'code', to: null, decision: 'nothing_found', said: c.args.why })
          return { found: null, why: c.args.why || 'the investigator found nothing that is theirs', steps: step, model }
        }
        const key = `${c.args.how}:${c.args.domain}`
        const v = seen.get(key)
        if (!v) {
          const why = `${c.args.domain} has not been ${c.args.how === 'archived' ? 'read from the archive' : 'read live'} yet: check it before concluding`
          answers.push({ name: 'conclude', response: { accepted: false, why } }); guards.push(why); continue
        }
        if (v.verdict === 'theirs') {
          await onMove({ from: 'code', to: null, decision: 'found', said: JSON.stringify({ domain: c.args.domain, how: c.args.how, reasons: v.reasons }) })
          return { found: { ...v, domain: c.args.domain, how: c.args.how, confirmed_by: [...v.reasons, 'found by the research loop'] }, why: c.args.why, steps: step, model }
        }
        if (v.verdict === 'name_only') {
          const check = await callChecker({ domain: c.args.domain, how: c.args.how, verdict: v, why: c.args.why })
          const agreed = check?.verdict === 'theirs'
          await onMove({ from: 'checker', to: agreed ? null : 'investigator', model: check?.model ?? null, said: check?.raw ?? null,
            decision: agreed ? 'agreed' : 'disagreed', guard: agreed ? null : 'a name-only match needs the checker to agree; it did not' })
          if (agreed) {
            return { found: { ...v, domain: c.args.domain, how: c.args.how, confirmed_by: [...v.reasons, 'checker agreed', 'found by the research loop'] }, why: c.args.why, steps: step, model }
          }
          refusals++
          answers.push({ name: 'conclude', response: { accepted: false, why: `the checker does not accept that page as this business: ${check?.why || 'no reason given'}` } })
          if (refusals >= 2) return { found: null, why: 'the checker twice refused a name-only match', steps: step, model }
          continue
        }
        const why = `code read ${c.args.domain} and it is ${v.verdict === 'not_theirs' ? 'not this business' : 'not readable'}`
        answers.push({ name: 'conclude', response: { accepted: false, why } }); guards.push(why)
        continue
      }

      let result
      try { result = await tools[c.name](c.args) } catch (e) { result = { error: String(e?.message ?? e).slice(0, 200) } }
      for (const d of result?.offer ?? []) { const n = normaliseDomain(d); if (n && !isDirectory(n)) offered.add(n) }
      if (c.name === 'check_domain' || c.name === 'archived_copy') {
        seen.set(`${c.name === 'archived_copy' ? 'archived' : 'live'}:${c.args.domain}`, result)
      }
      const { offer, html, ...shown } = result ?? {}
      answers.push({ name: c.name, response: { ...shown, offered_now: [...offered] } })
    }
    contents.push({ role: 'user', parts: answers.map((a) => ({ functionResponse: { name: a.name, response: a.response } })) })
    await onMove({ from: 'code', to: 'investigator', decision: 'answered', said: JSON.stringify(answers), guard: guards.join('; ') || null })
  }
  return { found: null, why: `no conclusion in ${maxSteps} steps`, steps: maxSteps, model }
}

/** The checker's reply, read. Anything but a clear "theirs" is a no. */
export function readChecker(parsed) {
  const v = String(parsed?.verdict ?? '').toLowerCase()
  return { verdict: v === 'theirs' ? 'theirs' : v === 'not_theirs' ? 'not_theirs' : 'unsure', why: String(parsed?.why ?? '').slice(0, 600) }
}
