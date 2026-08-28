import { useState } from 'react'
import PortalAssistant from '../components/PortalAssistant.jsx'
import { Link } from 'react-router-dom'
import { portalClient, signedUrl, friendlyError } from '../lib/supabase.js'
import { isGeneratedPack, fetchDocHtml, DocPage } from '../components/ui/index.jsx'
import { Logo, Reveal, EdgeCard, Badge, Empty, Loading, prefersReducedMotion } from '../components/ui/index.jsx'

/* ============================================================
   CLIENT PORTAL
   Access key -> RLS-scoped read of that client's own records.
   The key lives in component state only: never localStorage,
   never a cookie, never logged.
   ============================================================ */

const gbp = (n) => {
  const num = Number(n)
  if (!isFinite(num)) return '£0.00'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(num)
}
const dateLong = (v) => {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
const monthYear = (d) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase()
const timeStr = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/* A file link that mints a fresh signed URL at click time.
   Signed URLs are never cached or persisted. */
function FileLink({ client, bucket, path, children, onOpenDoc, className = 'btn btn--ghost btn--sm' }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!path) return null
  const pack = isGeneratedPack(path)
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        // a tab is only opened for files we hand to the browser; the pack is
        // shown as a page, so opening one here would leave a blank window
        const tab = pack ? null : window.open('', '_blank')
        setBusy(true); setFailed(false)
        const url = await signedUrl(client, bucket, path)
        let ok = false
        if (url && pack) {
          const html = await fetchDocHtml(url)
          if (html) { onOpenDoc?.(html); ok = true }
        } else if (url) {
          ok = true
          if (tab) tab.location.replace(url)
          else window.open(url, '_blank', 'noopener')
        } else tab?.close()
        if (!ok) tab?.close()
        setBusy(false)
        if (!ok) { setFailed(true); setTimeout(() => setFailed(false), 3000) }
      }}
    >
      {busy ? 'Opening…' : failed ? 'Unable to load — try again' : pack ? 'Open →' : children}
    </button>
  )
}

function Section({ label, title, children }) {
  return (
    <section className="section" style={{ paddingBlock: 'var(--s-7)' }}>
      <Reveal><span className="eyebrow">{label}</span></Reveal>
      <Reveal delay={0.05}>
        <h2 className="section__title" style={{ fontSize: 'var(--t-2xl)' }}>
          {title}<span className="dot" />
        </h2>
      </Reveal>
      <div style={{ marginTop: 'var(--s-5)' }}>{children}</div>
    </section>
  )
}

