import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../ui/index.jsx'
import { NodeField } from '../Visuals.jsx'

/* ============================================================
   01 — HERO
   ============================================================ */
export default function Hero({ onBook }) {
  const heroRef = useRef(null)

  // Gentle parallax on the hero while it is still on screen.
  useEffect(() => {
    if (prefersReducedMotion()) return
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
  }, [])

  return (
    <section id="hero" className="hero">
      <div className="hero__glow" aria-hidden="true" />
      <NodeField />
      <div className="shell hero__inner" ref={heroRef}>
        <span className="eyebrow hero__eyebrow">Technology implementation partner</span>
        <h1 className="hero__title">
          Tell us what&rsquo;s costing you. We build the fix<span className="dot" />
        </h1>
        <p className="hero__sub">
          We start with the problem, not the technology. Sometimes the answer is automation,
          sometimes an app, sometimes a spreadsheet finally done properly.
        </p>
        <div className="hero__cta">
          <button className="btn btn--primary" onClick={onBook}>
            Book a discovery call
          </button>
          <a className="btn btn--ghost" href="#what-we-do">See what we do</a>
        </div>
      </div>
      <a href="#what-we-do" className="hero__scroll" aria-label="Scroll to content">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
    </section>
  )
}
