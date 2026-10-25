// The people a prospect can ring as on the demo phone (Call as), and the
// evaluations use: fixed numbers, fixed parts in every seeded fortnight
// (seed.ts). Kept apart from the seed so the web page can list them
// without carrying the seed.

export const PERSONAS = {
  seller: { phone: '+447700900001', name: 'Sarah Collins' },
  sam: { phone: '+447700900002', name: 'Sam Price' },
  aisha: { phone: '+447700900003', name: 'Aisha Khan' },
  ben: { phone: '+447700900004', name: 'Ben Walker' },
  solicitor: { phone: '+447700900005', name: 'Nadia Osei' },
  chainAgent: { phone: '+447700900006', name: 'Harper & Co' },
  megan: { phone: '+447700900007', name: 'Megan Hughes' },
  liam: { phone: '+447700900008', name: 'Liam Doyle' },
  nobody: { phone: '+447700900009', name: '' },
} as const;

/** Who to ring as, and what to try (M2 and M3). */
export const CALL_AS: { phone: string; who: string; try: string }[] = [
  { phone: PERSONAS.seller.phone, who: 'Sarah Collins, a seller', try: 'Ask how the sale is going.' },
  { phone: PERSONAS.sam.phone, who: 'Sam Price, a buyer', try: 'Ask about your viewings, or the missed call.' },
  { phone: PERSONAS.aisha.phone, who: 'Aisha Khan, made an offer', try: 'Ask where your offer stands.' },
  { phone: PERSONAS.ben.phone, who: 'Ben Walker, offer accepted', try: 'Ask about your offer.' },
  { phone: PERSONAS.megan.phone, who: 'Megan Hughes, enquired on Zoopla', try: 'Say nobody got back to you.' },
  { phone: PERSONAS.ben.phone, who: 'Ben Walker, buying 3 Kingfisher Way', try: "Ask when you'll exchange, or say your mortgage was refused." },
  { phone: PERSONAS.liam.phone, who: 'Liam Doyle, completing this week', try: 'Ask about completion day and the keys.' },
  { phone: PERSONAS.solicitor.phone, who: "Nadia Osei, a buyer's solicitor", try: 'Ask where the sale of 2 Elm Court has got to.' },
  { phone: PERSONAS.chainAgent.phone, who: 'Harper & Co, an agent in the chain', try: 'Ask how the chain on 2 Elm Court looks.' },
  { phone: PERSONAS.nobody.phone, who: 'A stranger', try: "Ask about Sarah's sale: you'll get nothing." },
];
