/* ============================================================
   BUILD-TIME RENDERING FOR THE PUBLIC ROUTES

   Why this file exists, measured rather than asserted. On
   14 September 2026 the live home page answered every crawler
   with this:

     GET https://nabl.agency/  ->  200, 2,583 bytes
     <body> contents:               29 bytes
     visible text:                  0 characters

   Twenty-nine bytes is the root div and a script tag. Around 41 KB
   of copy existed only after React had run.

   Googlebot runs JavaScript, so Google could read the site. GPTBot,
   ClaudeBot and PerplexityBot do not, and do not come back for a
   second pass — they read the raw HTML once and move on. So the site
   was legible to Google and completely blank to every AI assistant,
   at exactly the point where people started asking assistants who
   does this kind of work near them.

   scripts/build-routes.mjs already wrote a per-route <head> after the
   build. This is the same idea carried into the <body>.

   WHY THIS RENDERS PAGES DIRECTLY RATHER THAN <App />

   App.jsx code-splits Legal, Portal, Team and Crm behind React.lazy
   so a visitor to the marketing site never downloads the CRM bundle.
   That is right for the browser and wrong here: renderToStaticMarkup
   does not resolve lazy boundaries, so rendering <App /> would write
   the Suspense fallback — the word "Loading" — into three of the four
   shells, which is worse than the empty div it replaced.

   So the four public routes are listed explicitly with direct
   imports. The page components are the same ones the browser renders,
   so the copy still has exactly one source. The private surfaces are
   deliberately absent: robots.txt disallows them and prerendering
   them would publish markup for pages that exist behind a login.

   StaticRouter is still needed because the pages use <Link>, which
   throws outside a router context.

   NOT HYDRATION

   main.jsx still calls createRoot, which discards this markup and
   renders fresh. That is deliberate. hydrateRoot would be faster, but
   Home.jsx seeds state from prefersReducedMotion(), which is false
   here and may be true in the browser — a mismatch React would have
   to repair on the one group of users least able to tolerate a
   flicker. The markup here is for readers who never run the script.
   Making it load faster for everyone else is a separate change with
   its own risks, and it can be made later against this file.
   ============================================================ */
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'

import Home from './pages/Home.jsx'
import Legal from './pages/Legal.jsx'
import './styles/global.css'

/* The four public URLs, and the same four that are in sitemap.xml.
   If a page is ever added, it goes in both, in the same commit. */
const PAGES = {
  '/': () => <Home />,
  '/privacy': () => <Legal doc="privacy" />,
  '/terms': () => <Legal doc="terms" />,
  '/cookies': () => <Legal doc="cookies" />,
}

export const ROUTES = Object.keys(PAGES)

export function render(url) {
  const page = PAGES[url]
  if (!page) throw new Error(`prerender: no public route for ${url}`)
  return renderToStaticMarkup(
    <StaticRouter location={url}>{page()}</StaticRouter>,
  )
}
