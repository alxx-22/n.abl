import { useCallback, useEffect, useMemo, useState } from 'react'
import { teamClient, friendlyError } from '../lib/supabase.js'
import { generateKey } from '../lib/teamConfig.js'
import { buildWelcomeDoc } from '../lib/welcomeDoc.js'
import { Field, Loading } from './ui/index.jsx'

/* ============================================================
   PIPELINE HANDOFF

   The two points where a lead stops being a lead:

     Proposal Sent  → the business needs a portal account and a key,
                      so the quote has somewhere to live.
     Won            → the client needs a welcome pack and an email
                      carrying that key.

   Both are prompted rather than silent. Issuing a credential and
   producing client-facing material are not things to do behind
   somebody's back on a dropdown change — but everything is filled
   in already, so confirming is one click.

   Both are idempotent. The lead is matched to a portal account by
   business name, which is also how a person would check. That has
   an obvious weakness with two similarly named businesses, so the
   match is shown rather than assumed, and an existing account is
   reported instead of being quietly duplicated.
   ============================================================ */

const PORTAL_URL = 'https://nabl.agency/portal'

/** The welcome email, filled in. Plain text: it is meant to be pasted
    into a real mail client and sent by a person, not blasted. */
export function welcomeEmail(client, ownerName) {
  const first = (client.contact_name || '').trim().split(' ')[0]
  return `Subject: Welcome to n.abl

Hi ${first || 'there'},

Thanks for choosing to work with us — welcome aboard.

Your client portal is live. Quotes, project progress, meetings and
documents all live there, so you can see where things are without
having to ask.

    Portal:      ${PORTAL_URL}
    Access key:  ${client.access_key}

Treat that key like a password: it is the only thing protecting your
information. Share it only with people who should see your account, and
tell us straight away if it goes somewhere it shouldn't — we can issue a
new one in minutes.

Your welcome pack is attached. It covers what happens next and who to
talk to.

Anything at all, just reply to this email.

${ownerName || 'Alex'}
n.abl
hello@nabl.agency
`
}

export default function PipelineHandoff({ lead, stage, ownerName, onClose, onDone }) {
  const sb = useMemo(() => teamClient(), [])
  const [phase, setPhase] = useState('checking')   // checking | form | ready | done
  const [client, setClient] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')

  const contact = lead?.contacts?.[0] || {}
  const [form, setForm] = useState({
    business_name: lead?.company || '',
    contact_name: contact.name || '',
    contact_email: contact.email || '',
    access_key: '',
  })

  // Does this business already have a portal account?
  useEffect(() => {
    let alive = true
    ;(async () => {
      const name = (lead?.company || '').trim()
      if (!name) { if (alive) { setError('This lead has no company name.'); setPhase('form') } return }
      const { data, error: err } = await sb.from('clients').select('*').ilike('business_name', name)
      if (!alive) return
      if (err) { setError(friendlyError(err, 'Could not check the portal.')); setPhase('form'); return }
      const found = (data || [])[0]
      if (found) { setClient(found); setPhase('ready') }
      else {
        setForm((f) => ({ ...f, access_key: f.access_key || generateKey(name) }))
        setPhase('form')
      }
    })()
    return () => { alive = false }
  }, [sb, lead])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const createAccount = useCallback(async () => {
    setError('')
    if (!form.business_name.trim()) { setError('A business name is required.'); return }
    if (!form.access_key.trim()) { setError('An access key is required.'); return }
    setBusy(true)
    const { data, error: err } = await sb.from('clients').insert({
      business_name: form.business_name.trim(),
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      access_key: form.access_key.trim(),
    }).select().single()
    setBusy(false)
    if (err || !data) { setError(friendlyError(err, 'Could not create the portal account.')); return }
    setClient(data)
    setPhase('ready')
    onDone?.(data)
  }, [sb, form, onDone])

  const copy = async (what, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1600) }
    catch { setError('Could not copy — select the text and copy it manually.') }
  }

  const downloadPack = () => {
    const html = buildWelcomeDoc({ client, owner: ownerName })
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `welcome-pack-${(client.business_name || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const quoting = stage === 'Proposal Sent'
  const title = quoting ? 'Set up the portal account' : 'Hand over to the client'

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="modal modal--doc edge" role="dialog" aria-modal="true" aria-label={title}>
        <button className="modal__close" onClick={onClose} aria-label="Close">&times;</button>
        <span className="eyebrow">{lead?.company}</span>
        <h2 className="modal__title modal__title--lg">{title}<span className="dot" /></h2>

        {phase === 'checking' && <Loading label="Checking the portal" />}

        {phase === 'form' && (
          <>
            <p className="modal__body">
              {quoting
                ? 'Moving to Proposal Sent means this business needs somewhere to read the quote. Creating the account now issues its access key.'
                : 'This lead has been won but has no portal account yet. Create one first — the welcome pack is built around its key.'}
            </p>
            <div className="modal__form">
              <Field label="Business name" required htmlFor="ph-name">
                <input id="ph-name" className="input" value={form.business_name}
                       onChange={(e) => set('business_name', e.target.value)} />
              </Field>
              <Field label="Contact name" htmlFor="ph-contact">
                <input id="ph-contact" className="input" value={form.contact_name}
                       onChange={(e) => set('contact_name', e.target.value)} />
              </Field>
              <Field label="Contact email" htmlFor="ph-email">
                <input id="ph-email" className="input" type="email" value={form.contact_email}
                       onChange={(e) => set('contact_email', e.target.value)} />
              </Field>
              <Field label="Access key" required htmlFor="ph-key"
                     help="Generated with a CSPRNG. Regenerate if you would rather issue a different one.">
                <div className="keyrow">
                  <input id="ph-key" className="input mono" value={form.access_key}
                         onChange={(e) => set('access_key', e.target.value)} />
                  <button type="button" className="btn btn--ghost btn--sm"
                          onClick={() => set('access_key', generateKey(form.business_name))}>Generate</button>
                </div>
              </Field>
              <p className="auth-error" role="alert">{error}</p>
              <button className="btn btn--accent" disabled={busy} onClick={createAccount}>
                {busy ? 'Creating…' : 'Create portal account →'}
              </button>
            </div>
          </>
        )}

        {phase === 'ready' && client && (
          <>
            <p className="modal__body">
              {quoting
                ? 'This business already has a portal account, so nothing was created. Its key is below.'
                : 'Everything the client needs is ready. The pack is a single self-contained file; the email carries the key.'}
            </p>

            <div className="keybox">
              <div className="keylabel">Access key</div>
              <code className="mono keycell__key">{client.access_key}</code>
              <button type="button" className="btn btn--ghost btn--sm"
                      onClick={() => copy('key', client.access_key)}>
                {copied === 'key' ? 'Copied' : 'Copy'}
              </button>
            </div>

            {!quoting && (
              <div className="modal__form" style={{ marginTop: 'var(--s-4)' }}>
                <button className="btn btn--accent" onClick={downloadPack}>Download the welcome pack</button>
                <button className="btn btn--ghost"
                        onClick={() => copy('email', welcomeEmail(client, ownerName))}>
                  {copied === 'email' ? 'Email copied' : 'Copy the welcome email'}
                </button>
                <p className="field-help">
                  The email is plain text so it can be pasted into a real mail client and sent by a
                  person. Attach the pack before sending.
                </p>
              </div>
            )}

            <p className="auth-error" role="alert">{error}</p>
            <div className="modal__actions" style={{ marginTop: 'var(--s-5)' }}>
              <button className="btn btn--ghost" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
