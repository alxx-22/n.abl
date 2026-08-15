import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { teamClient, friendlyError } from '../lib/supabase.js'
import {
  Logo, Field, Badge, EdgeCard, Reveal, ConfirmModal, useToast, Loading, Empty,
} from '../components/ui/index.jsx'
import { displayName, dateLong } from '../lib/teamConfig.js'
import '../styles/crm.css'

/* ============================================================
   SALES CRM — leads, contacts, pipeline, outreach.

   Everything on this page is hand-entered by the team or derived
   from it by plain arithmetic. There is no model in the loop and
   no outbound call beyond Supabase.

   Two rules this file exists to protect:
   1. STAGES below must stay byte-identical to the CHECK
      constraint on sales_leads.status (202606010001). A single
      changed character makes every write on that lead fail.
   2. Outreach never sends. A draft is composed, a human approves
      it, and approval unlocks a mail-client handoff — nothing more.
   ============================================================ */

const STORAGE_KEY = 'nabl.sales-intelligence.v3'

/* sales_leads.status CHECK constraint — verified against
   supabase/migrations/202606010001_sales_intelligence.sql. */
const STAGES = [
  'New Lead',
  'Researching',
  'Ready To Contact',
  'Contacted',
  'Follow Up Required',
  'Replied',
  'Meeting Scheduled',
  'Proposal Sent',
  'Won',
  'Lost',
]

const SIZES = ['1-10', '11-50', '51-200', '201-500', 'Unknown']
const TYPES = ['SME', 'Multi-site', 'Back office heavy', 'Sales-led', 'Operations-led']

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
]

/* Stages that mean "this lead has been approached at least once". */
const AFTER_CONTACT = [
  'Contacted', 'Follow Up Required', 'Replied',
  'Meeting Scheduled', 'Proposal Sent', 'Won', 'Lost',
]
const REPLIED_ON = ['Replied', 'Meeting Scheduled', 'Proposal Sent', 'Won']

/* ---------------- small pure helpers ---------------- */

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`

const clampScore = (value, fallback = 50) =>
  Math.max(1, Math.min(100, Math.round(Number(value) || fallback || 50)))

const slug = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function makeActivity(type, text, at) {
  return { id: uid('act'), type, text, at: at || new Date().toISOString() }
}

/** Prepend an audit entry and stamp the lead as touched. Never mutates. */
function withActivity(lead, type, text) {
  return {
    ...lead,
    activities: [makeActivity(type, text), ...(lead.activities || [])],
    updatedAt: new Date().toISOString(),
  }
}

function normaliseUrl(url) {
  const value = String(url || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`
  return ''
}

/** A safe external link, or plain text when the value isn't a URL. */
function Ext({ url, children }) {
  const href = normaliseUrl(url)
  if (!href) return <>{children ?? url ?? 'Not recorded'}</>
  return (
    <a className="crm-link" href={href} target="_blank" rel="noopener noreferrer">
      {children ?? href}
    </a>
  )
}

/* ---------------- local fallback store ----------------
   The CRM stays usable on a flaky connection: every change lands
   here first, Supabase second. Key is unchanged from the previous
   build so existing devices keep their leads. */

function loadLocal() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (stored && Array.isArray(stored.leads)) return stored.leads
  } catch { /* corrupt or blocked storage — start empty */ }
  return []
}

function saveLocal(leads) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ leads })) } catch { /* quota or private mode */ }
}

/* ============================================================
   ROW MAPPERS — the camelCase <-> snake_case contract.

   These two functions are a matched pair and must be edited
   together: a column added to one and missed on the other makes
   the field vanish on the next round-trip.

     lead.company    <-> company
     lead.website    <-> website
     lead.industry   <-> industry
     lead.location   <-> location
     lead.size       <-> estimated_size
     lead.type       <-> business_type
     lead.score      <-> lead_score        (1..100, hand-set priority)
     lead.status     <-> status            (CHECK-constrained)
     lead.owner      <-> owner_name
     lead.notes      <-> notes
     lead.signals    <-> signals           (real column since 202606020001)
     lead.updatedAt  <-> updated_at        (DB-owned, read-only)
     lead.createdAt  <-> created_at        (DB-owned, read-only)
     -                -> owner_id          (write-only, from the session)
     -                -> last_activity_at  (write-only, derived)

   research_json, research_summary, source_urls and
   recommendation_reason were dropped by 202606020001 and must not
   appear on either path.
   ============================================================ */

function leadToRow(lead, userId, fallbackOwner) {
  return {
    company: lead.company,
    website: lead.website || null,
    industry: lead.industry || null,
    location: lead.location || null,
    estimated_size: lead.size || null,
    business_type: lead.type || null,
    lead_score: clampScore(lead.score, 50),
    status: lead.status || 'New Lead',
    owner_id: userId || null,
    owner_name: lead.owner || fallbackOwner,
    notes: lead.notes || null,
    signals: lead.signals || null,
    last_activity_at: lead.activities?.[0]?.at || lead.updatedAt || new Date().toISOString(),
  }
}

