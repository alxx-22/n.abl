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
  /** Booked today, soon: ringing to say they're running late. */
  late: { name: 'Priya Shah', phone: '+447700900904' },
  /** A skin test here two days ago: colour can be booked. */
  tested: { name: 'Ben Carter', phone: '+447700900905' },
  /** Wants colour, with no skin test yet. */
  colour: { name: 'Femi Ade', phone: '+447700900906' },
};

export const BB_CALL_AS: { phone: string; who: string; try: string }[] = [
  { phone: BB_PEOPLE.regular.phone, who: `${BB_PEOPLE.regular.name}, a regular, booked with Marcus next week`, try: 'Ask to move it to Saturday: Marcus\'s times first, and the notice rule.' },
  { phone: BB_PEOPLE.soon.phone, who: `${BB_PEOPLE.soon.name}, booked with Dan within the next day`, try: 'Cancel it: the deposit is kept under the shop\'s policy, said once.' },
  { phone: BB_PEOPLE.parent.phone, who: `${BB_PEOPLE.parent.name}, a parent`, try: 'Book two kids\' cuts and one for their dad on Saturday morning.' },
  { phone: BB_PEOPLE.late.phone, who: `${BB_PEOPLE.late.name}, booked in later today`, try: 'Say you\'re running 15 minutes late: kept, or the next booking decides.' },
  { phone: BB_PEOPLE.colour.phone, who: `${BB_PEOPLE.colour.name}, after a beard colour, no skin test yet`, try: 'Ask for a beard colour on Friday: the skin test comes first, 48 hours before.' },
];
