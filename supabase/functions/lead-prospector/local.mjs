/* ============================================================
   BUSINESSES THAT ARE NOT ON COMPANIES HOUSE

   Sole traders and partnerships file nothing at Companies House, so the
   register search never sees a barber, a café or a back-street garage
   run by its owner. Two open sources do:

     fsa   the Food Standards Agency's food hygiene register: every food
           business a council has inspected, sole traders included.
           Open Government Licence; no key.
     osm   OpenStreetMap: shops and services mapped by volunteers.
           ODbL - credit "© OpenStreetMap contributors"; no key.

   Neither says what legal form a business has. A business found here is
   therefore never taken for a company: its subscriber type is unknown,
   and the send gate refuses email to an unknown subscriber just as it
   refuses it to a sole trader (PECR regulation 22). Phone numbers read
   here are the business's own published number, kept for a person to
   call after TPS and CTPS screening; no agent is ever shown one.

   Pure functions only, shared by the edge function and the Lead gen
   screen so what the form offers is exactly what gets asked for.
   ============================================================ */

export const FSA_BASE = 'https://api.ratings.food.gov.uk'

/* The councils covering the two territories (FSA LocalAuthorityId). */
export const FSA_AUTHORITIES = Object.freeze([
  { id: 87, name: 'Nottingham City', town: 'Nottingham' },
  { id: 79, name: 'Broxtowe', town: 'Beeston' },
  { id: 83, name: 'Rushcliffe', town: 'West Bridgford' },
  { id: 80, name: 'Gedling', town: 'Arnold' },
  { id: 51, name: 'Erewash', town: 'Ilkeston' },
  { id: 77, name: 'Ashfield', town: 'Hucknall' },
  { id: 372, name: 'Stratford-on-Avon', town: 'Stratford-upon-Avon' },
  { id: 357, name: 'Redditch', town: 'Redditch' },
  { id: 359, name: 'Wychavon', town: 'Evesham' },
])

/* The FSA business types worth pulling (BusinessTypeId). Schools, care
   homes, hospitals, supermarkets and manufacturers are left out: none is
   a small business taking bookings by phone. */
export const FSA_TYPES = Object.freeze([
  { id: 1, label: 'Restaurant, café or canteen' },
  { id: 7844, label: 'Takeaway or sandwich shop' },
  { id: 7843, label: 'Pub, bar or nightclub' },
  { id: 7842, label: 'Hotel, B&B or guest house' },
  { id: 7846, label: 'Mobile caterer' },
  { id: 7841, label: 'Other catering' },
])

export function fsaUrl({ authority, businessType, page = 1, pageSize = 50 }, base = FSA_BASE) {
  const u = new URL('/Establishments', base)
  u.searchParams.set('localAuthorityId', String(authority))
  u.searchParams.set('businessTypeId', String(businessType))
  u.searchParams.set('pageNumber', String(Math.max(1, Math.floor(Number(page) || 1))))
  u.searchParams.set('pageSize', String(Math.max(1, Math.min(200, Math.floor(Number(pageSize) || 50)))))
  return u.toString()
}

/* Chains and institutions: a franchisee's phone is answered by head
   office's systems, and a school kitchen is not a business at all. A name
   is a chain's when it starts with the brand as whole words - "Pret" is
   Pret A Manger, "Pretty Nails" is not. */
