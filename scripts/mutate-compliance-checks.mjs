/* ============================================================
   Mutation test for the compliance checks.

   check-compliance-schema.mjs asserts that the schema refuses the
   things it is meant to refuse. This asks the question that suite
   cannot ask about itself: would any of those assertions have
   noticed if the rule were broken?

   Each mutation below reintroduces one bug into the ceiling
   migration, runs the checker, and confirms the assertion covering
   that bug goes red — matched by name, so a mutation that trips a
   *different* assertion is reported as a miss rather than passing
   quietly.

   A replacement that finds nothing to replace throws. That is not
   pedantry: the first version of this file used silent string
   replacement and reported four mutations as MISSED when in fact
   they had never been applied, which is exactly the failure mode
   the whole exercise exists to catch.

   The migration is restored on every path out, including a crash.

   Usage: node scripts/mutate-compliance-checks.mjs
   ============================================================ */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATION = join(ROOT, 'supabase/migrations/202608210001_marketing_tier_ceilings.sql')
const POSTAL = join(ROOT, 'supabase/migrations/202608210003_postal_channel.sql')
const CHECKER = join(ROOT, 'scripts/check-compliance-schema.mjs')
const ORIGINAL = readFileSync(MIGRATION, 'utf8')
const POSTAL_ORIGINAL = readFileSync(POSTAL, 'utf8')

/** Replace exactly once, and throw rather than no-op if the anchor moved. */
const sub = (old, replacement) => (s) => {
  if (!s.includes(old)) throw new Error(`anchor not found: ${JSON.stringify(old.slice(0, 70))}`)
  return s.replace(old, replacement)
}

/** Delete everything between two anchors, for removing a whole branch. */
const cut = (from, to) => (s) => {
  const i = s.indexOf(from), j = s.indexOf(to)
  if (i < 0) throw new Error(`anchor not found: ${JSON.stringify(from.slice(0, 70))}`)
  if (j < 0) throw new Error(`anchor not found: ${JSON.stringify(to.slice(0, 70))}`)
  if (i >= j) throw new Error('anchors are out of order')
  return s.slice(0, i) + s.slice(j)
}

const CEILING_TEST = 'if coalesce(v_spent, 0) >= coalesce(v_ceiling, 0) then'

/* Mutations name which file they edit. The ceiling logic lives in 0001 and
   the channel logic in 0003, and 0003 redefines several of 0001's functions —
   so a mutation to 0001's copy of marketing_ceiling_guard would be overwritten
   and prove nothing. Anything the postal migration redefines must be mutated
   there. */
