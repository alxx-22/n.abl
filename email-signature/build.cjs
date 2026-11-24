/* ============================================================
   Email signature build.

   node email-signature/build.cjs

   Writes, from the brand masters:
     svg/   n.abl lockup (light + dark ground) and square icon
     png/   2x exports of every logo, transparent backgrounds
     signature.html   the email-ready signature
     preview.html     light/dark preview + copy area

   The HPE SVGs in svg/ are HPE's official 2025 files, used
   byte-for-byte. This script never writes to them; it only
   rasterises them.
   ============================================================ */

// ------------------------------------------------------------
// IMAGE BASE URL: change this to wherever the PNGs are hosted,
// then re-run the build. Must be public HTTPS and end in "/".
// ------------------------------------------------------------
const IMAGE_BASE_URL = 'https://nabl.agency/email-signature/'

// ------------------------------------------------------------
// Signature content. Leave PHONE empty to omit the phone link.
// ------------------------------------------------------------
const NAME     = 'Alex Cohen'
const LINKEDIN = 'https://www.linkedin.com/in/alexander-alton-cohen-688018304/'
const WEBSITE  = 'https://nabl.agency'
const PHONE    = ''            // e.g. '+44 7700 900000'

const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const HERE = __dirname
const ROOT = path.join(HERE, '..')
const SVG = path.join(HERE, 'svg')
const PNG = path.join(HERE, 'png')
fs.mkdirSync(SVG, { recursive: true })
fs.mkdirSync(PNG, { recursive: true })

// ---------- n.abl colours (business/02-brand/brand-guidelines.md 2.4) ----------
const ESPRESSO   = '#0E0C0A'   // strokes on light grounds
const CREAM      = '#FBF6EC'   // strokes on dark grounds
const AMBER      = '#E9AC57'   // dot on dark
const AMBER_DEEP = '#B87718'   // dot on light (the deep-amber rule, 3.2)
const INK        = '#14110E'   // small text on light

// ---------- n.abl SVG masters, derived from the drawn artwork ----------
// Strip comments/title, hard-code the colours (CSS variables do not
// reach an SVG loaded as an image), and keep the geometry untouched.
const clean = s => s
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<title>[\s\S]*?<\/title>/g, '')
  .replace(/>\s+</g, '><')
  .replace(/\s{2,}/g, ' ')
  .trim()

const wordmarkSrc = fs.readFileSync(path.join(ROOT, 'public/brand/wordmark.svg'), 'utf8')
const faviconSrc  = fs.readFileSync(path.join(ROOT, 'public/favicon.svg'), 'utf8')

// Ink spans x 18..255, y 6..82. Clear space is one dot (13 units) on
// every side (guide 2.5), so the export viewBox is x 5..268, y -7..95.
const LOCKUP_VB = { x: 5, y: -7, w: 263, h: 102 }
const lockup = (stroke, dot) => clean(wordmarkSrc)
  .replace(/viewBox="[^"]*"/, `viewBox="${LOCKUP_VB.x} ${LOCKUP_VB.y} ${LOCKUP_VB.w} ${LOCKUP_VB.h}" width="${LOCKUP_VB.w}" height="${LOCKUP_VB.h}"`)
  .replace('stroke="currentColor"', `stroke="${stroke}"`)
  .replace(/fill="var\(--mark-accent, #E9AC57\)"/, `fill="${dot}"`)

// The square icon is the brand's own rounded tile (public/favicon.svg),
// the one enclosure the guide permits (misuse 13). Espresso tile, cream
// n, amber dot, so it reads the same on a light or a dark email.
const icon = clean(faviconSrc).replace('viewBox="0 0 100 100"', 'viewBox="0 0 100 100" width="100" height="100"')

const nablSvgs = {
  'nabl-lockup.svg':         lockup(ESPRESSO, AMBER_DEEP),  // light grounds
  'nabl-lockup-reverse.svg': lockup(CREAM, AMBER),          // dark grounds
  'nabl-icon.svg':           icon,
}
for (const [f, s] of Object.entries(nablSvgs)) fs.writeFileSync(path.join(SVG, f), s + '\n')

// ---------- Display sizes (CSS px). PNGs are exported at 2x. ----------
const ICON = 64                      // mark floor is 48px (guide 2.6)
const LOCKUP_W = 160                 // wordmark floor 120px; ink ≈ 144px of this
const LOCKUP_H = Math.round(LOCKUP_W * LOCKUP_VB.h / LOCKUP_VB.w)   // 62
const HPE_H = 14                     // official artwork is 504 x 144 (3.5 : 1)
const HPE_W = HPE_H * 504 / 144      // 49
const HPE_CLEAR = HPE_H / 2          // clear space = half the logo height
const CHIP_W = HPE_W + 2 * HPE_CLEAR // 63
const CHIP_H = HPE_H + 2 * HPE_CLEAR // 28

