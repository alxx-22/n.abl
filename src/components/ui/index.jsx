import { useEffect, useRef, useState, useCallback } from 'react'

/* ============================================================
   n.abl UI KIT
   reactbits-derived effects, rebuilt for the warm-dark theme.
   Every animation degrades cleanly under prefers-reduced-motion.
   ============================================================ */

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- The same preference, but live ----------

   prefersReducedMotion() answers for the instant it is called, and every
   JS-driven animation on the site called it once inside a mount effect. So
   the CSS half of the site honoured a visitor who turned the preference on
   mid-visit — a media query is live, the keyframes stop that moment — while
   the canvas, the parallax and the reveals carried on moving until a reload.
   Half the site obeying is worse than neither half, because the visitor has
   no way to tell which half will.

   This subscribes instead of sampling. Effects that list the returned value
   as a dependency tear down and rebuild when it flips, so motion stops on
   the change rather than on the next page load. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    // Re-read once on mount, to close the gap between the render that
    // sampled the initial value and this effect committing.
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/* ---------- Pointer spotlight ----------
   Writes --mx/--my on the element so CSS can place a radial bloom
   under the cursor. Pointer-events driven, no per-frame React state. */
export function usePointerGlow() {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Clear the last position on the way out, or the bloom stays frozen
    // wherever the cursor happened to be when the preference was turned on.
    if (reduced) {
      el.style.removeProperty('--mx')
      el.style.removeProperty('--my')
      return
    }
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
    }
    el.addEventListener('pointermove', onMove)
    return () => el.removeEventListener('pointermove', onMove)
  }, [reduced])
  return ref
}

/* ---------- Scroll reveal ----------
   One IntersectionObserver per element, unobserved after firing. */
/* Reveal on enter AND on exit.

   This used to fire once and unobserve, so anything scrolled past stayed
   visible forever and scrolling back up showed a static page. The observer
   now stays live and the element tracks which edge it left by, so content
   rises in from below and lifts away upward — the motion always follows the
   direction of travel rather than snapping back the way it came.

   entry.boundingClientRect.top < 0 means the element left past the top of
   the viewport; otherwise it left past the bottom. */
export function useReveal(options = {}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Reveal everything and keep the observer torn down: with the preference
    // on there is no enter or exit state to track, only content that is
    // simply there. Clearing the exit classes matters because the element may
    // have been parked in one when the preference flipped.
    if (reduced) { el.classList.add('in'); el.classList.remove('out-up', 'out-down'); return }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const t = entry.target
          if (entry.isIntersecting) {
            t.classList.add('in')
            t.classList.remove('out-up', 'out-down')
            return
          }
          /* HYSTERESIS.

             Entry and exit must not share a boundary. With one inset
             margin, an element parked near the top edge flips in/out on
             every tiny scroll and the animation replays continuously —
             which is exactly the flicker this had.

             So: reveal on the inset margin (things settle before the very
             edge), but only un-reveal once the element is COMPLETELY clear
             of the real viewport. Anything still touching the screen stays
             revealed, so there is a wide dead zone between the two states
             and no amount of jiggling at the boundary can oscillate it. */
          const r = entry.boundingClientRect
          const vh = window.innerHeight || document.documentElement.clientHeight
          const fullyAbove = r.bottom <= 0
          const fullyBelow = r.top >= vh
          if (!fullyAbove && !fullyBelow) return   // still on screen — leave it alone

          t.classList.remove('in')
          t.classList.toggle('out-up', fullyAbove)
          t.classList.toggle('out-down', fullyBelow)
        })
      },
      {
        threshold: options.threshold ?? 0,
        // Inset governs ENTRY only; exit is decided above against the real
        // viewport, which is what creates the gap between the two states.
        rootMargin: options.rootMargin ?? '-10% 0px -10% 0px',
      }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [reduced, options.threshold, options.rootMargin])
  return ref
}

/** Fade + rise on scroll, both directions. `delay` staggers siblings.
    The delay is passed as a custom property so CSS can apply it on entry
    only — a staggered exit reads as lag, not choreography. */
