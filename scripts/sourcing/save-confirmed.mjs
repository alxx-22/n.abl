#!/usr/bin/env node
/* Extract the confirmed websites from a sweep checkpoint into a file small
   enough to commit.

   The sweep writes every outcome to .sourcing/, which is gitignored and lives
   only on the machine running it. A full sweep is seven hours; a container
   that goes away in hour six takes all of it. The confirmed subset is about a
   quarter of the rows and the only part that cost anything to establish, so it
   is worth carrying in the repo.

   Safe to run against a sweep still in progress — the checkpoint is JSONL and
   a torn final line is skipped.

     node scripts/sourcing/save-confirmed.mjs
*/

import fs from 'node:fs'
import path from 'node:path'

const IN = process.argv[2] || '.sourcing/websites-all.jsonl'
const OUT = process.argv[3] || 'business/10-lead-sourcing/confirmed-websites.json'

if (!fs.existsSync(IN)) { console.error(`No checkpoint at ${IN}`); process.exit(1) }

let scanned = 0, torn = 0
const confirmed = []
for (const line of fs.readFileSync(IN, 'utf8').split('\n')) {
  if (!line.trim()) continue
  scanned++
  let r
  try { r = JSON.parse(line) } catch { torn++; continue }
  if (r.outcome !== 'confirmed' || !r.website) continue
  // Only what the next stage needs. The guesses and the resolved list are
  // working notes and would triple the file for nothing.
  confirmed.push({ name: r.name, area: r.area, website: r.website, confirmed_by: r.confirmed_by })
}

fs.writeFileSync(OUT, JSON.stringify({
  generated_at: new Date().toISOString(),
  source: IN,
  scanned,
  confirmed: confirmed.length,
  note: 'Websites confirmed against the company name, postcode or company number. '
      + 'A partial file means the sweep was still running; rerun to extend it.',
  results: confirmed,
}, null, 1))

console.log(`  ${scanned.toLocaleString()} swept, ${confirmed.length.toLocaleString()} confirmed${torn ? `, ${torn} torn line(s) skipped` : ''}`)
console.log(`  -> ${path.resolve(OUT)}  (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)\n`)
