// Safety mode for a repairs contractor's calls
// (presets/property-maintenance.md §4.2). A caller describing a gas smell,
// a carbon monoxide alarm, fire, sparks or water on electrics, or someone
// hurt, arms it; from then until the receptionist has said the advice and
// the number in its own words, every job, booking and lookup tool refuses.
// Fetching the script is not saying it (the reviewer's rule): only the
// receptionist's transcript turns it off. Switched on only for a call to a
// business with profile.maintenance.

import { digitsSaid } from '../domain/phone.ts';
import type { MtNation } from '../domain/types.ts';
import { MT_NATION_PACKS, safetyScript, type SafetyKind } from '../presets/maintenance/nations.ts';

/** The kinds that stop everything else until the advice is said. A chirping alarm, a leak or a lockout don't. */
export const GATED: SafetyKind[] = ['gas', 'co', 'fire', 'hurt', 'electric'];

export interface SafetyState {
  kind: SafetyKind;
  /** How many caller lines had been heard when it armed. */
  armed_at: number;
  /** How many of the receptionist's lines had been said: only what comes after counts as the advice. */
  said_from: number;
  spoken: boolean;
  /** The incident safety_advice logged, to mark when the advice was said. */
  incident: string | null;
  /** Described in another language: the advice is given in it, so only the number can show it was said. */
  foreign?: boolean;
}

interface Tracked {
  safety: SafetyState | null;
  safetyDone: string[];
  heard: string[];
  said: string[];
}

/**
 * Arms safety mode for what the caller just said: the kind armed, or null.
 * Each kind arms once a call, and one at a time, so a caller repeating
 * themselves never restarts the advice.
 */
export function armSafety(state: Tracked, line: string): SafetyKind | null {
  const kind = detectSafety(line);
  if (!kind || !GATED.includes(kind) || state.safetyDone.includes(kind) || state.safety?.kind === kind) return null;
  if (state.safety && !state.safety.spoken) return null;
  state.safety = { kind, armed_at: state.heard.length, said_from: state.said.length, spoken: false, incident: null, ...(inAnotherLanguage(line) ? { foreign: true } : {}) };
  return kind;
}

/** After the receptionist speaks: the safety state that has just been satisfied, if any. */
export function noteAdvice(state: Tracked, nation: MtNation): SafetyState | null {
  const s = state.safety;
  if (!s || s.spoken || !adviceSaid(s.kind, state.said.slice(s.said_from).join(' '), nation, s.foreign)) return null;
  s.spoken = true;
  state.safetyDone.push(s.kind);
  return s;
}

