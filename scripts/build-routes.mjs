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

   Run automatically by `npm run build`.
   ============================================================ */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
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

async function run() {
  const shell = await readFile(join(DIST, 'index.html'), 'utf8')

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

    await mkdir(join(DIST, r.path), { recursive: true })
    await writeFile(join(DIST, r.path, 'index.html'), html)
    console.log(`  /${r.path} → dist/${r.path}/index.html`)
  }

  // The home page gets its own canonical too.
  let home = shell.replace(
    /<\/head>/i,
    `  <link rel="canonical" href="${ORIGIN}/" />\n  </head>`
  )
  await writeFile(join(DIST, 'index.html'), home)
  console.log('  / → canonical added')
}

run().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
