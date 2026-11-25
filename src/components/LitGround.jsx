import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, useReducedMotion } from './ui/index.jsx'
import { createGround } from './ground/engine.js'
import { homeKeyframes, stillKeyframes } from './ground/story.js'

/* ============================================================
   LIT GROUND — the light behind the page

   One fixed canvas under everything, drawn by ground/engine.js, with the
   grain over it. On the homepage the light follows the story section by
   section (ground/story.js): the opening's wisps, warmth as the work is
   described, fluted glass while the film shows it being done, the reeds
   widening into an aurora through How we work, and a quiet close. On
   other pages it holds the opening light.

   The canvas sits at z-index -1, so it paints above the page's own
   background and below every section. Sections on a lit page must not
   paint an opaque background of their own, or they hide it.

   Where WebGL is not available the ground is a still made of CSS
   gradients (.ground__still), so the page is never flat black.
   ============================================================ */

/* Where each section sits on the page, and where each product's chapter
   sits, and on which side its words are. */
function measure() {
  const vh = window.innerHeight
  const maxY = Math.max(1, document.documentElement.scrollHeight - vh)
  const sec = (id) => {
    const el = document.getElementById(id)
    if (!el) return null
    return { top: el.getBoundingClientRect().top + window.scrollY, h: el.offsetHeight }
  }
  const portrait = window.innerWidth < window.innerHeight
  const products = [...document.querySelectorAll('#what-we-do .product')].map((el) => ({
    top: el.getBoundingClientRect().top + window.scrollY,
    h: el.offsetHeight,
    // on a phone the words run full width under the animation
    side: !portrait && el.classList.contains('product--left') ? 'left' : 'right',
  }))
  return { vh, maxY, portrait, sec, products }
}

/* The words the light dims behind as they pass: headings and their
   standfirsts. The opening keeps its own fixed fade instead. */
const SHIELDS = '[data-shield], .section__title, .section__sub, .contact__title, .contact__sub, .about__quote, .services-hero__title'

export default function LitGround({ story = 'home' }) {
  const canvas = useRef(null)
  const ground = useRef(null)
  const [still, setStill] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    const g = createGround(canvas.current, { reduced: prefersReducedMotion(), shields: SHIELDS })
    if (!g) { setStill(true); return }
    ground.current = g
    g.setStory(() => (story === 'home' ? homeKeyframes(measure()) : stillKeyframes(measure())))

    /* The page changes height after the first render (the fonts, the film
       taking its length, the cards revealing), and every change moves the
       chapters, so the story is laid out again whenever it does. */
    let t = 0
    const relayout = () => { clearTimeout(t); t = setTimeout(() => g.layout(), 120) }
    const ro = new ResizeObserver(relayout)
    ro.observe(document.body)
    window.addEventListener('resize', relayout)
    window.addEventListener('load', relayout)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout)

    return () => {
      clearTimeout(t)
      ro.disconnect()
      window.removeEventListener('resize', relayout)
      window.removeEventListener('load', relayout)
      g.destroy()
      ground.current = null
    }
  }, [story])

  useEffect(() => { if (ground.current) ground.current.setReduced(reduced) }, [reduced])

  /* The main button's spot of light follows the pointer across its glass. */
  useEffect(() => {
    const onMove = (e) => {
      const b = e.target && e.target.closest ? e.target.closest('.btn--primary') : null
      if (!b) return
      const r = b.getBoundingClientRect()
      b.style.setProperty('--bx', `${(e.clientX - r.left).toFixed(0)}px`)
      b.style.setProperty('--by', `${(e.clientY - r.top).toFixed(0)}px`)
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => document.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <>
      <canvas ref={canvas} className={`ground ${still ? 'ground--off' : ''}`} aria-hidden="true" />
      <div className={`ground__still ${still ? 'ground__still--on' : ''}`} aria-hidden="true" />
      <div className="ground__grain" aria-hidden="true" />
    </>
  )
}
