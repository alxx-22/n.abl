import { useCallback, useEffect, useMemo, useState } from 'react'
import { teamClient, friendlyError } from '../lib/supabase.js'
import { Loading, Empty } from './ui/index.jsx'
import ArgumentTranscript from './ArgumentTranscript.jsx'
import { SplitView, RecordBar, SectionTabs, SectionPanel, Sheet, usePickScroll } from './ui/Workspace.jsx'

/* ============================================================
   LEAD GEN

   New businesses into the list, argued for by agents rather than
   scraped. A Companies House search pulls register rows for the towns
   and SIC codes below; for each one, in turn:

     research    reads the register row and the business's own site
     signals     turns those facts into signals, and research reviews them
     sales       sets the signals against the service portfolio and picks
     specialists the specialist for each picked service argues the score
                 with sales until one accepts the other's exact number

   A service has a score only when both sides named the same number. No
   agreement is "disputed", and a disputed service scores nothing.

   Every table is RLS-on and closed; this reads through prospect_dashboard
   and prospect_transcript and writes through six RPCs that re-check what
   they were sent. The work itself is done by the lead-prospector edge
   function, woken every five minutes - and doing nothing until a target
   is running. NOTHING HERE SENDS ANYTHING, and a promoted lead arrives
   do_not_contact: finding a business is not permission to write to it.
   ============================================================ */

const STATUSES = [
  { id: '', label: 'All' },
  { id: 'scored', label: 'Scored' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'working', label: 'Working' },
  { id: 'queued', label: 'Queued' },
  { id: 'no_fit', label: 'No fit' },
  { id: 'failed', label: 'Failed' },
  { id: 'promoted', label: 'Promoted' },
]

const STAGE_LABEL = {
  research: 'research',
  signals: 'signals and review',
  sales: 'sales picking services',
  specialists: 'sales and specialists agreeing a score',
  done: 'done',
}

const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-GB'))
const nice = (s) => String(s || '').replace(/_/g, ' ')
const list = (s) => String(s || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean)
const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const blankDraft = (t) => ({
  id: t ? t.id : null,
  name: t ? t.name : '',
  towns: t ? (t.towns || []).join(', ') : '',
  sic: t ? (t.sic_codes || []).join(', ') : '',
  from: (t && t.incorporated_from) || '',
  to: (t && t.incorporated_to) || '',
})

/* The same three tests prospect_save_target makes, so a bad draft says so
   before the round trip. The database stays the authority. */
function problemWith(d) {
  if (!d.name.trim()) return 'Give the target a name'
  const towns = list(d.towns)
  if (!towns.length) return 'Add at least one town or city'
  if (towns.some((t) => /[0-9]/.test(t))) return 'A town, not a postcode'
  if (list(d.sic).some((s) => !/^[0-9]{2,5}$/.test(s))) return 'SIC codes are two to five digits'
  if (d.from && d.to && d.from > d.to) return 'Incorporated from is after incorporated to'
  return ''
}

/* The argument, word for word, fetched when its section is opened. */
function Transcript({ id }) {
  const [moves, setMoves] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    teamClient().rpc('prospect_transcript', { p_id: id })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) throw error
        setMoves(Array.isArray(data) ? data : [])
      })
      .catch((e) => { if (alive) setErr(friendlyError(e, 'Could not read the argument.')) })
    return () => { alive = false }
  }, [id])

  if (err) return <p className="crm-warn">{err}</p>
  if (!moves) return <Loading label="Reading the argument" />
  return <ArgumentTranscript moves={moves} empty="Nobody has said anything about this business yet." />
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'fit', label: 'Service fit' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'argument', label: 'Argument log' },
]

