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

/* Name matching across registers.

   Companies House holds the legal name ("THE OLD BAKERY (NOTTINGHAM) LTD");
   the FSA holds the trading name ("The Old Bakery"). They are the same
   business, so the key has to survive the suffix, the punctuation and the
   case. It must NOT survive the identity — "Bakery" and "The Bakery" are
   different businesses in different towns, which is what the generic-name
   guard below is for. */

const LEGAL_SUFFIXES = [
  'LIMITED', 'LTD', 'PLC', 'LLP', 'LP', 'CIC', 'CIO', 'LBG',
  'PUBLIC LIMITED COMPANY', 'COMPANY', 'CO', 'AND CO', 'INCORPORATED', 'INC',
]

export function nameKey(name) {
  let s = String(name || '').toUpperCase()
  s = s.replace(/&/g, ' AND ')
  s = s.replace(/[^A-Z0-9 ]+/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  // Suffixes only strip from the end, and repeatedly: "FOO LTD" and
  // "FOO CO LTD" both reduce to "FOO".
  let changed = true
  while (changed) {
    changed = false
    for (const suf of LEGAL_SUFFIXES) {
      if (s.endsWith(' ' + suf)) { s = s.slice(0, -(suf.length + 1)).trim(); changed = true }
    }
  }
  if (s.startsWith('THE ')) s = s.slice(4)
  return s.replace(/\s+/g, ' ').trim()
}

/* A name is distinctive enough to match on WITHOUT a shared postcode only if
   it is long and not a common trade word. "MOTORS" or "KITCHEN" appear
   hundreds of times across the register and would merge unrelated firms.
   Compared against a key that has already been through nameKey, so no entry
   here carries a legal suffix or a leading "THE". */
const GENERIC = new Set([
  'MOTORS', 'KITCHEN', 'CAFE', 'BAR', 'GRILL', 'TAKEAWAY',
  'RESTAURANT', 'SHOP', 'STORES', 'STORE', 'GARAGE', 'SALON', 'BARBERS',
  'PHARMACY', 'POST OFFICE', 'NEWSAGENTS', 'CHIPPY', 'FISH AND CHIPS',
  'PIZZA', 'KEBAB HOUSE', 'CHINESE TAKEAWAY', 'INDIAN TAKEAWAY', 'HOTEL',
  'BAKERY', 'BUTCHERS', 'FLORIST', 'NURSERY', 'PRESCHOOL',
])

export function isDistinctiveName(key) {
  if (!key || key.length < 10) return false
  if (GENERIC.has(key)) return false
  if (key.split(' ').length < 2) return false
  return true
}

/** Full postcode, space-normalised, for exact-address matching. */
export function postcodeKey(postcode) {
  const pc = String(postcode || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (pc.length < 5 || pc.length > 7) return ''
  return pc.slice(0, -3) + ' ' + pc.slice(-3)
}

/* The 124 real UK postcode areas. Needed because a regex shaped like a
   postcode matches a great deal that is not one: uppercased HTML is full of
   hex colours, minified identifiers and base64, and "GQ1 2AB" or "JV3 9XY"
   will match a pattern while belonging to no postal district on earth.

   Without this list a contradiction test built on that regex rejects real
   websites — it read "the page's addresses are all in AF, not NG" off a
   stylesheet and threw the company away. */
export const POSTCODE_AREAS = new Set(`
AB AL B BA BB BD BH BL BN BR BS BT CA CB CF CH CM CO CR CT CV CW DA DD DE DG
DH DL DN DT DY E EC EH EN EX FK FY G GL GU GY HA HD HG HP HR HS HU HX IG IM
IP IV JE KA KT KW KY L LA LD LE LL LN LS LU M ME MK ML N NE NG NN NP NR NW OL
OX PA PE PH PL PO PR RG RH RM S SA SE SG SK SL SM SN SO SP SR SS ST SW SY TA
TD TF TN TQ TR TS TW UB W WA WC WD WF WN WR WS WV YO ZE
`.trim().split(/\s+/))

export const isPostcodeArea = (a) => POSTCODE_AREAS.has(String(a || '').toUpperCase())
