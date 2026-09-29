import { useEffect, useRef } from 'react'
import { Reveal, useReducedMotion } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'
import { createStage } from '../film/stage.js'
import film, { BEAT, LIST, CHAPTERS } from '../film/reel.js'

/* ============================================================
   02 — SEE IT WORK

   The launch reel, run live and scrubbed by scroll. The section is as
   tall as the film is long; a stage pinned inside it plays forwards as
   the page moves down and backwards as it moves up, so the visitor sets
   the pace and can stop on any frame.

   Scroll drives a target time, and the frame eases towards it rather than
   jumping to it. That is what makes a wheel's coarse steps read as one
   continuous move, the way the reel's camera moves. When the frame
   reaches the target the loop stops: a stationary page does no work.

   The words the film puts on screen are also in the page as text, for a
   screen reader, a crawler, and anyone who has asked for reduced motion
   and gets the chapters as cards instead of a film.
   ============================================================ */

/* Scroll distance per second of film. A wheel notch is about 100px, so
   roughly one notch a second, which is the reel's pace. A phone swipe
   covers more ground, so it gets less per second. */
const PX_DESK = 115, PX_TOUCH = 95

function Words({ className }) {
  return (
    <ol className={className}>
      {CHAPTERS.map((c) => (
        <li key={c.no}>
          {c.name}: {c.line}
          <ul>{c.steps.map((s) => <li key={s}>{s}</li>)}</ul>
        </li>
      ))}
    </ol>
  )
}

function Still() {
  return (
    <div className="film-still__grid">
      {CHAPTERS.map((c, i) => (
        <Reveal key={c.no} delay={0.06 + i * 0.08}>
          <div className="film-still__card">
            <div className="film-still__eb"><span>{c.name}</span><span>{c.no}</span></div>
            <p className="film-still__line">{c.line}</p>
            <ul className="film-still__steps">
              {c.steps.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

function Film() {
  const section = useRef(null)
  const pin = useRef(null)
  const host = useRef(null)
  const bar = useRef(null)
  const hint = useRef(null)

  useEffect(() => {
    const sec = section.current, box = pin.current, el = host.current
    let ctx = null, dur = 1, px = PX_DESK, size = [0, 0]
    let t = 0, target = 0, raf = 0, last = 0, alive = true, stale = false

    function build() {
      const vw = box.clientWidth, vh = box.clientHeight
      if (!vw || !vh) return
      const R = vw / vh
      const W = R >= 1 ? Math.round(1080 * R) : 1080
      const H = R >= 1 ? 1080 : Math.round(1080 / R)
      if (ctx && W === size[0] && H === size[1]) return
      size = [W, H]
      if (ctx) ctx.destroy()
      const touch = window.matchMedia('(pointer: coarse)').matches
      px = touch ? PX_TOUCH : PX_DESK
      ctx = createStage(el, { W, H, beat: BEAT, list: LIST, lite: Math.min(vw, vh) < 700 })
      film(ctx)
      ctx.prime()
      el.style.transform = `scale(${(R >= 1 ? vh : vw) / 1080})`
      dur = ctx.TL.duration + 0.6
      sec.style.height = `${Math.round(dur * px + vh)}px`
      measure()
      t = target
      ctx.seek(t)
      paint()
    }

    function measure() {
      const r = sec.getBoundingClientRect()
      const span = r.height - box.clientHeight
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0
      target = p * dur
    }

    function paint() {
      if (bar.current) bar.current.style.transform = `scaleX(${(t / dur).toFixed(4)})`
      if (hint.current) hint.current.style.opacity = t < 0.4 ? '1' : '0'
    }

    function frame(now) {
      // off screen there is nothing to ease towards: jump, and stop
      if (!near) { t = target; raf = 0; stale = true; return }
      const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000))
      last = now
      const before = t
      t += (target - t) * (1 - Math.exp(-dt * 9))
      if (Math.abs(target - t) < 0.002) t = target
      ctx.speed = Math.abs(t - before) / dt
      ctx.seek(t)
      paint()
      stale = false
      raf = t === target ? 0 : requestAnimationFrame(frame)
    }

    function kick() {
      if (!ctx) return
      measure()
      if (!raf && target !== t) { last = performance.now(); raf = requestAnimationFrame(frame) }
      // back from off screen with nothing to ease: draw where it now is
      else if (!raf && stale) { stale = false; ctx.speed = 0; ctx.seek(t); paint() }
    }

    /* Only listen, and only draw, while the section is anywhere near the
       screen. A jump past it (a link to the pricing section, a keyboard End)
       must not leave the film easing through thirty seconds nobody sees. */
    let near = false
    const io = new IntersectionObserver(([e]) => {
      near = e.isIntersecting
      if (near) kick()
      else if (raf) { cancelAnimationFrame(raf); raf = 0; t = target; stale = true }
    }, { rootMargin: '50% 0px 50% 0px' })
    io.observe(sec)
    const onScroll = () => { if (near) kick() }
    let rt = 0
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { build(); kick() }, 180) }

    // the stage measures its own layout, so the fonts have to be in first
    document.fonts.ready.then(() => {
      if (!alive) return
      build()
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onResize)
    })

    return () => {
      alive = false
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      clearTimeout(rt)
      if (raf) cancelAnimationFrame(raf)
      if (ctx) ctx.destroy()
      sec.style.height = ''
    }
  }, [])

  return (
    <div className="film" ref={section}>
      <div className="film__pin" ref={pin} aria-hidden="true">
        <div className="film__host" ref={host} />
        <span className="film__hint" ref={hint}>Scroll to play</span>
        <span className="film__bar"><i ref={bar} /></span>
      </div>
    </div>
  )
}

export default function FilmSection() {
  const reduced = useReducedMotion()
  return (
    <section id="see-it-work" className={`film-section ${reduced ? 'section film--still' : ''}`} aria-labelledby="see-it-work-title">
      <div className="shell film-section__head">
        <Chapter index={1}>See it work</Chapter>
        <Reveal delay={0.06}>
          <h2 id="see-it-work-title" className="section__title">Watch the work get done<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            Calls answered, bookings made, paperwork read and the admin chased, by AI built
            around one business.{reduced ? '' : ' Scroll, and it plays.'}
          </p>
        </Reveal>
        {reduced && <Still />}
      </div>
      {!reduced && (
        <>
          <Words className="sr-only" />
          <Film />
        </>
      )}
    </section>
  )
}
