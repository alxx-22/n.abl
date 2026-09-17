import { useCallback, useEffect, useMemo, useState } from 'react'
import { teamClient, friendlyError } from '../lib/supabase.js'
import { Loading, Empty } from './ui/index.jsx'

/* ============================================================
   THE ARGUMENT LOG

   What the outreach writer did, and who the next run is for.

   Every outreach table is RLS-on with no policies and no grant to
   authenticated, which is why this reads through exactly one function:
   public.outreach_dashboard() returns the whole page as one jsonb
   document, and the tables underneath stay shut. Adding a field here
   means editing that function, not opening a table.

   NOTHING ON THIS PAGE SENDS ANYTHING. Both approval gates are human
   and both are before sending. The switch at the bottom of the run
   panel is the arming control, it is disabled while any blocker holds,
   and the database re-checks the typed name regardless of what this
   component sent.

   THE COUNT REACTS BEFORE YOU COMMIT TO IT. The reach beside the
   heading is computed here, from the leads already loaded, running the
   same four tests outreach_target_reach runs in SQL. A filter whose
   effect you cannot see until after you save is a filter you are
   guessing at. The database stays the authority: saving re-counts
   server-side and that number replaces this one on the next load.
   ============================================================ */

const STATES = [
  { id: '', label: 'All' },
  { id: 'drafted', label: 'Drafted' },
  { id: 'no_clause', label: 'Assessed' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'given_up', label: 'Given up' },
]

const STATE_LABEL = {
  drafted: 'drafted',
  no_clause: 'assessed, no clause',
  waiting: 'waiting',
  given_up: 'given up',
}

const num = (n) => (n == null ? '—' : Number(n).toLocaleString('en-GB'))
const nice = (s) => String(s || '').replace(/_/g, ' ')

/* The secret's name is the only handle this side has on which Google
   project a model spends from, and it is a name, never a key. */
const poolName = (secret) =>
  String(secret || 'GEMINI_API_KEY')
    .replace(/^GEMINI_/, '').replace(/_?API_KEY$/, '').toLowerCase() || 'main'

/* The same four tests outreach_target_reach makes, made here so a chip
   click answers immediately. */
function matchesDraft(l, d) {
  if (l.suppressed) return false
  if (d.towns.length && !d.towns.includes(l.town)) return false
  if (d.sectors.length && !d.sectors.includes(l.sector)) return false
  if (d.min_score != null && (l.score || 0) < d.min_score) return false
  /* A lead nobody has assessed yet passes the service filter, because
     the run is what discovers its capability. Filtering it out first
     would mean it never got one. */
  if (d.capabilities.length && l.assessed) {
    const have = l.caps_any || []
    if (!d.capabilities.some((c) => have.includes(c))) return false
  }
  return true
}

function reachOf(leads, draft) {
  const r = { matched: 0, queued: 0, drafted: 0, given_up: 0 }
  for (const l of leads) {
    if (!matchesDraft(l, draft)) continue
    r.matched++
    if (l.state === 'drafted') r.drafted++
    else if (l.state === 'given_up') r.given_up++
    else r.queued++
  }
  return r
}

function blankDraft(t) {
  return t
    ? {
      id: t.id,
      name: t.name,
      towns: [...(t.towns || [])],
      sectors: [...(t.sectors || [])],
      capabilities: [...(t.capabilities || [])],
      min_score: t.min_score,
      is_default: t.is_default,
      sending_enabled: t.sending_enabled,
    }
    : {
      id: null, name: 'New run', towns: [], sectors: [], capabilities: [],
      min_score: null, is_default: false, sending_enabled: false,
    }
}

/* ---------------- the blockers, folded away ----------------
   They were a wall of red standing between a person and the switch.
   Still every word they were — they have just stopped shouting until
   asked. Focusable, so it opens without a pointer. */
