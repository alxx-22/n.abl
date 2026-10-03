// What a demo is called before it has a name, in its own kind of business's
// words ("Untitled barber shop"), from the catalogue's noun, never its label:
// "Hair salon" lowercased reads well, "Takeaway and fast food" does not.

import { presetInfo } from '../../../src/presets/catalogue.ts';

const noun = (preset: string) => presetInfo(preset)?.noun ?? 'demo';

/** On the list of demos: "Untitled restaurant". */
export const untitled = (preset: string) => `Untitled ${noun(preset)}`;

/** In the builder, until it is named: "New restaurant". */
export const unnamed = (preset: string) => `New ${noun(preset)}`;
