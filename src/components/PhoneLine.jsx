import { useCallback, useEffect, useState } from 'react'
import { teamClient, friendlyError } from '../lib/supabase.js'
/* The same normaliser the lead finder and the tps-check function use, so a
   number reads the same everywhere. */
import { normalisePhone } from '../../supabase/functions/lead-prospector/local.mjs'

/* ============================================================
   PHONE LINE — one number on a contact, and whether it may be called.

   PECR regulation 21: no sales call to a number on the TPS (individuals,
   sole traders, most partnerships) or the CTPS (companies). Both are checked
   every time, because a business's legal form is not always known, and a
   check counts for 28 days.

   This never decides anything. It shows what the database says about the
   number, lets a person get it checked (automatically when a screening key
   is set, or by hand on a checker's own site), and records a call BEFORE
   the dialler opens: the insert into marketing_sends is the gate, and a
   refused call opens nothing.
   ============================================================ */

const today = () => new Date().toISOString().slice(0, 10)
const day = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export default function PhoneLine({ lead, raw, onRecordSend, onCalled }) {
  const phone = normalisePhone(raw)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState('')
  const [said, setSaid] = useState('')
  const [byHand, setByHand] = useState(false)
  const [form, setForm] = useState({ provider: 'TPS Checker (tpschecker.co.uk)', on: today(), tps: 'no', ctps: 'no', note: '' })

  const load = useCallback(async () => {
    if (!phone) return
    const { data, error } = await teamClient().rpc('phone_screening_status', { p_phones: [phone] })
    if (error) { setSaid(friendlyError(error, 'Could not read the screening record.')); return }
    setStatus((Array.isArray(data) && data[0]) || null)
  }, [phone])

  useEffect(() => { load() }, [load])

  if (!phone) return null

  async function screen() {
    setBusy('Checking'); setSaid('')
    const { data, error } = await teamClient().functions.invoke('tps-check', { body: { phone, lead_id: lead.dbId || null } })
    if (error) {
      let msg = ''
      try { msg = (await error.context.json()).error } catch { /* no body */ }
      setSaid(msg || friendlyError(error, 'The check did not go through.'))
    } else {
      setSaid(data?.clear ? 'Clear on both registers.' : 'On a register: do not call.')
    }
    setBusy(''); load()
  }

  async function recordByHand(e) {
    e.preventDefault()
    setBusy('Recording'); setSaid('')
    const { error } = await teamClient().rpc('phone_screening_record_by_hand', {
      p_phone: phone, p_tps: form.tps === 'yes', p_ctps: form.ctps === 'yes',
      p_provider: form.provider.trim(), p_checked_at: new Date(`${form.on}T12:00:00`).toISOString(),
      p_evidence: form.note.trim() || null, p_lead_id: lead.dbId || null,
    })
    setBusy('')
    if (error) { setSaid(friendlyError(error, 'That check was not recorded.')); return }
    setByHand(false); setSaid('Recorded under your name.'); load()
  }

  async function callNow() {
    setBusy('Recording the call'); setSaid('')
    const result = await onRecordSend({ lead, channel: 'phone', recipient: phone, subject: 'Sales call' })
    setBusy('')
    if (!result.ok) { setSaid(result.message); return }
    onCalled?.(phone)
    window.location.href = `tel:${phone}`
  }

  async function stopCalling() {
    if (!window.confirm('Record that they asked not to be contacted? This is permanent: nothing will be sent to this business again on any channel.')) return
    setBusy('Recording the objection'); setSaid('')
    const { error } = await teamClient().rpc('apply_opt_out', {
      p_lead_id: lead.dbId, p_channel: 'phone', p_identifier: phone, p_reason: 'phone_request',
      p_evidence: `Asked on a call, ${day(new Date())}`,
    })
    setBusy('')
    if (error) { setSaid(friendlyError(error, 'The objection was not recorded — try again.')); return }
    setSaid('Recorded. They will not be contacted again, on any channel.'); load()
  }

  const clear = Boolean(status?.clear)
  const state = !status || !status.checked_at
    ? (status?.suppressed ? 'On our do-not-call list' : 'Not checked against the TPS and CTPS')
    : status.suppressed
      ? `On ${status.tps && status.ctps ? 'the TPS and CTPS' : status.tps ? 'the TPS' : status.ctps ? 'the CTPS' : 'our do-not-call list'} — do not call`
      : clear
        ? `Clear on the TPS and CTPS until ${day(status.clear_until)}`
        : `Last checked ${day(status.checked_at)}, over 28 days ago — check again`

  return (
    <div className={`crm-phone ${clear ? 'is-clear' : ''} ${status?.suppressed ? 'is-blocked' : ''}`}>
      <p className="crm-phone__state">
        <strong>{state}</strong>
        {status?.checked_at && <span> · checked {day(status.checked_at)} by {status.provider}{status.method === 'by_hand' ? ', by hand' : ''}</span>}
      </p>
      <div className="card-actions">
        {!status?.suppressed && !clear && (
          <>
            <button type="button" className="btn btn--ghost btn--sm" disabled={Boolean(busy)} onClick={screen}>Check TPS and CTPS</button>
            <button type="button" className="btn btn--ghost btn--sm" disabled={Boolean(busy)} onClick={() => setByHand((v) => !v)}>
              I checked it by hand
            </button>
          </>
        )}
        {clear && (
          <button type="button" className="btn btn--accent btn--sm" disabled={Boolean(busy)} onClick={callNow}>Record the call, then dial</button>
        )}
        {!status?.suppressed && (
          <button type="button" className="btn btn--ghost btn--sm danger-text" disabled={Boolean(busy) || !lead.dbId} onClick={stopCalling}>
            They asked not to be contacted
          </button>
        )}
      </div>
      {byHand && (
        <form className="crm-phone__form" onSubmit={recordByHand}>
          <label><span>Checked on</span>
            <input className="input" type="text" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          </label>
          <label><span>Date</span>
            <input className="input" type="date" value={form.on} max={today()} onChange={(e) => setForm({ ...form, on: e.target.value })} />
          </label>
          <fieldset><legend>On the TPS?</legend>
            {['no', 'yes'].map((v) => (
              <label key={v}><input type="radio" name="tps" checked={form.tps === v} onChange={() => setForm({ ...form, tps: v })} /> {v}</label>
            ))}
          </fieldset>
          <fieldset><legend>On the CTPS?</legend>
            {['no', 'yes'].map((v) => (
              <label key={v}><input type="radio" name="ctps" checked={form.ctps === v} onChange={() => setForm({ ...form, ctps: v })} /> {v}</label>
            ))}
          </fieldset>
          <label className="crm-phone__wide"><span>Note (optional)</span>
            <input className="input" type="text" value={form.note} placeholder="e.g. screenshot saved to the shared drive" onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <button type="submit" className="btn btn--sm" disabled={Boolean(busy) || !form.provider.trim()}>Record this check under my name</button>
        </form>
      )}
      {clear && (
        <p className="crm-phone__script">
          On the call: say your name and that you are calling from n.abl; give our address if they ask; tell them how
          we use their details (the privacy notice); and if they say stop, press &ldquo;They asked not to be contacted&rdquo;.
        </p>
      )}
      {(busy || said) && <p className="crm-phone__said" role="status">{busy ? `${busy}…` : said}</p>}
    </div>
  )
}
