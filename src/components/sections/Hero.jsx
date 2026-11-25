import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../ui/index.jsx'
import { track } from '../../lib/analytics.js'

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
      {/* No ground of its own: the lit ground behind the page (LitGround)
          is the hero's light, and it keeps the copy's side dark. */}
      <div className="shell hero__inner" ref={heroRef}>
        {/* The descriptor is the eyebrow, not the headline. It names the
            category, so a visitor knows what kind of business this is in the
            first second; the promise is what they leave with. The headline
            is the reel's end card, so the film and the site say the same
            thing in the same words. */}
        <span className="eyebrow hero__eyebrow">AI implementation for small and mid-sized businesses</span>
        <h1 className="hero__title">
          AI, built into your business<span className="dot" />
        </h1>
        <p className="hero__sub">
          We build AI around the way your business already works. It answers the calls and
          messages, reads the paperwork and handles the admin, and we keep it running and
          improving, month after month.
        </p>
        <div className="hero__cta">
          {/* The label sits in its own span so it can be trimmed to its
              capitals and centred in the pill in every browser (.lbl). */}
          <button className="btn btn--primary" onClick={onBook}>
            <span className="lbl">Book a free discovery call</span>
          </button>
          <a className="btn btn--ghost" href="#see-it-work" onClick={() => track('cta_secondary')}><span className="lbl">See it work</span></a>
        </div>
        <p className="hero__note">Built around you. Looked after every month.</p>
      </div>
      <a href="#see-it-work" className="hero__scroll" aria-label="Scroll to content">
        <span className="hero__scroll-word" aria-hidden="true">Scroll</span>
        <i aria-hidden="true" />
      </a>
    </section>
  )
}