const CHAINS = [
  'mcdonalds', 'greggs', 'kfc', 'subway', 'costa', 'costa coffee', 'starbucks', 'dominos', 'pizza hut', 'burger king',
  'nandos', 'caffe nero', 'cafe nero', 'pret a manger', 'pret', 'tesco', 'sainsburys', 'co op', 'coop', 'the co operative',
  'wetherspoon', 'jd wetherspoon', 'toby carvery', 'harvester', 'hungry horse', 'papa johns', 'wimpy', 'five guys', 'leon',
  'wagamama', 'pizza express', 'zizzi', 'ask italian', 'frankie and bennys', 'bella italia', 'chiquito', 'greene king',
  'marstons', 'stonegate', 'miller and carter', 'vintage inns', 'crafthouse', 'beefeater', 'premier inn', 'travelodge',
  'holiday inn', 'ibis', 'marks and spencer', 'm and s', 'asda', 'morrisons', 'aldi', 'lidl', 'iceland', 'waitrose', 'spar',
  'one stop', 'londis', 'budgens', 'nisa local', 'best one', 'taco bell', 'popeyes', 'wingstop', 'german doner kebab',
  'chopstix', 'itsu', 'yo sushi', 'wasabi', 'tim hortons', 'krispy kreme', 'millies cookies', 'cinnabon', 'boost juice',
  'dunelm', 'ikea', 'holland and barrett', 'boots', 'toni and guy', 'toni guy', 'supercuts', 'regis salons', 'headmasters',
  'rush hair', 'saks', 'kwik fit', 'halfords', 'formula one autocentres', 'national tyres', 'ats euromaster',
  'vets4pets', 'medivet', 'pets at home', 'puregym', 'the gym', 'anytime fitness', 'david lloyd', 'nuffield health',
  'bannatyne', 'snap fitness', 'jd gyms', 'bannatynes',
]
const INSTITUTION = /\b(school|academy|college|university|hospital|nursery|care home|nursing home|hospice|prison|barracks|council|church|chapel|mosque|gurdwara|temple|scout|guide hut|village hall|community centre|sports club|cricket club|football club|golf club|leisure centre|primary|infant|junior)\b/i