const MUTATIONS = [
  [POSTAL, 'the ceiling check removed entirely',
   'the 401st tier B first contact is refused',
   sub(`    ${CEILING_TEST}`, '    if false then')],

  [POSTAL, 'post treated as if PECR reached it',
   'but the same sole trader can be sent a letter',
   sub("            when 'post' then\n              l.lawful_basis in ('not_personal_data', 'legitimate_interests', 'consent', 'contract')",
       "            when 'post' then\n              l.subscriber_type = 'corporate'")],

  [POSTAL, 'not_personal_data trusted even with a person named',
   'once a person is named, not_personal_data no longer opens the door',
   sub("        and not (l.lawful_basis = 'not_personal_data'\n                 and public.has_named_individual(l.id))",
       '        and true')],

  [POSTAL, 'a generic route counted as a named person',
   '"Public contact route" is not treated as a person',
   sub("      and lower(btrim(c.name)) not in ('public contact route', 'general enquiries', 'enquiries', 'reception')",
       '')],

  [POSTAL, 'phone opened without any TPS screening',
   'phone is refused outright while there is no TPS screening',
   sub("            when 'phone' then false", "            when 'phone' then true")],

  [POSTAL, 'a postal objection no longer suppresses',
   'a postal suppression stops a letter to a still-permitted lead',
   sub("        (s.scope = 'address'         and lower(btrim(s.identifier)) = t.addr)",
       "        (s.scope = 'address'         and s.channel = 'email' and lower(btrim(s.identifier)) = t.addr)")],

  [POSTAL, 'channels share one allowance',
   'letters spend none of the email allowance',
   sub("  where s.channel = p_channel\n    and s.tier is not distinct from p_tier",
       '  where s.tier is not distinct from p_tier')],

  [POSTAL, 'off-by-one: >= relaxed to >',
   'the 401st tier B first contact is refused',
   sub(CEILING_TEST, 'if coalesce(v_spent, 0) > coalesce(v_ceiling, 0) then')],

  [POSTAL, 'a multi-row INSERT no longer counted row by row',
   'a multi-row INSERT is stopped on the row that crosses the ceiling',
   sub(`    ${CEILING_TEST}`, `    ${CEILING_TEST.replace('coalesce(v_ceiling, 0)', 'coalesce(v_ceiling, 0) + 100')}`)],

  [POSTAL, 'an unknown subscriber type treated as corporate',
   'an unresolved subscriber type is tier C, not tier A',
   sub("when l.subscriber_type is distinct from 'corporate' then 'C'",
       "when l.subscriber_type in ('sole_trader','partnership','individual') then 'C'")],

  [POSTAL, 'a blank contact name counted as a named person',
   'a whitespace-only contact name does not make it tier B',
   sub("      and btrim(coalesce(c.name, '')) <> ''\n", '')],

  [POSTAL, 'the month window widened to all time',
   "last month's first contacts do not count against this month",
   sub("    and s.sent_at >= date_trunc('month', now())\n" +
       "    and s.sent_at < date_trunc('month', now()) + interval '1 month'", '    and true')],

  [POSTAL, 'a missing lead silently defaulted instead of refused',
   'a send against a lead that does not exist is refused, not defaulted',
   sub("raise exception 'no such lead: %', new.lead_id\n      using errcode = 'check_violation';",
       "v_tier := 'A';")],

  [POSTAL, 'consented sends counted against the ceiling anyway',
   'and it spends none of the tier B allowance',
   sub("  if v_basis = 'consent' then\n    new.counts_toward_ceiling := false;",
       "  if v_basis = 'consent' then\n    new.counts_toward_ceiling := v_first;")],

  [POSTAL, 'the consent exemption removed',
   'but consent is exempt from the ceiling, so it sends with tier B full',
   cut("  if v_basis = 'consent' then", '  -- Tier C on email without consent')],
]

const runChecker = () => {
  try {
    return execFileSync('node', [CHECKER], { encoding: 'utf8', stdio: 'pipe' })
  } catch (e) {
    // A failing suite exits non-zero, which is the normal case here.
    return String(e.stdout || '') + String(e.stderr || '')
  }
}

console.log('\nMUTATION — each bug must turn its own assertion red\n')
let missed = 0

try {
  for (const [file, name, expect, mutate] of MUTATIONS) {
    const base = file === POSTAL ? POSTAL_ORIGINAL : ORIGINAL
    let mutated
    try { mutated = mutate(base) } catch (e) {
      console.log(`  HARNESS  | ${name} — ${e.message}`)
      missed++
      continue
    }
    writeFileSync(file, mutated)
    const reds = runChecker().split('\n').map((l) => l.trim()).filter((l) => l.startsWith('✗'))
    if (reds.some((r) => r.includes(expect))) {
      console.log(`  caught   | ${name}`)
    } else {
      missed++
      console.log(`  MISSED   | ${name}`)
      console.log(`             expected red: ${expect}`)
      console.log(`             actually red: ${reds.length ? reds.join('; ') : 'nothing — the suite stayed green'}`)
    }
  }
} finally {
  writeFileSync(MIGRATION, ORIGINAL)
  writeFileSync(POSTAL, POSTAL_ORIGINAL)
}

const restored = runChecker().trim().split('\n').pop()
console.log(`\nmigration restored — ${restored}\n`)
process.exit(missed ? 1 : 0)
