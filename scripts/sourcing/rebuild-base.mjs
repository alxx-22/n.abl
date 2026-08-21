#!/usr/bin/env node
/* Rebuild the whole candidate base from the published registers.

   The base is not stored anywhere, and that is deliberate. It is 84,349 rows
   derived from five files that four public bodies republish daily or monthly,
   so keeping a copy would mean keeping a stale copy. Everything here is
   reproducible in about twenty minutes, and a rebuild picks up new companies,
   closed ones and corrected addresses at the same time.

   What IS kept in the repo is the part that cost something to establish and
   cannot be re-derived from a file: confirmed websites and extracted contact
   routes, under business/10-lead-sourcing/.

   Downloads already in .sourcing/ are reused, so a second run is fast. Delete
   the directory to force a genuinely fresh pull.

     node scripts/sourcing/rebuild-base.mjs
     node scripts/sourcing/rebuild-base.mjs --areas all
*/

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'

const areasArg = process.argv.includes('--areas')
  ? ['--areas', process.argv[process.argv.indexOf('--areas') + 1]]
  : []

/* Ordered by what each one contributes, not by size. Companies House is the
   spine because it is the only source with a company number to key on; the
   ICO supplies the address a business gave for itself; the last three supply
   contact routes that would otherwise have to be crawled for. */
const STEPS = [
  ['Companies House — the spine, and the only company numbers', 'fetch-companies-house.mjs'],
  ['ICO Register of Fee Payers — self-declared addresses', 'fetch-ico.mjs'],
  ['FSA hygiene ratings — real trading premises', 'fetch-fsa.mjs'],
  ['Charity Commission — phone and email, stated outright', 'fetch-charities.mjs'],
  ['CQC — phone, and websites we then do not guess at', 'fetch-cqc.mjs'],
]

mkdirSync('.sourcing', { recursive: true })
const started = Date.now()

for (const [label, script] of STEPS) {
  console.log(`\n\x1b[1m${label}\x1b[0m`)
  try {
    execFileSync('node', [`scripts/sourcing/${script}`, ...areasArg], { stdio: 'inherit' })
  } catch {
    /* One register being unreachable should not lose the other four. The merge
       reports which files it read, so a missing one is visible rather than
       silently absorbed. */
    console.error(`  \x1b[31m${script} failed — continuing without it\x1b[0m`)
  }
}

console.log('\n\x1b[1mMerge\x1b[0m')
execFileSync('node', ['scripts/sourcing/merge.mjs'], { stdio: 'inherit' })
console.log('\n\x1b[1mTriage\x1b[0m')
execFileSync('node', ['scripts/sourcing/triage.mjs'], { stdio: 'inherit' })

console.log(`\n  rebuilt in ${((Date.now() - started) / 60000).toFixed(1)} minutes

  Next, in order of cost per contact route:
    node scripts/sourcing/find-websites.mjs --band first --concurrency 48 --out .sourcing/websites-all.json
    node scripts/sourcing/extract-contacts.mjs --in .sourcing/websites-all.json
    node scripts/sourcing/promote.mjs --limit 500          # generates SQL
`)
