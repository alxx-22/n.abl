import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '../ui/index.jsx'
import { mountScene, play, stop, still } from './Scene.jsx'

/* A mouse hovers and a finger cannot, and the difference decides the whole
   interaction — so it is read once and re-read if it changes. A tablet with
   a keyboard and trackpad attached is one device that is both. */
export function useFinePointer() {
  const [fine, setFine] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const onChange = () => setFine(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return fine
}

const POP_AR = 960 / 656          // the cropped scene viewBox
const GAP = 14                    // clearance from the card
const EDGE = 16                   // clearance from the screen
const MIN_W = 320                 // below this the scene stops reading

/* The popup is large and the grid fills the screen, so there is no one side
   that always works. Ask each of the four bands around the card how wide a
   popup it could hold and take the roomiest, preferring above and below,
   which read as belonging to the card. The card itself is never covered:
   you have to be able to see what you are pointing at. Null means no band
   can hold one without sitting on top of it, and then we show nothing —
   a preview that hides its own subject is worse than no preview. */
function planFor(card, capW, foot) {
  const r = card.getBoundingClientRect()
  const bands = [
    ['top', '50% 100%', innerWidth - EDGE * 2, r.top - GAP - EDGE],
    ['bottom', '50% 0%', innerWidth - EDGE * 2, innerHeight - r.bottom - GAP - EDGE],
    ['left', '100% 50%', r.left - GAP - EDGE, innerHeight - EDGE * 2],
    ['right', '0% 50%', innerWidth - r.right - GAP - EDGE, innerHeight - EDGE * 2],
  ]
  let best = null
  for (const [side, origin, bw, bh] of bands) {
    const w = Math.min(capW, bw, Math.max(0, bh - foot) * POP_AR)
    if (!best || w > best.w + 0.5) best = { side, origin, w }
  }
  if (best.w < MIN_W) return null
  return { ...best, h: best.w / POP_AR + foot }
}

/* Cards are still settling out of their reveal for the first half second on
   screen, so a popup positioned once can end up on top of the card that
   moved under it. The side and size are fixed at open; only the offset is
   re-derived, so it stays glued without ever resizing mid-hover. */
function position(pop, card, plan) {
  const r = card.getBoundingClientRect()
  const { side, w: W, h: H } = plan
  const fit = (v, span) => Math.max(EDGE, Math.min(v, span - EDGE))
  let x, y
  if (side === 'top' || side === 'bottom') {
    x = fit(r.left + r.width / 2 - W / 2, innerWidth - W)
    y = fit(side === 'top' ? r.top - GAP - H : r.bottom + GAP, innerHeight - H)
  } else {
    y = fit(r.top + r.height / 2 - H / 2, innerHeight - H)
    x = fit(side === 'left' ? r.left - GAP - W : r.right + GAP, innerWidth - W)
  }
  pop.style.left = `${x}px`
  pop.style.top = `${y}px`
}

/** The desktop surface: a preview that rises off the card under the cursor. */
function HoverPreview({ item, card, onClose }) {
  const popRef = useRef(null)
  const hostRef = useRef(null)
  const [on, setOn] = useState(false)
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    const pop = popRef.current
    const host = hostRef.current
    const m = mountScene(host, item.scene)
    m.scene.render(m.els, reduced ? still(item.scene) : 0)

    // measure the label bar rather than guess it
    const capW = Math.min(560, innerWidth - EDGE * 2)
    pop.style.width = `${capW}px`
    const foot = pop.offsetHeight - capW / POP_AR

    const plan = planFor(card, capW, foot)
    if (!plan) return () => { host.innerHTML = '' }

    pop.style.width = `${plan.w}px`
    pop.style.transformOrigin = plan.origin
    // it settles away from the card it came off, whichever side that is
    pop.style.setProperty('--pop-dx', plan.side === 'left' ? '12px' : plan.side === 'right' ? '-12px' : '0px')
    pop.style.setProperty('--pop-dy', plan.side === 'top' ? '12px' : plan.side === 'bottom' ? '-12px' : '0px')
    position(pop, card, plan)
    setOn(true)

    if (reduced) return () => { host.innerHTML = '' }
    play(m)
    let raf = requestAnimationFrame(function follow() {
      position(pop, card, plan)
      raf = requestAnimationFrame(follow)
    })
    return () => { cancelAnimationFrame(raf); stop(m); host.innerHTML = '' }
  }, [item, card, reduced])

  useEffect(() => {
    const onScroll = () => onClose()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll) }
  }, [onClose])

  return (
    <div ref={popRef} className={`pop${on ? ' on' : ''}`} aria-hidden="true">
      <div className="pop__inner">
        <div className="pop__scene" ref={hostRef} />
        <div className="pop__foot">
          <span className="pop__label">{item.label}</span>
          <span className="pop__note">what we would build</span>
        </div>
      </div>
    </div>
  )
}

