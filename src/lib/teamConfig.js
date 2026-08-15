/* ============================================================
   TEAM SPACE — table + form configuration
   Kept in one place so the read path, write path and form all
   agree. Column names must stay byte-identical to Supabase.
   ============================================================ */

export const TABS = ['clients', 'quotes', 'projects', 'meetings', 'documents']

export const TAB_LABEL = {
  clients: 'Clients', quotes: 'Quotes', projects: 'Projects',
  meetings: 'Meetings', documents: 'Documents',
}

export const ADD_LABEL = {
  clients: '+ Add client', quotes: '+ New quote', projects: '+ New project',
  meetings: '+ Schedule meeting', documents: '+ Add document',
}

export const SAVE_LABEL = {
  clients: 'Create client', quotes: 'Save quote', projects: 'Save project',
  meetings: 'Save meeting', documents: 'Save document',
}

export const EMPTY_MSG = {
  clients: 'No clients yet. Add your first one above.',
  quotes: 'No quotes yet.',
  projects: 'No projects yet.',
  meetings: 'No meetings yet.',
  documents: 'No documents yet.',
}

/* Ordering per table.
   NOTE: `projects` has NO created_at column — it must be queried with no
   .order() at all, or every request errors and the tab renders empty. */
export const ORDER = {
  clients:   { col: 'created_at',  asc: false },
  quotes:    { col: 'created_at',  asc: false },
  projects:  null,
  meetings:  { col: 'datetime',    asc: true },
  documents: { col: 'uploaded_at', asc: false },
}

export const FIELDS = {
  clients: [
    { name: 'business_name',  label: 'Business name',  type: 'text',  req: true, full: true },
    { name: 'contact_name',   label: 'Contact name',   type: 'text' },
    { name: 'contact_email',  label: 'Contact email',  type: 'email' },
    { name: 'access_key',     label: 'Access key',     type: 'key',   req: true, full: true },
  ],
  quotes: [
    { name: 'client_id',   label: 'Client',      type: 'client', req: true },
    { name: 'reference',   label: 'Reference',   type: 'text', placeholder: 'Q-2026-001' },
    { name: 'title',       label: 'Title',       type: 'text', req: true, full: true },
    { name: 'amount',      label: 'Amount',      type: 'money' },
    { name: 'status',      label: 'Status',      type: 'select', options: ['draft', 'sent', 'accepted', 'rejected'] },
    { name: 'pdf_url',     label: 'Quote PDF',   type: 'file', full: true,
      bucket: 'quotes', accept: '.pdf,application/pdf', maxMB: 10, pdfOnly: true },
    { name: 'valid_until', label: 'Valid until', type: 'date' },
  ],
  projects: [
    { name: 'client_id',           label: 'Client',              type: 'client', req: true },
    { name: 'title',               label: 'Title',               type: 'text', req: true },
    { name: 'description',         label: 'Description',         type: 'textarea', full: true },
    { name: 'status',              label: 'Status',              type: 'select', options: ['active', 'paused', 'complete'] },
    { name: 'progress_percent',    label: 'Progress',            type: 'progress' },
    { name: 'next_milestone',      label: 'Next milestone',      type: 'text' },
    { name: 'next_milestone_date', label: 'Next milestone date', type: 'date' },
  ],
  meetings: [
    { name: 'client_id', label: 'Client',        type: 'client', req: true },
    { name: 'title',     label: 'Title',         type: 'text', req: true, placeholder: 'Kickoff call' },
    { name: 'datetime',  label: 'Date & time',   type: 'datetime', req: true },
    { name: 'location',  label: 'Location',      type: 'text', placeholder: 'Microsoft Teams' },
    { name: 'join_url',  label: 'Join URL',      type: 'text' },
    { name: 'status',    label: 'Status',        type: 'select', options: ['scheduled', 'completed', 'cancelled'] },
  ],
  documents: [
    { name: 'client_id',     label: 'Client',        type: 'client', req: true },
    { name: 'title',         label: 'Title',         type: 'text', req: true, placeholder: 'Signed service agreement' },
    { name: 'document_type', label: 'Document type', type: 'select',
      options: ['contract', 'quote', 'invoice', 'report', 'proposal', 'other'] },
    { name: 'file_url',      label: 'File',          type: 'file', req: true, full: true,
      bucket: 'documents', accept: '', maxMB: 25 },
  ],
}

/* ---------- helpers shared by the team space ---------- */

export const gbp = (n) => {
  const num = Number(n)
  return isFinite(num)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(num)
    : ''
}

export const dateLong = (v) => {
  if (!v) return ''
  const d = new Date(v)
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const monthYear = (d) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase()
export const timeStr = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** ISO -> the value a datetime-local input expects (local, not UTC). */
export const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** [FIRST WORD UPPERCASE, MAX 6 ALNUM]-[4 RANDOM]-2026 */
export function generateKey(businessName) {
  let prefix = String(businessName || '').trim().split(/\s+/)[0]
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  if (!prefix) prefix = 'NABL'
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let rand = ''
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)]
  return `${prefix}-${rand}-2026`
}

/** Last path segment with the upload timestamp prefix stripped. */
export function baseName(path) {
  const seg = String(path || '').split('/').pop() || ''
  return seg.replace(/^\d{10,}-/, '')
}

export const fmtSize = (bytes) => {
  const b = Number(bytes) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

/** [client_id]/[timestamp]-[sanitised original name] */
export function storagePath(clientId, file) {
  const safe = String(file.name).replace(/[^A-Za-z0-9._-]/g, '_')
  return `${clientId || 'unknown'}/${Date.now()}-${safe}`
}

export function displayName(user) {
  if (!user) return 'team'
  const m = user.user_metadata || {}
  const named = m.display_name || m.full_name || m.name
  if (named && String(named).trim()) return String(named).trim()
  if (user.email) return user.email.split('@')[0]
  return 'team'
}