const svgData = f => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(SVG, f)).toString('base64')

const exports_ = [
  { out: 'nabl-icon.png',              src: 'nabl-icon.svg',              w: ICON,     h: ICON },
  { out: 'nabl-lockup.png',            src: 'nabl-lockup.svg',            w: LOCKUP_W, h: LOCKUP_H },
  { out: 'nabl-lockup-reverse.png',    src: 'nabl-lockup-reverse.svg',    w: LOCKUP_W, h: LOCKUP_H },
  { out: 'hpe-logo-full-clr-pos.png',  src: 'hpe-logo-full-clr-pos.svg',  w: HPE_W,    h: HPE_H },
  { out: 'hpe-logo-full-clr-rev.png',  src: 'hpe-logo-full-clr-rev.svg',  w: HPE_W,    h: HPE_H },
  { out: 'hpe-logo-blk-pos.png',       src: 'hpe-logo-blk-pos.svg',       w: HPE_W,    h: HPE_H },
  { out: 'hpe-logo-wht-rev.png',       src: 'hpe-logo-wht-rev.svg',       w: HPE_W,    h: HPE_H },
  // The one the signature uses: the official positive logo, unaltered,
  // sitting on white with its clear space. Email clients never recolour
  // images, so in dark mode this stays a legible white plate instead of
  // the black "HPE" letters disappearing into a dark background.
  { out: 'hpe-logo-email.png', src: 'hpe-logo-full-clr-pos.svg', w: HPE_W, h: HPE_H, pad: HPE_CLEAR, bg: '#FFFFFF' },
]

