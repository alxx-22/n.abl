/* ============================================================
   What a TPS/CTPS screening service is asked, and how its answer is read.

   Pure functions, shared by the tps-check edge function and its tests.
   A provider is named by TPS_CHECK_PROVIDER; only providers listed here can
   be used, so a typo cannot send numbers somewhere unexpected.

   An answer is accepted only when it says, as true or false, whether the
   number is on the TPS and on the CTPS. Anything else - a missing field, a
   string, a different number echoed back - is refused and nothing is
   recorded: an unreadable answer must never read as "clear".
   ============================================================ */

import { normalisePhone } from '../lead-prospector/local.mjs'

export const PROVIDERS = Object.freeze({
  /* tpscheck.uk: 50 free checks a month, no card. POST one number, answer
     carries tps and ctps as booleans and the number in E.164. */
  tpscheck: {
    label: 'TPSCheck (tpscheck.uk)',
    url: 'https://api.tpscheck.uk/check',
    free_per_month: 50,
    request: (phone, key) => ({
      method: 'POST',
      headers: { authorization: `Token ${key}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ phone: '0' + phone.slice(3) }),
    }),
  },
})

export const providerFor = (name) => PROVIDERS[String(name ?? '').trim().toLowerCase() || 'tpscheck'] ?? null

/* The answer, or why it cannot be trusted. */
export function readAnswer(json, phone) {
  const body = json && typeof json === 'object' ? json : null
  if (!body) return { ok: false, why: 'the screening service did not answer in JSON' }
  const r = body.result && typeof body.result === 'object' && !('tps' in body) ? body.result : body
  if (typeof r.tps !== 'boolean' || typeof r.ctps !== 'boolean') {
    return { ok: false, why: 'the screening service did not say, as yes or no, whether the number is on the TPS and the CTPS' }
  }
  if (r.e164 != null && normalisePhone(r.e164) !== phone) {
    return { ok: false, why: 'the screening service answered about a different number' }
  }
  const ref = [r.id, r.reference, r.request_id].find((x) => typeof x === 'string' && x.trim())
  return { ok: true, tps: r.tps, ctps: r.ctps, evidence: ref ? `reference ${String(ref).slice(0, 80)}` : null }
}

export { normalisePhone }
