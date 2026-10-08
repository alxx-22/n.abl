// The people a prospect can ring as on the takeaway's demo phone (Call as),
// from the seeded evening (seed.ts). Kept apart from the seed so the web page
// can list them without carrying it; this file imports nothing.

export const TK_PEOPLE = {
  amy: { name: 'Amy Clarke', phone: '+447700900801' },
  parent: { name: 'Jo Patel', phone: '+447700900802' },
  outer: { name: 'Sam Reid', phone: '+447700900803' },
  /** On the pay-on-the-phone list (the answers' default): he refused a delivery last month. */
  refused: { name: 'Dean Walsh', phone: '+447700900804' },
  /** A delivery that arrived twenty minutes ago. */
  delivered: { name: 'Chris Bell', phone: '+447700900805' },
  /** A regular: last Friday's order is "my usual". */
  regular: { name: 'Leah Grant', phone: '+447700900806' },
};

export const TK_CALL_AS: { phone: string; who: string; try: string }[] = [
  { phone: TK_PEOPLE.amy.phone, who: `${TK_PEOPLE.amy.name}, with a delivery out with Kai`, try: "Ask where your order is: you'll hear when it left, without your address being read out." },
  { phone: TK_PEOPLE.parent.phone, who: `${TK_PEOPLE.parent.name}, a parent`, try: "Say your son's allergic to sesame and ask if the Burger meal is OK." },
  { phone: TK_PEOPLE.outer.phone, who: `${TK_PEOPLE.outer.name}, further out in NG9`, try: 'Order a delivery under £15: hear the £3.50 fee and how much short of the minimum you are.' },
  { phone: TK_PEOPLE.delivered.phone, who: `${TK_PEOPLE.delivered.name}, whose delivery came twenty minutes ago`, try: "Say your fries weren't in the bag: it goes to the manager, and nothing is promised that staff haven't agreed." },
  { phone: TK_PEOPLE.regular.phone, who: `${TK_PEOPLE.regular.name}, a regular`, try: 'Ask for "my usual": you\'ll hear last week\'s order back, at tonight\'s prices, without your address read out.' },
  { phone: TK_PEOPLE.refused.phone, who: `${TK_PEOPLE.refused.name}, who refused a delivery last month`, try: "Order a delivery and say you'll pay the driver: you'll be asked to pay by card on the phone, or collect." },
];
