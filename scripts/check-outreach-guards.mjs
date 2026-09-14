#!/usr/bin/env node
/* ============================================================
   THE GUARDS IN THE OUTREACH WRITER, TESTED

   supabase/functions/outreach-writer/index.ts decides, for every lead,
   whether each of n.abl's service categories plausibly fits. Those
   verdicts steer what a stranger reads in a first contact, and there is
   one first contact per lead.

   Two rules in validateServices() are the entire defence against
   mischaracterising a business:

     1. An "observed" verdict whose quote is not literally on the page
        is downgraded to "inferred" and its evidence discarded.
     2. Anything not "observed" can never be a "strong" fit.

   Rule 2 is the expensive one. Without it, a sector prior saying "care
   homes usually have rota problems" becomes "this care home definitely
   has rota problems", and we write to them about a problem we invented.
   Being wrong in the first sentence of a cold letter is not recoverable.

   The functions are LIFTED OUT OF THE LIVE TYPESCRIPT rather than
   copied, so this cannot pass while the deployed code differs. If the
   extraction breaks, that is a signal the file moved and the test needs
   re-pointing - not a reason to paste a copy in here.

     node scripts/check-outreach-guards.mjs
   ============================================================ */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FN = join(ROOT, 'supabase', 'functions', 'outreach-writer', 'index.ts')

const src = await readFile(FN, 'utf8')

/* Slice the vocabulary and the validators out of the TypeScript and
   erase the annotations. Only the guards - the rest of the function
   does HTTP and is not what is under test here. */
function extract() {
  const need = (marker) => {
    const i = src.indexOf(marker)
    if (i < 0) throw new Error(`check-outreach-guards: "${marker}" not found in ${FN}. The function has been restructured; re-point this extraction.`)
    return i
  }
  const consts = src.slice(need('const CATEGORIES ='), need("const CREDITS =")) +
    src.slice(need("const CREDITS ="), need("const CREDITS =") + 60).split('\n')[0] + '\n'
  let guards = src.slice(need('function validateServices'), need('/* ---------- one lead ---------- */'))

  for (const [a, b] of [
    ['] as const', ']'],
    ['raw: unknown, pageText: string | null): { services: Service[]; notes: string[] }', 'raw, pageText)'],
    ['const notes: string[] = []', 'const notes = []'],
    ['const out: Service[] = []', 'const out = []'],
    ['new Set<string>()', 'new Set()'],
    ["String((r as Service)?.category ?? '')", "String(r?.category ?? '')"],
    ['c as typeof CATEGORIES[number]', 'c'],
    ['const s = r as Service', 'const s = r'],
    ['(v: unknown, allowed: string[], fallback: string)', '(v, allowed, fallback)'],
  ]) guards = guards.split(a).join(b)
  guards = guards.replace(/type Service = \{[\s\S]*?\n\}\n/, '')

  return (consts + "const norm = (s) => String(s).replace(/\\s+/g, ' ').trim().toLowerCase()\n" +
    guards + '\nexport { validateServices, pick }\n').split('] as const').join(']')
}

const dir = join(tmpdir(), 'nabl-guard-check')
await mkdir(dir, { recursive: true })
const modPath = join(dir, 'guards.mjs')
await writeFile(modPath, extract())
const { validateServices, pick } = await import(`file://${modPath}?v=${Date.now()}`)

const PAGE = 'Mountford House Nursery. Places are limited so please call the office to arrange a visit. Our fees are set out in the parent handbook.'
const base = { rationale: 'r', confirm_question: 'q', disqualifier: 'd' }

let fail = 0
const ok = (n, c, d = '') => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  → ' + d}`)
  if (!c) fail++
}

console.log('\nEVIDENCE CHECKING\n')
let r = validateServices([{ ...base, category: 'save_time', fit: 'strong', confidence: 'observed',
  evidence: 'please call the office to arrange a visit' }], PAGE)
ok('a real quote keeps observed and strong',
  r.services[0].confidence === 'observed' && r.services[0].fit === 'strong')

r = validateServices([{ ...base, category: 'save_time', fit: 'strong', confidence: 'observed',
  evidence: 'we use a paper diary for every booking' }], PAGE)
ok('a FABRICATED quote is downgraded to inferred',
  r.services[0].confidence === 'inferred' && r.services[0].evidence === null)
ok('  …and the fit drops from strong to possible', r.services[0].fit === 'possible')
ok('  …and the downgrade is recorded', /not found on the page/.test(r.notes.join(' ')))

console.log('\nTHE EXPENSIVE FAILURE MODE\n')
for (const c of ['inferred', 'guessed']) {
  r = validateServices([{ ...base, category: 'understand_data', fit: 'strong', confidence: c }], PAGE)
  ok(`a ${c} verdict can never be a strong fit`, r.services[0].fit === 'possible')
}

console.log('\nTHE FIELDS THAT MAKE IT A HYPOTHESIS\n')
r = validateServices([{ category: 'save_time', fit: 'possible', confidence: 'inferred',
  rationale: 'r', confirm_question: '', disqualifier: 'd' }], PAGE)
ok('no confirm_question means the verdict is dropped entirely', r.services.length === 0)
r = validateServices([{ category: 'save_time', fit: 'possible', confidence: 'inferred',
  rationale: 'r', confirm_question: 'q', disqualifier: '' }], PAGE)
ok('no disqualifier means it is dropped entirely', r.services.length === 0)

console.log('\nJUNK\n')
r = validateServices([{ ...base, category: 'make_tea', fit: 'strong', confidence: 'observed', evidence: 'x' }], PAGE)
ok('an invented category is rejected', r.services.length === 0 && /unknown category/.test(r.notes.join(' ')))
r = validateServices([
  { ...base, category: 'save_time', fit: 'possible', confidence: 'inferred' },
  { ...base, category: 'save_time', fit: 'strong', confidence: 'inferred' }], PAGE)
ok('a duplicate category is rejected', r.services.length === 1 && /duplicate/.test(r.notes.join(' ')))
r = validateServices([{ ...base, category: 'save_time', fit: 'enormous', confidence: 'certain' }], PAGE)
ok('out-of-vocabulary fit and confidence fall back safely',
  r.services[0].fit === 'possible' && r.services[0].confidence === 'guessed')
ok('a non-array does not throw', validateServices('not an array', PAGE).services.length === 0)

console.log('\nNO PAGE AT ALL\n')
r = validateServices([{ ...base, category: 'save_time', fit: 'strong', confidence: 'observed', evidence: 'anything' }], null)
ok('observed is impossible with no page',
  r.services[0].confidence === 'inferred' && r.services[0].fit === 'possible')

console.log('\nENUM FALLBACKS\n')
ok('pick returns an allowed value', pick('brochure', ['none', 'brochure'], 'none') === 'brochure')
ok('pick falls back on junk', pick('lovely', ['none', 'brochure'], 'none') === 'none')
ok('pick falls back on undefined', pick(undefined, ['none'], 'none') === 'none')

console.log(`\n${fail ? fail + ' failed' : 'all guard checks passed'}`)
process.exit(fail ? 1 : 0)
