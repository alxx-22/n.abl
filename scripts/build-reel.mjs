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

const frame  = read(ROOT, 'scripts', 'reel', 'frame.js')
const player = read(ROOT, 'scripts', 'reel', 'player.js')
const shell  = read(ROOT, 'scripts', 'reel', 'shell.html')

for (const m of ['<!--SCENES-->', '<!--PLAYER-->']) {
  if (!shell.includes(m)) throw new Error(`shell.html is missing ${m}`)
}

/* Two cuts off one player. The show is data — a list of sections with
   durations, camera framings and copy — so the difference between
   "talk over it" and "brand film" is which list gets concatenated in,
   not a second copy of the machinery. */
const CUTS = [
  { out: 'reel.html',       show: 'show-talk.js',  title: 'n.abl Reel Studio' },
  { out: 'reel-brand.html', show: 'show-brand.js', title: 'n.abl Brand Cut',
    extra: ['cards.js'] },
  { out: 'reel-punch.html', show: 'show-punch.js', title: 'n.abl Punch Cut',
    extra: ['cards.js', 'punch.js'] },
  { out: 'reel-automation.html', show: 'show-auto.js', title: 'n.abl Automation Reel',
    extra: ['canvas-auto.js'] },
  { out: 'reel-data.html', show: 'show-data.js', title: 'n.abl Data Reel',
    extra: ['canvas-data.js'] },
  { out: 'reel-web.html', show: 'show-web.js', title: 'n.abl Web Reel',
    extra: ['canvas-web.js'] },
]

mkdirSync(join(ROOT, 'build'), { recursive: true })

for (const cut of CUTS) {
  const show = read(ROOT, 'scripts', 'reel', cut.show)
  const extra = (cut.extra || []).map((f) => read(ROOT, 'scripts', 'reel', f)).join('\n\n')
  const html = shell
    .replace('<!--SCENES-->', () => bundle)
    .replace('<!--PLAYER-->', () => [frame, extra, show, player].join('\n\n'))
    .replace('<title>n.abl Reel Studio</title>', `<title>${cut.title}</title>`)

  /* Everything concatenated here shares one script scope, so two files
     declaring the same top-level const is a SyntaxError that only shows
     up in a browser. `bar` was a progress bar in the player and a text
     stand-in in the cards; before that, two different `mount`s. Catch it
     at build time instead of at look time. */
  const seen = new Map()
  for (const [label, src] of [['frame', frame], ['extras', extra], ['show', show], ['player', player]]) {
    for (const m of src.matchAll(/^(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      const name = m[1]
      if (seen.has(name)) {
        throw new Error(
          `${cut.out}: '${name}' is declared in both ${seen.get(name)}.js and ${label}.js — ` +
          `they share one scope, so this is a SyntaxError in the browser.`)
      }
      seen.set(name, label)
    }
  }

  writeFileSync(join(ROOT, 'build', cut.out), html)
  console.log(`build/${cut.out.padEnd(16)} ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`)
}
console.log(`${SIX.length} scenes inlined into each`)