function Services({ rows, labels }) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  return (
    <div className="lg-services">
      <u>Services, and whether sales and the specialist agreed</u>
      {rows.map((s) => (
        <div className={`lg-service lg-service--${s.status}`} key={s.service}>
          <div className="lg-service__head">
            <b>{labels[s.service] || nice(s.service)}</b>
            <span>
              {s.status === 'agreed'
                ? <>agreed at <strong>{num(s.score)}</strong></>
                : <>disputed · sales {num(s.sales_last)}, specialist {num(s.specialist_last)} · no score</>}
              {' '}· {num(s.turns)} turns
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* One business, in sections, with the three decisions a person makes
   about it kept in the bar so they are reachable from every section. */
function CandidateRecord({ cand, labels, section, onSection, onBack, busy, onPromote, onDismiss, onRetry }) {
  const services = Array.isArray(cand.services) ? cand.services : []
  const asks = services.filter((s) => s.confirm_question || s.walk_away_if)
  const tabs = SECTIONS.map((t) => ({
    ...t,
    count: t.id === 'argument' ? cand.moves : t.id === 'fit' ? services.length : null,
  }))

  const actions = (
    <>
      {['scored', 'disputed', 'no_fit'].includes(cand.status) && (
        <button type="button" className="btn btn--accent btn--sm" disabled={Boolean(busy)} onClick={() => onPromote(cand)}>
          Promote
        </button>
      )}
      {cand.status !== 'promoted' && (
        <button type="button" className="btn btn--ghost btn--sm" disabled={Boolean(busy)} onClick={() => onDismiss(cand)}>
          Dismiss
        </button>
      )}
      {['failed', 'no_fit', 'disputed', 'scored'].includes(cand.status) && (
        <button type="button" className="btn btn--ghost btn--sm" disabled={Boolean(busy)} onClick={() => onRetry(cand)}>
          Argue again
        </button>
      )}
    </>
  )

  return (
    <>
      <RecordBar
        title={cand.company}
        sub={<>{cand.town || 'location unknown'}{cand.score != null ? ` · ${cand.score}` : ''}
          {' '}· <span className={`ol-tag lg-tag--${cand.status}`}>{nice(cand.status)}</span></>}
        backLabel="All businesses"
        onBack={onBack}
        actions={actions}
        tabs={<SectionTabs tabs={tabs} active={section} onChange={onSection} label="Business sections" idPrefix="lg" />}
      />
      <SectionPanel idPrefix="lg" active={section}>
        {section === 'overview' && (
          <>
            <p className="ol-detail__sub">
              {cand.activity || 'activity unknown'}
              {cand.number && (
                <> · <a className="crm-link" target="_blank" rel="noreferrer noopener"
                  href={`https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(cand.number)}`}>
                  Companies House {cand.number}</a></>
              )}
            </p>
            <dl className="crm-kv">
              <div><dt>Score</dt><dd>{cand.score != null ? num(cand.score) : (cand.status === 'disputed' ? 'none — disputed' : '—')}</dd></div>
              <div><dt>Status</dt><dd>{nice(cand.status)}{cand.status === 'working' || cand.status === 'queued' ? ` · ${STAGE_LABEL[cand.stage] || cand.stage}` : ''}</dd></div>
              <div><dt>Incorporated</dt><dd>{cand.incorporated_on || '—'}{cand.company_type ? ` · ${nice(cand.company_type)}` : ''}</dd></div>
              <div>
                <dt>Website</dt>
                <dd>
                  {cand.website
                    ? <><a className="crm-link" href={cand.website} target="_blank" rel="noreferrer noopener">{cand.website.replace(/^https?:\/\//, '')}</a>
                      {Array.isArray(cand.website_confirmed_by) && cand.website_confirmed_by.length > 0 && ` · confirmed by ${cand.website_confirmed_by.join(' + ')}`}</>
                    : nice(cand.website_outcome) || '—'}
                </dd>
              </div>
            </dl>
            {cand.error && (
              <p className="crm-warn">
                {cand.status === 'failed' ? `Failed after ${cand.attempts} attempts. ` : ''}{cand.error}
              </p>
            )}
          </>
        )}

        {section === 'fit' && (services.length
          ? <Services rows={services} labels={labels} />
          : <p className="at-empty">{cand.status === 'queued' || cand.status === 'working'
            ? `Not there yet — ${STAGE_LABEL[cand.stage] || cand.stage}.`
            : 'Sales found no service to put to a specialist.'}</p>)}

        {section === 'outreach' && (
          <>
            {cand.status === 'promoted'
              ? <p className="ol-summary">In Leads, marked do not contact. Writing to them is a decision made there, by a person.</p>
              : <p className="ol-summary">Not a lead yet. Promoting it adds it to Leads marked do not contact — finding a business is not permission to write to it.</p>}
            {asks.length === 0 && <p className="at-empty">No call questions yet — they come from the specialists.</p>}
            {asks.length > 0 && (
              <div className="lg-services">
                <u>Before anyone writes: what to ask, and when to walk away</u>
                {asks.map((s) => (
                  <div className={`lg-service lg-service--${s.status}`} key={s.service}>
                    <div className="lg-service__head"><b>{labels[s.service] || nice(s.service)}</b></div>
                    {s.confirm_question && <p><em>the question that settles it:</em> {s.confirm_question}</p>}
                    {s.walk_away_if && <p><em>walk away if:</em> {s.walk_away_if}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {section === 'argument' && <Transcript key={cand.id} id={cand.id} />}
      </SectionPanel>
    </>
  )
}

export default function LeadGen() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(null)
  const [runOpen, setRunOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [said, setSaid] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [section, setSection] = useState('overview')
  const nav = usePickScroll(setSelected)
  const closeRun = useCallback(() => setRunOpen(false), [])

  const load = useCallback(async () => {
    try {
      const { data: doc, error: err } = await teamClient().rpc('prospect_dashboard')
      if (err) throw err
      setData(doc || {})
      setError('')
    } catch (err) {
      setError(friendlyError(err, 'Could not read lead gen.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const targets = useMemo(() => (data && Array.isArray(data.targets) ? data.targets : []), [data])
  const candidates = useMemo(() => (data && Array.isArray(data.candidates) ? data.candidates : []), [data])
  const live = useMemo(() => targets.find((t) => t.running) || null, [targets])
  const labels = useMemo(() => Object.fromEntries(
    ((data && data.services) || []).map((s) => [s.key, s.label]),
  ), [data])

  useEffect(() => {
    if (!data || draft) return
    setDraft(blankDraft(live || targets[0] || null))
  }, [data, draft, live, targets])

  const shown = useMemo(
    () => (statusFilter ? candidates.filter((c) => c.status === statusFilter) : candidates),
    [candidates, statusFilter],
  )
  const cand = useMemo(() => candidates.find((c) => c.id === selected) || null, [candidates, selected])

  /* Every write is an RPC; this reports what the database answered. */
  const call = useCallback(async (label, fn, whenDone, keepDraft = true) => {
    setBusy(label)
    setSaid('')
    try {
      const { data: r, error: err } = await fn()
      if (err) throw err
      setSaid(whenDone(r))
      if (!keepDraft) setDraft(null)
      await load()
    } catch (err) {
      setSaid(friendlyError(err, 'That did not go through.'))
    } finally {
      setBusy('')
    }
  }, [load])

  const problem = draft ? problemWith(draft) : ''
  const running = Boolean(live && draft && live.id === draft.id)

  const save = () => call('Saving', () => teamClient().rpc('prospect_save_target', {
    p_id: draft.id,
    p_name: draft.name.trim(),
    p_towns: list(draft.towns),
    p_sic_codes: list(draft.sic),
    p_incorporated_from: draft.from || null,
    p_incorporated_to: draft.to || null,
  }), (id) => {
    setDraft((d) => ({ ...d, id: id || d.id }))
    return running ? 'Saved — the next tick uses it' : 'Saved — press Run to start it'
  })

  const start = () => call('Starting', () => teamClient().rpc('prospect_start', { p_id: draft.id }),
    () => 'Running — the first tick is within five minutes')
  const stop = () => call('Stopping', () => teamClient().rpc('prospect_stop', {}), () => 'Stopped')

  const promote = (c) => call('Promoting', () => teamClient().rpc('prospect_promote', { p_id: c.id }),
    () => `${c.company} is in Leads, marked do not contact`)
  const dismiss = (c) => call('Dismissing', () => teamClient().rpc('prospect_dismiss', { p_id: c.id }),
    () => `${c.company} dismissed`)
  const retry = (c) => call('Queuing', () => teamClient().rpc('prospect_retry', { p_id: c.id }),
    () => `${c.company} goes back to research; its old argument is gone`)

  if (loading) return <Loading label="Reading lead gen" />
  if (error) {
    return (
      <Empty>
        {error === 'SESSION_EXPIRED' ? 'Your session expired — sign in again from the team space.' : error}
      </Empty>
    )
  }

  const counts = (data && data.counts) || {}
  const lastRun = data && data.last_run
  const models = (data && Array.isArray(data.models)) ? data.models : []
  const chains = (data && data.chains) || {}

  return (
    <section className="ol lg ws-page" aria-label="Lead generation">
      <div className="ol-counts">
        {[
          ['queued', counts.queued], ['working', counts.working], ['scored', counts.scored],
          ['disputed', counts.disputed], ['promoted', counts.promoted],
        ].map(([label, n]) => (
          <div className="ol-count" key={label}><b>{num(n || 0)}</b><span>{label}</span></div>
        ))}
        <div className={`ol-count ol-count--state ${live ? 'is-on' : ''}`}>
          <b>{live ? 'Running' : 'Stopped'}</b>
          <span>{live ? live.name : 'nothing runs until you press Run'}</span>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm ol-counts__btn"
          aria-haspopup="dialog"
          onClick={() => setRunOpen(true)}
        >
          Run settings
        </button>
      </div>

      {(lastRun && lastRun.error) || said ? (
        <p className={`lg-lastrun ${lastRun && lastRun.error && !said ? 'is-bad' : ''}`} role="status">
          {said || <><em>last tick went wrong:</em> {lastRun.error}</>}
        </p>
      ) : null}

      <Sheet open={runOpen && Boolean(draft)} title="Who to look for" onClose={closeRun}>
        {draft && (
          <>
            {targets.length > 1 && (
              <select
                className="input lg-pick"
                aria-label="Saved targets"
                value={draft.id || ''}
                onChange={(e) => setDraft(blankDraft(targets.find((t) => t.id === e.target.value) || null))}
              >
                <option value="">New target</option>
                {targets.map((t) => <option key={t.id} value={t.id}>{t.name}{t.running ? ' (running)' : ''}</option>)}
              </select>
            )}

            <div className="lg-form">
              <label>
                <span>Name</span>
                <input className="input" type="text" value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label>
                <span>Towns or cities, comma separated</span>
                <input className="input" type="text" value={draft.towns} placeholder="Nottingham, Derby"
                  onChange={(e) => setDraft({ ...draft, towns: e.target.value })} />
              </label>
              <label>
                <span>SIC codes or prefixes, comma separated — blank for any</span>
                <input className="input" type="text" inputMode="numeric" value={draft.sic} placeholder="62, 7022"
                  onChange={(e) => setDraft({ ...draft, sic: e.target.value })} />
              </label>
              <div className="lg-form__dates">
                <label>
                  <span>Incorporated from</span>
                  <input className="input" type="date" value={draft.from}
                    onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
                </label>
                <label>
                  <span>to</span>
                  <input className="input" type="date" value={draft.to}
                    onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
                </label>
              </div>
            </div>

            <div className="ol-actions ws-sheet__actions">
              <button type="button" className="btn btn--sm" disabled={Boolean(busy) || Boolean(problem)} onClick={save}>
                Save target
              </button>
              {running ? (
                <button type="button" className="btn btn--sm ol-stop" disabled={Boolean(busy)} onClick={stop}>Stop</button>
              ) : (
                <button type="button" className="btn btn--accent btn--sm" disabled={Boolean(busy) || !draft.id} onClick={start}>
                  Run
                </button>
              )}
              <span className="ol-said" role="status">
                {busy ? `${busy}…` : (said || problem || (!draft.id ? 'Save the target before starting it' : ''))}
              </span>
            </div>

            {lastRun && (
              <p className={`lg-lastrun ${lastRun.error ? 'is-bad' : ''}`}>
                Last tick {when(lastRun.finished_at || lastRun.started_at)} · pulled {num(lastRun.pulled)} ·{' '}
                {num(lastRun.stages)} stages · {num(lastRun.finished)} finished
                {lastRun.error && <><br /><em>went wrong:</em> {lastRun.error}</>}
              </p>
            )}

            {(models.length > 0 || Object.keys(chains).length > 0) && (
              <div className="ol-models">
                <u>Discovery project — today, Pacific. Its own key, never the writer&rsquo;s.</u>
                {Object.keys(chains).length > 0 && (
                  <dl className="lg-chains">
                    {Object.entries(chains).map(([role, chain]) => (
                      <div key={role}><dt>{nice(role.replace(/^prospect_/, ''))}</dt><dd>{(chain || []).join(' → ')}</dd></div>
                    ))}
                  </dl>
                )}
                {models.length > 0 && (
                  <table>
                    <thead><tr><th>model</th><th>calls</th><th>ceiling</th></tr></thead>
                    <tbody>
                      {models.map((m) => (
                        <tr key={m.model}>
                          <td>{m.model}</td>
                          <td>{num(m.used)}</td>
                          <td>{m.exhausted ? (m.observed_rpd == null ? 'yes' : num(m.observed_rpd)) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </Sheet>

      <div className="ol-filters" role="group" aria-label="Filter by status">
        {STATUSES.map((st) => (
          <button
            key={st.id || 'all'}
            type="button"
            className={`crm-view ${statusFilter === st.id ? 'crm-view--on' : ''}`}
            aria-pressed={statusFilter === st.id}
            onClick={() => setStatusFilter(st.id)}
          >
            {st.label}
            <span className="crm-view__count">
              {st.id ? (counts[st.id] || 0) : candidates.length}
            </span>
          </button>
        ))}
      </div>

      <SplitView
        picked={Boolean(cand)}
        innerRef={nav.ref}
        label="Businesses"
        list={(
          <div className="ol-list">
            {shown.length === 0 && <Empty>Nothing in this state.</Empty>}
            {shown.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`crm-leadbtn ${selected === c.id ? 'crm-leadbtn--active' : ''}`}
                aria-current={selected === c.id ? 'true' : undefined}
                onClick={() => nav.pick(c.id)}
              >
                <span className="ol-list__name">{c.company}</span>
                <span className="ol-list__meta">
                  {c.town || '—'} · {c.activity || 'activity unknown'}{c.score != null ? ` · ${c.score}` : ''}
                </span>
                <span className={`ol-tag lg-tag--${c.status}`}>{nice(c.status)}</span>
              </button>
            ))}
          </div>
        )}
        detail={cand ? (
          <CandidateRecord
            cand={cand}
            labels={labels}
            section={section}
            onSection={setSection}
            onBack={nav.back}
            busy={busy}
            onPromote={promote}
            onDismiss={dismiss}
            onRetry={retry}
          />
        ) : (
          <div className="crm-hint ws-hint">
            <p>
              Pick a business to see what the agents found, which services sales picked, whether
              each specialist agreed a score, and every word they said to each other — each a tab away.
            </p>
          </div>
        )}
      />
    </section>
  )
}
