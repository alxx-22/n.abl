/* Shared helpers for the sourcing scripts.

   Extracted once there were two consumers rather than up front — the CSV
   parsing and postcode handling are identical for Companies House and the
   FSA, and two copies would drift. */

/** Quoted CSV with commas inside fields, so it cannot be split on commas.
    Hand-rolled rather than a dependency: two fixed formats, neither changing. */
export function parseCsvLine(line) {
  const out = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { out.push(field); field = '' }
    else field += c
  }
  out.push(field)
  return out.map((f) => f.trim())
}

/** NG1 2AB -> NG1 ; B49 6AA -> B49. '' when there is no usable postcode. */
export function outwardArea(postcode) {
  const pc = String(postcode || '').trim().toUpperCase()
  if (!pc) return ''
  const outward = pc.split(/\s+/)[0] || ''
  const m = outward.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)$/)
  return m ? m[1] : ''
}

/** 'NG' matches any NG district; 'B49' matches only that district.
    ['ALL'] keeps everything — territory is a business decision. */
export function makeTerritoryFilter(areas) {
  const A = areas.map((a) => a.trim().toUpperCase()).filter(Boolean)
  if (A.length === 1 && A[0] === 'ALL') return () => true
  return (postcode) => {
    const outward = outwardArea(postcode)
    if (!outward) return false
    const letters = outward.match(/^[A-Z]{1,2}/)?.[0] || ''
    return A.some((a) => (/\d/.test(a) ? outward === a : letters === a))
  }
}

/** DD/MM/YYYY -> ISO. A string date sorts wrong and will not insert. */
export function isoDate(ddmmyyyy) {
  const m = String(ddmmyyyy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

export const areasFrom = (v, fallback) =>
  String(v ?? fallback).split(',').map((a) => a.trim().toUpperCase()).filter(Boolean)
