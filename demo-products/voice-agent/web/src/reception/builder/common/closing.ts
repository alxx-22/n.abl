// A closing time in the hours grid. Midnight is saved as '24:00', the end of
// the business's own day (src/domain/time.ts), which a time box cannot hold.
// So it shows as 00:00, and 00:00 typed as a closing time means midnight:
// nothing else can, since a service cannot close before it opens.

import { MIDNIGHT } from '../../../../../src/domain/time.ts';

export { MIDNIGHT };

/** What the time box shows for a saved closing time. */
export const shownClose = (close: string) => (close === MIDNIGHT ? '00:00' : close);

/** What a closing time typed into the box is saved as. */
export const savedClose = (typed: string) => (typed === '00:00' ? MIDNIGHT : typed);