export function Reveal({ children, delay = 0, as: Tag = 'div', className = '', ...rest }) {
  const ref = useReveal()
  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={{ '--reveal-delay': `${delay}s`, ...(rest.style || {}) }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** Card with a gradient edge that lights up, plus optional cursor spotlight. */
export function EdgeCard({
  children, className = '', spotlight = true, lift = true, rotate = false, as: Tag = 'div', ...rest
}) {
  const ref = usePointerGlow()
  const cls = [
    'edge',
    lift && 'edge--lift',
    rotate && 'edge--rotate',
    spotlight && 'spot',
    className,
  ].filter(Boolean).join(' ')
  return <Tag ref={spotlight ? ref : undefined} className={cls} {...rest}>{children}</Tag>
}

/* Brand wordmark — drawn, not set in a typeface.

   It used to be text in the display face plus a square span. That put a
   typeface's lowercase n next to the mark's drawn one, and they disagreed:
   the drawn n has a true semicircular shoulder, which is what plays against
   the square dot, while the typeface's squarer shoulder competes with it.

   These are the same paths as public/brand/{mark,wordmark}.svg, inlined so
   they inherit currentColor, cost no extra request, and stay crisp at any
   size. One construction throughout: a 13-unit monoline stroke with butt
   caps, every curve a true circle, x-height 21.5-82, ascenders from 6. */
export function Logo({ size = 26, showWord = true, className = '' }) {
  const w = showWord ? 273 : 104
  // The viewBox is 100 tall but the letterforms occupy 6..82, so scale up a
  // little to keep the optical size matching the old text at the same `size`.
  const height = size * 1.28
  return (
    <svg
      className={`nabl-logo ${className}`}
      viewBox={`0 0 ${w} 100`}
      height={height}
      width={(height * w) / 100}
      role="img"
      aria-label="n.abl"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="butt">
        <path d="M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82" />
        {/* Spacing is optical: gaps of 7 / 7 / 13 / 10 between outer edges.
            The a-b gap is widest because two flat verticals read tighter than
            a curve facing a vertical. See public/brand/wordmark.svg. */}
        {showWord && (
          <>
            <circle cx="128.25" cy="51.75" r="23.75" />
            <path d="M152 21.5 L152 82" />
            <path d="M178 6 L178 82" />
            <circle cx="201.75" cy="51.75" r="23.75" />
            <path d="M248.5 6 L248.5 82" />
          </>
        )}
      </g>
      <rect className="nabl-logo__dot" x="78" y="69" width="13" height="13" />
    </svg>
  )
}

/** Accessible field wrapper: label, control, error and help text. */
export function Field({ label, required, error, help, htmlFor, children }) {
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}{required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {help && <span className="field-help">{help}</span>}
      <span className="field-error" role={error ? 'alert' : undefined}>{error || ''}</span>
    </div>
  )
}

export function Badge({ status, children }) {
  const key = String(status || '').toLowerCase().trim().replace(/[^a-z]/g, '')
  return <span className={`badge badge--${key}`}>{children ?? status}</span>
}

/* ---------- Confirmation modal ----------
   Escape and backdrop both cancel; focus moves to the dialog on open. */
export function ConfirmModal({ open, title, body, confirmLabel = 'Delete', onConfirm, onCancel }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel?.() }}>
      <div className="modal edge" role="alertdialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialogRef}>
        <h3 className="modal__title">{title}</h3>
        <p className="modal__body">{body}</p>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

/** Transient status message. Returns [node, show()]. */
export function useToast() {
  const [msg, setMsg] = useState(null)
  const timer = useRef(null)
  const show = useCallback((text, ms = 1800) => {
    setMsg(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), ms)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const node = (
    <div className={`toast ${msg ? 'toast--show' : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  )
  return [node, show]
}

/** Centred loading state in brand voice. */
export function Loading({ label = 'Loading' }) {
  return <div className="loading"><span className="eyebrow">{label}</span></div>
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}
