// The people a prospect can ring as on the café's demo phone (Call as), from
// the seeded week (seed.ts). Kept apart from the seed so the web page can
// list them without carrying it; this file imports nothing.

export const CF_PEOPLE = {
  /** A regular with afternoon tea for two on Saturday: moving or cancelling it. */
  regular: { name: 'Helen Ward', phone: '+447700900931' },
  /** A parent with nothing booked, asking what her nut-allergic daughter can have. */
  parent: { name: 'Asha Patel', phone: '+447700900932' },
  /** An office manager after sandwich platters: a message for the owner. */
  office: { name: 'Tom Lees', phone: '+447700900933' },
};

export const CF_CALL_AS: { phone: string; who: string; try: string }[] = [
  { phone: CF_PEOPLE.regular.phone, who: `${CF_PEOPLE.regular.name}, afternoon tea for two on Saturday`, try: 'Move it to Sunday, or make it three of you with one gluten-free.' },
  { phone: CF_PEOPLE.parent.phone, who: `${CF_PEOPLE.parent.name}, a parent`, try: 'Ask which cakes your daughter can have: she has a nut allergy.' },
  { phone: CF_PEOPLE.office.phone, who: `${CF_PEOPLE.office.name}, an office manager`, try: 'Ask for sandwich platters for twelve on Friday: a message for the owner.' },
];
