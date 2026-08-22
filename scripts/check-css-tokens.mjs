/* Every var(--token) in our stylesheets must resolve to something.

   Written because an entire block of new CSS referenced --accent, --espresso,
   --ink and --r-sm, none of which exist: the token scale is --accent-200 to
   --accent-600. CSS fails silently on an unknown custom property, so the
   active tab rendered as near-black text on a near-black background and the
   build was perfectly happy. Nothing caught it but a screenshot.

   Fallbacks are honoured: var(--maybe, #fff) is fine because it cannot fail.
   Anything without one has to be declared somewhere in src/styles.

   Usage: node scripts/check-css-tokens.mjs
*/

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')
const files = readdirSync(DIR).filter((f) => f.endsWith('.css'))
const all = files.map((f) => [f, readFileSync(join(DIR, f), 'utf8')])

/* Declarations, from anywhere in the bundle — tokens are defined in one file
   and used across all of them. */
/* A declaration only counts when the `--x:` sits where a property can sit:
   after `{`, `;`, or the start of a line. Without that anchor a BEM class
   name matches — `.btn--accent:not(:disabled)` reads as declaring `--accent`,
   which is exactly the token that was missing, so the checker passed on the
   one bug it was written to catch. */
const declared = new Set()
for (const [, css] of all) {
  for (const m of css.matchAll(/(?:^|[{;])\s*(--[a-zA-Z0-9-]+)\s*:/gm)) declared.add(m[1])
}

const problems = []
for (const [file, css] of all) {
  const lines = css.split('\n')
  lines.forEach((line, i) => {
    // var(--x) with no comma is a use with no fallback, so it must resolve.
    for (const m of line.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
      if (!declared.has(m[1])) problems.push(`${file}:${i + 1}  ${m[1]}`)
    }
  })
}

if (problems.length) {
  console.log(`\n  ${problems.length} CSS custom propert${problems.length === 1 ? 'y' : 'ies'} used but never declared:\n`)
  for (const p of problems) console.log(`    ${p}`)
  console.log(`\n  Declared tokens live in src/styles/tokens.css. Use one of those,`)
  console.log(`  or give the var() a fallback so it cannot silently resolve to nothing.\n`)
  process.exit(1)
}
console.log(`\n  ${declared.size} tokens declared, every var() across ${files.length} stylesheets resolves.\n`)
