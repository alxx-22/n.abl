import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { teamClient, friendlyError } from '../lib/supabase.js'
import PipelineHandoff from '../components/PipelineHandoff.jsx'
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

/* The research edge function. Absent by default: the CRM works without it,
   and the button says so rather than failing when pressed. */
const RESEARCH_URL = import.meta.env.VITE_RESEARCH_URL || ''

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

/* The three things a CRM is for: deciding what to do, doing it, and seeing
   the shape of the pipeline. Insights leads because it is the only one that
   answers "what now" without being asked. */
const VIEWS = [
  { id: 'insights', label: 'Insights' },
  { id: 'leads', label: 'Leads' },
  { id: 'board', label: 'Board' },
]

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'notes', label: 'Notes' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'activity', label: 'Activity' },
]

/* The compliance fields, and what each value actually permits. The help text
   is not decoration: these are the fields the send gate reads, and somebody
   changing one from a dropdown should be able to see what they are changing.
   Values must match the CHECK constraints in 202608160003 and 202608210003. */
const SUBSCRIBER_TYPES = [
  ['unknown', 'Unknown — cannot be marketed to at all'],
  ['corporate', 'Limited company, LLP, PLC — email is lawful without consent'],
  ['sole_trader', 'Sole trader — an individual subscriber; post only, unless they consented'],
  ['partnership', 'Partnership, not an LLP — same as a sole trader'],
  ['individual', 'A private person — same as a sole trader'],
]
const LAWFUL_BASES = [
  ['unassessed', 'Unassessed — blocks every channel'],
  ['not_personal_data', 'No personal data held — nothing to have a basis for'],
  ['legitimate_interests', 'Legitimate interests — needs an assessment on file'],
  ['consent', 'They asked to hear from us'],
  ['contract', 'Necessary to deliver something agreed'],
]
const SOURCES = [
  ['', 'Not recorded — blocks marketing'],
  ['companies_house', 'Companies House'],
  ['public_company_information', 'Another public register'],
  ['own_website', 'Their own website'],
  ['referral', 'Referral'],
  ['event', 'Event'],
  ['inbound_enquiry', 'They contacted us'],
]
const NOTICE_STATUSES = [
  ['not_given', 'Not given — blocks marketing'],
  ['given_at_first_contact', 'Linked in the first message'],
  ['given_on_request', 'Sent when they asked'],
  ['not_required', 'Not required — inbound, or no personal data'],
]
const MARKETING_STATUSES = [
  ['do_not_contact', 'Do not contact'],
  ['permitted', 'Permitted'],
  ['paused', 'Paused'],
  ['opted_out', 'Opted out — set by the opt-out path, not by hand'],
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

    subscriber_type: lead.subscriberType || 'unknown',
    subscriber_type_evidence: lead.subscriberEvidence || null,
    /* Stamped whenever a type other than unknown is recorded, because
       sales_leads_permitted_is_documented wants to know when it was checked
       and "at some point" is not an answer. */
    subscriber_type_checked_at: lead.subscriberType && lead.subscriberType !== 'unknown'
      ? (lead.subscriberCheckedAt || new Date().toISOString())
      : null,
    lawful_basis: lead.lawfulBasis || 'unassessed',
    lia_ref: lead.liaRef || null,
    lia_completed_at: lead.lawfulBasis === 'legitimate_interests' && lead.liaRef
      ? (lead.liaCompletedAt || new Date().toISOString())
      : null,
    source: lead.source || null,
    source_detail: lead.sourceDetail || null,
    source_date: lead.sourceDate || null,
    privacy_notice_status: lead.noticeStatus || 'not_given',
    marketing_status: lead.marketingStatus || 'do_not_contact',
    /* opt_out, opt_out_at and opt_out_channel are deliberately absent. pushLead
       sends the whole row on every save, so putting them here would let an
       unrelated edit in a stale tab clear an objection. They move only through
       apply_opt_out(). */
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

    /* Compliance. Read and written as a block, because the database checks
       them against each other: a permitted lead with no source, or
       legitimate interests with no assessment, is refused at the constraint
       rather than at the send. */
    subscriberType: row.subscriber_type || 'unknown',
    subscriberEvidence: row.subscriber_type_evidence || '',
    lawfulBasis: row.lawful_basis || 'unassessed',
    liaRef: row.lia_ref || '',
    source: row.source || '',
    sourceDetail: row.source_detail || '',
    sourceDate: row.source_date || '',
    noticeStatus: row.privacy_notice_status || 'not_given',
    marketingStatus: row.marketing_status || 'do_not_contact',
    /* Read-only here on purpose. An opt-out is set through apply_opt_out so
       it also writes a permanent suppression row; letting a save clear it
       would let one stale tab undo an objection. */
    optOut: row.opt_out === true,
    optOutAt: row.opt_out_at || null,
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
  /* Which of the three workspaces is showing. Everything used to be stacked on
     one page — metrics, filters, the lead list, the board and the insights,
     in that order — so finding anything meant scrolling past everything else.
     They are the same three jobs a CRM does and they are now three views. */
  const [view, setView] = useState('insights')
  /* A predicate handed over from Insights, so clicking "12 ready to contact"
     lands on exactly those twelve rather than on a stage filter that happens
     to be close. Carries its own label so the chip can say what it did. */
  const [focus, setFocus] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [handoff, setHandoff] = useState(null)
  const [ownerFilter, setOwnerFilter] = useState('')
  const [minScore, setMinScore] = useState(0)

  const [addOpen, setAddOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [expired, setExpired] = useState(false)
  const [toastNode, showToast] = useToast()

  /* Mirror every change to the local fallback store. */
  useEffect(() => { saveLocal(leads) }, [leads])

  /* Ask the gate, and only then let the message out.

     Until now the CRM opened a mail client and recorded nothing, so
     marketing_send_allowed — the whole compliance layer — was never consulted
     by the thing that actually sends. The panel even said "backend should
     enforce the same rule server-side". It does; nothing was calling it.

     The insert IS the check. marketing_sends carries a BEFORE INSERT trigger
     that runs the gate and the monthly ceiling, so a refused send never
     becomes a row and never opens a draft. Order matters: record first, send
     second. The other way round would mean discovering a lead was suppressed
     after the letter was in the post. */
  const recordSend = useCallback(async ({ lead, channel, recipient, subject }) => {
    if (!lead.dbId) {
      return { ok: false, message: 'This lead has not been saved to the server yet.' }
    }
    const { error } = await sb.from('marketing_sends').insert({
      lead_id: lead.dbId,
      channel,
      recipient,
      subject: subject || null,
      sender_identity: `n.abl <hello@nabl.agency>`,
      // The template carries an opt-out route in every channel; the column
      // exists so that claim is recorded rather than assumed.
      opt_out_included: true,
      approved_by: user?.id || null,
      approved_at: new Date().toISOString(),
      send_provider: channel === 'post' ? 'royal mail, by hand' : 'mail client',
    })
    if (!error) return { ok: true }
    /* The gate raises check_violation with a sentence explaining itself.
       Surfacing that verbatim is the point — "blocked by compliance gate:
       x@y on channel email is not permitted" tells an operator exactly what
       to fix, and a generic failure message would not. */
    return { ok: false, message: friendlyError(error, 'That send was refused.') }
  }, [sb, user])

  /* Research runs on the caller's own Claude subscription, through their own
     tunnel. This never learns the URL or the token — it sends a lead id and a
     session, and the edge function looks up whose endpoint to ask.

     Offered only when VITE_RESEARCH_URL is set, the same way the welcome-pack
     summariser is: the CRM has to work without it. */
  const researchLead = useCallback(async (lead) => {
    if (!RESEARCH_URL) return { ok: false, message: 'Research is not configured for this site.' }
    if (!lead.dbId) return { ok: false, message: 'Save the lead to the server first.' }
    try {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return { ok: false, message: 'SESSION_EXPIRED' }
      const res = await fetch(RESEARCH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ lead_id: lead.dbId }),
      })
      const body = await res.json().catch(() => ({}))
      /* The rate limit and the "no endpoint registered" case come back as
         sentences from the database, and they are the useful part — "20 runs
         in the last hour" tells you what to do, "request failed" does not. */
      if (!res.ok) return { ok: false, message: body.error || `Research failed (${res.status}).` }
      return { ok: true, result: body.result }
    } catch (err) {
      return { ok: false, message: friendlyError(err, 'Could not reach the research endpoint.') }
    }
  }, [sb])

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

        /* A successful read that returns nothing means the server genuinely
           has no leads, and this device must agree with it.

           This used to keep the local copy in that case, on the same reasoning
           as the catch block below — do not blank someone's workspace over a
           flaky connection. But the two situations are not the same, and only
           one of them is about connectivity. A read that THREW is handled
           below and still falls back to the device. A read that SUCCEEDED and
           returned zero rows is an answer, not a failure.

           It matters because of what happens next: the seven old-CRM leads
           were deleted on 21 August, and a device holding the stale mirror
           would not only keep showing them, it would re-insert one on the next
           save through pushLead. A deletion that a stale browser tab can undo
           is not a deletion. */
        if (!rows || !rows.length) {
          setLeads([])
          setLoading(false)
          return
        }

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

    // The two stages where a lead stops being a lead. Proposal Sent needs a
    // portal account for the quote to live in; Won needs the welcome pack and
    // the email that carries the key. Prompted, not silent — but pre-filled,
    // so it is one click rather than a job for later.
    if (toStatus === 'Proposal Sent' || toStatus === 'Won') {
      setHandoff({ lead: next, stage: toStatus })
    }
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
          && (!focus || focus.fn(lead))
      })
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
  }, [leads, search, statusFilter, ownerFilter, minScore, focus])

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
      {/* ---------- Ribbon ----------
          One sticky row carrying identity, the three views, search and the one
          action worth having always to hand. It replaces a header, a metrics
          strip and a filter block that together took most of a screen before
          any lead was visible. */}
      <div className="crm-ribbon">
        <Link to="/" className="crm-ribbon__brand" aria-label="n.abl home"><Logo size={20} /></Link>

        <nav className="crm-views" role="tablist" aria-label="Workspace">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              className={`crm-view ${view === v.id ? 'crm-view--on' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
              {v.id === 'leads' && leads.length > 0 && (
                <span className="crm-view__count">{leads.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="crm-ribbon__right">
          <input
            className="input crm-ribbon__search"
            type="search"
            value={search}
            aria-label="Search leads"
            placeholder="Search leads"
            onChange={(e) => { setSearch(e.target.value); if (view === 'insights') setView('leads') }}
          />
          <button type="button" className="btn btn--accent btn--sm" onClick={() => setAddOpen(true)}>
            + Lead
          </button>
          <Link to="/team" className="btn btn--ghost btn--sm crm-ribbon__team">Team</Link>
        </div>
      </div>

      <div className="shell crm-shell">
        {view === 'insights' && (
          <Insights
            leads={leads}
            onJump={(fn, label) => { setStatusFilter(''); setSearch(''); setView('leads'); setFocus({ fn, label }) }}
          />
        )}

        {view === 'board' && (
          <section aria-label="Pipeline board">
            <p className="dim crm-hint">
              Drag a lead between columns to change its stage. Every move is logged.
              Prefer the keyboard? Use the stage menu on the lead&rsquo;s Overview tab.
            </p>
            <Board leads={leads} onMove={moveLead} onSelect={(id) => { selectLead(id); setView('leads') }} />
          </section>
        )}

        {view === 'leads' && (
        <>
        {/* ---------- Filters ---------- */}
        <section aria-label="Lead filters">
          <div className="crm-filters">
            {focus && (
              <button type="button" className="crm-focus" onClick={() => setFocus(null)}>
                {focus.label} <span aria-hidden="true">×</span>
                <span className="sr-only">— clear this filter</span>
              </button>
            )}
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
                  onRecordSend={recordSend}
                  onResearch={researchLead}
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

        </>
        )}
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

      {handoff && (
        <PipelineHandoff
          lead={handoff.lead}
          stage={handoff.stage}
          ownerName={displayName(user)}
          onClose={() => setHandoff(null)}
        />
      )}
      {toastNode}
    </div>
  )
}

/* ============================================================
   Lead detail
   ============================================================ */

function LeadDetail({ lead, tab, onTab, onSave, onMove, onDelete, onRecordSend, onResearch }) {
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
        {tab === 'outreach' && (
          <OutreachPanel lead={lead} onSave={onSave} onRecordSend={onRecordSend} onResearch={onResearch} />
        )}
        {tab === 'notes' && <NotesPanel lead={lead} onSave={onSave} />}
        {tab === 'compliance' && <CompliancePanel lead={lead} onSave={onSave} />}
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
function OutreachPanel({ lead, onSave, onRecordSend, onResearch }) {
  const [text, setText] = useState(lead.outreachDraft || emailDraft(lead))
  const [refusal, setRefusal] = useState('')
  const [busy, setBusy] = useState(false)
  const [researching, setResearching] = useState(false)
  const [findings, setFindings] = useState(null)

  /* Reads the lead's own website through the operator's Claude subscription
     and comes back with observations, contact routes and a draft. The draft
     lands unapproved: it is a starting point for a human, not an outbox. */
  async function research() {
    setResearching(true); setRefusal('')
    const out = await onResearch(lead)
    setResearching(false)
    if (!out.ok) { setRefusal(out.message); return }
    const r = out.result || {}
    setFindings(r)
    if (r.draft_body) setText(`Subject: ${r.draft_subject || lead.company}\n\n${r.draft_body}`)
    onSave(withActivity({
      ...lead,
      signals: [lead.signals, ...(r.signals || [])].filter(Boolean).join('; ').slice(0, 2000),
      outreachDraft: r.draft_body ? `Subject: ${r.draft_subject || lead.company}\n\n${r.draft_body}` : lead.outreachDraft,
      /* Researching does not approve anything. A draft that arrived from a
         model and approved itself would defeat both gates. */
      outreachApproved: false,
    }, 'Note', 'Researched from their website'), { okMsg: 'Research complete' })
  }

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

  async function openInMail() {
    const contact = (lead.contacts || []).find((c) => c.email)
    const to = contact ? contact.email : 'hello@nabl.agency'
    const draft = lead.outreachDraft || emailDraft(lead)
    const subject = (draft.match(/^Subject:\s*(.+)$/m) || ['', `Quick idea for ${lead.company}`])[1]
    const body = draft.replace(/^Subject:.*\n\n?/m, '')

    /* Recorded before the draft opens, never after. The insert runs the
       compliance gate and the monthly ceiling, so if this lead is suppressed,
       unassessed or over the cap, no mail window appears at all. */
    setBusy(true); setRefusal('')
    const result = await onRecordSend({ lead, channel: 'email', recipient: to, subject })
    setBusy(false)
    if (!result.ok) { setRefusal(result.message); return }

    const from = lead.status
    onSave(withActivity({ ...lead, status: 'Contacted' }, 'Email opened',
      `Recorded as sent, then opened in mail client — ${to}`),
      { pipelineFrom: from, okMsg: 'Recorded and opened in your mail client' })
    window.location.href =
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  /* Post has no draft and no mail client — the letter is printed and put in an
     envelope. What the CRM does is the part software can do: ask the gate
     first, and record that it happened so the suppression list and the monthly
     ceiling stay true. */
  async function recordLetter() {
    const recipient = `The Owner, ${lead.location || lead.company}`
    setBusy(true); setRefusal('')
    const result = await onRecordSend({ lead, channel: 'post', recipient, subject: 'First contact letter' })
    setBusy(false)
    if (!result.ok) { setRefusal(result.message); return }
    const from = lead.status
    onSave(withActivity({ ...lead, status: 'Contacted' }, 'Letter sent',
      `First contact letter recorded — ${recipient}`),
      { pipelineFrom: from, okMsg: 'Letter recorded' })
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
          <button type="button" className="btn btn--ghost btn--sm" onClick={research}
            disabled={researching || !RESEARCH_URL}
            title={RESEARCH_URL ? 'Read their website and draft from what is actually there'
              : 'Set VITE_RESEARCH_URL to enable this'}>
            {researching ? 'Reading their site…' : 'Research this lead'}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={compose}>Compose draft</button>
          <button type="button" className="btn btn--accent btn--sm" onClick={approve} disabled={!text.trim()}>
            Approve email
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={openInMail}
            disabled={!approvedNow || busy}>
            Record and open in mail
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={recordLetter} disabled={busy}>
            Record a letter sent
          </button>
        </div>
        {refusal && <p className="crm-warn" role="status">{refusal}</p>}

        {findings && (
          <div className="crm-findings">
            {findings.summary && <p className="crm-findings__summary">{findings.summary}</p>}
            {findings.signals?.length > 0 && (
              <>
                <h4 className="crm-findings__h">What is actually on their site</h4>
                <ul>{findings.signals.map((s) => <li key={s}>{s}</li>)}</ul>
              </>
            )}
            {findings.contacts?.length > 0 && (
              <>
                <h4 className="crm-findings__h">Published contact routes</h4>
                <ul>{findings.contacts.map((c) => (
                  <li key={`${c.kind}-${c.value}`}>{c.value} <em>{c.kind}{c.where ? ` · ${c.where}` : ''}</em></li>
                ))}</ul>
              </>
            )}
            {findings.fit && (
              <>
                <h4 className="crm-findings__h">Whether we can help</h4>
                <p>{findings.fit}</p>
              </>
            )}
          </div>
        )}
      </div>

      <EdgeCard className="card-pad" lift={false} spotlight={false}>
        <span className="eyebrow">Approval</span>
        <h3 style={{ fontSize: 'var(--t-lg)', margin: 'var(--s-3) 0' }}>
          {approvedNow ? 'Approved' : lead.outreachApproved ? 'Edited since approval' : 'Not approved'}
        </h3>
        <p className="muted" style={{ fontSize: 'var(--t-sm)' }}>
          The page never sends automatically. Both buttons write a
          <code> marketing_sends </code> row first, which runs the compliance
          gate and the monthly ceiling in the database — a refused send opens
          nothing and records nothing. Post has no draft: the letter is printed
          and posted by hand, and the button records that it happened so the
          suppression list and the count stay true.
        </p>
      </EdgeCard>
    </div>
  )
}

/* ---------------- Notes ---------------- */
/* Why this panel exists.

   Every one of these fields is read by public.marketing_send_allowed before
   anything is sent, and until now none of them were visible in the CRM. A
   lead could be blocked from every channel and the only way to find out was
   to query the database. Worse, a lead promoted from the sourcing pipeline
   arrives with all of them already answered, and nobody could check whether
   the answers were right.

   The panel deliberately shows what each value PERMITS rather than just
   naming it. "sole_trader" tells you nothing; "an individual subscriber, post
   only unless they consented" tells you why the email button will not work.

   It cannot set opt_out. That moves only through apply_opt_out(), which also
   writes a permanent suppression row — see the note in leadToRow. */
function CompliancePanel({ lead, onSave }) {
  const [form, setForm] = useState({
    subscriberType: lead.subscriberType || 'unknown',
    subscriberEvidence: lead.subscriberEvidence || '',
    lawfulBasis: lead.lawfulBasis || 'unassessed',
    liaRef: lead.liaRef || '',
    source: lead.source || '',
    sourceDetail: lead.sourceDetail || '',
    sourceDate: lead.sourceDate || '',
    noticeStatus: lead.noticeStatus || 'not_given',
    marketingStatus: lead.marketingStatus || 'do_not_contact',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const dirty = Object.keys(form).some((k) => String(form[k] || '') !== String(lead[k] || ''))

  /* The same rules the database enforces, stated before the save rather than
     after it. A constraint violation arrives as a wall of SQL; this arrives as
     a sentence, and it is checked against the migration rather than guessed:
     sales_leads_permitted_is_documented and sales_leads_permitted_needs_a_basis. */
  const blockers = []
  if (form.marketingStatus === 'permitted') {
    if (form.subscriberType === 'unknown') blockers.push('a subscriber type — unknown is never marketable')
    if (form.lawfulBasis === 'unassessed') blockers.push('a lawful basis')
    if (!form.source) blockers.push('a source')
    if (!form.sourceDate) blockers.push('a source date')
    if (form.subscriberType !== 'corporate'
        && !['consent', 'not_personal_data'].includes(form.lawfulBasis)) {
      blockers.push('either consent or "no personal data held", because this is an individual subscriber')
    }
  }
  if (form.lawfulBasis === 'legitimate_interests' && !form.liaRef) {
    blockers.push('an assessment reference, because legitimate interests is being relied on')
  }

  /* What this lead can actually be sent, restating the channel rules in
     202608210003 so the answer is visible without running a query. */
  const permitted = form.marketingStatus === 'permitted' && !blockers.length && !lead.optOut
  const canEmail = permitted && form.subscriberType === 'corporate'
    && form.noticeStatus !== 'not_given'
  const canPost = permitted && form.noticeStatus !== 'not_given'
    && ['not_personal_data', 'legitimate_interests', 'consent', 'contract'].includes(form.lawfulBasis)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (blockers.length) return
        onSave(withActivity({ ...lead, ...form }, 'Note', 'Compliance record updated'),
          { okMsg: 'Compliance record saved' })
      }}
    >
      {lead.optOut && (
        <p className="crm-warn" role="status">
          This business has objected. That is absolute and permanent, it cannot be
          changed here, and nothing may be sent to them on any channel.
        </p>
      )}

      <dl className="crm-kv">
        <div>
          <dt>Email</dt>
          <dd>{canEmail ? 'Permitted' : 'Blocked'}</dd>
        </div>
        <div>
          <dt>Post</dt>
          <dd>{canPost ? 'Permitted' : 'Blocked'}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>Blocked — needs TPS and CTPS screening we do not hold</dd>
        </div>
      </dl>

      <Field label="Subscriber type" htmlFor={`st-${lead.id}`}
        help="Which PECR rules apply. A question about legal form, not size — check Companies House.">
        <select id={`st-${lead.id}`} className="input" value={form.subscriberType} onChange={set('subscriberType')}>
          {SUBSCRIBER_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </Field>

      <Field label="Evidence for that" htmlFor={`se-${lead.id}`}
        help='What settled it. "Companies House 09876543", or "their site says Ltd but gives no number".'>
        <input id={`se-${lead.id}`} className="input" value={form.subscriberEvidence}
          onChange={set('subscriberEvidence')} placeholder="Companies House 09876543" />
      </Field>

      <Field label="Lawful basis" htmlFor={`lb-${lead.id}`}
        help="Only needed where personal data is held. A company at a role address holds none.">
        <select id={`lb-${lead.id}`} className="input" value={form.lawfulBasis} onChange={set('lawfulBasis')}>
          {LAWFUL_BASES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </Field>

      {form.lawfulBasis === 'legitimate_interests' && (
        <Field label="Assessment reference" htmlFor={`lia-${lead.id}`}
          help="The assessment relied on, e.g. LIA-2026-08-v2. It must exist and be on file.">
          <input id={`lia-${lead.id}`} className="input" value={form.liaRef}
            onChange={set('liaRef')} placeholder="LIA-2026-08-v2" />
        </Field>
      )}

      <Field label="Where they came from" htmlFor={`src-${lead.id}`}
        help='If you do not know, leave it unrecorded. A guess that clears a constraint is worse than a gap.'>
        <select id={`src-${lead.id}`} className="input" value={form.source} onChange={set('source')}>
          {SOURCES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </Field>

      <Field label="Source detail" htmlFor={`sd-${lead.id}`}>
        <input id={`sd-${lead.id}`} className="input" value={form.sourceDetail}
          onChange={set('sourceDetail')} placeholder="Which file, which page" />
      </Field>

      <Field label="Source date" htmlFor={`sdt-${lead.id}`} help="When we obtained it.">
        <input id={`sdt-${lead.id}`} type="date" className="input" value={form.sourceDate}
          onChange={set('sourceDate')} />
      </Field>

      <Field label="Privacy notice" htmlFor={`pn-${lead.id}`}
        help="Article 14. Owed whenever personal data was obtained from someone other than them.">
        <select id={`pn-${lead.id}`} className="input" value={form.noticeStatus} onChange={set('noticeStatus')}>
          {NOTICE_STATUSES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </Field>

      <Field label="Marketing status" htmlFor={`ms-${lead.id}`}
        help="Permitted still does not send anything. Every message goes through the gate as well.">
        <select id={`ms-${lead.id}`} className="input" value={form.marketingStatus}
          onChange={set('marketingStatus')} disabled={lead.optOut}>
          {MARKETING_STATUSES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </Field>

      {blockers.length > 0 && (
        <p className="crm-warn" role="status">
          Cannot be permitted yet. Still needs {blockers.join('; ')}.
        </p>
      )}

      <div className="card-actions">
        <button type="submit" className="btn btn--accent btn--sm" disabled={!dirty || blockers.length > 0}>
          Save compliance record
        </button>
      </div>
    </form>
  )
}

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
            {/* Wrapper so the head stays fixed and only the cards scroll —
                see .crm-stage__cards. */}
            <div className="crm-stage__cards">
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
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ============================================================
   Pipeline insights — arithmetic over the leads above, nothing else
   ============================================================ */

/* The page that opens first, so it has to answer "what do I do now" rather
   than restate what is already on screen elsewhere.

   The old version was six cards of prose, three of which were the same advice
   for every pipeline — "move leads above 80 into approved outreach", "use
   public business contact routes". Advice that does not change is
   documentation, not an insight, and it belongs in the business pack where it
   already is.

   What replaces it is three questions with numbers attached, each clickable
   through to the leads it counted:

     Where is everything?      the funnel, and where it stops
     What is waiting on me?    the queue, in the order it should be worked
     Can I actually reach it?  the split by channel, which decides the day

   Nothing here is a target or a projection. Every figure is a count of rows
   that exist. */
function Insights({ leads, onJump }) {
  const m = useMemo(() => {
    const at = (...stages) => leads.filter((l) => stages.includes(l.status))
    const total = leads.length

    /* Reachability, which is the number that decides what work is possible
       today. A lead with a role email is free to contact; one with only an
       address costs a stamp; one with neither needs research first. */
    const withEmail = leads.filter((l) => (l.contacts || []).some((c) => c.email))
    const withPhone = leads.filter((l) => (l.contacts || []).some((c) => c.phone)
      && !(l.contacts || []).some((c) => c.email))
    const postOnly = leads.filter((l) => !(l.contacts || []).some((c) => c.email || c.phone)
      && Boolean(l.location))
    const unreachable = leads.filter((l) => !(l.contacts || []).some((c) => c.email || c.phone)
      && !l.location)

    /* The queue. Ordered by what unblocks the most, not by stage order:
       a reply left sitting is worse than a lead not yet contacted. */
    const queue = [
      {
        key: 'replied',
        label: 'Replied — waiting on you',
        n: at('Replied').length,
        fn: (l) => l.status === 'Replied',
        urgent: true,
      },
      {
        key: 'followup',
        label: 'Follow-up due',
        n: at('Follow Up Required').length,
        fn: (l) => l.status === 'Follow Up Required',
        urgent: true,
      },
      {
        key: 'ready',
        label: 'Ready to contact',
        n: at('Ready To Contact').length,
        fn: (l) => l.status === 'Ready To Contact',
      },
      {
        key: 'drafted',
        label: 'Drafted, not yet approved',
        n: leads.filter((l) => l.outreachDraft && !l.outreachApproved).length,
        fn: (l) => Boolean(l.outreachDraft) && !l.outreachApproved,
      },
      {
        key: 'blocked',
        label: 'Blocked until assessed',
        n: leads.filter((l) => l.marketingStatus !== 'permitted' && !l.optOut).length,
        fn: (l) => l.marketingStatus !== 'permitted' && !l.optOut,
        note: 'Nothing can be sent to these. Compliance tab on each one.',
      },
      {
        key: 'proposal',
        label: 'Proposal out, no answer',
        n: at('Proposal Sent').length,
        fn: (l) => l.status === 'Proposal Sent',
      },
    ].filter((q) => q.n > 0)

    /* The funnel, as counts at each stage rather than a conversion rate.
       A rate over twenty leads is noise, and quoting one would invite a
       decision it cannot support. */
    const funnel = STAGES
      .filter((st) => st !== 'Lost')
      .map((st) => ({ stage: st, n: leads.filter((l) => l.status === st).length }))
    const peak = Math.max(1, ...funnel.map((f) => f.n))

    const sectors = {}
    for (const l of leads) {
      const key = String(l.industry || '').trim()
      if (key) sectors[key] = (sectors[key] || 0) + 1
    }
    const topSectors = Object.entries(sectors).sort((a, b) => b[1] - a[1]).slice(0, 6)

    return { total, withEmail, withPhone, postOnly, unreachable, queue, funnel, peak, topSectors,
      won: at('Won').length, lost: at('Lost').length, optedOut: leads.filter((l) => l.optOut).length }
  }, [leads])

  if (!m.total) {
    return (
      <Empty>
        Nothing in the pipeline yet. Add a lead from the ribbon, or load a sourced
        batch — see <code>business/10-lead-sourcing</code>.
      </Empty>
    )
  }

  return (
    <div className="crm-insights">
      <section className="crm-ins__block" aria-label="What needs you">
        <h2 className="crm-ins__h">What needs you</h2>
        {m.queue.length === 0 ? (
          <p className="dim crm-hint">Nothing waiting. Everything is either sent or parked.</p>
        ) : (
          <ul className="crm-queue">
            {m.queue.map((q) => (
              <li key={q.key}>
                <button
                  type="button"
                  className={`crm-queue__row ${q.urgent ? 'crm-queue__row--urgent' : ''}`}
                  onClick={() => onJump(q.fn, q.label)}
                >
                  <span className="crm-queue__n">{q.n}</span>
                  <span className="crm-queue__label">
                    {q.label}
                    {q.note && <em className="crm-queue__note">{q.note}</em>}
                  </span>
                  <span className="crm-queue__go" aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="crm-ins__block" aria-label="How you can reach them">
        <h2 className="crm-ins__h">How you can reach them</h2>
        <ul className="crm-reach">
          {[
            ['Email', m.withEmail, 'free, and capped at 2,400 a month'],
            ['Phone only', m.withPhone, 'needs TPS screening before any call'],
            ['Post only', m.postOnly, 'costs a stamp, capped at 1,000 a month'],
            ['No route yet', m.unreachable, 'needs an address or a website first'],
          ].map(([label, set, note]) => (
            <li key={label}>
              <button type="button" className="crm-reach__row"
                onClick={() => onJump((l) => set.some((x) => x.id === l.id), label)}
                disabled={!set.length}>
                <span className="crm-reach__bar" aria-hidden="true">
                  <i style={{ width: `${Math.round((set.length / m.total) * 100)}%` }} />
                </span>
                <span className="crm-reach__n">{set.length}</span>
                <span className="crm-reach__label">{label}<em>{note}</em></span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="crm-ins__block crm-ins__block--wide" aria-label="Pipeline shape">
        <h2 className="crm-ins__h">Where everything is</h2>
        <ul className="crm-funnel">
          {m.funnel.map((f) => (
            <li key={f.stage}>
              <button type="button" className="crm-funnel__row"
                onClick={() => onJump((l) => l.status === f.stage, f.stage)}
                disabled={!f.n}>
                <span className="crm-funnel__stage">{f.stage}</span>
                <span className="crm-funnel__bar" aria-hidden="true">
                  <i style={{ width: `${Math.round((f.n / m.peak) * 100)}%` }} />
                </span>
                <span className="crm-funnel__n">{f.n}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="dim crm-hint">
          {m.lost > 0 && `${m.lost} lost. `}
          {m.optedOut > 0 && `${m.optedOut} objected and can never be contacted again. `}
          Counts, not conversion rates — a rate over {m.total} lead{m.total === 1 ? '' : 's'} would be noise.
        </p>
      </section>

      {m.topSectors.length > 0 && (
        <section className="crm-ins__block crm-ins__block--wide" aria-label="Sectors">
          <h2 className="crm-ins__h">What is in there</h2>
          <ul className="crm-sectors">
            {m.topSectors.map(([name, n]) => (
              <li key={name}>
                <button type="button" className="crm-sector"
                  onClick={() => onJump((l) => l.industry === name, name)}>
                  {name} <span>{n}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
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
