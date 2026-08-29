/* ============================================================
   build-reel — assemble the vertical marketing reel template.

   The six scenes are the ones the site ships, not copies of them.
   This reads src/components/scenes verbatim, strips the module
   syntax, and inlines the result into one file that opens with no
   server and no build step — because the person recording with it
   is holding a webcam, not a terminal.

   Regenerate after any change to a scene:
     node scripts/build-reel.mjs

   Output: build/reel.html
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCENES = join(ROOT, 'src', 'components', 'scenes')

const read = (...p) => readFileSync(join(...p), 'utf8')

/* The engine is a flat list of exports. Dropping the keyword leaves
   valid top-level declarations, which is the whole transform. */
function inlineEngine() {
  return read(SCENES, 'engine.js').replace(/^export\s+/gm, '')
}

/* A scene is one `export default (function(){ ... })()`. It becomes a
   const, and its import of the engine becomes nothing, because the
   engine is already above it in the same scope. */
function inlineScene(name) {
  const src = read(SCENES, `${name}.js`)
  const withoutImport = src.replace(/^import\s+\{[^}]*\}\s+from\s+'\.\/engine\.js'\s*$/m, '')
  if (withoutImport === src) throw new Error(`${name}.js: engine import not found — did the import line change?`)

  const named = withoutImport.replace(/^export default /m, `const SCENE_${name} = `)
  if (named === withoutImport) throw new Error(`${name}.js: no default export to name`)

  return named
}

const SIX = ['automation', 'data', 'web', 'ai', 'software', 'training']

const bundle = [
  '/* ---- engine, from src/components/scenes/engine.js ---- */',
  inlineEngine(),
  ...SIX.map((n) => `\n/* ---- ${n}, from src/components/scenes/${n}.js ---- */\n${inlineScene(n)}`),
  /* ai.js exports both the assistant and the agent. The site's problem
     card uses the assistant, so the reel does too. */
  '\nconst SCENES = {',
  ...SIX.map((n) => `  ${n}: ${n === 'ai' ? 'SCENE_ai[0]' : `SCENE_${n}`},`),
  '}',
].join('\n')

const player = read(ROOT, 'scripts', 'reel', 'player.js')
const shell  = read(ROOT, 'scripts', 'reel', 'shell.html')

const marks = ['<!--SCENES-->', '<!--PLAYER-->']
for (const m of marks) {
  if (!shell.includes(m)) throw new Error(`shell.html is missing ${m}`)
}

const out = shell
  .replace('<!--SCENES-->', () => bundle)
  .replace('<!--PLAYER-->', () => player)

mkdirSync(join(ROOT, 'build'), { recursive: true })
writeFileSync(join(ROOT, 'build', 'reel.html'), out)

const kb = (Buffer.byteLength(out) / 1024).toFixed(0)
console.log(`build/reel.html  ${kb} KB  (${SIX.length} scenes inlined)`)