/** The touch surface: a sheet up from the bottom edge, where there is room. */
function SheetPreview({ item, onClose }) {
  const hostRef = useRef(null)
  const closeRef = useRef(null)
  const [on, setOn] = useState(false)
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    const host = hostRef.current
    const m = mountScene(host, item.scene)
    m.scene.render(m.els, reduced ? still(item.scene) : 0)
    setOn(true)
    if (reduced) return () => { host.innerHTML = '' }
    play(m)
    return () => { stop(m); host.innerHTML = '' }
  }, [item, reduced])

  useEffect(() => {
    // html is the scrolling element on this site, so lock it, not just body
    const root = document.documentElement
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', onKey)
    return () => {
      root.style.overflow = ''
      document.body.style.overflow = ''
      removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className={`sheet${on ? ' on' : ''}`} role="dialog" aria-modal="true"
      aria-label={`${item.label} — what we would build`}>
      <div className="sheet__scrim" onClick={onClose} />
      <div className="sheet__panel">
        {/* the grab bar is the close button, so the only affordance is also
            the control, and nothing sits over the animation itself */}
        <button ref={closeRef} type="button" className="sheet__handle"
          aria-label="Close preview" onClick={onClose} />
        <div className="sheet__scene" ref={hostRef} />
        <div className="pop__foot">
          <span className="pop__label">{item.label}</span>
          <span className="pop__note">what we would build</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Preview behaviour for a set of cards: hover on a mouse, press on a finger.
 * Returns the props each card needs and the overlay to render.
 */
export function useScenePreview(items) {
  const fine = useFinePointer()
  const [open, setOpen] = useState(null)   // { i, card }
  const timer = useRef(0)

  const close = useCallback(() => { clearTimeout(timer.current); setOpen(null) }, [])
  useEffect(() => close(), [fine, close])  // never carry a surface across modes

  const cardProps = (i) => (fine ? {
    tabIndex: 0,
    // a short delay so sweeping across the grid does not fire six of them
    onMouseEnter: (e) => {
      const card = e.currentTarget
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setOpen({ i, card }), 110)
    },
    onMouseLeave: close,
    onFocus: (e) => setOpen({ i, card: e.currentTarget }),   // keyboard, immediately
    onBlur: close,
  } : {
    tabIndex: 0,
    role: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': open?.i === i,
    // press it again to put it away
    onClick: (e) => { const card = e.currentTarget; setOpen((o) => (o?.i === i ? null : { i, card })) },
    onKeyDown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      const card = e.currentTarget
      setOpen((o) => (o?.i === i ? null : { i, card }))
    },
  })

  const overlay = open && createPortal(
    fine
      ? <HoverPreview key={open.i} item={items[open.i]} card={open.card} onClose={close} />
      : <SheetPreview key={open.i} item={items[open.i]} onClose={close} />,
    document.body,
  )

  return { cardProps, overlay }
}
