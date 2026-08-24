import { useEffect, useRef, useState } from 'react'
import { Field } from './ui/index.jsx'
import { track } from '../lib/analytics.js'

const BUSINESS_TYPES = [
  'Retail', 'Professional Services', 'Technology',
  'Manufacturing', 'Healthcare', 'Finance', 'Other',
]

/* Live Web3Forms endpoint carried over from the previous site — the access
   key is a public form token by design. */
const WEB3FORMS_KEY = '2a4cc07f-441a-4bfe-8b85-586418d676ee'

/* `prefill` lets the assistant hand a visitor over with what they already
   said filled in. It is a defaultValue rather than a controlled value on
   purpose: the visitor must be able to edit or delete it before sending, and
   the assistant's summary is a starting point, not a submission. */
export default function DiscoveryModal({ open, onClose, prefill = '' }) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const firstFieldRef = useRef(null)
  const dialogRef = useRef(null)
  const lastFocus = useRef(null)

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => firstFieldRef.current?.focus(), 180)

    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return }
      // Focus trap — the previous site had none; keep the dialog contained.
      if (e.key !== 'Tab') return
      const nodes = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!nodes?.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      lastFocus.current?.focus?.()
    }
  }, [open, onClose])

  // Reset back to the form the next time it opens.
  useEffect(() => { if (!open) { setDone(false); setError(''); setSending(false) } }, [open])

  if (!open) return null

  async function onSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget
    if (!form.checkValidity()) { form.reportValidity(); return }

    /* Honeypot. A field no human sees and no human fills; a bot that
       walks the DOM fills everything. Show the success state rather
       than an error, so a scripted submitter gets no signal about why
       it failed and nothing is sent on. */
    if (new FormData(form).get('company_website')) { setDone(true); return }

    setError('')
    setSending(true)
    track('form_submit')
    const fd = new FormData(form)
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: 'New Discovery Call Request — n.abl Website',
          from_name: 'n.abl Website',
          name: fd.get('fullName'),
          business: fd.get('businessName'),
          email: fd.get('email'),
          business_type: fd.get('businessType'),
          notes: fd.get('challenge'),
        }),
      })
      const data = await res.json()
      if (data.success) { track('form_success'); setDone(true) }
      else {
        track('form_error')
        setError('Something went wrong. Email hello@nabl.agency and we’ll pick it up.')
      }
    } catch {
      track('form_error')
      setError('Couldn’t send just now. Email hello@nabl.agency and we’ll pick it up.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div
        className="modal modal--wide edge"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discovery-heading"
        ref={dialogRef}
      >
        <button className="modal__close" onClick={onClose} aria-label="Close">&times;</button>

        {done ? (
          <div className="modal__success">
            <div className="tick" aria-hidden="true" />
            <h2 id="discovery-heading" className="modal__title">You&rsquo;re on the list<span className="dot" /></h2>
            {/* No response-time promise: nothing measures one, and this
                is the moment a visitor is most likely to hold us to it. */}
            <p className="modal__body">
              We&rsquo;ll be in touch to find a time. Nothing to prepare — just bring the
              thing that&rsquo;s getting in the way.
            </p>
            <button className="btn btn--primary btn--block" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <span className="eyebrow">Discovery call</span>
            <h2 id="discovery-heading" className="modal__title modal__title--lg">
              Let&rsquo;s find out what&rsquo;s possible<span className="dot" />
            </h2>
            <p className="modal__body">
              Free, 30 minutes, no pitch. Tell us a little and we&rsquo;ll come prepared.
            </p>

            <form onSubmit={onSubmit} noValidate className="modal__form">
              <Field label="Your name" required htmlFor="d-name">
                <input ref={firstFieldRef} id="d-name" name="fullName" className="input" required autoComplete="name" />
              </Field>
              <Field label="Business name" required htmlFor="d-business">
                <input id="d-business" name="businessName" className="input" required autoComplete="organization" />
              </Field>
              <Field label="Email" required htmlFor="d-email">
                <input id="d-email" name="email" type="email" className="input" required autoComplete="email" />
              </Field>
              <Field label="Business type" required htmlFor="d-type">
                <select id="d-type" name="businessType" className="input" required defaultValue="">
                  <option value="" disabled>Select one…</option>
                  {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="What's getting in the way?" htmlFor="d-challenge">
                <textarea id="d-challenge" name="challenge" className="input" rows={4}
                  key={prefill}
                  defaultValue={prefill}
                  placeholder="The report that takes all Monday, the inbox nobody owns…" />
              </Field>

              {/* Honeypot. aria-hidden and out of the tab order so it is
                  invisible to screen readers and keyboard users alike. */}
              <div className="hp" aria-hidden="true">
                <label htmlFor="d-company-website">Company website</label>
                <input
                  id="d-company-website"
                  name="company_website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <button type="submit" className="btn btn--accent btn--block" disabled={sending}>
                {sending ? 'Sending…' : 'Book my discovery call'}
              </button>
              {error && <p className="auth-error" role="alert">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