function leadFromRow(row, contacts, activities, drafts, fallbackOwner) {
  const latestDraft = drafts[0]
  return {
    id: row.id,
    dbId: row.id,
    company: row.company,
    website: row.website || '',
    industry: row.industry || '',
    location: row.location || '',
    size: row.estimated_size || '',
    type: row.business_type || '',
    score: row.lead_score || 50,
    status: row.status || 'New Lead',
    owner: row.owner_name || fallbackOwner,
    /* signals is a real column from 202606020001 onward. The fallback
       keeps rows readable on a database where that migration has not
       been applied yet, where the text still sits in the old blob. */
    signals: row.signals ?? row.research_json?.signals ?? '',
    notes: row.notes || '',
    contacts: contacts.map((contact) => ({
      name: contact.name || 'Public contact route',
      role: contact.role || 'Public',
      email: contact.email || '',
      phone: contact.phone || contact.contact_form_url || '',
      source: contact.source || '',
      confidence: contact.confidence || 50,
    })),
    outreachDraft: latestDraft ? `Subject: ${latestDraft.subject}\n\n${latestDraft.body}` : '',
    outreachApproved: !!(latestDraft && latestDraft.approved_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activities: activities.length
      ? activities.map((item) => ({
        id: item.id,
        type: item.activity_type,
        text: item.description,
        at: item.created_at,
      }))
      : [makeActivity('Lead loaded', 'Loaded from the sales pipeline', row.updated_at)],
  }
}

function contactToRow(contact, leadId) {
  return {
    lead_id: leadId,
    name: contact.name || 'Public contact route',
    role: contact.role || null,
    email: contact.email || null,
    phone: contact.phone || null,
    contact_form_url: normaliseUrl(contact.phone) || null,
    source: contact.source || null,
    /* Manual reliability rating, 1..100 — how much the team trusts
       this contact route. Nothing scores it automatically. */
    confidence: clampScore(contact.confidence, 50),
  }
}

function activityToRow(item, leadId, userId) {
  return {
    lead_id: leadId,
    actor_id: userId || null,
    activity_type: item.type || 'Activity',
    description: item.text || '',
    metadata: {},
    created_at: item.at || new Date().toISOString(),
  }
}

function draftToRow(lead, leadId, userId) {
  if (!lead.outreachDraft) return null
  const subject = (lead.outreachDraft.match(/^Subject:\s*(.+)$/m) || ['', `Quick idea for ${lead.company}`])[1]
  const body = lead.outreachDraft.replace(/^Subject:.*\n\n?/m, '')
  return {
    lead_id: leadId,
    subject,
    body,
    approved_at: lead.outreachApproved ? new Date().toISOString() : null,
    approved_by: lead.outreachApproved ? (userId || null) : null,
    created_by: userId || null,
  }
}

/* ---------------- outreach draft ----------------
   The middle paragraph carries whatever the team wrote by hand about
   this business. With nothing written, the line is dropped rather
   than padded out. */
function emailDraft(lead) {
  const context = String(lead.signals || '').trim() || String(lead.notes || '').trim()
  const lines = [
    `Subject: Quick idea for ${lead.company}`,
    '',
    'Hi,',
    '',
    `I came across ${lead.company} and noticed a few public signals that suggest there may be useful gains hiding in your current systems.`,
  ]
  if (context) lines.push('', context)
  lines.push(
    '',
    'At n.abl, we take a job that is costing a business time or accuracy and build the right fix for it - sometimes an automation, sometimes a small piece of software, sometimes just the tool you already pay for set up properly. Fixed price, agreed before we start.',
    '',
    'Would a short conversation next week be useful?',
    '',
    'Best,',
    'n.abl team',
    'Technology implementation for small business.',
    'hello@nabl.agency',
  )
  return lines.join('\n')
}

/* ============================================================
   Route entry — session gate
   ============================================================ */

export default function Crm() {
  const sb = useMemo(() => teamClient(), [])
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => { document.title = 'Sales CRM — n.abl' }, [])

  useEffect(() => {
    let alive = true
    sb.auth.getSession()
      .then(({ data }) => { if (alive) { setUser(data?.session?.user ?? null); setBooting(false) } })
      .catch(() => { if (alive) setBooting(false) })

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') setUser(session?.user ?? null)
      else if (event === 'SIGNED_OUT') setUser(null)
    })
    return () => { alive = false; sub?.subscription?.unsubscribe?.() }
  }, [sb])

  if (booting) return <div className="auth-wrap"><Loading label="Checking session" /></div>
  if (!user) return <SignInRequired />
  return <Workspace sb={sb} user={user} onSignedOut={() => setUser(null)} />
}

