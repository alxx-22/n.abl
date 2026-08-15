import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { teamClient, signedUrl, friendlyError } from '../lib/supabase.js'
import {
  Logo, Field, Badge, EdgeCard, ConfirmModal, useToast, Loading, Empty, prefersReducedMotion,
} from '../components/ui/index.jsx'
import {
  TABS, TAB_LABEL, ADD_LABEL, SAVE_LABEL, EMPTY_MSG, ORDER, FIELDS,
  gbp, dateLong, monthYear, timeStr, toLocalInput, generateKey,
  baseName, fmtSize, storagePath, displayName,
} from '../lib/teamConfig.js'

/* ============================================================
   TEAM SPACE — Supabase Auth + five CRUD tabs
   ============================================================ */

export default function Team() {
  const sb = useMemo(() => teamClient(), [])
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    let alive = true
    sb.auth.getSession()
      .then(({ data }) => { if (alive) { setUser(data?.session?.user ?? null); setBooting(false) } })
      .catch(() => { if (alive) setBooting(false) })

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') { setUser(session?.user ?? null); setExpired(false) }
      else if (event === 'SIGNED_OUT') setUser(null)
    })
    return () => { alive = false; sub?.subscription?.unsubscribe?.() }
  }, [sb])

  if (booting) return <div className="auth-wrap"><Loading label="Checking session" /></div>
  if (expired) return <Expired onBack={async () => { try { await sb.auth.signOut() } catch {} ; setExpired(false); setUser(null) }} />
  if (!user) return <SignIn sb={sb} />
  return <Dashboard sb={sb} user={user} onExpired={() => setExpired(true)} />
}

/* ---------------- Session expired ---------------- */
function Expired({ onBack }) {
  return (
    <div className="auth-wrap grain">
      <div className="auth-card">
        <span className="eyebrow">Session</span>
        <h1>Session expired<span className="dot" /></h1>
        <p className="auth-card__sub">Your session timed out. Please sign in again.</p>
        <button className="btn btn--accent btn--block" onClick={onBack}>Back to sign in →</button>
      </div>
    </div>
  )
}

