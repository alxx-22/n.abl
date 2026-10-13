// The people a prospect can ring as on the pub's demo phone (Call as), from
// the seeded week (seed.ts). Kept apart from the seed so the web page can
// list them without carrying it; this file imports nothing.

export const PB_PEOPLE = {
  /** A regular with Sunday lunch for four booked: moving it, or adding the children. */
  regular: { name: 'Gary Mills', phone: '+447700900971' },
  /** A parent asking whether her 17-year-old can have a drink with dinner. */
  parent: { name: 'Nadia Okafor', phone: '+447700900972' },
  /** Planning a 40th in the Loft: a message for the manager. */
  party: { name: 'Jess Clarke', phone: '+447700900973' },
};

export const PB_CALL_AS: { phone: string; who: string; try: string }[] = [
  { phone: PB_PEOPLE.regular.phone, who: `${PB_PEOPLE.regular.name}, Sunday lunch for four`, try: 'Make it six with two children and the dog, or move it to 8:30pm.' },
  { phone: PB_PEOPLE.parent.phone, who: `${PB_PEOPLE.parent.name}, a parent`, try: 'Ask if your 17-year-old can have a pint with his dinner, and what ID he needs.' },
  { phone: PB_PEOPLE.party.phone, who: `${PB_PEOPLE.party.name}, planning a 40th`, try: 'Ask about hiring the room upstairs for forty in March.' },
];
