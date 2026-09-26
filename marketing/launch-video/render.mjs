/* Renders the film to video, frame by frame, in headless Chromium.

   node render.mjs --stills 1.2,8,15.5 [--ratio 16x9]   PNG stills for review
   node render.mjs --cues                                writes build/cues.json
   node render.mjs --video [--ratio 9x16] [--jobs 3]     build/video_<ratio>.mp4

   The page is served from the repository root so the film can use the
   site's own fonts and easing curves. Each frame is an explicit seek, so
   frames can be split across several browser pages and joined afterwards. */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const BUILD = path.join(HERE, 'build')
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')) }

export const RATIOS = { '16x9': [1920, 1080], '1x1': [1080, 1080], '4x5': [1080, 1350], '9x16': [1080, 1920] }
const args = process.argv.slice(2)
const opt = k => { const i = args.indexOf('--' + k); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) }
const ratios = (opt('ratio') && opt('ratio') !== 'all') ? String(opt('ratio')).split(',') : Object.keys(RATIOS)
const FPS = +(opt('fps') || 60)
const LAUNCH = ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--hide-scrollbars']

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' }
function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' })
    fs.createReadStream(p).pipe(res)
  })
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)))
}

async function openPage(browser, port, [w, h]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  page.on('pageerror', e => console.error('pageerror', e.message))
  page.on('console', m => { if (m.type() === 'error') console.error('console', m.text()) })
  await page.goto(`http://127.0.0.1:${port}/marketing/launch-video/film/index.html?w=${w}&h=${h}`)
  await page.waitForFunction(() => window.READY || window.ERROR, null, { timeout: 60000 })
  const err = await page.evaluate(() => window.ERROR)
  if (err) throw new Error(err)
  const cdp = await page.context().newCDPSession(page)
  return { page, cdp }
}
const shot = async (cdp) => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64')

async function main() {
  const srv = await serve()
  const port = srv.address().port
  const browser = await chromium.launch({ args: LAUNCH })
  try {
    if (opt('cues')) {
      const { page } = await openPage(browser, port, RATIOS['16x9'])
      const cues = await page.evaluate(() => window.CUES)
      fs.writeFileSync(path.join(BUILD, 'cues.json'), JSON.stringify(cues, null, 1))
      console.log(`cues: ${cues.length}`)
    }
    if (opt('stills')) {
      const times = String(opt('stills')).split(',').map(Number)
      for (const r of ratios) {
        const dir = path.join(BUILD, 'stills', r); fs.mkdirSync(dir, { recursive: true })
        const { page, cdp } = await openPage(browser, port, RATIOS[r])
        for (const t of times) {
          await page.evaluate(t => window.seek(t), t)
          fs.writeFileSync(path.join(dir, `${t.toFixed(2).padStart(6, '0')}.png`), await shot(cdp))
        }
        await page.close()
        console.log(`stills ${r}: ${times.length}`)
      }
    }
    if (opt('covers')) {
      // a still for each format, for platforms that ask for a cover image
      const at = +(opt('covers') === true ? 3.97 : opt('covers'))
      const out = path.join(HERE, 'out'); fs.mkdirSync(out, { recursive: true })
      for (const r of ratios) {
        const { page, cdp } = await openPage(browser, port, RATIOS[r])
        await page.evaluate(t => window.seek(t), at)
        const jpg = (await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })).data
        fs.writeFileSync(path.join(out, `nabl-ai-launch-cover-${r}.jpg`), Buffer.from(jpg, 'base64'))
        await page.close()
      }
      console.log(`covers at ${at}s`)
    }
    if (opt('video')) {
      const tl = JSON.parse(fs.readFileSync(path.join(BUILD, 'timeline.json')))
      const total = Math.round(tl.duration * FPS)
      const jobs = +(opt('jobs') || 4)
      for (const r of ratios) {
        const t0 = Date.now()
        const per = Math.ceil(total / jobs)
        const parts = []
        await Promise.all(Array.from({ length: jobs }, async (_, j) => {
          const a = j * per, b = Math.min(total, a + per)
          if (a >= b) return
          const out = path.join(BUILD, `part_${r}_${j}.mp4`); parts[j] = out
          // one browser per job: pages in one browser share a single compositor
          const own = await chromium.launch({ args: LAUNCH })
          const { page, cdp } = await openPage(own, port, RATIOS[r])
          // light temporal grain, seeded per job so a rebuild is identical
          const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
            '-vf', `noise=c0s=5:c0f=t+u:c1s=2:c1f=t+u:c2s=2:c2f=t+u:c0_seed=${101 + j}:c1_seed=${201 + j}:c2_seed=${301 + j}`,
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-tune', 'film', '-pix_fmt', 'yuv420p', '-g', String(FPS * 2),
            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out], { stdio: ['pipe', 'inherit', 'inherit'] })
          const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()))
          for (let f = a; f < b; f++) {
            await page.evaluate(t => window.seek(t), f / FPS)
            const buf = await shot(cdp)
            if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r))
            if (j === 0 && (f - a) % 300 === 0) console.log(`  ${r} ${Math.round(100 * (f - a) / (b - a))}%`)
          }
          ff.stdin.end(); await done; await own.close()
        }))
        const list = path.join(BUILD, `parts_${r}.txt`)
        fs.writeFileSync(list, parts.filter(Boolean).map(p => `file '${p}'`).join('\n'))
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(BUILD, `video_${r}.mp4`)])
        parts.filter(Boolean).forEach(p => fs.unlinkSync(p)); fs.unlinkSync(list)
        console.log(`video ${r}: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
      }
    }
  } finally {
    await browser.close(); srv.close()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
