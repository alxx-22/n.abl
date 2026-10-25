// The estate agent builder's steps, in order (presets/estate-agent.md §3);
// the shared Review and start step comes after them. Every validation issue
// points at one of these keys. The web's builder lists these very steps, so
// this file is bundled for the browser and must import nothing.

export const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'patch', label: 'Where you work' },
  { key: 'hours', label: 'Office and viewing hours' },
  { key: 'team', label: 'Your team' },
  { key: 'listings', label: 'Listings' },
  { key: 'viewings', label: 'Viewings and safety' },
  { key: 'offers', label: 'Offers and valuations' },
  { key: 'services', label: 'Fees and services' },
  { key: 'policies', label: 'Area guide and questions' },
] as const;

/** The builder steps an issue can point at. */
export type EstateStep = (typeof STEPS)[number]['key'];
