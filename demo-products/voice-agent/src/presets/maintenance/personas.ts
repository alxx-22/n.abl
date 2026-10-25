// The people a prospect can ring as on the demo phone (Call as), from the
// seeded week (fixtures/presets/maintenance-properties.json, seed.ts). Kept
// apart from the seed so the web page can list them without carrying it.

export const MT_CALL_AS: { phone: string; who: string; try: string }[] = [
  { phone: '+447700900501', who: 'Sam Ortiz, tenant at 14 Elm Road', try: "Ask when the engineer's coming, or say you can smell gas." },
  { phone: '+447700900502', who: 'Aisha Patel, a Harbour Lettings tenant', try: "Say water's coming through the kitchen ceiling." },
  { phone: '+447700900406', who: 'Ben Whitfield, a landlord', try: 'Book the gas safety check at 14 Elm Road.' },
  { phone: '+447700900411', who: 'Jess Morgan at Harbour Lettings', try: 'Raise a new back door for a tenant: the joiner quoted £600, over Harbour\'s £250 limit.' },
  { phone: '+447700900404', who: 'Jean Ellis, a landlord with quote Q-2291', try: 'Say yes to Q-2291. The yes is given on this phone, not by voice: press Approve here.' },
  { phone: '+447700900571', who: 'Nadia Hussain, a Meadowbank tenant', try: "Say there's black mould in your son's bedroom, and he has asthma." },
  { phone: '+447700900546', who: 'Ellie Burke, a homeowner', try: 'Ask for a plumber for a dripping tap, or pay your bill for last week.' },
  { phone: '+447700900405', who: 'Raj Kaur, a landlord with three homes', try: "Ask what's due across your properties, then ask to book it all." },
  { phone: '+447700900578', who: 'Marcus Okoro, Flat 4, Riverside Court', try: "Say the door entry isn't working, or that someone's stuck in the lift." },
  { phone: '+447700900412', who: 'Sian Morris at The Copper Kettle café', try: "Say the kitchen sink's blocked and you open at 8." },
  { phone: '+447700900409', who: "Bramley Mutual Insurance's claims desk", try: 'Give claim 77-23455: escape of water at 4 Holly Close, NG5, trace and access. The policyholder is David Shaw, 07700 900590.' },
  { phone: '+447700900888', who: 'A stranger', try: "Ask when the engineer's coming to 14 Elm Road: you'll get nothing without the reference." },
];
