// The kinds of business a prospect can build a demo for. Restaurant is live;
// the rest are listed so prospects see where the product is going, and are
// built in the order of DEMO-SERVICE-PLAN.md §8.

export interface PresetInfo {
  key: string;
  label: string;
  /** One line, from the owner's side: what the receptionist does for them. */
  blurb: string;
  status: 'live' | 'soon';
  /** What the builder asks about, shown on the card. */
  covers: string[];
}

export const PRESETS: PresetInfo[] = [
  {
    key: 'restaurant',
    label: 'Restaurant',
    blurb: 'Books tables inside or out, takes click and collect orders, and answers the questions your staff answer all day.',
    status: 'live',
    covers: ['Seating areas and floor plan', 'Menu and allergens', 'Click and collect, delivery', 'Deposits and payment'],
  },
  { key: 'takeaway', label: 'Takeaway and fast food', blurb: 'Takes orders for collection or delivery, upsells the meal deal, and quotes honest wait times.', status: 'soon', covers: ['Menu, sizes and deals', 'Collection slots', 'Delivery areas'] },
  { key: 'cafe', label: 'Café and coffee shop', blurb: 'Takes pre-orders and office catering, and knows every milk and syrup.', status: 'soon', covers: ['Drinks and food', 'Pre-orders', 'Catering'] },
  { key: 'pub', label: 'Pub and bar', blurb: 'Books tables and the beer garden, and knows when the match is on.', status: 'soon', covers: ['Areas and tables', 'Food menu', 'Events and function room'] },
  { key: 'barber', label: 'Barber', blurb: 'Books cuts with any barber or a named one, and handles the walk-in question.', status: 'soon', covers: ['Barbers and chairs', 'Cuts, times and prices', 'Deposits and no-shows'] },
  { key: 'salon', label: 'Hair salon', blurb: 'Books colour and cut by stylist level, and remembers the patch test.', status: 'soon', covers: ['Stylists and levels', 'Services and processing time', 'Deposits'] },
  { key: 'beauty', label: 'Beauty and nails', blurb: 'Books treatments, answers aftercare questions, and fills cancellations.', status: 'soon', covers: ['Therapists and rooms', 'Treatments', 'Deposits'] },
  { key: 'spa', label: 'Spa and massage', blurb: 'Books treatments that need a therapist and a room, couples included.', status: 'soon', covers: ['Therapists and rooms', 'Treatments and packages'] },
  { key: 'estate_agent', label: 'Estate agent', blurb: 'Qualifies buyers, books viewings on your listings, and captures valuation leads.', status: 'soon', covers: ['Negotiators', 'Property list', 'Viewings and valuations'] },
  { key: 'letting_agent', label: 'Letting agent', blurb: 'Books viewings, asks the referencing questions, and triages repair reports.', status: 'soon', covers: ['Rentals', 'Viewings', 'Repairs'] },
  { key: 'hotel', label: 'Hotel and B&B', blurb: 'Checks rooms across dates and answers check-in, parking and dog questions.', status: 'soon', covers: ['Rooms and rates', 'Stays', 'Policies'] },
  { key: 'gym', label: 'Gym and personal training', blurb: 'Books trial classes and PT sessions, and knows what is full.', status: 'soon', covers: ['Timetable', 'Trainers', 'Memberships'] },
  { key: 'dog_grooming', label: 'Dog grooming', blurb: 'Books by dog size and coat, so the diary never overruns.', status: 'soon', covers: ['Groomers', 'Services by size'] },
  { key: 'garage', label: 'Garage and MOT', blurb: 'Books MOTs, services and repairs into the right bay.', status: 'soon', covers: ['Bays and mechanics', 'MOT and services'] },
];

export const presetInfo = (key: string) => PRESETS.find((p) => p.key === key);
