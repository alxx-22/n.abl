// The people a prospect can ring as on the barber's demo phone (Call as),
// from the seeded week (seed.ts). Kept apart from the seed so the web page
// can list them without carrying it; this file imports nothing.

export const BB_PEOPLE = {
  /** A regular, booked with Marcus next week: moving it. */
  regular: { name: 'Jay Morgan', phone: '+447700900901' },
  /** Booked with Dan within the next day, the deposit paid: cancelling late. */
  soon: { name: 'Ollie Price', phone: '+447700900902' },
  /** A parent with nothing booked: two kids and their dad. */
  parent: { name: 'Sara Ahmed', phone: '+447700900903' },
};

export const BB_CALL_AS: { phone: string; who: string; try: string }[] = [
  { phone: BB_PEOPLE.regular.phone, who: `${BB_PEOPLE.regular.name}, a regular, booked with Marcus next week`, try: 'Ask to move it to Saturday: Marcus\'s times first, and the notice rule.' },
  { phone: BB_PEOPLE.soon.phone, who: `${BB_PEOPLE.soon.name}, booked with Dan within the next day`, try: 'Cancel it: the deposit is kept under the shop\'s policy, said once.' },
  { phone: BB_PEOPLE.parent.phone, who: `${BB_PEOPLE.parent.name}, a parent`, try: 'Book two kids\' cuts and one for their dad on Saturday morning.' },
];
