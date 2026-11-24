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

// n.abl's own social accounts (shown under the n.abl icon, separate
// from the personal LinkedIn above).
const NABL_SOCIAL = [
  { key: 'linkedin',  label: 'n.abl on LinkedIn',  href: 'https://www.linkedin.com/company/n-abl-agency/home' },
  { key: 'instagram', label: 'n.abl on Instagram', href: 'https://www.instagram.com/n.abl.ai/' },
  { key: 'tiktok',    label: 'n.abl on TikTok',    href: 'https://www.tiktok.com/@n.abl.ai' },
]

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

// Font Awesome Free brand glyphs (CC BY 4.0, https://fontawesome.com/license/free),
// path data copied unchanged from @fortawesome/free-brands-svg-icons 7.3.1.
const GLYPHS = {
  linkedin: { w: 448, h: 512, d: 'M100.3 448l-92.9 0 0-299.1 92.9 0 0 299.1zM53.8 108.1C24.1 108.1 0 83.5 0 53.8 0 39.5 5.7 25.9 15.8 15.8s23.8-15.8 38-15.8 27.9 5.7 38 15.8 15.8 23.8 15.8 38c0 29.7-24.1 54.3-53.8 54.3zM447.9 448l-92.7 0 0-145.6c0-34.7-.7-79.2-48.3-79.2-48.3 0-55.7 37.7-55.7 76.7l0 148.1-92.8 0 0-299.1 89.1 0 0 40.8 1.3 0c12.4-23.5 42.7-48.3 87.9-48.3 94 0 111.3 61.9 111.3 142.3l0 164.3-.1 0z' },
  instagram: { w: 448, h: 512, d: 'M224.3 141a115 115 0 1 0 -.6 230 115 115 0 1 0 .6-230zm-.6 40.4a74.6 74.6 0 1 1 .6 149.2 74.6 74.6 0 1 1 -.6-149.2zm93.4-45.1a26.8 26.8 0 1 1 53.6 0 26.8 26.8 0 1 1 -53.6 0zm129.7 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM399 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z' },
  tiktok: { w: 448, h: 512, d: 'M448.5 209.9c-44 .1-87-13.6-122.8-39.2l0 178.7c0 33.1-10.1 65.4-29 92.6s-45.6 48-76.6 59.6-64.8 13.5-96.9 5.3-60.9-25.9-82.7-50.8-35.3-56-39-88.9 2.9-66.1 18.6-95.2 40-52.7 69.6-67.7 62.9-20.5 95.7-16l0 89.9c-15-4.7-31.1-4.6-46 .4s-27.9 14.6-37 27.3-14 28.1-13.9 43.9 5.2 31 14.5 43.7 22.4 22.1 37.4 26.9 31.1 4.8 46-.1 28-14.4 37.2-27.1 14.2-28.1 14.2-43.8l0-349.4 88 0c-.1 7.4 .6 14.9 1.9 22.2 3.1 16.3 9.4 31.9 18.7 45.7s21.3 25.6 35.2 34.6c19.9 13.1 43.2 20.1 67 20.1l0 87.4z' },
}

// Social icons share the n.abl icon's construction: the same espresso
// rounded tile (rx 22 of 100) with the glyph in the same cream as the n.
// That keeps them one family with the logo, and a dark tile stays
// visible whether the inbox is light or dark.
const socialIcon = ({ w, h, d }) => {
  const k = 54 / h, gw = w * k
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" rx="22" fill="${ESPRESSO}"/><path transform="translate(${+((100 - gw) / 2).toFixed(3)} 23) scale(${+k.toFixed(6)})" fill="#F0E7D8" d="${d}"/></svg>`
}

const nablSvgs = {
  'nabl-lockup.svg':         lockup(ESPRESSO, AMBER_DEEP),  // light grounds
  'nabl-lockup-reverse.svg': lockup(CREAM, AMBER),          // dark grounds
  'nabl-icon.svg':           icon,
  'social-linkedin.svg':     socialIcon(GLYPHS.linkedin),
  'social-instagram.svg':    socialIcon(GLYPHS.instagram),
  'social-tiktok.svg':       socialIcon(GLYPHS.tiktok),
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
const SOCIAL = 18                    // three of these + two 5px gaps = the 64px icon width
const SOCIAL_GAP = 5

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
  // with its clear space (half the logo height) as transparent padding.
  { out: 'hpe-logo-email.png', src: 'hpe-logo-full-clr-pos.svg', w: HPE_W, h: HPE_H, pad: HPE_CLEAR },
  ...NABL_SOCIAL.map(s => ({ out: `social-${s.key}.png`, src: `social-${s.key}.svg`, w: SOCIAL, h: SOCIAL })),
]

