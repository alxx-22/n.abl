// The kinds of business a prospect can build a demo for. Restaurant, estate
// agent and property maintenance are live; the rest are listed so prospects
// see where the product is going, and are built in the order of
// DEMO-SERVICE-PLAN.md §8.

import type { BusinessType } from '../domain/types.ts';

export interface PresetInfo {
  key: string;
  label: string;
  /** One line, from the owner's side: what the receptionist does for them. */
  blurb: string;
  status: 'live' | 'soon';
  /** What the builder asks about, shown on the card. */
  covers: string[];
  /** What the business is called in a sentence: "Untitled barber shop", "Give the hair salon a name". */
  noun: string;
  /** What its compiled profile says it is. */
  business_type: BusinessType;
  /** A placeholder website for the new-demo form. */
  example: string;
}

export const PRESETS: PresetInfo[] = [
  {
    key: 'restaurant',
    label: 'Restaurant',
    blurb: 'Books tables inside or out, takes click and collect orders, and answers the questions your staff answer all day.',
    status: 'live',
    covers: ['Seating areas and floor plan', 'Menu and allergens', 'Click and collect, delivery', 'Deposits and payment'],
    noun: 'restaurant',
    business_type: 'restaurant',
    example: 'https://www.your-restaurant.co.uk',
  },
  {
    key: 'takeaway', label: 'Takeaway and fast food', blurb: 'Takes orders for collection or delivery, upsells the meal deal, and quotes honest wait times.', status: 'live',
    covers: ['Menu, sizes and deals', 'Collection slots', 'Delivery areas'],
    noun: 'takeaway', business_type: 'takeaway', example: 'https://www.your-takeaway.co.uk',
  },
  {
    key: 'cafe', label: 'Café and coffee shop', blurb: 'Takes pre-orders and office catering, and knows every milk and syrup.', status: 'soon',
    covers: ['Drinks and food', 'Pre-orders', 'Catering'],
    noun: 'café', business_type: 'cafe', example: 'https://www.your-cafe.co.uk',
  },
  {
    key: 'pub', label: 'Pub and bar', blurb: 'Books tables and the beer garden, and knows when the match is on.', status: 'soon',
    covers: ['Areas and tables', 'Food menu', 'Events and function room'],
    noun: 'pub', business_type: 'pub', example: 'https://www.your-pub.co.uk',
  },
  {
    key: 'barber', label: 'Barber', blurb: 'Books cuts with any barber or a named one, and handles the walk-in question.', status: 'soon',
    covers: ['Barbers and chairs', 'Cuts, times and prices', 'Deposits and no-shows'],
    noun: 'barber shop', business_type: 'barber', example: 'https://www.your-barbers.co.uk',
  },
  {
    key: 'salon', label: 'Hair salon', blurb: 'Books colour and cut by stylist level, and remembers the patch test.', status: 'soon',
    covers: ['Stylists and levels', 'Services and processing time', 'Deposits'],
    noun: 'hair salon', business_type: 'salon', example: 'https://www.your-salon.co.uk',
  },
  {
    key: 'beauty', label: 'Beauty and nails', blurb: 'Books treatments, answers aftercare questions, and fills cancellations.', status: 'soon',
    covers: ['Therapists and rooms', 'Treatments', 'Deposits'],
    noun: 'beauty salon', business_type: 'beauty', example: 'https://www.your-beauty-salon.co.uk',
  },
  {
    key: 'spa', label: 'Spa and massage', blurb: 'Books treatments that need a therapist and a room, couples included.', status: 'soon',
    covers: ['Therapists and rooms', 'Treatments and packages'],
    noun: 'spa', business_type: 'spa', example: 'https://www.your-spa.co.uk',
  },
  {
    key: 'estate_agent', label: 'Estate agent', blurb: 'Qualifies buyers, books viewings on your listings, and captures valuation leads.', status: 'live',
    covers: ['Negotiators', 'Property list', 'Viewings and valuations'],
    noun: 'estate agency', business_type: 'estate_agent', example: 'https://www.your-estate-agency.co.uk',
  },
  {
    key: 'letting_agent', label: 'Letting agent', blurb: 'Books viewings, asks the referencing questions, and triages repair reports.', status: 'soon',
    covers: ['Rentals', 'Viewings', 'Repairs'],
    noun: 'letting agency', business_type: 'letting_agent', example: 'https://www.your-letting-agency.co.uk',
  },
  {
    key: 'property_maintenance', label: 'Property maintenance', blurb: 'Puts safety first on emergency calls, books the right engineer into a real window, and tells tenants when their engineer is coming.', status: 'live',
    covers: ['Trades and engineers', 'Emergencies and on call', 'Safety checks and servicing'],
    noun: 'property maintenance company', business_type: 'property_maintenance', example: 'https://www.your-property-maintenance.co.uk',
  },
  {
    key: 'hotel', label: 'Hotel and B&B', blurb: 'Checks rooms across dates and answers check-in, parking and dog questions.', status: 'soon',
    covers: ['Rooms and rates', 'Stays', 'Policies'],
    noun: 'hotel', business_type: 'hotel', example: 'https://www.your-hotel.co.uk',
  },
  {
    key: 'gym', label: 'Gym and personal training', blurb: 'Books trial classes and PT sessions, and knows what is full.', status: 'soon',
    covers: ['Timetable', 'Trainers', 'Memberships'],
    noun: 'gym', business_type: 'gym', example: 'https://www.your-gym.co.uk',
  },
  {
    key: 'dog_grooming', label: 'Dog grooming', blurb: 'Books by dog size and coat, so the diary never overruns.', status: 'soon',
    covers: ['Groomers', 'Services by size'],
    noun: 'dog grooming salon', business_type: 'dog_grooming', example: 'https://www.your-dog-groomers.co.uk',
  },
  {
    key: 'garage', label: 'Garage and MOT', blurb: 'Books MOTs, services and repairs into the right bay.', status: 'soon',
    covers: ['Bays and mechanics', 'MOT and services'],
    noun: 'garage', business_type: 'garage', example: 'https://www.your-garage.co.uk',
  },
];

export const presetInfo = (key: string) => PRESETS.find((p) => p.key === key);
