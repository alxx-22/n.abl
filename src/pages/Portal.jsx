import { useState } from 'react'
import PortalAssistant from '../components/PortalAssistant.jsx'
import { Link } from 'react-router-dom'
import { portalClient, signedUrl, friendlyError } from '../lib/supabase.js'
import { isGeneratedPack, fetchDocHtml, DocPage } from '../components/ui/index.jsx'
import { Logo, Reveal, EdgeCard, Empty, prefersReducedMotion } from '../components/ui/index.jsx'
import LitGround from '../components/LitGround.jsx'
import '../styles/portal.css'

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

/* Manjari has no arrows (brand-guidelines.md, 5.5): they are drawn. */
const Arrow = ({ back = false }) => (
  <svg className="p-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {back ? <path d="M19 12H6M11 7l-5 5 5 5" /> : <path d="M5 12h13M13 7l5 5-5 5" />}
  </svg>
)

/* A record's state as one of the brand's chips: the ember square for what
   waits on the client, the round ice dot for work that is live (breathing)
   or done (still), the amber square for what n.abl has arranged. The word
   is always there too, so the colour is never the only signal. */
const TONE = {
  sent: 'wait', review: 'wait', awaiting: 'wait', pending: 'wait',
  active: 'live', inprogress: 'live', live: 'live', building: 'live',
  accepted: 'done', approved: 'done', complete: 'done', completed: 'done', signed: 'done', paid: 'done',
  scheduled: 'nabl', confirmed: 'nabl', planning: 'nabl', booked: 'nabl',
}
function Status({ status }) {
  if (!status) return null
  const key = String(status).toLowerCase().replace(/[^a-z]/g, '')
  return <span className={`pchip pchip--${TONE[key] || 'plain'}`}>{status}</span>
}

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
      {busy ? 'Opening…' : failed ? 'Unable to load. Try again' : pack ? <>Open <Arrow /></> : children}
    </button>
  )
}

