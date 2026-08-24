/* Bundle the assistant's knowledge file into the Worker at build time.

   Build time rather than a runtime fetch: no extra request per message, no
   chance of serving a stale copy after an edit, and — the reason that matters
   most — the build gets to check the file before it ships.

   There are two checks. The first is a size ceiling. The knowledge goes into the system prompt on
   every question, so a file that grows past what the prompt can carry does not
   fail loudly, it gets truncated, and the part that falls off the end is
   whatever was written last. A red build is a much better outcome than an
   assistant that has quietly forgotten the refund policy.

   The second is that the length of the discovery call agrees with the form on
   the site. That one exists because they came apart.

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

/* The assistant matches a visitor's problem against the capability list, so a
   capability the site advertises and the reference omits is work n.abl will
   quietly decline to discuss. That is how "can you set us up on Shopify?"
   became "I don't know" — the reference described Web as "sites and the things
   attached to them" while the site said "websites, booking flows, customer
   portals, payments".

   Names only, not wording: the site's copy is written for a reader and the
   reference for a model, and forcing them to match verbatim would be worse
   than letting them drift. What must not happen is a seventh capability
   appearing on the site that the assistant has never heard of. */
const toolkit = readFileSync(new URL('../src/components/sections/Capabilities.jsx', import.meta.url), 'utf8')
const cats = [...toolkit.matchAll(/cat:\s*'([^']+)'/g)].map((m) => m[1])
if (cats.length < 3) {
  console.error('\n  Could not read the capability list out of Capabilities.jsx — the check\n  that keeps it in step with the assistant is now blind. Fix the pattern.\n')
  process.exit(1)
}
/* "Data & Analytics" and "Training & Support" are prose in the reference, and
   "Software" is "custom software" there. Compare on the distinguishing word. */
const missing = cats.filter((cat) => {
  const key = cat.split(/\s*&\s*/)[0].trim()
  return !new RegExp(`\\b${key}\\b`, 'i').test(knowledge)
})
if (missing.length) {
  console.error(`
  The site advertises capabilities the assistant has never heard of.

    missing from assistant-knowledge.md: ${missing.join(', ')}

  A visitor asking about one of these gets "I don't know" from the assistant
  while the home page offers it. Add them to "What we do".
`)
  process.exit(1)
}

/* The assistant tells visitors how long the discovery call is, and so does the
   form on the site. They came apart once — the modal said thirty minutes, the
   knowledge file said twenty, and the assistant confidently gave the wrong
   number to anyone who asked. The modal is the source of truth because it is
   what someone reads as they book. */
const modal = readFileSync(new URL('../src/components/DiscoveryModal.jsx', import.meta.url), 'utf8')
const onSite = modal.match(/Free,\s*(\d+)\s*minutes/i)?.[1]
if (!onSite) {
  console.error('\n  Could not find the call length in DiscoveryModal.jsx — the check that\n  keeps it in step with the assistant is now blind. Fix the pattern.\n')
  process.exit(1)
}
const words = { 20: 'twenty', 30: 'thirty', 45: 'forty-five', 60: 'sixty' }
const wrong = Object.entries(words)
  .filter(([n]) => n !== onSite)
  .flatMap(([n, word]) => [
    new RegExp(`\\b${n}[\\s-]?minute`, 'i'),
    new RegExp(`\\b${word}[\\s-]minutes\\b`, 'i'),
  ])
  .filter((re) => re.test(knowledge))
if (wrong.length) {
  console.error(`
  The assistant knowledge file gives a different call length from the site.

    DiscoveryModal.jsx says ${onSite} minutes
    assistant-knowledge.md matches ${wrong.join(', ')}

  Whichever is right, they have to agree — the assistant is quoting the site.
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
