#!/usr/bin/env node
/* Bundle an edge function folder into one file, for deploying through a
   channel that takes a single payload.

     node scripts/bundle-edge.mjs lead-prospector

   Writes .edge-bundles/<name>.js (gitignored) and prints its sha256.

   WHY THIS EXISTS. lead-prospector's source is five files and 132 KB, most
   of it comments and the vendored SIC table. The Supabase CLI deploys the
   folder as it is and needs none of this. Deploying through the MCP tool
   means sending every byte in one call, and at that size the call has twice
   gone out incomplete. A bundle of exactly the same source, with the
   comments and indentation removed, is 85 KB.

   The source in supabase/functions/lead-prospector stays the truth: the
   tests import it, reviews read it. The bundle is a build of it, and is
   deterministic - same esbuild (the one package-lock pins through vite),
   same flags, same bytes - so a deployed copy can be checked against a
   rebuild by hash rather than trusted. */

import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const name = process.argv[2]
if (!/^[a-z0-9-]+$/.test(name || '')) {
  console.error('usage: node scripts/bundle-edge.mjs <function-name>')
  process.exit(1)
}

const entry = ['index.ts', 'index.js'].map((f) => join(ROOT, 'supabase', 'functions', name, f))
  .find((p) => { try { readFileSync(p); return true } catch { return false } })
if (!entry) { console.error(`supabase/functions/${name} has no index.ts`); process.exit(1) }

const out = join(ROOT, '.edge-bundles', `${name}.js`)
mkdirSync(dirname(out), { recursive: true })

await build({
  entryPoints: [entry],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  /* Whitespace only: names stay as written, so the deployed file can still
     be read, and searched for the function a stack trace names. */
  minifyWhitespace: true,
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'warning',
  banner: { js: `/* Built from supabase/functions/${name} by scripts/bundle-edge.mjs. Do not edit: change the source and rebuild. */` },
})

const bytes = readFileSync(out)
console.log(`${out.replace(ROOT + '/', '')}  ${bytes.length} bytes  sha256 ${createHash('sha256').update(bytes).digest('hex')}`)