function Blockers({ list }) {
  if (!list.length) return null
  const what = list.length === 1 ? 'thing' : 'things'
  return (
    <span
      className="ol-warn"
      tabIndex={0}
      role="button"
      aria-label={`Sending is blocked — ${list.length} ${what} in the way`}
    >
      !
      <span className="ol-warn__pop">
        <u>Sending is blocked — {list.length} {what} in the way</u>
        <ol>
          {list.map((b, i) => (
            <li key={i}>{b.what}<span>{b.why}</span></li>
          ))}
        </ol>
      </span>
    </span>
  )
}

function ChipRow({ label, options, chosen, onToggle, hint }) {
  if (!options.length) return null
  return (
    <div className="ol-col">
      <u>{label}</u>
      <div className="ol-chips">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className="ol-chip"
            aria-pressed={chosen.includes(o.key)}
            onClick={() => onToggle(o.key)}
          >
            {o.label || nice(o.key)}
            {o.n != null && <span className="ol-chip__n">{o.n}</span>}
          </button>
        ))}
      </div>
      {hint && <p className="crm-hint ol-hint">{hint}</p>}
    </div>
  )
}

/* ---------------- arming, deliberately awkward ----------------
   The target name has to be typed back exactly. That is the difference
   between a click and a decision, and the database checks it again. */