// "can't" has no word break before its n't, so that is matched on its own.
const NOT = /(?:\b(?:no|not|never|nothing|stopped|gone)\b|n't\b)[^.?!]{0,20}$/i;

const GAS = /\b(?:smell(?:s|ing)?(?: of)? gas|gas (?:smell|leak|leaking)|smells? (?:like|of) gas|leaking gas|gas (?:is|'s) (?:leaking|escaping)|hiss(?:ing)? (?:of|from the) gas)\b/i;
// A gas smell in the languages most often heard on the phone here besides English: Polish, Romanian, Portuguese,
// Spanish, Italian, French and Lithuanian (live, 8 October: "czuję gaz w kuchni" armed nothing, so no text was sent).
const GAS_ABROAD = /\b(?:czuj\w*|zapach\w*|wyciek\w*|ulatnia\w*|miro[as]\w*|scurg\w*|cheir\w*|fuga|huele|olor|odore|puzza|odeur|fuite|kvap\w*|kvep\w*|nuot\w*)\b[^.?!]{0,30}\b(?:gaz\w*|g[aá]s|duj\w*)\b|\b(?:gaz\w*|g[aá]s|duj\w*)\b[^.?!]{0,20}\b(?:czu\w*|ulatnia\w*|wycieka\w*|miroase|cheira|huele|puzza|kvap\w*|kvep\w*)\b|\bça sent (?:le )?gaz\b/i;
/** A gas smell described in another language, not in English. */
export const inAnotherLanguage = (line: string) => GAS_ABROAD.test(line) && !GAS.test(line);
const CO_ALARM = /\b(?:carbon monoxide|monoxide|co) (?:alarm|detector|monitor)\b|\bcarbon monoxide\b/i;
const CHIRP = /\bchirp|\bbeeps? (?:once|every)|\bevery (?:minute|few minutes|30 seconds)|\blow battery|\bend of (?:its )?life/i;
const CO_SYMPTOMS = /\b(?:headache|dizzy|dizziness|feel(?:ing)? sick|nause\w*|drowsy|passed out|faint\w*)\b[^.?!]{0,60}\b(?:boiler|fire|heater|fumes?|cooker|gas)\b|\b(?:boiler|fire|heater|fumes?|gas)\b[^.?!]{0,60}\b(?:headache|dizzy|dizziness|feel(?:ing)? sick|drowsy)\b/i;
const FIRE = /\b(?:on fire|there'?s a fire|caught fire|in flames|flames (?:are )?coming|smoke (?:is |'s )?(?:coming|pouring|everywhere|filling)|full of smoke)\b/i;
const ELECTRIC = /\bsparks?\b|\bsparking\b|\bburning smell\b|\bsmell(?:s|ing)? of burning\b|\b(?:socket|plug|switch|fuse ?box|consumer unit)\b[^.?!]{0,30}\b(?:smoking|melted|melting|scorched|hot to touch|buzzing)\b|\bwater\b[^.?!]{0,40}\b(?:light fittings?|lights?|sockets?|fuse ?box|consumer unit|electrics)\b/i;
const HURT = /\b(?:is|'s|has been|got|was) (?:hurt|injured|unconscious|bleeding badly)\b|\bnot breathing\b|\bcollapsed\b|\belectric shock\b|\bgot a shock\b/i;

/** The emergency a caller's line describes, if any; a chirping carbon monoxide alarm is its own, milder kind. */
export function detectSafety(line: string): SafetyKind | null {
  // A denial before the words, or inside them: "the water isn't anywhere near the lights" (live, 6 October).
  const hit = (re: RegExp) => {
    const m = re.exec(line);
    return m !== null && !NOT.test(line.slice(Math.max(0, m.index - 30), m.index)) && !/\b(?:not|nowhere|never|no)\b|n'?t\b/i.test(m[0]);
  };
  if (hit(GAS) || GAS_ABROAD.test(line)) return 'gas';
  if (CO_ALARM.test(line) && CHIRP.test(line)) return 'co_chirp';
  if (hit(CO_ALARM) || hit(CO_SYMPTOMS)) return 'co';
  if (hit(FIRE)) return 'fire';
  if (hit(HURT)) return 'hurt';
  if (hit(ELECTRIC)) return 'electric';
  return null;
}

/** What shows the advice was given: its first step's gist, and the number, in figures or words. */
const GIST: Partial<Record<SafetyKind, RegExp>> = {
  gas: /\b(?:get (?:everyone )?out|leave|outside|out of the (?:property|house|flat|home))\b/i,
  co: /\b(?:fresh air|get (?:everyone )?out|leave|outside)\b/i,
  fire: /\b(?:get (?:everyone )?out|leave|outside)\b/i,
  hurt: /\b(?:999|nine nine nine|ambulance)\b/i,
  electric: /\b(?:don'?t touch|do not touch|main switch|power off|switch (?:it|the power|everything) off|turn (?:the power|the electrics|everything) off)\b/i,
};

/** The kind's number said in these words, in figures or digit by digit. */
function numberSaid(kind: SafetyKind, words: string, nation: MtNation): boolean {
  const number = safetyScript(kind, nation).number;
  return Boolean(number) && digitsSaid(words).includes(number!.replace(/\D/g, ''));
}

/** These words start this kind's advice, number or not: a reply that doesn't, while it is owed, puts something else first. */
export const adviceStarted = (kind: SafetyKind, words: string, foreign = false, nation?: MtNation) =>
  Boolean(GIST[kind]?.test(words)) || (foreign && nation !== undefined && numberSaid(kind, words, nation));

/** The receptionist said this kind's advice, number included, in these words. */
export function adviceSaid(kind: SafetyKind, words: string, nation: MtNation, foreign = false): boolean {
  const said = numberSaid(kind, words, nation);
  // In the caller's own language the steps can't be matched word for word: the number, in digits, still must be said.
  if (!GIST[kind]?.test(words) && !(foreign && said)) return false;
  // An electrical fault is made safe by the switch; its number (999) is only for a fire.
  if (!safetyScript(kind, nation).number || kind === 'electric') return true;
  return said;
}

/** The one line the call sends when it arms: the first steps, so the first sentence never waits on a tool. */
export function safetyCorrection(kind: SafetyKind, nation: MtNation, foreign = false): string {
  const s = safetyScript(kind, nation);
  const gas = MT_NATION_PACKS[nation].gas;
  const say = s.steps.slice(0, kind === 'gas' ? 5 : 3).join(' ');
  const twice = s.number && s.number !== '999' ? ` Say ${s.number} twice, in groups.` : '';
  const after = kind === 'gas' || kind === 'co' ? ` Then use safety_advice, and tell them to hang up and ring ${gas.who} from outside.` : ' Then use safety_advice.';
  const language = foreign ? ' The caller is speaking another language: say it in their language, with the number in digits.' : '';
  return `[From the system: the caller may be describing an emergency (${s.title.toLowerCase()}). Before anything else, say: "${say}"${twice}${language}${after} Book nothing until you have.]`;
}

/** The refusal every gated tool gives while the advice is unsaid. */
export function safetyFirst(kind: SafetyKind, nation: MtNation): Record<string, unknown> {
  const s = safetyScript(kind, nation);
  return {
    done: false,
    message: `Give the safety advice first, in your own words: ${s.steps.join(' ')}${s.number ? ` Say ${s.number} clearly, twice.` : ''} Nothing else until you have.`,
  };
}
