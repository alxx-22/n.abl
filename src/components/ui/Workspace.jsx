import { useCallback, useEffect, useRef } from 'react'

/* ============================================================
   THE LIST AND THE RECORD

   One layout for every screen in the CRM that is a list of things and
   the one you picked: Leads, the argument log, lead gen.

   The rule it keeps: you scroll to read the thing you are looking at,
   never to travel between parts of the screen.

   - On a phone or tablet the list and the record are never stacked.
     You see the list; pick something and you see the record, with a
     sticky bar holding "back to the list" and the record's sections.
     The list keeps its place, so going back lands where you were.
   - On a desktop they sit side by side at the height of the window and
     each scrolls on its own, so the page itself does not move.
   - A record is split into sections by a sub-ribbon of tabs rather than
     laid end to end, so reaching the argument log is one tap, not a
     scroll past the letter.

   Layout is .ws in crm.css; the breakpoint (900px) is in one place there.
   ============================================================ */

export function SplitView({ picked, list, detail, label = 'Records', className = '', innerRef }) {
  return (
    <div className={`ws ${picked ? 'is-picked' : ''} ${className}`} ref={innerRef}>
      <div className="ws__list" aria-label={label} role="region">{list}</div>
      <div className="ws__detail">{detail}</div>
    </div>
  )
}

/* The record's own header, in two parts.

   The title block - name, facts, the decisions that must be reachable
   from every section - scrolls away with the record.
   The nav row - back to the list, and the sections - stays: sticky under
   the main ribbon on a phone, at the top of the record's own scroller on
   a desktop. It is one row, so the sticky part of a phone screen is the
   ribbon and a strip of tabs, not a quarter of the glass. */
export function RecordBar({ title, sub, backLabel = 'All', onBack, actions, tabs }) {
  return (
    <>
      <div className="ws-bar">
        <div className="ws-bar__title">
          <h3>{title}</h3>
          {sub && <div className="ws-bar__sub">{sub}</div>}
        </div>
        {actions && <div className="ws-bar__actions">{actions}</div>}
      </div>
      <div className="ws-nav">
        {onBack && (
          <button type="button" className="ws-back" onClick={onBack} aria-label={backLabel}>
            <span aria-hidden="true">←</span>
          </button>
        )}
        {tabs}
      </div>
    </>
  )
}

/* A tablist with the keyboard behaviour a tablist is expected to have:
   arrows move, Home and End jump, only the active tab is in the tab order. */
export function SectionTabs({ tabs, active, onChange: change, label, idPrefix }) {
  const refs = useRef({})
  /* A new section starts at its top. If the reader had scrolled down the
     last one, the tabs are stuck at the top of the screen and the new
     section would open halfway down itself. */
  const onChange = (id) => {
    change(id)
    requestAnimationFrame(() => {
      const panel = document.getElementById(`${idPrefix}-panel-${id}`)
      const nav = refs.current[id]?.closest('.ws-nav')
      if (!panel || !nav) return
      if (panel.getBoundingClientRect().top < nav.getBoundingClientRect().bottom - 1) {
        panel.scrollIntoView({ block: 'start' })
      }
    })
  }
  const onKey = (e) => {
    const i = tabs.findIndex((t) => t.id === active)
    let next = null
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length]
    if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length]
    if (e.key === 'Home') next = tabs[0]
    if (e.key === 'End') next = tabs[tabs.length - 1]
    if (!next) return
    e.preventDefault()
    onChange(next.id)
    refs.current[next.id]?.focus()
  }
  return (
    <div className="tabs ws-tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${t.id}`}
          ref={(el) => { refs.current[t.id] = el }}
          aria-selected={t.id === active}
          aria-controls={`${idPrefix}-panel-${t.id}`}
          tabIndex={t.id === active ? 0 : -1}
          className={`tab ${t.id === active ? 'tab--active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count != null && t.count !== 0 && <span className="ws-tabs__count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function SectionPanel({ idPrefix, active, children }) {
  return (
    <div className="ws-panel" role="tabpanel" id={`${idPrefix}-panel-${active}`} aria-labelledby={`${idPrefix}-tab-${active}`}>
      {children}
    </div>
  )
}

/* Settings that are not the work: a panel that slides over the page
   instead of pushing the list down. Full screen on a phone, a side sheet
   on anything wider. Escape and the backdrop close it; focus goes in on
   open and back to whatever opened it on close. */
export function Sheet({ open, title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const before = document.activeElement
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      before?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="overlay ws-sheet__backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ws-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="ws-sheet__head">
          <h3>{title}</h3>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Close</button>
        </div>
        <div className="ws-sheet__body">{children}</div>
      </div>
    </div>
  )
}

const narrow = () => typeof window !== 'undefined' && window.matchMedia
  && !window.matchMedia('(min-width: 900px)').matches

/* Going between the list and a record on a narrow screen.

   pick(): remember where the list was scrolled to, then show the record
   from its top - the list is hidden, so without this the record would
   open wherever the list had been scrolled to, often past its tabs.
   back(): show the list again at exactly the place it was left.

   On a desktop both are visible and neither moves the page. */
export function usePickScroll(setPicked) {
  const ref = useRef(null)
  const listY = useRef(0)

  const pick = useCallback((id) => {
    const small = narrow()
    if (small) listY.current = window.scrollY
    setPicked(id)
    if (!small || !ref.current) return
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      const ribbon = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--crm-ribbon-h')) || 0
      const top = el.getBoundingClientRect().top + window.scrollY - ribbon
      if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top) })
    })
  }, [setPicked])

  const back = useCallback(() => {
    setPicked(null)
    requestAnimationFrame(() => window.scrollTo({ top: listY.current }))
  }, [setPicked])

  return { ref, pick, back }
}

/* Publishes the sticky ribbon's real height as --crm-ribbon-h, so a record
   bar can stick directly beneath it. The ribbon wraps to two rows below
   1000px and one above; a hard-coded number would be wrong on one of them. */
export function useRibbonHeight() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const root = document.documentElement
    const set = () => root.style.setProperty('--crm-ribbon-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => { ro.disconnect(); root.style.removeProperty('--crm-ribbon-h') }
  }, [])
  return ref
}
