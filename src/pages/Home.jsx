import { useEffect, useState } from 'react'
import Nav from '../components/layout/Nav.jsx'
import Footer from '../components/layout/Footer.jsx'
import { prefersReducedMotion } from '../components/ui/index.jsx'
import DiscoveryModal from '../components/DiscoveryModal.jsx'
import { JourneyRail } from '../components/Journey.jsx'

import Hero from '../components/sections/Hero.jsx'
import Problems from '../components/sections/Problems.jsx'
import Capabilities from '../components/sections/Capabilities.jsx'
import Process from '../components/sections/Process.jsx'
import Pricing from '../components/sections/Pricing.jsx'
import Examples from '../components/sections/Examples.jsx'
import About from '../components/sections/About.jsx'
import Contact from '../components/sections/Contact.jsx'

import '../styles/home.css'

/* ============================================================
   INTRO — the blind lifts to reveal the page
   ============================================================ */
function Intro() {
  const [lift, setLift] = useState(false)
  const [gone, setGone] = useState(prefersReducedMotion())
  useEffect(() => {
    if (prefersReducedMotion()) return
    const t1 = setTimeout(() => setLift(true), 620)
    const t2 = setTimeout(() => setGone(true), 1050)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  if (gone) return null
  return (
    <div className={`intro ${lift ? 'intro--lift' : ''}`} aria-hidden="true">
      {/* The same drawn paths as the logo and favicon — the opening frame of
          the site must not show a different letterform from the one in the
          nav it reveals. */}
      <svg className="intro__mark" viewBox="0 0 104 100" width="1" height="1">
        <path
          className="intro__n"
          d="M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82"
          fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="butt"
        />
        <rect className="intro__sq" x="78" y="69" width="13" height="13" />
      </svg>
    </div>
  )
}

/* ============================================================
   PAGE

   Every section lives in src/components/sections/, one file each,
   so the order of the page is legible from this list alone and a
   reorder is a readable diff rather than a rewrite. The copy for
   each section sits with the markup that renders it.
   ============================================================ */
export default function Home() {
  const [modalOpen, setModalOpen] = useState(false)
  const book = () => setModalOpen(true)

  return (
    <div className="grain">
      <Intro />
      <Nav />

      <JourneyRail />

      <main>
        <Hero onBook={book} />
        <Problems />
        <Process />
        <Capabilities />
        <Examples />
        <Pricing />
        <About />
        <Contact onBook={book} />
      </main>

      <Footer />
      <DiscoveryModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