/* ---------------- Sign in ---------------- */
function SignIn({ sb }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) return fail('Incorrect email or password.')
    setBusy(true)
    try {
      const { data, error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (err || !data?.user) { setBusy(false); fail('Incorrect email or password.') }
      // onAuthStateChange swaps to the dashboard
    } catch {
      setBusy(false)
      setError('Unable to reach the server. A browser extension or network may be blocking it.')
    }
  }
  function fail(msg) {
    setError(msg)
    if (!prefersReducedMotion()) { setShake(false); requestAnimationFrame(() => setShake(true)) }
  }

  return (
    <div className="grain">
      <div className="app-top">
        <Link to="/" aria-label="n.abl home"><Logo size={22} /></Link>
        <Link to="/" className="app-back">← Back to site</Link>
      </div>
      <div className="auth-wrap">
        <div className="auth-card">
          <span className="eyebrow">Team access</span>
          <h1>Internal only<span className="dot" /></h1>
          <p className="auth-card__sub">
            If you&rsquo;re seeing this and you&rsquo;re not part of the n.abl team, you&rsquo;re in the
            wrong place. Try the client portal instead.
          </p>
          <form className={`auth-form ${shake ? 'shake' : ''}`} onSubmit={onSubmit}
                onAnimationEnd={() => setShake(false)} noValidate>
            <input className="input" type="email" value={email} placeholder="your@email.com"
                   aria-label="Email" autoComplete="username"
                   onChange={(e) => setEmail(e.target.value)} />
            <input className="input" type="password" value={password} placeholder="password"
                   aria-label="Password" autoComplete="current-password"
                   onChange={(e) => setPassword(e.target.value)} />
            <button className="btn btn--accent btn--block" disabled={busy}>
              {busy ? 'Authenticating…' : 'Access team space →'}
            </button>
            <p className="auth-error" role="alert" aria-live="assertive">{error}</p>
          </form>
          <p className="auth-help">Forgot your password? Contact the admin.</p>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ sb, user, onExpired }) {
  const [tab, setTab] = useState('clients')
  const [clients, setClients] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('all')
  const [confirm, setConfirm] = useState(null)
  const [toastNode, showToast] = useToast()

  const handle = useCallback((err, fallback) => {
    const m = friendlyError(err, fallback)
    if (m === 'SESSION_EXPIRED') { onExpired(); return null }
    return m
  }, [onExpired])

  const loadClients = useCallback(async () => {
    const { data, error } = await sb.from('clients').select('*').order('created_at', { ascending: false })
    if (error) { handle(error, ''); return [] }
    return data || []
  }, [sb, handle])

  const loadRows = useCallback(async (t) => {
    let q = sb.from(t).select('*')
    const o = ORDER[t]
    if (o) q = q.order(o.col, { ascending: o.asc })   // projects: no ordering at all
    const { data, error } = await q
    if (error) { const m = handle(error, 'Couldn’t load — please try again.'); if (m) showToast(m); return [] }
    return data || []
  }, [sb, handle, showToast])

  const refresh = useCallback(async (t = tab) => {
    setLoading(true)
    const cs = await loadClients()
    setClients(cs)
    setRows(t === 'clients' ? cs : await loadRows(t))
    setLoading(false)
  }, [tab, loadClients, loadRows])

  useEffect(() => { refresh(tab) /* eslint-disable-next-line */ }, [tab])

  function switchTab(t) {
    setTab(t); setFormOpen(false); setEditing(null); setSearch(''); setFilterClient('all')
  }

  const clientName = (id) => clients.find((c) => String(c.id) === String(id))?.business_name || 'Unknown client'

  const visible = useMemo(() => {
    let out = [...rows]
    if (tab === 'clients' && search) {
      const s = search.toLowerCase()
      out = out.filter((r) => String(r.business_name || '').toLowerCase().includes(s))
    }
    if (tab !== 'clients' && filterClient !== 'all') {
      out = out.filter((r) => String(r.client_id) === String(filterClient))
    }
    if (tab === 'meetings') {
      const now = Date.now()
      out.sort((a, b) => {
        const ta = a.datetime ? new Date(a.datetime).getTime() : Infinity
        const tb = b.datetime ? new Date(b.datetime).getTime() : Infinity
        const ap = ta < now, bp = tb < now
        if (ap !== bp) return ap ? 1 : -1
        return ap ? tb - ta : ta - tb
      })
    }
    return out
  }, [rows, tab, search, filterClient])

  async function onDelete(row) {
    const label = row.business_name || row.title || 'this item'
    setConfirm({
      title: `Delete ${label}?`,
      body: 'This cannot be undone.',
      run: async () => {
        setConfirm(null)
        try {
          const { error } = await sb.from(tab).delete().eq('id', row.id)
          if (error) { const m = handle(error, 'Couldn’t delete — please try again.'); if (m) showToast(m); return }
          // Remove any stored file belonging to this row (best effort).
          for (const f of FIELDS[tab].filter((x) => x.type === 'file')) {
            if (row[f.name]) { try { await sb.storage.from(f.bucket).remove([row[f.name]]) } catch {} }
          }
          showToast('Deleted')
          refresh()
        } catch {
          showToast('Connection lost. Refresh the page and try again.')
        }
      },
    })
  }

  return (
    <div className="grain">
      <div className="app-top">
        <Link to="/" aria-label="n.abl home"><Logo size={22} /></Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
          <span className="conn"><i />Connected</span>
          <button className="btn btn--ghost btn--sm" onClick={() => sb.auth.signOut()}>Log out</button>
        </div>
      </div>

      <div className="shell" style={{ paddingBottom: 'var(--s-9)' }}>
        <header style={{ paddingTop: 'var(--s-7)' }}>
          <span className="eyebrow">n.abl team space</span>
          <h1 style={{ fontSize: 'var(--t-3xl)', margin: 'var(--s-3) 0 var(--s-5)' }}>
            Hey, {displayName(user)}<span className="dot" />
          </h1>
        </header>

        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t} className={`tab ${t === tab ? 'tab--active' : ''}`}
                    aria-current={t === tab ? 'page' : undefined}
                    onClick={() => switchTab(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </nav>

        <div className="controls">
          <button className="btn btn--accent" onClick={() => { setEditing(null); setFormOpen(true) }}>
            {ADD_LABEL[tab]}
          </button>
          {tab === 'clients' ? (
            <input className="input controls__filter" value={search} placeholder="Search business name…"
                   aria-label="Search clients" onChange={(e) => setSearch(e.target.value)} />
          ) : (
            <select className="input controls__filter" value={filterClient}
                    aria-label="Filter by client" onChange={(e) => setFilterClient(e.target.value)}>
              <option value="all">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
          )}
        </div>

        {formOpen && (
          <EntityForm
            sb={sb} tab={tab} clients={clients} editing={editing}
            onCancel={() => { setFormOpen(false); setEditing(null) }}
            onSaved={() => { setFormOpen(false); setEditing(null); showToast('Saved'); refresh() }}
            onError={handle}
          />
        )}

        {loading ? <Loading /> : visible.length === 0 ? (
          <Empty>{EMPTY_MSG[tab]}</Empty>
        ) : (
          <div className={tab === 'quotes' || tab === 'projects' ? 'grid grid--2' : 'rows'}>
            {visible.map((row) => (
              <Row key={row.id} sb={sb} tab={tab} row={row} clientName={clientName}
                   onEdit={() => { setEditing(row); setFormOpen(true) }}
                   onDelete={() => onDelete(row)}
                   onCopy={() => showToast('Copied')} />
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title}
        body={confirm?.body}
        onConfirm={() => confirm?.run()}
        onCancel={() => setConfirm(null)}
      />
      {toastNode}
    </div>
  )
}

/* ---------------- One row / card ---------------- */
function Row({ sb, tab, row, clientName, onEdit, onDelete, onCopy }) {
  const actions = (
    <div className="card-actions">
      <button className="btn btn--ghost btn--sm" onClick={onEdit}>Edit</button>
      <button className="btn btn--ghost btn--sm danger-text" onClick={onDelete}>Delete</button>
    </div>
  )

  if (tab === 'clients') {
    return (
      <EdgeCard className="card-pad client-row">
        <div>
          <h3 style={{ fontSize: 'var(--t-lg)' }}>{row.business_name || 'Unnamed'}</h3>
          {row.contact_name && <div className="dim" style={{ fontSize: 'var(--t-sm)' }}>{row.contact_name}</div>}
          {row.contact_email && <div className="dim" style={{ fontSize: 'var(--t-sm)' }}>{row.contact_email}</div>}
        </div>
        <div className="keycell">
          <code className="mono keycell__key">{row.access_key}</code>
          <CopyBtn value={row.access_key} onCopied={onCopy} />
        </div>
        <div className="client-row__right">
          <span className="dim" style={{ fontSize: 'var(--t-sm)' }}>{dateLong(row.created_at)}</span>
          {actions}
        </div>
      </EdgeCard>
    )
  }

  if (tab === 'quotes') {
    return (
      <EdgeCard className="card-pad">
        {row.reference && <div className="eyebrow">{row.reference}</div>}
        <h3 style={{ fontSize: 'var(--t-lg)', margin: 'var(--s-3) 0' }}>{row.title || 'Untitled quote'}</h3>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-2xl)', color: 'var(--accent-400)' }}>
          {gbp(row.amount)}
        </div>
        <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center', marginTop: 'var(--s-3)', flexWrap: 'wrap' }}>
          <Badge status={row.status}>{row.status}</Badge>
          <span className="dim" style={{ fontSize: 'var(--t-sm)' }}>{clientName(row.client_id)}</span>
        </div>
        {row.valid_until && <div className="dim" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s-2)' }}>Valid until {dateLong(row.valid_until)}</div>}
        <div className="card-actions">
          {row.pdf_url && <ViewFile sb={sb} bucket="quotes" path={row.pdf_url}>View PDF →</ViewFile>}
          <button className="btn btn--ghost btn--sm" onClick={onEdit}>Edit</button>
          <button className="btn btn--ghost btn--sm danger-text" onClick={onDelete}>Delete</button>
        </div>
      </EdgeCard>
    )
  }

  if (tab === 'projects') {
    const pct = Math.max(0, Math.min(100, Number(row.progress_percent) || 0))
    return (
      <EdgeCard className="card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s-3)' }}>
          <h3 style={{ fontSize: 'var(--t-lg)' }}>{row.title || 'Untitled project'}</h3>
          <Badge status={row.status}>{row.status}</Badge>
        </div>
        {row.description && <p className="muted" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s-3)' }}>{row.description}</p>}
        <div className="progress" style={{ marginTop: 'var(--s-5)' }}>
          <div className="progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s-2)' }}>{pct}% complete</div>
        {(row.next_milestone || row.next_milestone_date) && (
          <div style={{ marginTop: 'var(--s-4)', paddingTop: 'var(--s-4)', borderTop: '1px solid var(--line)' }}>
            <div className="eyebrow">Next</div>
            {row.next_milestone && <div style={{ marginTop: 'var(--s-2)' }}>{row.next_milestone}</div>}
            {row.next_milestone_date && <div className="dim" style={{ fontSize: 'var(--t-sm)' }}>Due {dateLong(row.next_milestone_date)}</div>}
          </div>
        )}
        <div className="dim" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s-3)' }}>{clientName(row.client_id)}</div>
        {actions}
      </EdgeCard>
    )
  }

  if (tab === 'meetings') {
    const d = row.datetime ? new Date(row.datetime) : null
    const valid = d && !isNaN(d)
    const past = valid && d.getTime() < Date.now()
    return (
      <EdgeCard className="card-pad meeting" style={past ? { opacity: 0.6 } : undefined}>
        <div className="meeting__date">
          <div className="meeting__day">{valid ? d.getDate() : '–'}</div>
          <div className="meeting__my">{valid ? monthYear(d) : ''}</div>
        </div>
        <div>
          <h3 style={{ fontSize: 'var(--t-lg)' }}>{row.title || 'Meeting'}</h3>
          <div className="dim" style={{ fontSize: 'var(--t-sm)' }}>
            {[row.location, valid ? timeStr(d) : null].filter(Boolean).join(' · ')}
          </div>
          {actions}
        </div>
        <div className="meeting__right">
          <span className="eyebrow">{clientName(row.client_id)}</span>
          {row.status && <Badge status={row.status}>{row.status}</Badge>}
          {row.join_url && !past && (
            <a className="btn btn--accent btn--sm" href={row.join_url} target="_blank" rel="noopener noreferrer">Join →</a>
          )}
        </div>
      </EdgeCard>
    )
  }

  // documents
  return (
    <EdgeCard className="card-pad doc">
      <span className="doc__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--accent-400)"
             strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <polyline points="14 3 14 8 19 8" />
        </svg>
      </span>
      <div>
        <h3 style={{ fontSize: 'var(--t-base)' }}>{row.title || 'Document'}</h3>
        {row.document_type && <div className="eyebrow" style={{ marginTop: 'var(--s-1)' }}>{row.document_type}</div>}
        <div className="dim" style={{ fontSize: 'var(--t-sm)', marginTop: 'var(--s-1)' }}>{clientName(row.client_id)}</div>
      </div>
      <div className="doc__right">
        {row.uploaded_at && <span className="dim" style={{ fontSize: 'var(--t-sm)' }}>{dateLong(row.uploaded_at)}</span>}
        {row.file_url && <ViewFile sb={sb} bucket="documents" path={row.file_url}>View →</ViewFile>}
        <button className="btn btn--ghost btn--sm" onClick={onEdit}>Edit</button>
        <button className="btn btn--ghost btn--sm danger-text" onClick={onDelete}>Delete</button>
      </div>
    </EdgeCard>
  )
}

/* Opens a stored file through a signed URL minted at click time. */
function ViewFile({ sb, bucket, path, children }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <button className="btn btn--ghost btn--sm" disabled={busy} onClick={async () => {
      setBusy(true); setFailed(false)
      const url = await signedUrl(sb, bucket, path)
      setBusy(false)
      if (url) window.open(url, '_blank', 'noopener')
      else { setFailed(true); setTimeout(() => setFailed(false), 2500) }
    }}>
      {busy ? 'Opening…' : failed ? 'Unable to load' : children}
    </button>
  )
}

function CopyBtn({ value, onCopied }) {
  const [done, setDone] = useState(false)
  return (
    <button className="btn btn--ghost btn--sm" onClick={async () => {
      try { await navigator.clipboard.writeText(value || '') } catch {}
      setDone(true); onCopied?.(); setTimeout(() => setDone(false), 1200)
    }}>{done ? 'Copied ✓' : 'Copy'}</button>
  )
}

/* ---------------- Create / edit form ---------------- */
function EntityForm({ sb, tab, clients, editing, onCancel, onSaved, onError }) {
  const fields = FIELDS[tab]
  const [values, setValues] = useState(() => {
    const v = {}
    fields.forEach((f) => {
      if (f.type === 'file') return
      let init = editing ? editing[f.name] : (f.type === 'select' ? f.options[0] : '')
      if (f.type === 'datetime') init = toLocalInput(init)
      if (f.type === 'date' && init) init = String(init).slice(0, 10)
      if (f.type === 'progress') init = editing ? (Number(editing[f.name]) || 0) : 0
      v[f.name] = init ?? ''
    })
    return v
  })
  const [files, setFiles] = useState({})     // field -> File
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')

  const set = (name, val) => setValues((v) => ({ ...v, [name]: val }))
  const setErr = (name, msg) => setErrors((e) => ({ ...e, [name]: msg }))

  function validate() {
    const errs = {}
    const payload = {}
    for (const f of fields) {
      if (f.type === 'file') {
        const has = files[f.name] || (editing && editing[f.name])
        if (f.req && !has) errs[f.name] = 'Required.'
        continue
      }
      let val = values[f.name]
      if (typeof val === 'string') val = val.trim()
      if (f.req && !val) { errs[f.name] = 'Required.'; continue }
      if (f.type === 'email' && val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) { errs[f.name] = 'Enter a valid email.'; continue }
      if (f.type === 'money')    { payload[f.name] = val === '' ? null : Number(val); continue }
      if (f.type === 'progress') {
        const n = val === '' ? 0 : parseInt(val, 10)
        if (isNaN(n) || n < 0 || n > 100) { errs[f.name] = '0–100 only.'; continue }
        payload[f.name] = n; continue
      }
      if (f.type === 'datetime') { payload[f.name] = val ? new Date(val).toISOString() : null; continue }
      if (f.type === 'date')     { payload[f.name] = val || null; continue }
      payload[f.name] = val === '' ? null : val
    }
    setErrors(errs)
    return Object.keys(errs).length ? null : payload
  }

  async function onSubmit(e) {
    e.preventDefault()
    const payload = validate()
    if (!payload) return

    if (tab === 'documents' && !editing) payload.uploaded_at = new Date().toISOString()

    setBusy(true)
    const uploaded = []   // roll back if the row write fails
    const replaced = []   // delete only after a successful save

    try {
      for (const f of fields.filter((x) => x.type === 'file')) {
        const file = files[f.name]
        if (!file) { if (editing) payload[f.name] = editing[f.name] || null; continue }
        setPhase('Uploading…')
        const clientId = payload.client_id || editing?.client_id
        const path = storagePath(clientId, file)
        const { error: upErr } = await sb.storage.from(f.bucket)
          .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined })
        if (upErr) {
          for (const u of uploaded) { try { await sb.storage.from(u.bucket).remove([u.path]) } catch {} }
          setBusy(false); setPhase('')
          setErr(f.name, 'Upload failed — please try again')
          return
        }
        uploaded.push({ bucket: f.bucket, path })
        if (editing && editing[f.name]) replaced.push({ bucket: f.bucket, path: editing[f.name] })
        payload[f.name] = path
      }

      setPhase('Saving…')
      const { error } = editing
        ? await sb.from(tab).update(payload).eq('id', editing.id)
        : await sb.from(tab).insert(payload)

      if (error) {
        for (const u of uploaded) { try { await sb.storage.from(u.bucket).remove([u.path]) } catch {} }
        setBusy(false); setPhase('')
        const m = onError(error, 'Couldn’t save — please try again.')
        if (m) setErr(fields[0].name, m)
        return
      }

      for (const r of replaced) { try { await sb.storage.from(r.bucket).remove([r.path]) } catch {} }
      onSaved()
    } catch {
      for (const u of uploaded) { try { await sb.storage.from(u.bucket).remove([u.path]) } catch {} }
      setBusy(false); setPhase('')
      setErr(fields[0].name, 'Connection lost. Refresh the page and try again.')
    }
  }

  return (
    <form className="entity-form edge" onSubmit={onSubmit} noValidate>
      <div className="entity-form__grid">
        {fields.map((f) => (
          <div key={f.name} className={f.full ? 'span-2' : undefined}>
            <Field label={f.label} required={f.req} error={errors[f.name]} htmlFor={`f-${f.name}`}>
              <Control f={f} id={`f-${f.name}`} value={values[f.name]} set={set}
                       clients={clients} editing={editing}
                       file={files[f.name]}
                       onFile={(file) => setFiles((s) => ({ ...s, [f.name]: file }))}
                       onClearFile={() => setFiles((s) => { const n = { ...s }; delete n[f.name]; return n })}
                       setErr={setErr} sb={sb} businessName={values.business_name} />
            </Field>
          </div>
        ))}
      </div>
      <div className="card-actions">
        <button type="submit" className="btn btn--accent" disabled={busy}>
          {busy ? (phase || 'Saving…') : `${SAVE_LABEL[tab]} →`}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

/* ---------------- One control ---------------- */
function Control({ f, id, value, set, clients, editing, file, onFile, onClearFile, setErr, sb, businessName }) {
  const common = { id, className: 'input' }

  switch (f.type) {
    case 'textarea':
      return <textarea {...common} rows={4} value={value} onChange={(e) => set(f.name, e.target.value)} />
    case 'select':
      return (
        <select {...common} value={value} onChange={(e) => set(f.name, e.target.value)}>
          {f.options.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
        </select>
      )
    case 'client':
      return (
        <select {...common} value={value} onChange={(e) => set(f.name, e.target.value)}>
          <option value="">Select a client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
      )
    case 'money':
      return (
        <div className="money">
          <span aria-hidden="true">£</span>
          <input {...common} type="number" step="0.01" min="0" value={value}
                 placeholder="0.00" onChange={(e) => set(f.name, e.target.value)} />
        </div>
      )
    case 'date':
      return <input {...common} type="date" value={value} onChange={(e) => set(f.name, e.target.value)} />
    case 'datetime':
      return <input {...common} type="datetime-local" value={value} onChange={(e) => set(f.name, e.target.value)} />
    case 'progress': {
      const pct = Math.max(0, Math.min(100, Number(value) || 0))
      return (
        <>
          <input {...common} type="number" min="0" max="100" value={value}
                 onChange={(e) => set(f.name, e.target.value)} />
          <div className="progress" style={{ marginTop: 'var(--s-2)' }}>
            <div className="progress__fill" style={{ width: `${pct}%` }} />
          </div>
        </>
      )
    }
    case 'key':
      return (
        <div className="keyrow">
          <input {...common} className="input mono" value={value}
                 placeholder="ACME-K7X2-2026" onChange={(e) => set(f.name, e.target.value)} />
          <button type="button" className="btn btn--ghost btn--sm"
                  onClick={() => set(f.name, generateKey(businessName))}>Generate</button>
        </div>
      )
    case 'file':
      return <FileZone f={f} file={file} editing={editing} sb={sb}
                       onFile={onFile} onClear={onClearFile} setErr={setErr} />
    case 'email':
      return <input {...common} type="email" value={value} onChange={(e) => set(f.name, e.target.value)} />
    default:
      return <input {...common} type="text" value={value} placeholder={f.placeholder || ''}
                    onChange={(e) => set(f.name, e.target.value)} />
  }
}

/* ---------------- Drag & drop upload ---------------- */
function FileZone({ f, file, editing, sb, onFile, onClear, setErr }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const existing = editing && editing[f.name]

  function accept(picked) {
    setErr(f.name, '')
    if (f.pdfOnly) {
      const isPdf = picked.type === 'application/pdf' || /\.pdf$/i.test(picked.name)
      if (!isPdf) { setErr(f.name, 'Quotes must be PDF files'); return }
    }
    if (picked.size > f.maxMB * 1024 * 1024) { setErr(f.name, `File must be under ${f.maxMB}MB`); return }
    onFile(picked)
  }

  if (file) {
    return (
      <div className="drop drop--filled">
        <div className="drop__file">
          <span>
            <span className="drop__name">{file.name}</span>
            <span className="drop__size"> {fmtSize(file.size)}</span>
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>Remove</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <input ref={inputRef} type="file" hidden accept={f.accept || undefined}
             onChange={(e) => e.target.files?.[0] && accept(e.target.files[0])} />
      <div
        className={`drop ${over ? 'drop--over' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setOver(true) }}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setOver(false) }}
        onDrop={(e) => {
          e.preventDefault(); setOver(false)
          const picked = e.dataTransfer?.files?.[0]
          if (picked) accept(picked)
        }}
      >
        <div>{existing ? 'Drop a new file to replace, or' : 'Drag & drop a file here, or'}</div>
        <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 'var(--s-2)' }}
                onClick={() => inputRef.current?.click()}>
          {existing ? 'Replace file' : 'Choose file'}
        </button>
        <div className="drop__hint">Max {f.maxMB}MB{f.pdfOnly ? ' · PDF only' : ''}</div>
      </div>
      {existing && (
        <div className="current-file">
          <span className="dim">Current: {baseName(existing)}</span>
          <ViewFile sb={sb} bucket={f.bucket} path={existing}>Download current →</ViewFile>
        </div>
      )}
    </>
  )
}
