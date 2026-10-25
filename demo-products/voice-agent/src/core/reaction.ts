// A severe allergic reaction on a takeaway's call (presets/takeaway.md §4.2):
// "he's eaten it and his lips are swelling". The caller's words arm it; from
// then until the receptionist has said 999, every tool refuses, and the call
// is told the fixed script to say first. The owner cannot edit the script.
// Its own detector and state, apart from the repairs preset's emergencies
// (core/safety.ts), as the two never meet on one call.
//
// The steps are the NHS's for anaphylaxis: call 999 and say anaphylaxis, use
// an adrenaline auto-injector if there is one, lie down with the legs raised
// (sit up if breathing is hard), and a second injection after five minutes if
// there is no better. Ill after eating is not this: it is a tool answer
// (GP, NHS 111, 999 if severe; core/kitchen.ts).


export interface ReactionState {
  /** How many caller lines had been heard when it armed: the one that armed it is heard[armed_at - 1]. */
  armed_at: number;
  /** How many of the receptionist's lines had been said: only what comes after counts. */
  said_from: number;
  spoken: boolean;
}

interface Tracked {
  reaction: ReactionState | null;
  heard: string[];
  said: string[];
}

export const REACTION_SCRIPT = [
  'Please call 999 now and say anaphylaxis.',
  'If they have an adrenaline auto-injector, like an EpiPen, use it now, in the outer thigh.',
  "Lie them down with their legs raised, or sit them up if they're struggling to breathe.",
  "If they're no better after five minutes, use a second auto-injector if there is one.",
  'Stay with them, and keep them still.',
];

const REACTION = [
  /\b(?:lips?|tongue|throat|face|mouth)\b[^.?!]{0,25}\b(?:swell\w*|swollen|puff\w* up|closing up|tight\w*)\b/i,
  /\b(?:swell\w*|swollen)\b[^.?!]{0,15}\b(?:lips?|tongue|throat|face|mouth)\b/i,
  /\b(?:can'?t|cannot|struggling to|hard to|trouble|difficulty)\s+(?:breath\w*|swallow\w*)\b/i,
  /\banaphyla\w*\b/i,
  /\b(?:having|had|going into|gone into)\s+(?:an?\s+)?(?:bad\s+|severe\s+)?(?:allergic\s+)?reaction\b/i,
  /\b(?:use|used|using|give|gave|given)\b[^.?!]{0,20}\b(?:epi-?pens?|auto-?injectors?|adrenaline)\b/i,
];

// "can't" has no word break before its n't, so that is matched on its own.
const NOT = /(?:\b(?:no|not|never|nothing|any)\b|n't\b)[^.?!]{0,20}$/i;

/** The caller's line describes a severe allergic reaction happening now. */
export function detectReaction(line: string): boolean {
  return REACTION.some((re) => {
    const m = re.exec(line);
    // "No reaction", "isn't swelling"; "can't breathe" carries its own n't, so only what comes before it counts.
    return m !== null && !NOT.test(line.slice(Math.max(0, m.index - 30), m.index)) && !/\b(?:not|no|never)\b|(?<!can)n'?t\b/i.test(m[0]);
  });
}

/** Arms it for the caller's line, once a call. True when it has just armed. */
export function armReaction(state: Tracked, line: string): boolean {
  if (state.reaction || !detectReaction(line)) return false;
  state.reaction = { armed_at: state.heard.length, said_from: state.said.length, spoken: false };
  return true;
}

/** 999, in figures or words, on its own: a price like £19.99 is not it. */
export const said999 = (words: string) => /(?<![\d.£])9[\s-]?9[\s-]?9(?![\d.]\d)/.test(words) || /\bnine[\s,-]+nine[\s,-]+nine\b/i.test(words);

/** After the receptionist speaks: true when 999 has just been said, which opens the tools. */
export function noteReactionSaid(state: Tracked): boolean {
  const r = state.reaction;
  if (!r || r.spoken || !said999(state.said.slice(r.said_from).join(' '))) return false;
  r.spoken = true;
  return true;
}

/** The one line the call sends when it arms, so the first sentence never waits on a tool. */
export const REACTION_NOW = `[From the system: the caller may be describing a severe allergic reaction (anaphylaxis). Before anything else, say: "${REACTION_SCRIPT.join(' ')}" Nothing about orders or anything else until you have. Then ask if they're with them now, and stay calm.]`;

/** What every tool returns while 999 is unsaid. */
export function reactionFirst(): Record<string, unknown> {
  return { done: false, message: `This may be anaphylaxis. Say this first, in your own words: ${REACTION_SCRIPT.join(' ')} Nothing else until you have.` };
}
