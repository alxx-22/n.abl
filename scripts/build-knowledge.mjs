/* Bundle the assistant's knowledge file into the Worker at build time.

   Build time rather than a runtime fetch: no extra request per message, no
   chance of serving a stale copy after an edit, and — the reason that matters
   most — the build gets to check the file before it ships.

   The check is a size ceiling. The knowledge goes into the system prompt on
   every question, so a file that grows past what the prompt can carry does not
   fail loudly, it gets truncated, and the part that falls off the end is
   whatever was written last. A red build is a much better outcome than an
   assistant that has quietly forgotten the refund policy.

   Usage: node scripts/build-knowledge.mjs
*/

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'business', '03-website', 'assistant-knowledge.md')
const OUT = join(ROOT, 'worker', 'knowledge.generated.ts')

/* Roughly four characters to a token. Deliberately conservative: the ceiling
   is about leaving room for the conversation, not about the model's limit. */
const MAX_CHARS = 12_000

const raw = readFileSync(SOURCE, 'utf8')

/* The "Notes for whoever edits this" section is instructions to a human, not
   to the assistant, and shipping it would have the model explaining its own
   editing policy to a visitor. */
const knowledge = raw.split(/^## Notes for whoever edits this/m)[0].trim()

if (knowledge.length > MAX_CHARS) {
  console.error(`
  The assistant knowledge file is too long.

    ${knowledge.length.toLocaleString()} characters, ceiling ${MAX_CHARS.toLocaleString()}

  It goes into the system prompt on every question, so past this it would be
  truncated rather than rejected, and the part that falls off is whatever was
  written most recently.

  Cut it, or split it into sections and load only the relevant one — which is
  a change to worker/index.ts, not to the ceiling.
`)
  process.exit(1)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `/* GENERATED — do not edit.
   Source: business/03-website/assistant-knowledge.md
   Regenerate: node scripts/build-knowledge.mjs
*/
export const KNOWLEDGE = ${JSON.stringify(knowledge)}
`)

console.log(`  assistant knowledge: ${knowledge.length.toLocaleString()} chars (~${Math.round(knowledge.length / 4).toLocaleString()} tokens), under the ${MAX_CHARS.toLocaleString()} ceiling`)