/* ---------------- No session ---------------- */
function SignInRequired() {
  return (
    <div className="grain">
      <div className="app-top">
        <Link to="/" aria-label="n.abl home"><Logo size={22} /></Link>
        <Link to="/" className="app-back">← Back to site</Link>
      </div>
      <div className="auth-wrap">
        <div className="auth-card">
          <span className="eyebrow">Sales CRM</span>
          <h1>Team sign-in needed<span className="dot" /></h1>
          <p className="auth-card__sub">
            The sales pipeline lives inside the team space. Sign in there and this page
            will pick up your session.
          </p>
          <Link className="btn btn--accent btn--block" to="/team">Sign in through the team space →</Link>
          <p className="auth-help">Already signed in on another tab? Reload this page.</p>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Workspace
   ============================================================ */

function Workspace({ sb, user, onSignedOut }) {
  const ownerFallback = useMemo(() => displayName(user), [user])

  const [leads, setLeads] = useState(() => loadLocal())
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [tab, setTab] = useState('overview')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [minScore, setMinScore] = useState(0)

  const [addOpen, setAddOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [expired, setExpired] = useState(false)
  const [toastNode, showToast] = useToast()

  /* Mirror every change to the local fallback store. */
  useEffect(() => { saveLocal(leads) }, [leads])

  const handle = useCallback((err, fallback) => {
    const message = friendlyError(err, fallback)
    if (message === 'SESSION_EXPIRED') { setExpired(true); return null }
    return message
  }, [])

  /* ---------------- read path ---------------- */
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: rows, error } = await sb
          .from('sales_leads').select('*').order('updated_at', { ascending: false })
        if (error) throw error
        if (!alive) return

        /* No rows server-side: keep whatever this device already holds
           rather than blanking the workspace. */
        if (!rows || !rows.length) { setLoading(false); return }

        const ids = rows.map((row) => row.id)
        const [contacts, activities, drafts] = await Promise.all([
          sb.from('sales_contacts').select('*').in('lead_id', ids),
          sb.from('sales_activities').select('*').in('lead_id', ids).order('created_at', { ascending: false }),
          sb.from('sales_email_drafts').select('*').in('lead_id', ids).order('created_at', { ascending: false }),
        ])
        if (contacts.error) throw contacts.error
        if (activities.error) throw activities.error
        if (drafts.error) throw drafts.error
        if (!alive) return

        const hydrated = rows.map((row) => leadFromRow(
          row,
          (contacts.data || []).filter((item) => item.lead_id === row.id),
          (activities.data || []).filter((item) => item.lead_id === row.id),
          (drafts.data || []).filter((item) => item.lead_id === row.id),
          ownerFallback,
        ))
        setLeads(hydrated)
        setLoading(false)
      } catch (err) {
        if (!alive) return
        setLoading(false)
        const message = handle(err, 'Showing the copy stored on this device.')
        if (message) showToast(message)
      }
    })()
    return () => { alive = false }
  }, [sb, ownerFallback, handle, showToast])

  /* Adopt orphaned records from earlier builds onto the signed-in user. */
  useEffect(() => {
    setLeads((prev) => {
      let changed = false
      const next = prev.map((lead) => {
        if (lead.owner && lead.owner !== 'team' && lead.owner !== 'n.abl Team') return lead
        changed = true
        return { ...lead, owner: ownerFallback }
      })
      return changed ? next : prev
    })
  }, [ownerFallback])

  /* ---------------- write path ---------------- */

  const pushLead = useCallback(async (lead, { pipelineFrom } = {}) => {
    const row = leadToRow(lead, user.id, ownerFallback)
    let dbId = lead.dbId
    let updatedAt = lead.updatedAt

    if (dbId) {
      const { data, error } = await sb
        .from('sales_leads').update(row).eq('id', dbId).select('id, updated_at').single()
      if (error) throw error
      updatedAt = data?.updated_at || updatedAt
    } else {
      const { data, error } = await sb
        .from('sales_leads').insert(row).select('id, updated_at').single()
      if (error) throw error
      dbId = data.id
      updatedAt = data?.updated_at || updatedAt
    }

    /* Children are replaced wholesale — the client list is the truth. */
    await sb.from('sales_contacts').delete().eq('lead_id', dbId)
    if (lead.contacts?.length) {
      const { error } = await sb.from('sales_contacts')
        .insert(lead.contacts.map((contact) => contactToRow(contact, dbId)))
      if (error) throw error
    }

    await sb.from('sales_activities').delete().eq('lead_id', dbId)
    if (lead.activities?.length) {
      const { error } = await sb.from('sales_activities')
        .insert(lead.activities.map((item) => activityToRow(item, dbId, user.id)))
      if (error) throw error
    }

    await sb.from('sales_email_drafts').delete().eq('lead_id', dbId)
    const draft = draftToRow(lead, dbId, user.id)
    if (draft) {
      const { error } = await sb.from('sales_email_drafts').insert(draft)
      if (error) throw error
    }

    if (pipelineFrom !== undefined && lead.status) {
      const { error } = await sb.from('sales_pipeline_events').insert({
        lead_id: dbId,
        actor_id: user.id,
        from_status: pipelineFrom || null,
        to_status: lead.status,
      })
      if (error) throw error
    }

    return { dbId, updatedAt }
  }, [sb, user, ownerFallback])

  /** Local state first, database second — a failed write never loses the edit. */
  const saveLead = useCallback(async (next, opts = {}) => {
    setLeads((prev) => (prev.some((lead) => lead.id === next.id)
      ? prev.map((lead) => (lead.id === next.id ? next : lead))
      : [next, ...prev]))
    try {
      const patch = await pushLead(next, opts)
      setLeads((prev) => prev.map((lead) => (lead.id === next.id ? { ...lead, ...patch } : lead)))
      if (opts.okMsg) showToast(opts.okMsg)
    } catch (err) {
      const message = handle(err, 'Saved on this device only.')
      if (message) showToast(message)
    }
  }, [pushLead, handle, showToast])

  const moveLead = useCallback((lead, toStatus) => {
    if (!toStatus || toStatus === lead.status || !STAGES.includes(toStatus)) return
    const from = lead.status
    const next = withActivity({ ...lead, status: toStatus }, 'Status change', `${from} to ${toStatus}`)
    saveLead(next, { pipelineFrom: from, okMsg: `Moved to ${toStatus}` })
  }, [saveLead])

  const removeLead = useCallback(async (lead) => {
    setLeads((prev) => prev.filter((item) => item.id !== lead.id))
    setSelectedId((current) => (current === lead.id ? null : current))
    if (!lead.dbId) { showToast('Lead deleted'); return }
    try {
      /* Contacts, activities, drafts and pipeline events all carry
         ON DELETE CASCADE, so one delete clears the whole record. */
      const { error } = await sb.from('sales_leads').delete().eq('id', lead.dbId)
      if (error) throw error
      showToast('Lead deleted')
    } catch (err) {
      const message = handle(err, 'Deleted here, but the server copy remains.')
      if (message) showToast(message)
    }
  }, [sb, handle, showToast])

  /* ---------------- derived views ---------------- */

  const owners = useMemo(() => {
    const set = new Set([ownerFallback])
    leads.forEach((lead) => { if (lead.owner) set.add(lead.owner) })
    return [...set]
  }, [leads, ownerFallback])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    const floor = Number(minScore) || 0
    return leads
      .filter((lead) => {
        const haystack = [lead.company, lead.industry, lead.location, lead.status, lead.owner]
          .join(' ').toLowerCase()
        return (!query || haystack.includes(query))
          && (!statusFilter || lead.status === statusFilter)
          && (!ownerFilter || lead.owner === ownerFilter)
          && (Number(lead.score) || 0) >= floor
      })
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
  }, [leads, search, statusFilter, ownerFilter, minScore])

  const selected = useMemo(
    () => visible.find((lead) => lead.id === selectedId) || visible[0] || null,
    [visible, selectedId],
  )

  const metrics = useMemo(() => ([
    ['Total Leads', leads.length],
    ['New Leads', leads.filter((l) => l.status === 'New Lead').length],
    ['Contacted', leads.filter((l) => AFTER_CONTACT.includes(l.status)).length],
    ['Replies', leads.filter((l) => REPLIED_ON.includes(l.status)).length],
    ['Meetings', leads.filter((l) => l.status === 'Meeting Scheduled').length],
    ['Opportunities', leads.filter((l) => ['Proposal Sent', 'Won'].includes(l.status)).length],
    ['Won Deals', leads.filter((l) => l.status === 'Won').length],
    ['Lost Deals', leads.filter((l) => l.status === 'Lost').length],
  ]), [leads])

  function selectLead(id) { setSelectedId(id); setTab('overview') }

  if (expired) {
    return (
      <div className="grain">
        <div className="app-top">
          <Link to="/" aria-label="n.abl home"><Logo size={22} /></Link>
          <Link to="/" className="app-back">← Back to site</Link>
        </div>
        <div className="auth-wrap">
          <div className="auth-card">
            <span className="eyebrow">Session</span>
            <h1>Session expired<span className="dot" /></h1>
            <p className="auth-card__sub">
              Your changes are still stored on this device. Sign in again to sync them.
            </p>
            <button
              type="button"
              className="btn btn--accent btn--block"
              onClick={async () => { try { await sb.auth.signOut() } catch { /* already gone */ } onSignedOut() }}
            >
              Back to sign in →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grain">
      <div className="app-top">
        <Link to="/" aria-label="n.abl home"><Logo size={22} /></Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
          <span className="conn"><i />Connected</span>
          <Link to="/team" className="btn btn--ghost btn--sm">Team space</Link>
        </div>
      </div>

      <div className="shell" style={{ paddingBottom: 'var(--s-9)' }}>
        <header style={{ paddingTop: 'var(--s-7)' }}>
          <span className="eyebrow">n.abl sales CRM</span>
          <h1 style={{ fontSize: 'var(--t-3xl)', margin: 'var(--s-3) 0 var(--s-4)' }}>
            Pipeline<span className="dot" />
          </h1>
          <p className="muted prose">
            Leads, contacts, stages and approved outreach in one place. Every record here is
            entered and maintained by the team.
          </p>
        </header>

        {/* ---------- Dashboard ---------- */}
        <section aria-label="Pipeline metrics" style={{ marginTop: 'var(--s-6)' }}>
          <div className="crm-metrics">
            {metrics.map(([label, value], i) => (
              <Reveal key={label} delay={i * 0.03}>
                <EdgeCard className="crm-metric" spotlight={false} lift={false}>
                  <div className="crm-metric__value">{value}</div>
                  <div className="crm-metric__label">{label}</div>
                </EdgeCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- Filters ---------- */}
        <section aria-label="Lead filters">
          <div className="crm-filters">
            <div className="crm-filter">
              <label className="label" htmlFor="crm-search">Search</label>
              <input
                id="crm-search" className="input" type="search" value={search}
                placeholder="Company, industry, location"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="crm-filter">
              <label className="label" htmlFor="crm-status">Stage</label>
              <select
                id="crm-status" className="input" value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Any stage</option>
                {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </div>
            <div className="crm-filter">
              <label className="label" htmlFor="crm-owner">Owner</label>
              <select
                id="crm-owner" className="input" value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
              >
                <option value="">Any owner</option>
                {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
              </select>
            </div>
            <div className="crm-filter">
              <label className="label" htmlFor="crm-score">Minimum score</label>
              <input
                id="crm-score" className="input" type="number" min="0" max="100" value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn--accent" onClick={() => setAddOpen(true)}>
              + Add lead
            </button>
          </div>
        </section>

        {/* ---------- Leads ---------- */}
        {loading ? <Loading label="Loading pipeline" /> : (
          <div className="crm-workspace">
            <aside className="crm-leadlist" aria-label="Leads">
              {visible.length === 0 ? (
                <Empty>
                  {leads.length === 0
                    ? 'No leads yet. Add your first one above.'
                    : 'No leads match the current filters.'}
                </Empty>
              ) : visible.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className={`crm-leadbtn ${selected?.id === lead.id ? 'crm-leadbtn--active' : ''}`}
                  aria-current={selected?.id === lead.id ? 'true' : undefined}
                  onClick={() => selectLead(lead.id)}
                >
                  <span className="crm-leadbtn__name">{lead.company}</span>
                  <span className="crm-leadbtn__meta">
                    {[lead.industry, lead.location, lead.owner].filter(Boolean).join(' · ') || 'No details yet'}
                  </span>
                  <span className="crm-leadbtn__tags">
                    <Badge status="score">{lead.score}</Badge>
                    <Badge status={lead.status}>{lead.status}</Badge>
                  </span>
                </button>
              ))}
            </aside>

            <EdgeCard className="crm-detail" spotlight={false} lift={false}>
              {selected ? (
                <LeadDetail
                  key={selected.id}
                  lead={selected}
                  tab={tab}
                  onTab={setTab}
                  onSave={saveLead}
                  onMove={moveLead}
                  onDelete={() => setConfirm({
                    title: `Delete ${selected.company}?`,
                    body: 'This removes the lead and everything attached to it — contacts, activity and drafts. This cannot be undone.',
                    run: () => { setConfirm(null); removeLead(selected) },
                  })}
                />
              ) : (
                <Empty>Select a lead to see its record.</Empty>
              )}
            </EdgeCard>
          </div>
        )}

        {/* ---------- Pipeline board ---------- */}
        <section aria-label="Pipeline board" style={{ marginTop: 'var(--s-8)' }}>
          <span className="eyebrow">Pipeline board</span>
          <p className="dim" style={{ fontSize: 'var(--t-sm)', margin: 'var(--s-3) 0 var(--s-4)' }}>
            Drag a lead between columns to change its stage. Every move is logged. Prefer the
            keyboard? Use the stage menu on the lead&rsquo;s Overview tab.
          </p>
          <Board leads={leads} onMove={moveLead} onSelect={selectLead} />
        </section>

        {/* ---------- Insights ---------- */}
        <section aria-label="Pipeline insights" style={{ marginTop: 'var(--s-8)' }}>
          <span className="eyebrow">Pipeline insights</span>
          <p className="dim" style={{ fontSize: 'var(--t-sm)', margin: 'var(--s-3) 0 var(--s-4)' }}>
            Counted from the leads on this page.
          </p>
          <Insights leads={leads} />
        </section>
      </div>

      {addOpen && (
        <AddLeadModal
          ownerName={ownerFallback}
          onCancel={() => setAddOpen(false)}
          onCreate={(lead) => {
            setAddOpen(false)
            setSelectedId(lead.id)
            setTab('overview')
            saveLead(lead, { pipelineFrom: null, okMsg: 'Lead added' })
          }}
        />
      )}

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

/* ============================================================
   Lead detail
   ============================================================ */

function LeadDetail({ lead, tab, onTab, onSave, onMove, onDelete }) {
  const tabRefs = useRef({})

  function onTabKey(e) {
    const i = TABS.findIndex((t) => t.id === tab)
    let next = null
    if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length]
    if (e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length]
    if (e.key === 'Home') next = TABS[0]
    if (e.key === 'End') next = TABS[TABS.length - 1]
    if (!next) return
    e.preventDefault()
    onTab(next.id)
    tabRefs.current[next.id]?.focus()
  }

  return (
    <>
      <div className="crm-detail__head">
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">Lead record</span>
          <h2 className="crm-detail__title">{lead.company}<span className="dot" /></h2>
          <div className="crm-detail__facts">
            <Badge status={lead.status}>{lead.status}</Badge>
            {lead.industry && <span>{lead.industry}</span>}
            {lead.location && <span>{lead.location}</span>}
            {lead.size && <span>{lead.size} people</span>}
            {lead.website && <Ext url={lead.website}>Website</Ext>}
          </div>
          <div className="card-actions">
            <button type="button" className="btn btn--ghost btn--sm danger-text" onClick={onDelete}>
              Delete lead
            </button>
          </div>
        </div>
        <div className="crm-score">
          <div className="crm-score__box" role="img" aria-label={`Priority score ${lead.score} out of 100`}>
            <span aria-hidden="true">{lead.score}</span>
          </div>
          <span className="crm-score__label" aria-hidden="true">Priority</span>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Lead sections" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`crm-tab-${t.id}`}
            ref={(el) => { tabRefs.current[t.id] = el }}
            aria-selected={t.id === tab}
            aria-controls={`crm-panel-${t.id}`}
            tabIndex={t.id === tab ? 0 : -1}
            className={`tab ${t.id === tab ? 'tab--active' : ''}`}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="crm-panel"
        role="tabpanel"
        id={`crm-panel-${tab}`}
        aria-labelledby={`crm-tab-${tab}`}
      >
        {tab === 'overview' && <OverviewPanel lead={lead} onSave={onSave} onMove={onMove} />}
        {tab === 'contacts' && <ContactsPanel lead={lead} onSave={onSave} />}
        {tab === 'outreach' && <OutreachPanel lead={lead} onSave={onSave} />}
        {tab === 'notes' && <NotesPanel lead={lead} onSave={onSave} />}
        {tab === 'activity' && <ActivityPanel lead={lead} />}
      </div>
    </>
  )
}

/* ---------------- Overview ---------------- */
function OverviewPanel({ lead, onSave, onMove }) {
  const [signals, setSignals] = useState(lead.signals || '')
  const dirty = signals.trim() !== String(lead.signals || '').trim()

  return (
    <>
      <dl className="crm-kv">
        <div><dt>Industry</dt><dd>{lead.industry || 'Not recorded'}</dd></div>
        <div><dt>Website</dt><dd><Ext url={lead.website}>{lead.website || 'Not recorded'}</Ext></dd></div>
        <div><dt>Estimated size</dt><dd>{lead.size || 'Not recorded'}</dd></div>
        <div><dt>Location</dt><dd>{lead.location || 'Not recorded'}</dd></div>
        <div><dt>Business type</dt><dd>{lead.type || 'Not recorded'}</dd></div>
        <div><dt>Owner</dt><dd>{lead.owner || 'Unassigned'}</dd></div>
        <div><dt>Added</dt><dd>{dateLong(lead.createdAt) || 'Not recorded'}</dd></div>
        <div><dt>Last updated</dt><dd>{dateLong(lead.updatedAt) || 'Not recorded'}</dd></div>
      </dl>

      <div style={{ marginTop: 'var(--s-6)', maxWidth: '22rem' }}>
        <Field label="Stage" htmlFor={`stage-${lead.id}`} help="Changing the stage logs a pipeline event.">
          <select
            id={`stage-${lead.id}`}
            className="input"
            value={lead.status}
            onChange={(e) => onMove(lead, e.target.value)}
          >
            {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </Field>
      </div>

      <form
        style={{ marginTop: 'var(--s-4)' }}
        onSubmit={(e) => {
          e.preventDefault()
          const next = withActivity({ ...lead, signals: signals.trim() }, 'Signals updated', 'Public signals edited')
          onSave(next, { okMsg: 'Signals saved' })
        }}
      >
        <Field
          label="Public signals"
          htmlFor={`signals-${lead.id}`}
          help="What you noticed about this business — how they operate, what looks manual, how to reach them."
        >
          <textarea
            id={`signals-${lead.id}`}
            className="input"
            rows={5}
            value={signals}
            placeholder="Public website signals, contact route, operational clues"
            onChange={(e) => setSignals(e.target.value)}
          />
        </Field>
        <div className="card-actions">
          <button type="submit" className="btn btn--accent btn--sm" disabled={!dirty}>Save signals</button>
        </div>
      </form>
    </>
  )
}

/* ---------------- Contacts ---------------- */
function ContactsPanel({ lead, onSave }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [confidence, setConfidence] = useState(70)
  const [error, setError] = useState('')

  function addContact(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Required.'); return }
    setError('')
    const contact = {
      name: name.trim(),
      role: 'Public',
      email: email.trim(),
      phone: phone.trim(),
      source: 'Public website',
      confidence: clampScore(confidence, 70),
    }
    const next = withActivity(
      { ...lead, contacts: [...(lead.contacts || []), contact] },
      'Contact added',
      `Added contact route: ${contact.name}`,
    )
    onSave(next, { okMsg: 'Contact added' })
    setName(''); setEmail(''); setPhone(''); setConfidence(70)
  }

  function removeContact(index) {
    const removed = lead.contacts[index]
    const next = withActivity(
      { ...lead, contacts: lead.contacts.filter((_, i) => i !== index) },
      'Contact removed',
      `Removed contact route: ${removed?.name || 'unnamed'}`,
    )
    onSave(next, { okMsg: 'Contact removed' })
  }

  return (
    <>
      {lead.contacts?.length ? (
        <div className="crm-contacts">
          {lead.contacts.map((contact, index) => (
            <EdgeCard key={`${contact.name}-${index}`} className="card-pad" lift={false}>
              <h3 style={{ fontSize: 'var(--t-lg)' }}>{contact.name}</h3>
              <p className="dim" style={{ fontSize: 'var(--t-sm)' }}>
                {[contact.role, contact.source].filter(Boolean).join(' · ')}
              </p>
              <dl className="crm-kv" style={{ marginTop: 'var(--s-4)' }}>
                <div><dt>Email</dt><dd>{contact.email || 'Not recorded'}</dd></div>
                <div><dt>Phone / route</dt><dd><Ext url={contact.phone}>{contact.phone || 'Not recorded'}</Ext></dd></div>
                <div><dt>Reliability</dt><dd>{contact.confidence}%</dd></div>
                <div><dt>Allowed use</dt><dd>Public business contact only</dd></div>
              </dl>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm danger-text"
                  onClick={() => removeContact(index)}
                >
                  Remove {contact.name}
                </button>
              </div>
            </EdgeCard>
          ))}
        </div>
      ) : <Empty>No contact routes recorded yet.</Empty>}

      <form className="entity-form edge" style={{ marginTop: 'var(--s-5)' }} onSubmit={addContact} noValidate>
        <div className="entity-form__grid">
          <Field label="Name / route" required error={error} htmlFor={`c-name-${lead.id}`}>
            <input
              id={`c-name-${lead.id}`} className="input" value={name}
              placeholder="Generic inbox" onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor={`c-email-${lead.id}`}>
            <input
              id={`c-email-${lead.id}`} className="input" type="email" value={email}
              placeholder="name@company.co.uk" onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Phone / form" htmlFor={`c-phone-${lead.id}`}>
            <input
              id={`c-phone-${lead.id}`} className="input" value={phone}
              placeholder="Contact form" onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field
            label="Reliability" htmlFor={`c-conf-${lead.id}`}
            help="Your own 1–100 rating of how dependable this route is."
          >
            <input
              id={`c-conf-${lead.id}`} className="input" type="number" min="1" max="100"
              value={confidence} onChange={(e) => setConfidence(e.target.value)}
            />
          </Field>
        </div>
        <div className="card-actions">
          <button type="submit" className="btn btn--accent btn--sm">Add contact</button>
        </div>
      </form>
    </>
  )
}

/* ---------------- Outreach ----------------
   Compose -> approve -> hand off to the mail client. The page has no
   send path of its own, by design. */
function OutreachPanel({ lead, onSave }) {
  const [text, setText] = useState(lead.outreachDraft || emailDraft(lead))

  /* Approval belongs to an exact body of text. Edit it and the approval
     lapses, so the mail handoff relocks until a human approves again. */
  const approvedNow = lead.outreachApproved && text === lead.outreachDraft

  function compose() {
    const draft = emailDraft(lead)
    setText(draft)
    const next = withActivity(
      { ...lead, outreachDraft: draft, outreachApproved: false },
      'Email draft',
      'Composed an outreach draft',
    )
    onSave(next, { okMsg: 'Draft composed' })
  }

  function approve() {
    const draft = text.trim()
    if (!draft) return
    setText(draft)
    const next = withActivity(
      { ...lead, outreachDraft: draft, outreachApproved: true },
      'Email approved',
      'Outreach approved for manual send',
    )
    onSave(next, { okMsg: 'Draft approved' })
  }

  function openInMail() {
    const contact = (lead.contacts || []).find((c) => c.email)
    const to = contact ? contact.email : 'hello@nabl.agency'
    const draft = lead.outreachDraft || emailDraft(lead)
    const subject = (draft.match(/^Subject:\s*(.+)$/m) || ['', `Quick idea for ${lead.company}`])[1]
    const body = draft.replace(/^Subject:.*\n\n?/m, '')
    const from = lead.status
    const next = withActivity(
      { ...lead, status: 'Contacted' },
      'Email opened',
      'Approved email opened in mail client',
    )
    onSave(next, { pipelineFrom: from, okMsg: 'Opened in your mail client' })
    window.location.href =
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="crm-outreach">
      <div>
        <Field label="Outreach draft" htmlFor={`draft-${lead.id}`}>
          <textarea
            id={`draft-${lead.id}`}
            className="input crm-draft"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <div className="card-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={compose}>Compose draft</button>
          <button type="button" className="btn btn--accent btn--sm" onClick={approve} disabled={!text.trim()}>
            Approve email
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={openInMail} disabled={!approvedNow}>
            Open in mail
          </button>
        </div>
      </div>

      <EdgeCard className="card-pad" lift={false} spotlight={false}>
        <span className="eyebrow">Approval</span>
        <h3 style={{ fontSize: 'var(--t-lg)', margin: 'var(--s-3) 0' }}>
          {approvedNow ? 'Approved' : lead.outreachApproved ? 'Edited since approval' : 'Not approved'}
        </h3>
        <p className="muted" style={{ fontSize: 'var(--t-sm)' }}>
          The page never sends automatically. Approval unlocks a mail client draft only.
          Backend should enforce the same rule server-side.
        </p>
      </EdgeCard>
    </div>
  )
}

/* ---------------- Notes ---------------- */
function NotesPanel({ lead, onSave }) {
  const [notes, setNotes] = useState(lead.notes || '')
  const dirty = notes.trim() !== String(lead.notes || '').trim()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const next = withActivity({ ...lead, notes: notes.trim() }, 'Note', 'Internal notes updated')
        onSave(next, { okMsg: 'Notes saved' })
      }}
    >
      <Field label="Internal notes" htmlFor={`notes-${lead.id}`}>
        <textarea
          id={`notes-${lead.id}`}
          className="input"
          rows={8}
          value={notes}
          placeholder="Notes for the team"
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <div className="card-actions">
        <button type="submit" className="btn btn--accent btn--sm" disabled={!dirty}>Save notes</button>
      </div>
    </form>
  )
}

/* ---------------- Activity ---------------- */
function ActivityPanel({ lead }) {
  if (!lead.activities?.length) return <Empty>No activity yet.</Empty>
  return (
    <div className="crm-timeline">
      {lead.activities.map((item) => (
        <article className="crm-event" key={item.id}>
          <time className="crm-event__time" dateTime={item.at}>{dateLong(item.at)}</time>
          <span className="crm-event__type">{item.type}</span>
          {item.text && <p className="crm-event__text">{item.text}</p>}
        </article>
      ))}
    </div>
  )
}

/* ============================================================
   Pipeline board — drag and drop between the ten stages
   ============================================================ */

function Board({ leads, onMove, onSelect }) {
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)

  return (
    <div className="crm-board">
      {STAGES.map((stage) => {
        const inStage = leads.filter((lead) => lead.status === stage)
        return (
          <section
            key={stage}
            className={`crm-stage ${overStage === stage ? 'crm-stage--over' : ''}`}
            aria-label={`${stage} — ${inStage.length} lead${inStage.length === 1 ? '' : 's'}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverStage(stage) }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setOverStage((current) => (current === stage ? null : current))
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              setOverStage(null)
              const id = e.dataTransfer.getData('text/plain') || dragId
              const lead = leads.find((item) => item.id === id)
              if (lead) onMove(lead, stage)
            }}
          >
            <div className="crm-stage__head">
              <h3 className="crm-stage__name">{stage}</h3>
              <span className="crm-stage__count">{inStage.length}</span>
            </div>
            {inStage.length === 0 ? <p className="crm-stage__empty">Empty</p> : inStage.map((lead) => (
              /* Deliberately a div, not a button: Chromium never fires
                 dragstart on a form control, so a <button draggable> card
                 silently refuses to drag. role + tabIndex + key handling
                 give back everything the button element provided. */
              <div
                key={lead.id}
                role="button"
                tabIndex={0}
                draggable
                className={`crm-deal ${dragId === lead.id ? 'crm-deal--dragging' : ''}`}
                aria-label={`${lead.company}, priority ${lead.score}, in ${stage}. Open lead.`}
                onClick={() => onSelect(lead.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(lead.id) }
                }}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', lead.id)
                  e.dataTransfer.effectAllowed = 'move'
                  setDragId(lead.id)
                }}
                onDragEnd={() => { setDragId(null); setOverStage(null) }}
              >
                <span className="crm-deal__name">{lead.company}</span>
                <span className="crm-deal__meta">Priority {lead.score}</span>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

/* ============================================================
   Pipeline insights — arithmetic over the leads above, nothing else
   ============================================================ */

function Insights({ leads }) {
  const cards = useMemo(() => {
    const top = [...leads].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))[0]
    const followUps = leads.filter((l) => ['Contacted', 'Follow Up Required'].includes(l.status))
    const ready = leads.filter((l) => l.status === 'Ready To Contact')

    const counts = {}
    leads.forEach((lead) => {
      const key = String(lead.industry || '').trim()
      if (key) counts[key] = (counts[key] || 0) + 1
    })
    const topIndustry = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]

    return [
      ['High-priority leads', top
        ? `${top.company} carries your highest priority score at ${top.score}/100.`
        : 'No leads yet.'],
      ['Follow-ups due', followUps.length
        ? `${followUps.length} lead${followUps.length === 1 ? '' : 's'} need a follow-up decision.`
        : 'No follow-ups due.'],
      ['Ready to contact', ready.length
        ? `${ready.length} lead${ready.length === 1 ? '' : 's'} are ready for approved outreach.`
        : 'No approved outreach queue yet.'],
      ['Similar businesses', topIndustry
        ? `${topIndustry} is your densest segment with ${counts[topIndustry]} lead${counts[topIndustry] === 1 ? '' : 's'}. Worth keeping that shape in mind next time you add one by hand.`
        : 'Add a few leads and your strongest segment will show up here.'],
      ['Conversion opportunity', 'Move leads above 80 into approved outreach before adding more low-score records.'],
      ['GDPR guardrail', 'Use public business contact routes, note where each one came from, and avoid personal scraping or authenticated access.'],
    ]
  }, [leads])

  return (
    <div className="grid grid--3">
      {cards.map(([title, body], i) => (
        <Reveal key={title} delay={i * 0.04}>
          <EdgeCard className="card-pad" lift={false}>
            <span className="eyebrow">{title}</span>
            <p className="muted" style={{ marginTop: 'var(--s-3)', fontSize: 'var(--t-sm)' }}>{body}</p>
          </EdgeCard>
        </Reveal>
      ))}
    </div>
  )
}

/* ============================================================
   Add lead
   ============================================================ */

function AddLeadModal({ ownerName, onCancel, onCreate }) {
  const dialogRef = useRef(null)
  const firstRef = useRef(null)
  const [values, setValues] = useState({
    company: '', website: '', industry: '', location: '',
    size: '11-50', type: 'SME', score: 60, status: 'New Lead',
    email: '', phone: '', sourceUrl: '', signals: '', notes: '',
  })
  const [error, setError] = useState('')

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }))

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    firstRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  function submit(e) {
    e.preventDefault()
    const company = values.company.trim()
    if (!company) { setError('Required.'); firstRef.current?.focus(); return }
    setError('')

    const now = new Date().toISOString()
    const website = values.website.trim()
    const sourceUrl = values.sourceUrl.trim()

    onCreate({
      id: `lead-${slug(company) || 'lead'}-${Date.now().toString(36)}`,
      dbId: null,
      company,
      website,
      industry: values.industry.trim(),
      location: values.location.trim(),
      size: values.size,
      type: values.type,
      score: clampScore(values.score, 60),
      status: values.status,
      owner: ownerName,
      signals: values.signals.trim(),
      notes: values.notes.trim(),
      contacts: [{
        name: 'Public contact route',
        role: 'Manual entry',
        email: values.email.trim(),
        phone: values.phone.trim() || 'Contact form',
        source: sourceUrl || website || 'Manual entry',
        confidence: 65,
      }],
      outreachDraft: '',
      outreachApproved: false,
      createdAt: now,
      updatedAt: now,
      activities: [makeActivity('Lead created', 'Added manually by a team member', now)],
    })
  }

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div
        className="modal edge crm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-add-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <button type="button" className="modal__close" aria-label="Close" onClick={onCancel}>&times;</button>
        <span className="eyebrow">New CRM entry</span>
        <h2 className="modal__title modal__title--lg" id="crm-add-title">Add lead<span className="dot" /></h2>

        <form onSubmit={submit} noValidate>
          <div className="entity-form__grid">
            <div className="span-2">
              <Field label="Company" required error={error} htmlFor="al-company">
                <input
                  id="al-company" ref={firstRef} className="input" value={values.company}
                  onChange={(e) => set('company', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Website" htmlFor="al-website">
              <input
                id="al-website" className="input" type="url" value={values.website}
                placeholder="https://" onChange={(e) => set('website', e.target.value)}
              />
            </Field>
            <Field label="Industry" htmlFor="al-industry">
              <input
                id="al-industry" className="input" value={values.industry}
                onChange={(e) => set('industry', e.target.value)}
              />
            </Field>
            <Field label="Location" htmlFor="al-location">
              <input
                id="al-location" className="input" value={values.location}
                onChange={(e) => set('location', e.target.value)}
              />
            </Field>
            <Field label="Estimated size" htmlFor="al-size">
              <select id="al-size" className="input" value={values.size} onChange={(e) => set('size', e.target.value)}>
                {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Business type" htmlFor="al-type">
              <select id="al-type" className="input" value={values.type} onChange={(e) => set('type', e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field
              label="Priority score" htmlFor="al-score"
              help="Your own 1–100 ranking of how worthwhile this lead is."
            >
              <input
                id="al-score" className="input" type="number" min="1" max="100" value={values.score}
                onChange={(e) => set('score', e.target.value)}
              />
            </Field>
            <Field label="Stage" htmlFor="al-status">
              <select id="al-status" className="input" value={values.status} onChange={(e) => set('status', e.target.value)}>
                {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </Field>
            <Field label="Owner" htmlFor="al-owner">
              <input id="al-owner" className="input" value={ownerName} readOnly />
            </Field>
            <Field label="Public contact email" htmlFor="al-email">
              <input
                id="al-email" className="input" type="email" value={values.email}
                placeholder="name@company.co.uk" onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Public phone / form" htmlFor="al-phone">
              <input
                id="al-phone" className="input" value={values.phone}
                placeholder="Contact form" onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
            <Field label="Source URL" htmlFor="al-source" help="Where you found the contact route.">
              <input
                id="al-source" className="input" type="url" value={values.sourceUrl}
                placeholder="https://" onChange={(e) => set('sourceUrl', e.target.value)}
              />
            </Field>
            <div className="span-2">
              <Field label="Public signals" htmlFor="al-signals">
                <textarea
                  id="al-signals" className="input" rows={4} value={values.signals}
                  placeholder="Public website signals, contact route, operational clues"
                  onChange={(e) => set('signals', e.target.value)}
                />
              </Field>
            </div>
            <div className="span-2">
              <Field label="Internal notes" htmlFor="al-notes">
                <textarea
                  id="al-notes" className="input" rows={4} value={values.notes}
                  placeholder="Notes for the team"
                  onChange={(e) => set('notes', e.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="card-actions">
            <button type="submit" className="btn btn--accent">Save lead →</button>
            <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