function signatureHtml(base) {
  const img = (file, w, h, alt) =>
    `<img src="${base}${file}" width="${w}" height="${h}" alt="${alt}" style="display:block;border:0;outline:none;width:${w}px;height:${h}px;">`
  const t = `font-family:Arial,Helvetica,sans-serif;color:${INK};`
  const sep = `<span style="color:${AMBER_DEEP};">&nbsp;|&nbsp;</span>`
  const link = (href, text) =>
    `<a href="${href}" style="${t}font-size:12px;line-height:18px;text-decoration:none;font-weight:bold;">${text}</a>`
  const contacts = [
    link(LINKEDIN, 'LinkedIn'),
    link(WEBSITE, WEBSITE.replace(/^https?:\/\//, '')),
    PHONE && link('tel:' + PHONE.replace(/[^\d+]/g, ''), PHONE.replace(/ /g, '&nbsp;')),
  ].filter(Boolean).join(sep)

  return `<!-- n.abl email signature. Images load from: ${base}
     To change that, edit IMAGE_BASE_URL in email-signature/build.cjs and re-run it. -->
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;max-width:500px;">
  <tr>
    <td valign="top" style="padding:2px 16px 0 0;">
      <a href="${WEBSITE}" style="text-decoration:none;">${img('nabl-icon.png', ICON, ICON, 'n.abl')}</a>
    </td>
    <td valign="top" style="border-left:2px solid ${AMBER_DEEP};padding:0 0 0 16px;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
        <tr>
          <td style="${t}font-size:18px;line-height:22px;font-weight:bold;padding:0 0 2px 0;">${NAME}</td>
        </tr>
        <tr>
          <td style="${t}font-size:13px;line-height:18px;">Founder, <b>n.abl</b>${sep}AI &amp; Automation for UK SMEs</td>
        </tr>
        <tr>
          <td style="padding:0;">
            <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
              <tr>
                <td valign="middle" style="${t}font-size:13px;line-height:18px;">UKIMEA Innovations &amp; Programs Lead Developer,</td>
                <td valign="middle" style="padding:0 0 0 6px;">${img('hpe-logo-email.png', CHIP_W, CHIP_H, 'HPE')}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="${t}font-size:12px;line-height:18px;padding:0;">${contacts}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}

function previewHtml(sig) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Email Signature Preview</title>
<style>
  :root { --bg:#F4EFE6; --fg:#14110E; --muted:#5A5249; --card:#FFFFFF; --line:#E2D9CA; --accent:#B87718; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0E0C0A; --fg:#F0E7D8; --muted:#C8BBA8; --card:#1A1613; --line:#2B241E; --accent:#E9AC57; } }
  :root[data-theme="dark"] { --bg:#0E0C0A; --fg:#F0E7D8; --muted:#C8BBA8; --card:#1A1613; --line:#2B241E; --accent:#E9AC57; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui,-apple-system,"Segoe UI",Arial,sans-serif; }
  main { max-width:1180px; margin:0 auto; padding:32px 16px 48px; }
  h1 { font-size:22px; margin:0 0 4px; } h2 { font-size:15px; margin:0 0 10px; }
  p { margin:0 0 12px; color:var(--muted); }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:20px 0 28px; }
  @media (max-width:900px) { .grid { grid-template-columns:1fr; } }
  .panel { border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .panel .label { font-size:12px; letter-spacing:.08em; text-transform:uppercase; padding:8px 14px; background:var(--card); color:var(--muted); border-bottom:1px solid var(--line); }
  .stage { padding:28px 24px; overflow-x:auto; }
  .stage.light { background:#FFFFFF; }
  /* Simulates Outlook.com / Gmail app dark mode: the client darkens the
     background and lightens text colours, but never touches images. */
  .stage.dark { background:#1F1F1F; }
  .stage.dark td, .stage.dark a, .stage.dark b, .stage.dark span:not(.keep) { color:#E8E6E3 !important; }
  .copy { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:20px; }
  #copyArea { background:#FFFFFF; padding:20px; border:1px dashed var(--line); border-radius:6px; margin:12px 0; overflow-x:auto; }
  button { font:inherit; font-weight:600; padding:9px 16px; border-radius:6px; border:0; background:#E9AC57; color:#24170A; cursor:pointer; }
  #status { margin-left:10px; color:var(--muted); font-size:14px; }
  .notice { display:none; border-left:3px solid var(--accent); background:var(--card); padding:10px 14px; margin:12px 0 0; font-size:14px; }
  code { font-size:13px; }
</style>
</head>
<body>
<main>
  <h1>Email signature</h1>
  <p>The left panel is a normal light inbox. The right panel simulates Outlook.com and Gmail dark mode, which recolour text but leave images alone.</p>
  <div class="notice" id="hostNotice">The images aren't at <code>${IMAGE_BASE_URL}</code> yet, so this preview is using the local <code>png/</code> files. Upload the PNGs before you copy, or the pasted signature will show broken images.</div>

  <div class="grid">
    <section class="panel"><div class="label">Light background</div><div class="stage light">${sig}</div></section>
    <section class="panel"><div class="label">Dark mode (simulated)</div><div class="stage dark">${sig}</div></section>
  </div>

  <section class="copy">
    <h2>Copy into Outlook.com</h2>
    <p>Click the button, then in Outlook.com go to Settings → Account → Signatures, click in the editor and paste (Ctrl/Cmd + V).</p>
    <button type="button" id="copyBtn">Select &amp; copy signature</button><span id="status" aria-live="polite"></span>
    <div id="copyArea">${sig}</div>
  </section>
</main>
<script>
(function () {
  var imgs = Array.prototype.slice.call(document.querySelectorAll('.stage img, #copyArea img'));
  var base = ${JSON.stringify(IMAGE_BASE_URL)};
  imgs.forEach(function (im) { im.setAttribute('data-remote', im.getAttribute('src')); });
  // If the hosted images are not live yet, show the local copies so the layout can be checked.
  imgs.forEach(function (im) {
    im.addEventListener('error', function onErr() {
      im.removeEventListener('error', onErr);
      im.src = 'png/' + im.getAttribute('data-remote').slice(base.length);
      document.getElementById('hostNotice').style.display = 'block';
    });
    if (im.complete && im.naturalWidth === 0) im.dispatchEvent(new Event('error'));
  });
  document.getElementById('copyBtn').addEventListener('click', function () {
    var area = document.getElementById('copyArea');
    var swapped = [];
    // Always copy the public URLs, never the local fallbacks.
    area.querySelectorAll('img').forEach(function (im) { swapped.push([im, im.src]); im.src = im.getAttribute('data-remote'); });
    var range = document.createRange(); range.selectNodeContents(area);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    setTimeout(function () { swapped.forEach(function (p) { p[0].src = p[1]; }); }, 300);
    document.getElementById('status').textContent = ok ? 'Copied. Now paste it into Outlook.com.' : 'Selected. Press Ctrl/Cmd + C to copy.';
  });
})();
</script>
</body>
</html>
`
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 800, height: 600 } })
  for (const e of exports_) {
    const pad = (e.pad || 0) * 2
    await page.setContent(`<!doctype html><style>*{margin:0;padding:0}html,body{background:transparent}
      #t{display:inline-block;line-height:0;padding:${pad}px;background:${e.bg || 'transparent'}}
      #t img{display:block;width:${e.w * 2}px;height:${e.h * 2}px}</style>
      <div id="t"><img src="${svgData(e.src)}"></div>`)
    await page.waitForFunction(() => document.querySelector('img').complete)
    await (await page.$('#t')).screenshot({ path: path.join(PNG, e.out), omitBackground: !e.bg })
    console.log(`  png/${e.out}  ${(e.w + 2 * (e.pad || 0)) * 2} x ${(e.h + 2 * (e.pad || 0)) * 2}`)
  }
  await browser.close()

  const sig = signatureHtml(IMAGE_BASE_URL)
  fs.writeFileSync(path.join(HERE, 'signature.html'), sig + '\n')
  fs.writeFileSync(path.join(HERE, 'preview.html'), previewHtml(sig))
  console.log('  signature.html, preview.html')
})()
