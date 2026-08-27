import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../ui/index.jsx'
import { track } from '../../lib/analytics.js'
import { NodeField } from '../Visuals.jsx'

/* ============================================================
   01 — HERO
   ============================================================ */
export default function Hero({ onBook }) {
  const heroRef = useRef(null)
  const reduced = useReducedMotion()

  // Gentle parallax on the hero while it is still on screen.
  useEffect(() => {
    // Put the hero back where the layout says it goes. The drift is only ever
    // applied within the first viewport, so a visitor who turns the preference
    // on further down the page would otherwise find the hero still displaced
    // by a quarter of the scroll distance when they came back to the top.
    if (reduced) {
      if (heroRef.current) heroRef.current.style.transform = ''
      return
    }
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        if (heroRef.current && y < window.innerHeight) {
          heroRef.current.style.transform = `translateY(${y * 0.25}px)`
        }
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduced])

  return (
    <section id="hero" className="hero">
      <div className="hero__glow" aria-hidden="true" />
      <NodeField />
      <div className="shell hero__inner" ref={heroRef}>
        {/* The descriptor is the eyebrow, not the headline. "Technology
            implementation partner" is accurate and nobody remembers it;
            the promise is what they leave with. */}
        <span className="eyebrow hero__eyebrow">Technology implementation for small businesses</span>
        <h1 className="hero__title">
          We make your business work smarter<span className="dot" />
        </h1>
        <p className="hero__sub">
          We listen to what isn&rsquo;t working, understand how your business actually
          operates, and build the right improvement — whether that&rsquo;s automation,
          analytics, software, a better website, AI or training.
        </p>
        <div className="hero__cta">
          <button className="btn btn--primary" onClick={onBook}>
            Book a free discovery call
          </button>
          <a className="btn btn--ghost" href="#why-nabl" onClick={() => track('cta_secondary')}>See how we help</a>
        </div>
        {/* Stronger differentiator than any technology list: it tells an
            owner these people understand business, not just software. */}
        <p className="hero__note">No retainer. No technology for technology&rsquo;s sake.</p>
      </div>
      <a href="#pillars" className="hero__scroll" aria-label="Scroll to content">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
    </section>
  )
}
