// The barber builder's steps, in order (presets/barber.md §3); the shared
// Review and start step comes after them. Every validation issue points at
// one of these keys. The web's builder lists these very steps, so this file
// is bundled for the browser and must import nothing.

export const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'hours', label: 'Opening hours' },
  { key: 'team', label: 'Your barbers' },
  { key: 'services', label: 'Services and prices' },
  { key: 'booking', label: 'Bookings and walk-ins' },
  { key: 'money', label: 'Deposits and cancelling' },
  { key: 'policies', label: 'Policies and questions' },
] as const;

/** The builder steps an issue can point at. */
export type BarberStep = (typeof STEPS)[number]['key'];