function signatureHtml(base) {
  const img = (file, w, h, alt) =>
    `<img src="${base}${file}" width="${w}" height="${h}" alt="${alt}" style="display:block;border:0;outline:none;width:${w}px;height:${h}px;">`
  const t = `font-family:Arial,Helvetica,sans-serif;color:${INK};`
  const sep = `<span style="color:${AMBER_DEEP};">&nbsp;|&nbsp;</span>`
  const link = (href, text) =>
    `<a href="${href}" style="${t}font-size:12px;line-height:18px;text-decoration:none;font-weight:bold;">${text}</a>`
  const contacts = [
    link(LINKEDIN, 'My LinkedIn'),
    link(WEBSITE, WEBSITE.replace(/^https?:\/\//, '')),
    PHONE && link('tel:' + PHONE.replace(/[^\d+]/g, ''), PHONE.replace(/ /g, '&nbsp;')),
  ].filter(Boolean).join(sep)
  const socials = NABL_SOCIAL.map((s, i) =>
    `<td style="padding:6px ${i < NABL_SOCIAL.length - 1 ? SOCIAL_GAP : 0}px 0 0;"><a href="${s.href}" title="${s.label}" style="text-decoration:none;">${img(`social-${s.key}.png`, SOCIAL, SOCIAL, s.label)}</a></td>`
  ).join('')

  return `<!-- n.abl email signature. Images load from: ${base}
     To change that, edit IMAGE_BASE_URL in email-signature/build.cjs and re-run it. -->
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;max-width:500px;">
  <tr>
    <td valign="top" style="padding:2px 16px 0 0;">
      <a href="${WEBSITE}" style="text-decoration:none;">${img('nabl-icon.png', ICON, ICON, 'n.abl')}</a>
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
        <tr>${socials}</tr>
      </table>
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
                <td valign="middle" style="padding:0;">${img('hpe-logo-email.png', CHIP_W, CHIP_H, 'HPE')}</td>
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

// ---------- The hosted copy page: nabl.agency/email-signature ----------
// Lives in the site's public/ folder, so the next deploy of main publishes
// it together with the images it uses. The site's CSP is script-src 'self',
// so the copy logic is a separate file rather than an inline script.
function copyPageHtml(sig) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Email Signature</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  * { box-sizing:border-box; }
  body { margin:0; background:#F4EFE6; color:#14110E; font:16px/1.55 system-ui,-apple-system,"Segoe UI",Arial,sans-serif; }
  main { max-width:720px; margin:0 auto; padding:40px 16px 56px; }
  h1 { font-size:24px; line-height:1.25; margin:0 0 6px; }
  h2 { font-size:16px; margin:0 0 8px; }
  p { margin:0 0 16px; color:#5A5249; }
  .card { background:#FFFFFF; border:1px solid #E2D9CA; border-radius:12px; padding:28px 24px; overflow-x:auto; }
  .actions { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin:20px 0 32px; }
  button { font:inherit; font-weight:600; font-size:17px; padding:12px 22px; border-radius:8px; border:0; background:#E9AC57; color:#24170A; cursor:pointer; }
  button:focus-visible { outline:3px solid #B87718; outline-offset:2px; }
  #status { color:#14110E; font-weight:600; }
  .steps { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:640px) { .steps { grid-template-columns:1fr; } }
  .steps section { background:#FFFFFF; border:1px solid #E2D9CA; border-radius:12px; padding:18px 20px; }
  ol { margin:0; padding-left:20px; } li { margin:0 0 6px; }
  .note { font-size:14px; margin-top:24px; }
</style>
</head>
<body>
<main>
  <h1>Email signature</h1>
  <p>Click <strong>Copy signature</strong>, then paste it into your email settings.</p>
  <div class="card"><div id="sig">${sig}</div></div>
  <div class="actions">
    <button type="button" id="copy">Copy signature</button>
    <span id="status" role="status" aria-live="polite"></span>
  </div>
  <div class="steps">
    <section>
      <h2>Outlook.com / Hotmail</h2>
      <ol>
        <li>Settings (gear icon) → <strong>Account</strong> → <strong>Signatures</strong></li>
        <li>Name it, click in the box, press <strong>Ctrl+V</strong> (<strong>Cmd+V</strong> on Mac)</li>
        <li>Choose it as the default for new messages and replies</li>
        <li>Click <strong>Save</strong></li>
      </ol>
    </section>
    <section>
      <h2>Gmail</h2>
      <ol>
        <li>Settings (gear icon) → <strong>See all settings</strong></li>
        <li>General → <strong>Signature</strong> → <strong>Create new</strong></li>
        <li>Paste into the box and set it as the default</li>
        <li>Scroll down and click <strong>Save Changes</strong></li>
      </ol>
    </section>
  </div>
  <p class="note">Do this on a computer. The Outlook and Gmail phone apps only take plain-text signatures.</p>
</main>
<script src="/email-signature/copy.js"></script>
</body>
</html>
`
}

const COPY_JS = `/* Copies the signature as rich HTML so it pastes with its layout and images. */
(function () {
  var btn = document.getElementById('copy')
  var status = document.getElementById('status')
  var sig = document.getElementById('sig')
  function say(t) { status.textContent = t }
  function selectSig() {
    var r = document.createRange(); r.selectNodeContents(sig)
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r)
  }
  btn.addEventListener('click', function () {
    var html = sig.innerHTML
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([sig.innerText], { type: 'text/plain' })
      })]).then(function () {
        say('Copied. Now paste it into your signature settings.')
      }, fallback)
    } else {
      fallback()
    }
  })
  function fallback() {
    selectSig()
    var ok = false
    try { ok = document.execCommand('copy') } catch (e) {}
    say(ok ? 'Copied. Now paste it into your signature settings.'
           : 'Selected. Press Ctrl+C (Cmd+C on Mac) to copy it.')
  }
})()
`

// The images the signature actually uses, published next to the page.
const SIGNATURE_IMAGES = ['nabl-icon.png', 'hpe-logo-email.png', ...NABL_SOCIAL.map(s => `social-${s.key}.png`)]

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

  // Only publish to the site when the images are meant to live there.
  if (IMAGE_BASE_URL === 'https://nabl.agency/email-signature/') {
    const SITE = path.join(ROOT, 'public', 'email-signature')
    fs.mkdirSync(SITE, { recursive: true })
    fs.writeFileSync(path.join(SITE, 'index.html'), copyPageHtml(sig))
    fs.writeFileSync(path.join(SITE, 'copy.js'), COPY_JS)
    for (const f of SIGNATURE_IMAGES) fs.copyFileSync(path.join(PNG, f), path.join(SITE, f))
    console.log(`  public/email-signature/: index.html, copy.js, ${SIGNATURE_IMAGES.length} images`)
  }
})()
