/* The security headers exist twice — in netlify.toml and in public/_headers —
   because the site is moving hosts and each reads only its own file.

   Two copies of a security policy is a policy that will disagree with itself.
   The failure is silent and total: drop the CSP from one file, deploy to that
   host, and the site looks identical while serving no content security policy
   at all. So this asserts they still say the same thing, and it runs in the
   build.

   Delete this and one of the two files once the move is finished.

   Usage: node scripts/check-headers.mjs
*/

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const toml = readFileSync(join(ROOT, 'netlify.toml'), 'utf8')
const headers = readFileSync(join(ROOT, 'public', '_headers'), 'utf8')

/* Every header Netlify sets, by the path it applies to. Parsed rather than
   hardcoded, so adding one to netlify.toml and forgetting _headers fails
   here instead of shipping. */
const netlify = new Map()
let current = null
for (const raw of toml.split('\n')) {
  const line = raw.replace(/^\s+/, '')
  if (line.startsWith('for =')) { current = line.split('"')[1]; continue }
  if (line.startsWith('[[')) { current = null; continue }
  if (!current || !line.includes('=') || line.startsWith('#')) continue
  const key = line.split('=')[0].trim()
  if (!/^[A-Z][A-Za-z-]+$/.test(key)) continue
  const value = line.slice(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '')
  if (!netlify.has(current)) netlify.set(current, new Map())
  netlify.get(current).set(key, value)
}

/* Cloudflare's format: a path on its own line, then indented `Key: value`. */
const cloudflare = new Map()
let path = null
for (const raw of headers.split('\n')) {
  if (!raw.trim() || raw.trim().startsWith('#')) continue
  if (!/^\s/.test(raw)) { path = raw.trim(); cloudflare.set(path, new Map()); continue }
  if (!path) continue
  const line = raw.trim()
  const i = line.indexOf(':')
  if (i < 0) continue
  cloudflare.get(path).set(line.slice(0, i).trim(), line.slice(i + 1).trim())
}

let bad = 0
const say = (m) => { console.log(`    ${m}`); bad++ }

console.log('\n  netlify.toml vs public/_headers\n')
for (const [nPath, nHeaders] of netlify) {
  const cPath = nPath === '/*' ? '/*' : nPath
  const cHeaders = cloudflare.get(cPath)
  if (!cHeaders) { say(`missing from _headers entirely: ${cPath}`); continue }
  for (const [key, value] of nHeaders) {
    const got = cHeaders.get(key)
    if (got === undefined) say(`${cPath}  ${key} — set by Netlify, absent from _headers`)
    else if (got !== value) {
      say(`${cPath}  ${key} — differs`)
      say(`    netlify:    ${value.slice(0, 90)}`)
      say(`    cloudflare: ${got.slice(0, 90)}`)
    }
  }
}

if (bad) {
  console.log(`\n  ${bad} difference${bad === 1 ? '' : 's'}. Both hosts must send the same headers.\n`)
  process.exit(1)
}
const count = [...netlify.values()].reduce((n, m) => n + m.size, 0)
console.log(`  ${count} headers across ${netlify.size} paths, identical in both.\n`)
