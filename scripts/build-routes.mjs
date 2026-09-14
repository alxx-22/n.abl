/* ============================================================
   PER-ROUTE METADATA

   The site is a Vite SPA behind a catch-all rewrite, so every URL
   serves the same shell and every URL therefore reports the home
   page's title and description to anything that does not run
   JavaScript — which includes most social scrapers.

   Setting document.title in React fixes Google and not much else.
   A framework with server rendering would fix it properly, and
   swapping the framework to correct four static pages is not a
   trade worth making.

   So: after the build, write one shell per public route with its
   own head. Netlify serves an existing file before it applies the
   SPA rewrite, so dist/privacy/index.html answers /privacy, React
   boots, and the router renders the same page it always did. The
   markup is byte-identical apart from the head.

   SINCE SEPTEMBER 2026 IT ALSO WRITES THE BODY

   Fixing the head was only half of it. Every shell still shipped an
   empty <div id="root">, so the live home page answered crawlers with
   2,583 bytes containing zero characters of readable text. Googlebot
   runs JavaScript and got there eventually; GPTBot, ClaudeBot and
   PerplexityBot do not run it and do not return, so the site was
   invisible to every AI assistant.

   So each shell now carries its route's markup, rendered at build
   time by src/prerender.jsx. See that file for why it renders the
   pages directly instead of <App />, and why this is prerendering
   rather than hydration.

   Run automatically by `npm run build`, after both Vite builds.
   ============================================================ */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const SSR = join(ROOT, 'dist-ssr', 'prerender.js')

/* Google Search Console's ownership token.
   
   Verification cannot be automated and that is deliberate: the token is
   issued by Google to a signed-in account that owns the domain, which is
   the whole point of it. So this is the smallest possible job for the
   person who can do it — paste one string, run one build.

     GSC_VERIFICATION=abc123… npm run build

   Or put it in .env.local, which .gitignore already covers.

   A DNS TXT record on the domain is the sturdier method and needs no
   code at all; this exists because it is faster, and because the site
   has moved host once already and may again. Either is fine — Search
   Console accepts both, and a property can hold more than one. */
const GSC = (process.env.GSC_VERIFICATION || '').trim()
const ORIGIN = 'https://nabl.agency'

const ROUTES = [
  {
    path: 'privacy',
    title: 'Privacy Policy — n.abl',
    description:
      'How n.abl collects, uses and protects personal data, and the rights you have over it. No advertising, no analytics tracking, no third-party content networks.',
  },
  {
    path: 'terms',
    title: 'Terms of Service — n.abl',
    description:
      'The terms on which n.abl provides technology implementation services to small businesses: engagement, quotes, ownership, confidentiality and liability.',
  },
  {
    path: 'cookies',
    title: 'Cookie Policy — n.abl',
    description:
      'What nabl.agency stores in your browser, which is very little: no advertising cookies, no analytics cookies, no third-party tracking, and no consent banner.',
  },
]

/* Replace the content of a meta tag matched by one attribute, leaving
   the rest of the head untouched. Anchored on the exact attribute so a
   second tag with a similar name is never caught by accident. */
function setMeta(html, attr, value, content) {
  const re = new RegExp(
    `(<meta\\s+${attr}=["']${value}["']\\s+content=["'])([^"']*)(["'])`,
    'i'
  )
  if (!re.test(html)) {
    throw new Error(`build-routes: no <meta ${attr}="${value}"> in the shell`)
  }
  return html.replace(re, (_, open, __, close) => open + escapeAttr(content) + close)
}

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/* The shell ships <div id="root"></div> and nothing else. Put the
   route's markup inside it.

   Anchored on the empty div specifically: if a previous run already
   filled it, or Vite ever changes the mount point, this throws rather
   than silently shipping an empty body again. Being loud is the whole
   point — the bug this replaces was invisible for a month because
   nothing checked. */
/* Injected into every public shell rather than just the home page: a
   Search Console property can be verified from any URL on the origin,
   and one of the four is likelier to be fetched than exactly one. */
function injectVerification(html) {
  if (!GSC) return html
  if (html.includes('name="google-site-verification"')) return html
  return html.replace(
    /<\/head>/i,
    `  <meta name="google-site-verification" content="${escapeAttr(GSC)}" />\n  </head>`
  )
}

function injectBody(html, markup) {
  const empty = '<div id="root"></div>'
  if (!html.includes(empty)) {
    throw new Error('build-routes: no empty <div id="root"></div> in the shell')
  }
  return html.replace(empty, `<div id="root">${markup}</div>`)
}

async function run() {
  const shell = await readFile(join(DIST, 'index.html'), 'utf8')

  /* The SSR bundle is built by `vite build --ssr` in the line before
     this script runs. If it is missing the build is misconfigured, and
     shipping unrendered shells is exactly the failure this script
     exists to prevent — so stop rather than carry on quietly. */
  if (!existsSync(SSR)) {
    throw new Error(
      'build-routes: dist-ssr/prerender.js is missing. ' +
      'Run `vite build --ssr src/prerender.jsx --outDir dist-ssr` first, ' +
      'or use `npm run build`, which does both.'
    )
  }
  const { render } = await import(SSR)

  for (const r of ROUTES) {
    let html = shell

    if (!/<title>[^<]*<\/title>/i.test(html)) {
      throw new Error('build-routes: no <title> in the shell')
    }
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${r.title}</title>`)

    html = setMeta(html, 'name', 'description', r.description)
    html = setMeta(html, 'property', 'og:title', r.title)
    html = setMeta(html, 'property', 'og:description', r.description)
    html = setMeta(html, 'property', 'og:url', `${ORIGIN}/${r.path}`)

    // Canonical: absent from the shell, so add it rather than replace it.
    html = html.replace(
      /<\/head>/i,
      `  <link rel="canonical" href="${ORIGIN}/${r.path}" />\n  </head>`
    )

    html = injectVerification(html)
    const markup = render(`/${r.path}`)
    html = injectBody(html, markup)

    await mkdir(join(DIST, r.path), { recursive: true })
    await writeFile(join(DIST, r.path, 'index.html'), html)
    console.log(`  /${r.path} → dist/${r.path}/index.html  (${markup.length.toLocaleString()} chars rendered)`)
  }

  // The home page gets its own canonical, and its own markup. It is the
  // page that matters most here and the one that was emptiest.
  let home = shell.replace(
    /<\/head>/i,
    `  <link rel="canonical" href="${ORIGIN}/" />\n  </head>`
  )
  home = injectVerification(home)
  const homeMarkup = render('/')
  home = injectBody(home, homeMarkup)
  await writeFile(join(DIST, 'index.html'), home)
  console.log(`  / → dist/index.html  (${homeMarkup.length.toLocaleString()} chars rendered)`)

  console.log(GSC
    ? '  google-site-verification: present on all four shells'
    : '  google-site-verification: not set (GSC_VERIFICATION) — Search Console still unverified')
}

run().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