export default function Portal() {
  const [key, setKey] = useState('')
  const [client, setClient] = useState(null)   // supabase client bound to the key
  const [me, setMe] = useState(null)           // the clients row
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  // the generated pack, when it is open as a page of its own
  const [openDoc, setOpenDoc] = useState(null)

  function fail(msg) {
    setError(msg)
    if (!prefersReducedMotion()) { setShake(false); requestAnimationFrame(() => setShake(true)) }
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const k = key.trim().toUpperCase()
    if (!k) { fail('Please enter your access key.'); return }

    setLoading(true)
    try {
      const sb = portalClient(k)
      // Sign in through the throttled RPC rather than selecting from `clients`
      // directly. The access key is the only credential guarding this data, so
      // the login path is rate limited per source IP server-side (10 failures
      // in 15 minutes) and every attempt is logged by fingerprint, never by key.
      const { data: rows, error: err } = await sb.rpc('portal_login', { p_key: k })
      if (err) {
        setLoading(false)
        // P0001 is the lockout raised by portal_login.
        if (err.code === 'P0001' || /too many attempts/i.test(err.message || '')) {
          fail('Too many attempts. Please wait 15 minutes and try again.')
          return
        }
        const m = friendlyError(err, 'Unable to load. Please try again in a moment.')
        fail(m === 'SESSION_EXPIRED' ? 'Unable to load. Please try again in a moment.' : m)
        return
      }
      if (!rows || rows.length === 0) {
        setLoading(false)
        fail('Invalid access key. Please check and try again.')
        return
      }
      // Valid — load the dashboard. Each table degrades to [] independently.
      const safe = async (q) => {
        try { const { data: d, error: e2 } = await q; return e2 ? [] : (d || []) } catch { return [] }
      }
      const [quotes, projects, meetings, documents] = await Promise.all([
        safe(sb.from('quotes').select('*').order('created_at', { ascending: false })),
        safe(sb.from('projects').select('*')),           // no created_at column on projects
        safe(sb.from('meetings').select('*').order('datetime')),
        safe(sb.from('documents').select('*').order('uploaded_at', { ascending: false })),
      ])
      setClient(sb)
      /* Store the normalised key, not what was typed. Login works either way
         because it sends `k`, but everything downstream reads this state —
         and the assistant's edge function matches the key exactly, so a
         lowercase entry would sign in here and be rejected there. */
      setKey(k)
      setMe(rows[0])
      setData({ quotes, projects, meetings, documents })
      setLoading(false)
    } catch (err) {
      setLoading(false)
      fail('Unable to reach the server. A browser extension or network may be blocking it.')
    }
  }

  function logOut() {
    setClient(null); setMe(null); setData(null); setKey(''); setError('')
  }

  /* ---------------- LOGIN ---------------- */
  if (!me) {
    return (
      <div className="grain">
        <div className="app-top">
          <Link to="/" aria-label="n.abl home"><Logo size={22} /></Link>
          <Link to="/" className="app-back">← Back to site</Link>
        </div>

        <div className="auth-wrap">
          <div className="auth-card">
            <span className="eyebrow">Client portal</span>
            <h1>Enter your access key<span className="dot" /></h1>
            <p className="auth-card__sub">
              Your private space for quotes, projects, meetings and documents.
            </p>
            <form className="auth-form" onSubmit={onSubmit} noValidate>
              <input
                className={`input portal-key ${shake ? 'shake' : ''}`}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                onAnimationEnd={() => setShake(false)}
                placeholder="XXXX-XXXX-XXXX"
                aria-label="Access key"
                autoComplete="off"
                spellCheck="false"
              />
              <button className="btn btn--accent btn--block" disabled={loading}>
                {loading ? 'Verifying…' : 'Access portal →'}
              </button>
              <p className="auth-error" role="alert" aria-live="assertive">{error}</p>
            </form>
            <p className="auth-help">
              Don&rsquo;t have a key? Contact <a href="mailto:hello@nabl.agency">hello@nabl.agency</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ---------------- DASHBOARD ---------------- */
  const { quotes, projects, meetings, documents } = data
  const now = Date.now()
  const sortedMeetings = [...meetings].sort((a, b) => {
    const ta = a.datetime ? new Date(a.datetime).getTime() : Infinity
    const tb = b.datetime ? new Date(b.datetime).getTime() : Infinity
    const ap = ta < now, bp = tb < now
    if (ap !== bp) return ap ? 1 : -1        // past sinks below upcoming
    return ap ? tb - ta : ta - tb
  })

  /* The pack takes over the whole screen when it is open, rather than
     layering over the dashboard: it is a document to read, not a dialogue. */
  if (openDoc) {
    return <DocPage title="Welcome pack" html={openDoc} onBack={() => setOpenDoc(null)} />
  }

  return (
    <div className="grain">
      <div className="app-top">
        <Link to="/" aria-label="n.abl home"><Logo size={22} /></Link>
        <button className="btn btn--ghost btn--sm" onClick={logOut}>Log out</button>
      </div>

      <div className="shell" style={{ paddingBottom: 'var(--s-9)' }}>
        <header style={{ paddingTop: 'var(--s-8)' }}>
          <Reveal><span className="eyebrow">Welcome back</span></Reveal>
          <Reveal delay={0.05}>
            <h1 style={{ fontSize: 'var(--t-3xl)', margin: 'var(--s-3) 0 var(--s-2)' }}>
              {me.business_name || 'Your dashboard'}<span className="dot" />
            </h1>
          </Reveal>
          {me.contact_name && <Reveal delay={0.1}><p className="muted">{me.contact_name}</p></Reveal>}
        </header>

        {/* QUOTES */}
        <Section label="Quotes" title="Your quotes">
          {quotes.length === 0 ? (
            <Empty>No quotes yet. We&rsquo;ll let you know when there&rsquo;s something to review.</Empty>
          ) : (
            <div className="grid grid--2 grid--3">
              {quotes.map((q, i) => (
                <Reveal key={q.id} delay={i * 0.05}>
                  <EdgeCard className="card-pad">
                    {q.reference && <div className="eyebrow">{q.reference}</div>}
                    <h3 style={{ fontSize: 'var(--t-lg)', margin: 'var(--s-3) 0' }}>
                      {q.title || 'Untitled quote'}
                    </h3>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700,
                      fontSize: 'var(--t-2xl)', color: 'var(--accent-400)',
                      marginBottom: 'var(--s-3)',
                    }}>{gbp(q.amount)}</div>
                    <Badge status={q.status}>{q.status}</Badge>
                    {q.valid_until && (
                      <div className="dim" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s-3)' }}>
                        Valid until {dateLong(q.valid_until)}
                      </div>
                    )}
                    {q.pdf_url && (
                      <div className="card-actions">
                        <FileLink client={client} bucket="quotes" path={q.pdf_url}>View PDF →</FileLink>
                      </div>
                    )}
                  </EdgeCard>
                </Reveal>
              ))}
            </div>
          )}
        </Section>

        {/* PROJECTS */}
        <Section label="Projects" title="What we're building">
          {projects.length === 0 ? (
            <Empty>No active projects right now. Let&rsquo;s chat about what&rsquo;s next.</Empty>
          ) : (
            <div className="grid grid--2">
              {projects.map((p, i) => {
                const pct = Math.max(0, Math.min(100, Number(p.progress_percent) || 0))
                return (
                  <Reveal key={p.id} delay={i * 0.05}>
                    <EdgeCard className="card-pad">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s-3)' }}>
                        <h3 style={{ fontSize: 'var(--t-lg)' }}>{p.title || 'Untitled project'}</h3>
                        <Badge status={p.status}>{p.status}</Badge>
                      </div>
                      {p.description && (
                        <p className="muted" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s-3)' }}>
                          {p.description}
                        </p>
                      )}
                      <div className="progress" style={{ marginTop: 'var(--s-5)' }}>
                        <div className="progress__fill" style={{ '--p': pct / 100 }} />
                      </div>
                      <div style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s-2)' }}>{pct}% complete</div>
                      {(p.next_milestone || p.next_milestone_date) && (
                        <div style={{
                          marginTop: 'var(--s-4)', paddingTop: 'var(--s-4)',
                          borderTop: '1px solid var(--line)',
                        }}>
                          <div className="eyebrow">Next</div>
                          {p.next_milestone && <div style={{ marginTop: 'var(--s-2)' }}>{p.next_milestone}</div>}
                          {p.next_milestone_date && (
                            <div className="dim" style={{ fontSize: 'var(--t-sm)' }}>
                              Due {dateLong(p.next_milestone_date)}
                            </div>
                          )}
                        </div>
                      )}
                    </EdgeCard>
                  </Reveal>
                )
              })}
            </div>
          )}
        </Section>

        {/* MEETINGS */}
        <Section label="Meetings" title="What's coming up">
          {sortedMeetings.length === 0 ? (
            <Empty>
              Nothing scheduled. Want to book a call?{' '}
              <a href="mailto:hello@nabl.agency">hello@nabl.agency</a>
            </Empty>
          ) : (
            <div className="rows">
              {sortedMeetings.map((m, i) => {
                const d = m.datetime ? new Date(m.datetime) : null
                const valid = d && !isNaN(d)
                const past = valid && d.getTime() < now
                return (
                  <Reveal key={m.id} delay={i * 0.04}>
                    <EdgeCard className="card-pad meeting" style={past ? { opacity: 0.6 } : undefined}>
                      <div className="meeting__date">
                        <div className="meeting__day">{valid ? d.getDate() : '–'}</div>
                        <div className="meeting__my">{valid ? monthYear(d) : ''}</div>
                      </div>
                      <div>
                        <h3 style={{ fontSize: 'var(--t-lg)' }}>{m.title || 'Meeting'}</h3>
                        <div className="dim" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s-1)' }}>
                          {[m.location, valid ? timeStr(d) : null].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="meeting__right">
                        {m.status && <Badge status={m.status}>{m.status}</Badge>}
                        {m.join_url && !past && (
                          <a className="btn btn--accent btn--sm" href={m.join_url} target="_blank" rel="noopener noreferrer">
                            Join →
                          </a>
                        )}
                      </div>
                    </EdgeCard>
                  </Reveal>
                )
              })}
            </div>
          )}
        </Section>

        {/* DOCUMENTS */}
        <Section label="Documents" title="Your files">
          {documents.length === 0 ? (
            <Empty>Nothing here yet.</Empty>
          ) : (
            <div className="rows">
              {documents.map((doc, i) => (
                <Reveal key={doc.id} delay={i * 0.04}>
                  <EdgeCard className="card-pad doc">
                    <span className="doc__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
                           stroke="var(--accent-400)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 3 14 8 19 8" />
                      </svg>
                    </span>
                    <div>
                      <h3 style={{ fontSize: 'var(--t-base)' }}>{doc.title || 'Document'}</h3>
                      {doc.document_type && <div className="eyebrow" style={{ marginTop: 'var(--s-1)' }}>{doc.document_type}</div>}
                    </div>
                    <div className="doc__right">
                      {doc.uploaded_at && <span className="dim" style={{ fontSize: 'var(--t-sm)' }}>{dateLong(doc.uploaded_at)}</span>}
                      <FileLink client={client} bucket="documents" path={doc.file_url}
                          onOpenDoc={setOpenDoc}>Download →</FileLink>
                    </div>
                  </EdgeCard>
                </Reveal>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* The key is passed straight from state and never leaves memory: it is
          not stored, not logged, and never reaches the model prompt. It is
          what the edge function resolves to decide whose record to load. */}
      <PortalAssistant accessKey={key} clientName={me?.business_name} />
    </div>
  )
}
