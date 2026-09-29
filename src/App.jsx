import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'

import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'

/* App surfaces are code-split — a visitor to the marketing site should
   never download the portal, team space or CRM bundles. */
const Portal = lazy(() => import('./pages/Portal.jsx'))
const Team = lazy(() => import('./pages/Team.jsx'))
const Crm = lazy(() => import('./pages/Crm.jsx'))
const Legal = lazy(() => import('./pages/Legal.jsx'))
const Services = lazy(() => import('./pages/Services.jsx'))

/* A new page starts at the top, unless the link named a section of it:
   /#pricing from the services page lands on the pricing section. The
   section may not exist on the first frame, since the page can still be
   loading, so it is looked for briefly before giving up. */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return }
    let tries = 0, timer = 0
    const go = () => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      // once more after the page settles: fonts and lazy sections can still
      // move it a little after the first frame
      if (el) { el.scrollIntoView(); timer = setTimeout(() => el.scrollIntoView(), 450); return }
      if (tries++ < 20) timer = setTimeout(go, 50)
    }
    go()
    return () => clearTimeout(timer)
  }, [pathname, hash])
  return null
}

function Loading() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <span className="eyebrow">Loading</span>
    </div>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/team" element={<Team />} />
          {/* Named /crm, not /sales-intelligence. "Sales intelligence" was the
              AI product that was deliberately stripped out; keeping its name on
              the URL kept advertising a thing that no longer exists. The old
              path still resolves so any saved link keeps working. */}
          <Route path="/crm" element={<Crm />} />
          <Route path="/sales-intelligence" element={<Navigate to="/crm" replace />} />
          <Route path="/services" element={<Services />} />
          <Route path="/privacy" element={<Legal doc="privacy" />} />
          <Route path="/terms" element={<Legal doc="terms" />} />
          <Route path="/cookies" element={<Legal doc="cookies" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