export const squashName = (s) => String(s ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
const words = (s) => String(s ?? '').toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export function isChainOrInstitution(name) {
  const w = words(name)
  if (!w) return true
  if (INSTITUTION.test(String(name))) return true
  return CHAINS.some((c) => w === c || w.startsWith(c + ' '))
}

const COUNTIES = /^(nottinghamshire|notts|derbyshire|warwickshire|worcestershire|leicestershire|west midlands|england|united kingdom|uk)$/i
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

/* One FSA establishment, or null when it is not one to research. */
export function fsaRow(e, { authorities = FSA_AUTHORITIES } = {}) {
  if (!e || typeof e !== 'object' || !e.FHRSID) return null
  const name = clean(e.BusinessName)
  if (!name || isChainOrInstitution(name)) return null
  const lines = [e.AddressLine1, e.AddressLine2, e.AddressLine3, e.AddressLine4].map(clean).filter(Boolean)
  const auth = authorities.find((a) => String(a.id) === String(e.LocalAuthorityCode) || a.name === clean(e.LocalAuthorityName))
  const STREET = /\b(road|rd|street|st|lane|ln|avenue|ave|way|drive|dr|close|court|place|crescent|terrace|parade|square|walk|hill|row|gate|green|park|centre|center|estate|unit|house|building|yard|mews|grove)\.?$/i
  const town = [...lines].reverse().find((l) => !COUNTIES.test(l) && !/\d/.test(l) && !STREET.test(l) && l.length <= 40) || auth?.town || null
  const postcode = clean(e.PostCode).toUpperCase() || null
  const type = clean(e.BusinessType) || 'food business'
  const rated = /^\d{4}-\d{2}-\d{2}/.test(String(e.RatingDate || '')) ? String(e.RatingDate).slice(0, 10) : null
  const rating = /^[0-5]$/.test(String(e.RatingValue ?? '')) ? String(e.RatingValue) : null
  return {
    source: 'fsa',
    source_ref: `fsa:${e.FHRSID}`,
    company_name: name,
    activity: type,
    town,
    postcode,
    address: lines.slice(0, 2).join(', ') || null,
    phone: normalisePhone(e.Phone),
    website_hint: null,
    source_detail: {
      register: 'Food Standards Agency food hygiene ratings',
      licence: 'Open Government Licence',
      id: e.FHRSID,
      authority: clean(e.LocalAuthorityName) || null,
      business_type: type,
      rating, rated_on: rated,
    },
  }
}

/* ---------- OpenStreetMap ---------- */

/* What a target can ask OpenStreetMap for, and the tags that mean it. */
export const OSM_KINDS = Object.freeze({
  hair: { label: 'Hairdressers and barbers', one: 'Hairdresser or barber', select: ['["shop"~"^(hairdresser|barber)$"]'] },
  beauty: { label: 'Beauty, nails and tanning', one: 'Beauty or nail salon', select: ['["shop"~"^(beauty|nails|tanning)$"]'] },
  massage: { label: 'Massage and therapy', one: 'Massage or therapy practice', select: ['["shop"="massage"]', '["healthcare"~"^(physiotherapist|podiatrist|chiropractor|osteopath)$"]'] },
  tattoo: { label: 'Tattoo and piercing', one: 'Tattoo or piercing studio', select: ['["shop"~"^(tattoo|piercing)$"]'] },
  cafe: { label: 'Cafés', one: 'Café', select: ['["amenity"="cafe"]'] },
  takeaway: { label: 'Takeaways', one: 'Takeaway', select: ['["amenity"="fast_food"]'] },
  restaurant: { label: 'Restaurants', one: 'Restaurant', select: ['["amenity"="restaurant"]'] },
  garage: { label: 'Garages and MOT', one: 'Garage', select: ['["shop"~"^(car_repair|tyres)$"]'] },
  vet: { label: 'Vets', one: 'Vet', select: ['["amenity"="veterinary"]'] },
  grooming: { label: 'Pet grooming', one: 'Pet groomer', select: ['["shop"="pet_grooming"]'] },
  driving: { label: 'Driving schools', one: 'Driving school', select: ['["amenity"="driving_school"]'] },
  gym: { label: 'Gyms and studios', one: 'Gym or studio', select: ['["leisure"~"^(fitness_centre|sports_centre)$"]["sport"!~"swimming"]'] },
})

/* The places a target can cover, as boxes (south, west, north, east).
   Named, so a target stores a word rather than four numbers nobody can
   check by eye. */
export const OSM_AREAS = Object.freeze({
  'Nottingham': [52.88, -1.30, 53.03, -1.03],
  'Ilkeston': [52.94, -1.34, 52.99, -1.28],
  'Hucknall': [53.02, -1.23, 53.05, -1.18],
  'Alcester': [52.20, -1.90, 52.23, -1.85],
  'Stratford-upon-Avon': [52.17, -1.74, 52.22, -1.66],
  'Redditch': [52.27, -1.99, 52.33, -1.90],
  'Studley': [52.26, -1.91, 52.28, -1.87],
  'Henley-in-Arden': [52.28, -1.79, 52.30, -1.76],
  'Evesham': [52.07, -1.97, 52.11, -1.91],
})

export function overpassQuery(kinds, area) {
  const box = OSM_AREAS[area]
  if (!box) return null
  const sel = kinds.flatMap((k) => OSM_KINDS[k]?.select ?? [])
  if (!sel.length) return null
  const b = box.join(',')
  return `[out:json][timeout:90];(${sel.map((s) => `nwr${s}["name"](${b});`).join('')});out tags center;`
}

const KIND_OF = (tags) => {
  for (const [k, v] of Object.entries(OSM_KINDS)) {
    for (const s of v.select) {
      const pairs = [...s.matchAll(/\["([^"]+)"(=|~|!~)"([^"]+)"\]/g)]
      if (pairs.every(([, key, op, val]) => {
        const got = tags[key]
        if (op === '=') return got === val
        if (op === '~') return got !== undefined && new RegExp(val).test(got)
        return got === undefined || !new RegExp(val).test(got)
      })) return k
    }
  }
  return null
}

/* One OpenStreetMap element, or null when it is not one to research.
   A brand tag marks a chain branch. */
export function osmRow(el, area) {
  const t = el?.tags
  if (!t || !el.id || !el.type) return null
  const name = clean(t.name)
  if (!name || t.brand || t['brand:wikidata'] || t['operator:wikidata'] || isChainOrInstitution(name)) return null
  if (t.disused === 'yes' || t['disused:shop'] || t['was:shop']) return null
  const kind = KIND_OF(t)
  const street = clean([t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '))
  const site = clean(t.website || t['contact:website'] || t.url)
  return {
    source: 'osm',
    source_ref: `osm:${el.type}/${el.id}`,
    company_name: name,
    activity: kind ? OSM_KINDS[kind].one : 'Local business',
    town: clean(t['addr:city'] || t['addr:town'] || area) || null,
    postcode: clean(t['addr:postcode']).toUpperCase() || null,
    address: street || null,
    phone: normalisePhone(t.phone || t['contact:phone'] || t['contact:mobile']),
    website_hint: /^https?:\/\//i.test(site) ? site : site ? `https://${site}` : null,
    source_detail: {
      register: 'OpenStreetMap',
      licence: 'ODbL, © OpenStreetMap contributors',
      id: `${el.type}/${el.id}`,
      kind,
      area,
      opening_hours: clean(t.opening_hours) || null,
    },
  }
}

/* A UK number in E.164, or null. Only ever a business's own published
   number; never anything a model wrote. */
export function normalisePhone(raw) {
  const first = String(raw ?? '').split(/[;,/]| or /i)[0]
  let d = first.replace(/\(0\)/g, '').replace(/[^\d+]/g, '')
  if (!d) return null
  if (d.startsWith('+44')) d = '0' + d.slice(3)
  else if (d.startsWith('0044')) d = '0' + d.slice(4)
  else if (d.startsWith('44') && d.length === 12) d = '0' + d.slice(2)
  if (!/^0[1-35-8]\d{8,9}$/.test(d)) return null
  return '+44' + d.slice(1)
}

/* The number a business's own site gives, read by code from the pages the
   research stage fetched; no agent sees it and none can supply it. A tel:
   link is what the site means to be dialled, and the one it repeats most
   is taken. Failing that, a number in the text only when it is the only
   one: a second could be the web designer's in the footer. */
export function sitePhone(htmls) {
  const pages = (Array.isArray(htmls) ? htmls : []).map((h) => String(h ?? ''))
  const count = new Map()
  for (const html of pages) {
    for (const m of html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) {
      let raw = m[1]
      try { raw = decodeURIComponent(raw) } catch { /* as written */ }
      const p = normalisePhone(raw)
      if (p) count.set(p, (count.get(p) ?? 0) + 1)
    }
  }
  if (count.size) return [...count].sort((a, b) => b[1] - a[1])[0][0]
  const inText = new Set()
  for (const html of pages) {
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    for (const m of text.matchAll(/(?:\+44\s?\(?0?\)?\s?|\b0)\d(?:[\s-]?\d){8,10}\b/g)) {
      const p = normalisePhone(m[0])
      if (p) inText.add(p)
    }
  }
  return inText.size === 1 ? [...inText][0] : null
}

/* Which kind of target this is, and whether its query is one we can run. */
export function checkSourceQuery(source, q) {
  if (source === 'fsa') {
    const a = (Array.isArray(q?.authorities) ? q.authorities : []).map(Number).filter((n) => FSA_AUTHORITIES.some((x) => x.id === n))
    const t = (Array.isArray(q?.business_types) ? q.business_types : []).map(Number).filter((n) => FSA_TYPES.some((x) => x.id === n))
    if (!a.length) return { ok: false, why: 'pick at least one council' }
    if (!t.length) return { ok: false, why: 'pick at least one kind of food business' }
    return { ok: true, query: { authorities: [...new Set(a)], business_types: [...new Set(t)] } }
  }
  if (source === 'osm') {
    const k = (Array.isArray(q?.kinds) ? q.kinds : []).filter((x) => OSM_KINDS[x])
    const a = (Array.isArray(q?.areas) ? q.areas : []).filter((x) => OSM_AREAS[x])
    if (!k.length) return { ok: false, why: 'pick at least one kind of business' }
    if (!a.length) return { ok: false, why: 'pick at least one place' }
    return { ok: true, query: { kinds: [...new Set(k)], areas: [...new Set(a)] } }
  }
  return { ok: false, why: `unknown source "${source}"` }
}

/* The units a local target is pulled in, one per tick: a council and a
   business type for the FSA (paged), a place for OpenStreetMap (one read). */
export function sourceUnits(source, q) {
  if (source === 'fsa') return (q.authorities ?? []).flatMap((a) => (q.business_types ?? []).map((t) => `${a}:${t}`))
  if (source === 'osm') return [...(q.areas ?? [])]
  return []
}

/* The register line the research agent is shown for a business found
   here. Facts from the source only - and never its phone number. */
export function sourceLine(d) {
  if (!d || typeof d !== 'object') return null
  if (d.register === 'Food Standards Agency food hygiene ratings') {
    return `Listed on the Food Standards Agency's food hygiene register as "${d.business_type}"` +
      (d.authority ? ` by ${d.authority} council` : '') +
      (d.rated_on ? `, last rated ${d.rated_on}${d.rating ? ` (${d.rating} out of 5)` : ''}` : '') +
      '. It is not a Companies House search result, so its legal form is unknown'
  }
  if (d.register === 'OpenStreetMap') {
    return 'Mapped on OpenStreetMap' + (d.kind && OSM_KINDS[d.kind] ? ` among ${OSM_KINDS[d.kind].label.toLowerCase()}` : '') +
      (d.opening_hours ? `, with opening hours "${String(d.opening_hours).slice(0, 80)}"` : '') +
      '. It is not a Companies House search result, so its legal form is unknown'
  }
  return null
}
