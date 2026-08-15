import { useEffect, useMemo, useRef, useState } from 'react'
import { buildWelcomeDoc, summarise, transcriptPrompt } from '../lib/welcomeDoc.js'
import { Field } from './ui/index.jsx'

/* ============================================================
   Welcome pack composer.

   Paste the discovery-call transcript, get a branded welcome
   document carrying the client's portal key, the project goals,
   contacts and next steps.

   The goals section is the only part that needs a model. Two ways
   to fill it, chosen with the toggle:

   WRITE IT   — you paste the goals yourself, or paste what a model
                gave you. Works today, costs nothing, no key needed.
                Use "Copy prompt" to get a prompt for any chat window.

   SUMMARISE  — POSTs the transcript to a summarisation endpoint you
                configure (a Supabase Edge Function calling a model).
                Only offered when VITE_SUMMARISE_URL is set, so the
                button never appears promising something that is not
                wired up.

   Nothing is invented. With no goals supplied, that section is left
   out of the document rather than padded with generic filler.
   ============================================================ */

const SUMMARISE_URL = import.meta.env.VITE_SUMMARISE_URL || ''

export default function WelcomeDocModal({ client, ownerName, onClose, onSaveDocument }) {
  const [transcript, setTranscript] = useState('')
  const [goals, setGoals] = useState(null)
  const [mode, setMode] = useState(SUMMARISE_URL ? 'endpoint' : 'manual')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const html = useMemo(
    () => buildWelcomeDoc({ client, goals, owner: ownerName }),
    [client, goals, ownerName]
  )

  async function onGenerate() {
    setError('')
    if (!transcript.trim()) { setError('Paste the transcript or the goals first.'); return }
    setBusy(true)
    try {
      const result = await summarise(transcript, { mode, endpoint: SUMMARISE_URL })
      if (!result || (!result.summary && !result.goals.length)) {
        setError(mode === 'manual'
          ? 'Nothing usable found. Write a sentence of summary, then the goals as a bulleted or numbered list.'
          : 'The summariser returned nothing usable.')
      } else {
        setGoals(result)
      }
    } catch (e) {
      setError(e.message || 'Could not summarise — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onCopyPrompt() {
    try { await navigator.clipboard.writeText(transcriptPrompt(client, transcript)) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  function onPrint() {
    // Print from a detached window so the app's own styles never bleed in.
    const w = window.open('', '_blank', 'noopener,width=900,height=1000')
    if (!w) { setError('Your browser blocked the print window.'); return }
    w.document.write(html); w.document.close()
    w.addEventListener('load', () => w.print())
  }

  function onDownload() {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const slug = (client?.business_name || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    a.href = url; a.download = `nabl-welcome-${slug}.html`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  async function onSave() {
    if (!onSaveDocument) return
    setSaving(true); setError('')
    try { await onSaveDocument(html) ; onClose?.() }
    catch (e) { setError(e.message || 'Could not save to the portal.') }
    finally { setSaving(false) }
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="modal modal--doc edge" role="dialog" aria-modal="true"
           aria-label="Welcome document" tabIndex={-1} ref={dialogRef}>
        <button className="modal__close" onClick={onClose} aria-label="Close">&times;</button>

        <span className="eyebrow">Welcome pack</span>
        <h2 className="modal__title modal__title--lg">
          {client?.business_name || 'New client'}<span className="dot" />
        </h2>

        <div className="doc-grid">
          <div className="doc-input">
            <div className="seg" role="group" aria-label="How to fill the goals section">
              <button type="button" className={`seg__btn ${mode === 'manual' ? 'seg__btn--on' : ''}`}
                      onClick={() => setMode('manual')}>Write it</button>
              <button type="button"
                      className={`seg__btn ${mode === 'endpoint' ? 'seg__btn--on' : ''}`}
                      onClick={() => setMode('endpoint')}
                      disabled={!SUMMARISE_URL}
                      title={SUMMARISE_URL ? '' : 'Set VITE_SUMMARISE_URL to enable'}>
                Summarise
              </button>
            </div>

            <Field
              label={mode === 'manual' ? 'Goals' : 'Meeting transcript or notes'}
              htmlFor="wd-transcript"
              error={error}
              help={mode === 'manual'
                ? 'A sentence of summary, then the goals as a bulleted or numbered list. Or paste a model’s output.'
                : 'The full transcript. It is sent to your summarisation endpoint and is not stored here.'}
            >
              <textarea id="wd-transcript" className="input" rows={12} value={transcript}
                        placeholder={mode === 'manual'
                          ? 'We are replacing the Monday reporting pack with a scheduled flow.\n\n- Cut the weekly reporting effort to near zero\n- One version of the numbers everyone trusts'
                          : 'Paste the call transcript…'}
                        onChange={(e) => setTranscript(e.target.value)} />
            </Field>

            <div className="card-actions">
              <button className="btn btn--accent" onClick={onGenerate} disabled={busy}>
                {busy ? 'Working…' : goals ? 'Regenerate' : 'Build document'}
              </button>
              <button className="btn btn--ghost" onClick={onCopyPrompt} disabled={!transcript.trim()}>
                {copied ? 'Copied ✓' : 'Copy prompt'}
              </button>
            </div>
            <p className="field-help" style={{ marginTop: 'var(--s-2)' }}>
              {SUMMARISE_URL
                ? 'Summarise posts the transcript to your configured endpoint.'
                : 'No summarisation endpoint configured — “Copy prompt” gives you a prompt to paste into any chat window, then paste the result back here.'}
            </p>
          </div>

          <div className="doc-preview">
            <div className="doc-preview__bar">
              <span className="dim">Preview</span>
              {!goals && <span className="dim">goals section omitted until supplied</span>}
            </div>
            <iframe title="Welcome document preview" srcDoc={html} className="doc-preview__frame" />
          </div>
        </div>

        <div className="modal__actions modal__actions--wide">
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
          <button className="btn btn--ghost" onClick={onDownload}>Download HTML</button>
          <button className="btn btn--ghost" onClick={onPrint}>Print / PDF</button>
          {onSaveDocument && (
            <button className="btn btn--accent" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save to portal'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