function ArmDialog({ target, onCancel, onArm }) {
  const [typed, setTyped] = useState('')
  const ok = typed.trim() === String(target.name).trim()
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div
        className="modal modal--wide edge ol-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ol-arm-h"
      >
        <h3 className="modal__title" id="ol-arm-h">This sends real letters</h3>
        <p>
          Every business matched by <b>{target.name}</b> is a real company that has not
          heard from us. A first contact cannot be taken back, and there is one per business.
        </p>
        <ul>
          <li>Both approval gates are human, and both are before this.</li>
          <li>
            Every message carries the postal address, the source disclosure and a one-click
            unsubscribe, because PECR and Article 14 require them.
          </li>
          <li>Changing who the run is for turns this off again.</li>
        </ul>
        <p>Type the name of the run to confirm:</p>
        <input
          className="input"
          type="text"
          value={typed}
          autoComplete="off"
          placeholder={target.name}
          aria-label="Type the target name to confirm"
          onChange={(e) => setTyped(e.target.value)}
        />
        <div className="modal__actions ol-dialog__row">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={!ok}
            onClick={() => onArm(typed)}
          >
            Turn sending on
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OutreachLog() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(null)
  const [runOpen, setRunOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [said, setSaid] = useState('')
  const [arming, setArming] = useState(false)
  const [stateFilter, setStateFilter] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    try {
      const { data: doc, error: err } = await teamClient().rpc('outreach_dashboard')
      if (err) throw err
      setData(doc || {})
      setError('')
    } catch (err) {
      setError(friendlyError(err, 'Could not read the outreach log.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const leads = useMemo(() => (data && Array.isArray(data.leads) ? data.leads : []), [data])
  const targets = useMemo(() => (data && Array.isArray(data.targets) ? data.targets : []), [data])
  const blockers = useMemo(
    () => (data && Array.isArray(data.send_blockers) ? data.send_blockers : []), [data],
  )
  const live = useMemo(() => targets.find((t) => t.is_default) || null, [targets])

  /* The draft follows the data until somebody edits it. */
  useEffect(() => {
    if (!data || draft) return
    setDraft(blankDraft(targets.find((t) => t.is_default) || targets[0] || null))
  }, [data, draft, targets])

  const reach = useMemo(
    () => (draft ? reachOf(leads, draft) : { matched: 0, queued: 0, drafted: 0, given_up: 0 }),
    [leads, draft],
  )
  const running = Boolean(live && draft && draft.id && live.id === draft.id)

  const shown = useMemo(
    () => (stateFilter ? leads.filter((l) => l.state === stateFilter) : leads),
    [leads, stateFilter],
  )
  const lead = useMemo(
    () => leads.find((l) => l.id === selected) || null, [leads, selected],
  )

  const toggle = (field, key) => setDraft((d) => {
    const next = [...d[field]]
    const i = next.indexOf(key)
    if (i > -1) next.splice(i, 1); else next.push(key)
    return { ...d, [field]: next }
  })

  /* Every write goes through an RPC that re-checks what it was sent.
     Nothing here builds SQL, and nothing here decides whether it was
     allowed — it reports what the database answered. */
  const call = useCallback(async (label, fn, whenDone) => {
    setBusy(label)
    setSaid('')
    try {
      const { data: r, error: err } = await fn()
      if (err) throw err
      setSaid(whenDone(r || {}))
      setDraft(null)
      await load()
    } catch (err) {
      setSaid(friendlyError(err, 'That did not go through.'))
    } finally {
      setBusy('')
    }
  }, [load])

  const saveTarget = () => call('Saving', () => teamClient().rpc('outreach_save_target', {
    p_id: draft.id,
    p_name: draft.name,
    p_towns: draft.towns,
    p_sectors: draft.sectors,
    p_capabilities: draft.capabilities,
    p_min_score: draft.min_score == null ? null : Math.round(draft.min_score),
    /* Saving carries the run state the target already had. It never
       starts anything, and never stops what is already going. */
    p_is_default: Boolean(draft.is_default),
  }), (r) => (r.saved === false
    ? `Refused: ${r.why || 'unknown'}`
    : (r.running ? 'Saved — the next tick uses it' : 'Saved — press Run to start it')))

  const startRun = () => call('Starting', () => teamClient().rpc('outreach_start_run', {
    p_target: draft.id,
  }), (r) => (r.running
    ? 'Running — first tick within five minutes'
    : `Refused: ${r.why || 'unknown'}`))

  const stopRun = () => call('Stopping', () => teamClient().rpc('outreach_stop_run', {}),
    (r) => `Stopped ${r.stopped || ''}`.trim())

  const armSending = (typed) => {
    setArming(false)
    call('Arming', () => teamClient().rpc('outreach_arm_sending', {
      p_target: draft.id, p_confirm_name: typed, p_who: 'CRM',
    }), (r) => (r.armed ? `Sending is ON for ${r.target}` : `Refused: ${r.why || 'unknown'}`))
  }

  const disarm = () => call('Turning off', () => teamClient().rpc('outreach_disarm_sending', {
    p_target: draft.id,
  }), () => 'Sending is off')

  if (loading) return <Loading label="Reading the pipeline" />
  if (error) {
    return (
      <Empty>
        {error === 'SESSION_EXPIRED'
          ? 'Your session expired — sign in again from the team space.'
          : error}
      </Empty>
    )
  }

  const s = (data && data.status) || {}
  const models = (data && Array.isArray(data.models)) ? data.models : []

  return (
    <section className="ol" aria-label="Outreach argument log">
      {/* ---------- what the pipeline has done ---------- */}
      <div className="ol-counts">
        {[
          ['waiting', s.waiting], ['assessed', s.assessed], ['drafted', s.written],
          ['letters', leads.filter((l) => l.letter).length], ['given up', s.given_up],
        ].map(([label, n]) => (
          <div className="ol-count" key={label}>
            <b>{num(n)}</b><span>{label}</span>
          </div>
        ))}
        <div className={`ol-count ol-count--state ${live ? 'is-on' : ''}`}>
          <b>{live ? 'Running' : 'Stopped'}</b>
          <span>{live ? live.name : 'no target is default'}</span>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm ol-counts__btn"
          aria-expanded={runOpen}
          onClick={() => setRunOpen((v) => !v)}
        >
          Run settings
        </button>
      </div>

      {/* ---------- who the run is for ---------- */}
      {runOpen && draft && (
        <div className="ol-panel">
          <div className="ol-panel__head">
            <h3>Who the run is for</h3>
            <span className="ol-reach">
              <b>{num(reach.matched)}</b> selected · {num(reach.queued)} queued ·{' '}
              {num(reach.drafted)} already drafted
              {reach.given_up ? ` · ${num(reach.given_up)} given up` : ''}
            </span>
          </div>

          <div className="ol-cols">
            <ChipRow
              label="Town or city"
              options={((data && data.towns) || [])}
              chosen={draft.towns}
              onToggle={(k) => toggle('towns', k)}
            />
            <ChipRow
              label="Sector"
              options={((data && data.sectors) || [])}
              chosen={draft.sectors}
              onToggle={(k) => toggle('sectors', k)}
            />
            <ChipRow
              label="Service"
              options={((data && data.capability_terms) || []).map((c) => ({
                key: c.term, label: c.label,
              }))}
              chosen={draft.capabilities}
              onToggle={(k) => toggle('capabilities', k)}
              hint="Filters on a capability the assessment has already established. A lead nobody has assessed yet passes anyway — the run is what discovers its capability."
            />
            <div className="ol-col">
              <u>Name, and a floor on the score</u>
              <input
                className="input"
                type="text"
                value={draft.name}
                aria-label="Target name"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <input
                className="input"
                type="number"
                placeholder="no minimum"
                value={draft.min_score == null ? '' : draft.min_score}
                aria-label="Minimum lead score"
                onChange={(e) => setDraft({
                  ...draft, min_score: e.target.value === '' ? null : Number(e.target.value),
                })}
              />
              <p className="crm-hint ol-hint">
                Nothing selected in a column means no filter on it, never &ldquo;match nothing&rdquo;.
              </p>
            </div>
          </div>

          {/* ---------- the send switch ---------- */}
          <div className="ol-switch">
            <input
              type="checkbox"
              id="ol-send"
              checked={Boolean(draft.sending_enabled)}
              disabled={blockers.length > 0 || !draft.id}
              onChange={(e) => (e.target.checked ? setArming(true) : disarm())}
            />
            <label htmlFor="ol-send">
              Actually send these emails
              <span>
                Real letters to real businesses that have not heard from us. Both approval
                gates are human and both are before this. Changing who the run is for always
                turns this back off.
              </span>
            </label>
            <Blockers list={blockers} />
          </div>

          <div className="ol-actions">
            <button
              type="button"
              className="btn btn--sm"
              disabled={Boolean(busy)}
              onClick={saveTarget}
            >
              Save target
            </button>
            {running ? (
              <button
                type="button"
                className="btn btn--sm ol-stop"
                disabled={Boolean(busy)}
                onClick={stopRun}
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--accent btn--sm"
                disabled={Boolean(busy) || !draft.id || !reach.queued}
                onClick={startRun}
              >
                Run
              </button>
            )}
            <span className="ol-said">
              {busy ? `${busy}…` : said}
              {!busy && !said && !running && draft.id && !reach.queued
                && 'Nothing queued — there is nothing for a run to do'}
              {!busy && !said && !draft.id && 'Save the target before starting it'}
            </span>
          </div>
        </div>
      )}

      {arming && draft && (
        <ArmDialog target={draft} onCancel={() => setArming(false)} onArm={armSending} />
      )}

      {/* ---------- the log ---------- */}
      <div className="ol-filters" role="group" aria-label="Filter by state">
        {STATES.map((st) => (
          <button
            key={st.id || 'all'}
            type="button"
            className={`crm-view ${stateFilter === st.id ? 'crm-view--on' : ''}`}
            aria-pressed={stateFilter === st.id}
            onClick={() => setStateFilter(st.id)}
          >
            {st.label}
            <span className="crm-view__count">
              {st.id ? leads.filter((l) => l.state === st.id).length : leads.length}
            </span>
          </button>
        ))}
      </div>

      <div className="ol-split">
        <div className="ol-list">
          {shown.length === 0 && <Empty>Nothing in this state.</Empty>}
          {shown.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`crm-leadbtn ${selected === l.id ? 'crm-leadbtn--active' : ''}`}
              onClick={() => setSelected(l.id)}
            >
              <span className="ol-list__name">{l.company}</span>
              <span className="ol-list__meta">
                {l.town || '—'} · {nice(l.sector) || 'unclassified'} · {num(l.score)}
              </span>
              <span className={`ol-tag ol-tag--${l.state}`}>{STATE_LABEL[l.state]}</span>
            </button>
          ))}
        </div>

        <div className="ol-detail">
          {!lead && (
            <div className="crm-hint">
              <p>
                Pick a business. Every lead, its score, the argument the agents had, the clause
                that came out and the letter it would go in. Nothing here has been sent: both
                approval gates are human and both are before sending.
              </p>
            </div>
          )}

          {lead && (
            <>
              <h3 className="ol-detail__name">{lead.company}</h3>
              <p className="ol-detail__sub">
                {lead.registered !== lead.company && <>registered as {lead.registered} · </>}
                {lead.town || 'location unknown'} · {nice(lead.sector) || 'unclassified'}
                {lead.website && (
                  <> · <a className="crm-link" href={lead.website} target="_blank" rel="noreferrer noopener">website</a></>
                )}
              </p>

              <dl className="crm-kv">
                <div><dt>Score</dt><dd>{num(lead.score)}{lead.band ? ` · ${nice(lead.band)}` : ''}</dd></div>
                <div><dt>Web presence</dt><dd>{nice(lead.presence) || '—'}</dd></div>
                <div><dt>Credit fit</dt><dd>{nice(lead.credit) || '—'}</dd></div>
                <div><dt>State</dt><dd>{STATE_LABEL[lead.state]}</dd></div>
              </dl>

              {lead.summary && <p className="ol-summary">{lead.summary}</p>}

              {lead.clause && (
                <div className="ol-clause">
                  <u>The clause a stranger reads first</u>
                  <p>{lead.clause}</p>
                  {lead.evidence && (
                    <p className="ol-evidence">
                      <em>rests on {lead.basis === 'register' ? 'a public register' : 'their own page'}:</em>{' '}
                      &ldquo;{lead.evidence}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {lead.error && !lead.clause && (
                <p className="crm-warn">
                  {lead.attempts >= 3 ? 'Given up after three attempts. ' : ''}{lead.error}
                </p>
              )}

              {lead.letter && (
                <div className="ol-letter">
                  <u>
                    The letter
                    {lead.letter.approved_at ? ' · approved' : ' · not approved'}
                  </u>
                  <p className="ol-letter__subject">{lead.letter.subject}</p>
                  {String(lead.letter.body || '').split(/\n\s*\n/).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}

              {/* The strategist's reasoning is NOT part of the letter and must
                  never look like it. Set below the body, in its own block, so
                  nobody reads the tension as a closing paragraph somebody is
                  about to send. */}
              {lead.letter && (lead.letter.tension || lead.letter.recognition) && (
                <div className="ol-why">
                  <u>Why this angle — the strategist&rsquo;s note, not part of the letter</u>
                  {lead.letter.tension && (
                    <p><em>the tension:</em> {lead.letter.tension}</p>
                  )}
                  {lead.letter.recognition && (
                    <p><em>they would recognise:</em> {lead.letter.recognition}</p>
                  )}
                  {lead.letter.must_not_imply && (
                    <p><em>it must not read as:</em> {lead.letter.must_not_imply}</p>
                  )}
                </div>
              )}

              {Array.isArray(lead.moves) && lead.moves.length > 0 && (
                <div className="ol-moves">
                  <u>The argument</u>
                  {lead.moves.map((m, i) => (
                    <div className="ol-move" key={i}>
                      <span className="ol-move__who">{m.agent}</span>
                      <span className="ol-move__what">
                        <b>{nice(m.decision)}</b>
                        {m.angle ? ` · ${m.angle}` : ''}
                        {m.reason && <span>{m.reason}</span>}
                      </span>
                      <span className="ol-move__model">{m.model}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ---------- what the day cost ----------
          The quota is per project and per model within it, so the same
          model on a second key is a second pool. */}
      {models.length > 0 && (
        <div className="ol-models">
          <u>Model budget — today, Pacific</u>
          <table>
            <thead>
              <tr><th>model</th><th>pool</th><th>calls</th><th>ceiling reached</th></tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={`${m.model}:${m.key_secret}`}>
                  <td>{m.model}</td>
                  <td>{poolName(m.key_secret)}</td>
                  <td>{num(m.used)}</td>
                  <td>{m.exhausted ? (m.observed_rpd == null ? 'yes' : num(m.observed_rpd)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
