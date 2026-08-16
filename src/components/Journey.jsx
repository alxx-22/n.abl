import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from './ui/index.jsx'

/* ============================================================
   JOURNEY — scroll as a narrative device
   A fixed rail tracks progress through the page and lights the
   chapter you are currently in. Reading position becomes a
   sense of travel rather than just scrolling.
   ============================================================ */

/* The order is the buyer's journey, not our taxonomy: recognise the
   problem, hear the method, then see the capability that backs it,
   the evidence, and only then the price. Sections and chapters are
   deliberately not one-to-one — some bands (the pillars, credits)
   are part of the section above them and do not earn a rail stop. */
export const CHAPTERS = [
  { id: 'hero', label: 'Start' },
  { id: 'what-we-do', label: 'Your problem' },
  { id: 'how-we-work', label: 'How we work' },
  { id: 'toolkit', label: 'What we build' },
  { id: 'cases', label: 'In practice' },
  { id: 'pricing', label: 'What it costs' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: "Let's talk" },
]

export function JourneyRail() {
  const [progress, setProgress] = useState(0)
  const [active, setActive] = useState('hero')

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0)
        ticking = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    // Which chapter owns the middle of the viewport
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id) })
      },
      { rootMargin: '-45% 0px -50% 0px' }
    )
    CHAPTERS.forEach((c) => {
      const el = document.getElementById(c.id)
      if (el) obs.observe(el)
    })

    return () => { window.removeEventListener('scroll', onScroll); obs.disconnect() }
  }, [])

  return (
    <nav className="rail" aria-label="Page progress">
      <div className="rail__track">
        <div className="rail__fill" style={{ transform: `scaleY(${progress})` }} />
      </div>
      <ul className="rail__list">
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              className={`rail__dot ${active === c.id ? 'rail__dot--on' : ''}`}
              aria-label={c.label}
              aria-current={active === c.id ? 'true' : undefined}
            >
              <span className="rail__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="rail__label">{c.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/* ------------------------------------------------------------
   Scroll-linked parallax. Returns a ref; the element drifts at
   `speed` relative to scroll while it is on screen.
   ------------------------------------------------------------ */
export function useParallax(speed = 0.12) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    let ticking = false
    let visible = false

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { rootMargin: '20% 0px' })
    io.observe(el)

    const onScroll = () => {
      if (ticking || !visible) return
      ticking = true
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        // -1 .. 1 as the element crosses the viewport
        const centre = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight
        el.style.transform = `translate3d(0, ${centre * speed * 100}px, 0)`
        ticking = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); io.disconnect() }
  }, [speed])
  return ref
}

/* ------------------------------------------------------------
   Chapter marker — a numbered rule that draws itself in.
   ------------------------------------------------------------ */
export function Chapter({ index, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) { el.classList.add('in'); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('in'); io.unobserve(el) }
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div className="chapter" ref={ref}>
      <span className="chapter__num">{String(index).padStart(2, '0')}</span>
      <span className="chapter__rule" />
      <span className="chapter__label">{children}</span>
    </div>
  )
}
