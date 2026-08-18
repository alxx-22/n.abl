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

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
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
          <Route path="/privacy" element={<Legal doc="privacy" />} />
          <Route path="/terms" element={<Legal doc="terms" />} />
          <Route path="/cookies" element={<Legal doc="cookies" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
