import { useEffect, useRef, useState, useCallback } from 'react'

/* ============================================================
   n.abl UI KIT
   reactbits-derived effects, rebuilt for the warm-dark theme.
   Every animation degrades cleanly under prefers-reduced-motion.
   ============================================================ */

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- Pointer spotlight ----------
   Writes --mx/--my on the element so CSS can place a radial bloom
   under the cursor. Pointer-events driven, no per-frame React state. */
export function usePointerGlow() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
    }
    el.addEventListener('pointermove', onMove)
    return () => el.removeEventListener('pointermove', onMove)
  }, [])
  return ref
}

/* ---------- Scroll reveal ----------
   One IntersectionObserver per element, unobserved after firing. */
export function useReveal(options = {}) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) { el.classList.add('in'); return }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { entry.target.classList.add('in'); obs.unobserve(entry.target) }
        })
      },
      { threshold: options.threshold ?? 0.15, rootMargin: options.rootMargin ?? '0px 0px -8% 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [options.threshold, options.rootMargin])
  return ref
}

/** Fade + rise on scroll. `delay` staggers siblings. */
export function Reveal({ children, delay = 0, as: Tag = 'div', className = '', ...rest }) {
  const ref = useReveal()
  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delay}s`, ...(rest.style || {}) }}
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

/** Brand wordmark. Rendered as text + a square dot so it stays crisp and themeable. */
export function Logo({ size = 26, showWord = true, className = '' }) {
  return (
    <span
      className={`nabl-logo ${className}`}
      style={{ fontSize: size }}
      aria-label="n.abl"
      role="img"
    >
      <span aria-hidden="true">n</span>
      <i className="nabl-logo__dot" aria-hidden="true" />
      {showWord && <span aria-hidden="true">abl</span>}
    </span>
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