function Section({ id, label, title, count, children }) {
  return (
    <section id={id} className="p-section">
      <Reveal>
        <div className="p-section__head">
          <span className="eyebrow">{label}</span>
          {count > 0 && <span className="p-section__count">{count}</span>}
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="p-section__title">{title}<span className="dot" /></h2>
      </Reveal>
      <div className="p-section__body">{children}</div>
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
      <div className="lit portal">
        <LitGround story="quiet" />
        <div className="app-top p-top">
          <Link to="/" aria-label="n.abl home"><Logo size={22} /></Link>
          <Link to="/" className="p-back"><Arrow back /><span>Back to site</span></Link>
        </div>

        <div className="auth-wrap">
          <div className="auth-card p-auth">
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
              <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
                <span className="ring" aria-hidden="true"><i /></span>
                <span className="lbl">{loading ? 'Verifying…' : 'Open my portal'}</span>
                {!loading && <Arrow />}
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

  /* what needs the client, what is live, and when we next meet: the four
     things worth knowing before reading any further */
  const toReview = quotes.filter((q) => TONE[String(q.status || '').toLowerCase().replace(/[^a-z]/g, '')] === 'wait').length
  const live = projects.filter((p) => TONE[String(p.status || '').toLowerCase().replace(/[^a-z]/g, '')] === 'live').length
  const next = sortedMeetings.find((m) => m.datetime && new Date(m.datetime).getTime() >= now)
  const nextD = next ? new Date(next.datetime) : null

  return (
    <div className="lit portal">
      <LitGround story="quiet" />
      <div className="app-top p-top">
        <Link to="/" aria-label="n.abl home"><Logo size={22} /></Link>
        <div className="p-top__right">
          <span className="p-top__who">{me.business_name || 'Client portal'}</span>
          <button className="btn btn--ghost btn--sm" onClick={logOut}><span className="lbl">Log out</span></button>
        </div>
      </div>

      <div className="shell p-shell">
        <header className="p-head">
          <Reveal><span className="eyebrow">Welcome back</span></Reveal>
          <Reveal delay={0.05}>
            <h1 className="p-head__title">{me.business_name || 'Your dashboard'}<span className="dot" /></h1>
          </Reveal>
          {me.contact_name && <Reveal delay={0.1}><p className="p-head__sub">{me.contact_name}</p></Reveal>}
        </header>

        {/* AT A GLANCE */}
        <div className="p-glance">
          <Reveal delay={0.12}>
            <a className="p-stat" href="#quotes">
              <span className={`p-stat__k ${toReview ? 'is-wait' : ''}`}>Quotes</span>
              <b className="p-stat__n">{toReview || quotes.length}</b>
              <span className="p-stat__s">{toReview ? 'waiting for your review' : (quotes.length === 1 ? 'quote on file' : 'quotes on file')}</span>
            </a>
          </Reveal>
          <Reveal delay={0.16}>
            <a className="p-stat" href="#projects">
              <span className={`p-stat__k ${live ? 'is-live' : ''}`}>Projects</span>
              <b className="p-stat__n">{live || projects.length}</b>
              <span className="p-stat__s">{live ? 'being built now' : (projects.length === 1 ? 'project' : 'projects')}</span>
            </a>
          </Reveal>
          <Reveal delay={0.2}>
            <a className="p-stat" href="#meetings">
              <span className={`p-stat__k ${next ? 'is-nabl' : ''}`}>Next meeting</span>
              <b className="p-stat__n">{nextD && !isNaN(nextD) ? nextD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'None'}</b>
              <span className="p-stat__s">{next ? [next.title, !isNaN(nextD) ? timeStr(nextD) : null].filter(Boolean).join(' · ') : 'nothing booked yet'}</span>
            </a>
          </Reveal>
          <Reveal delay={0.24}>
            <a className="p-stat" href="#documents">
              <span className="p-stat__k">Files</span>
              <b className="p-stat__n">{documents.length}</b>
              <span className="p-stat__s">{documents.length === 1 ? 'document' : 'documents'}</span>
            </a>
          </Reveal>
        </div>

        {/* QUOTES */}
        <Section id="quotes" label="Quotes" title="Your quotes" count={quotes.length}>
          {quotes.length === 0 ? (
            <Empty>No quotes yet. We&rsquo;ll let you know when there&rsquo;s something to review.</Empty>
          ) : (
            <div className="grid grid--2 grid--3">
              {quotes.map((q, i) => (
                <Reveal key={q.id} delay={i * 0.05}>
                  <EdgeCard className="card-pad p-quote">
                    <div className="p-card__head">
                      {q.reference && <span className="p-ref">{q.reference}</span>}
                      <Status status={q.status} />
                    </div>
                    <h3 className="p-card__title">{q.title || 'Untitled quote'}</h3>
                    <div className="p-amount">{gbp(q.amount)}</div>
                    {q.valid_until && (
                      <div className="p-meta">Valid until {dateLong(q.valid_until)}</div>
                    )}
                    {q.pdf_url && (
                      <div className="card-actions">
                        <FileLink client={client} bucket="quotes" path={q.pdf_url}>View PDF <Arrow /></FileLink>
                      </div>
                    )}
                  </EdgeCard>
                </Reveal>
              ))}
            </div>
          )}
        </Section>

        {/* PROJECTS */}
        <Section id="projects" label="Projects" title="What we're building" count={projects.length}>
          {projects.length === 0 ? (
            <Empty>No active projects right now. Let&rsquo;s chat about what&rsquo;s next.</Empty>
          ) : (
            <div className="grid grid--2">
              {projects.map((p, i) => {
                const pct = Math.max(0, Math.min(100, Number(p.progress_percent) || 0))
                return (
                  <Reveal key={p.id} delay={i * 0.05}>
                    <EdgeCard className="card-pad p-project">
                      <div className="p-card__head">
                        <h3 className="p-card__title">{p.title || 'Untitled project'}</h3>
                        <Status status={p.status} />
                      </div>
                      {p.description && <p className="p-card__body">{p.description}</p>}
                      <div className="p-progress">
                        <div className="p-progress__row">
                          <span className="p-progress__k">Progress</span>
                          <span className="p-progress__v">{pct}% complete</span>
                        </div>
                        <div className="progress"><div className="progress__fill" style={{ '--p': pct / 100 }} /></div>
                      </div>
                      {(p.next_milestone || p.next_milestone_date) && (
                        <div className="p-next">
                          <span className="p-next__k">Next</span>
                          {p.next_milestone && <div className="p-next__t">{p.next_milestone}</div>}
                          {p.next_milestone_date && <div className="p-meta">Due {dateLong(p.next_milestone_date)}</div>}
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
        <Section id="meetings" label="Meetings" title="What's coming up" count={sortedMeetings.length}>
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
                    <EdgeCard className={`card-pad meeting ${past ? 'meeting--past' : ''}`}>
                      <div className="meeting__date">
                        <div className="meeting__day">{valid ? d.getDate() : '–'}</div>
                        <div className="meeting__my">{valid ? monthYear(d) : ''}</div>
                      </div>
                      <div>
                        <h3 className="p-card__title">{m.title || 'Meeting'}</h3>
                        <div className="p-meta">
                          {[m.location, valid ? timeStr(d) : null].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="meeting__right">
                        {m.status && <Status status={m.status} />}
                        {m.join_url && !past && (
                          <a className="btn btn--primary btn--sm" href={m.join_url} target="_blank" rel="noopener noreferrer">
                            <span className="ring" aria-hidden="true"><i /></span><span className="lbl">Join</span><Arrow />
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
        <Section id="documents" label="Documents" title="Your files" count={documents.length}>
          {documents.length === 0 ? (
            <Empty>Nothing here yet.</Empty>
          ) : (
            <div className="rows">
              {documents.map((doc, i) => (
                <Reveal key={doc.id} delay={i * 0.04}>
                  <EdgeCard className="card-pad doc">
                    <span className="doc__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                           stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 3 14 8 19 8" />
                        <path d="M9 13h6M9 17h4" />
                      </svg>
                    </span>
                    <div>
                      <h3 className="p-card__title p-card__title--sm">{doc.title || 'Document'}</h3>
                      {doc.document_type && <span className="p-ref">{doc.document_type}</span>}
                    </div>
                    <div className="doc__right">
                      {doc.uploaded_at && <span className="p-meta">{dateLong(doc.uploaded_at)}</span>}
                      <FileLink client={client} bucket="documents" path={doc.file_url}
                          onOpenDoc={setOpenDoc}>Download <Arrow /></FileLink>
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
