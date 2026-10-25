// What the words say about whose turn it is. Pure functions, no I/O: the
// turn manager asks them "has the caller finished?" and "what is the
// caller about to give us?".
//
// Two sources of words. The receptionist's own last question sets what we
// expect next (a yes or no, a list of dishes, a phone number). The caller's
// words so far, from the parallel transcriber, say whether they have
// finished: "and, um..." has not, "hang on, let me ask the kids" is a hold,
// "Jack, what do you want?" is not meant for us at all.

/** What kind of answer the receptionist's last question invites. */
export type Expect = 'yes_no' | 'list' | 'digits' | 'name' | 'open';

export interface Expectation {
  expect: Expect;
  /** For digits: how many make a complete answer (a UK phone number is 11). */
  digits?: number;
}

function lastQuestion(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  const qs = t.split(/(?<=[.!?])\s+/).filter((s) => s.includes('?'));
  return (qs.length ? qs[qs.length - 1] : t.split(/(?<=[.!?])\s+/).pop() ?? '').toLowerCase();
}

export function expectFromAgent(text: string): Expectation {
  const q = lastQuestion(text);
  if (!q) return { expect: 'open' };
  if (/\b(card number|long number on the card)\b/.test(q)) return { expect: 'digits', digits: 16 };
  if (/\b(security code|cvc|cvv|three digits)\b/.test(q)) return { expect: 'digits', digits: 3 };
  if (/\b(expiry|expiration)\b/.test(q)) return { expect: 'digits', digits: 4 };
  if (/\b(phone|mobile|contact|telephone) number\b|\bnumber (to|for|we can|i can)\b|\bbest number\b|\bwhat'?s your number\b/.test(q)) return { expect: 'digits', digits: 11 };
  if (/\bpost ?code\b/.test(q)) return { expect: 'digits', digits: 0 };
  if (/\b(anything else|what (can|could) i get|what would you like|what do you fancy|what are you after|what'?ll it be|like to order|what else|which (one|dish|pizza|pasta)s?|any sides|any drinks)\b/.test(q)) return { expect: 'list' };
  if (/\b(name (for|on|is)|your name|what name|who'?s the booking for|who is the booking for|spell)\b/.test(q)) return { expect: 'name' };
  // "Could you repeat that?" and "Can you spell it?" are requests, answered with content, not a yes.
  if (/^(can|could|would|will) you (please |just )?(repeat|say|spell|give|tell|read|confirm|let me know|share|go through|run me through)\b/.test(q)) return { expect: 'open' };
  if (/^(shall|should|would|do|does|did|is|are|was|were|can|could|will|have|has|may|is that|are you)\b/.test(q) && !/\bor\b/.test(q)) {
    return { expect: 'yes_no' };
  }
  return { expect: 'open' };
}

const DIGIT_WORDS: Record<string, number> = {
  zero: 1, oh: 1, o: 1, nought: 1, nil: 1, one: 1, two: 1, three: 1, four: 1, five: 1, six: 1, seven: 1, eight: 1, nine: 1,
};

/** Digits spoken so far: "oh seven seven double oh" is 5, "07700 900" is 8. */
export function countDigits(text: string): number {
  let n = 0;
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^\d+$/.test(w)) n += w.length;
    else if ((w === 'double' || w === 'triple') && i + 1 < words.length && (DIGIT_WORDS[words[i + 1]] || /^\d$/.test(words[i + 1]))) {
      n += w === 'double' ? 2 : 3;
      i++;
    } else if (DIGIT_WORDS[w] && !(w === 'o' && i > 0 && !DIGIT_WORDS[words[i - 1]] && !/^\d+$/.test(words[i - 1]))) n += 1;
  }
  return n;
}

export interface WordSigns {
  /** Trails off: "and, um...", "can I get a", "with". The caller is still thinking. */
  unfinished: boolean;
  /** "Hang on", "one sec", "let me ask": the caller has asked us to wait. */
  hold: boolean;
  /** Talking to someone else in the room: "Jack, what do you want?" */
  sideTalk: boolean;
  /** Back to us after a hold: "Sorry about that", "Right, so...", "And a carbonara". */
  back: boolean;
  /** Clearly finished: "that's everything", "no, that's all, thanks". */
  done: boolean;
  /** Only a backchannel: "mm-hm", "yeah", "okay". */
  backchannel: boolean;
  digits: number;
}

const FILLER_TAIL =
  /(?:^|[\s,])(?:um+|uh+|erm+|er+|hmm+|ah+|and|or|but|with|plus|also|a|an|the|some|of|to|for|like|maybe|then|so|is|are|was|it'?s|my|our|your|at|in|on|from|than|if|because|just|let me (?:think|see)|what else|i think|can i (?:get|have)|could i (?:get|have)|i'?d like|we'?ll have|i'?ll have|we'?d like|and also|as well as)$/i;
const HOLD =
  /\b(hang on|hold on|one (sec|second|moment|minute|min)|just a (sec|second|moment|minute|min)|bear with me|give me a (sec|second|moment|minute)|wait a (sec|second|moment|minute)|two secs?|let me (ask|check with|see what|find out what|grab|get)|i'?ll (just )?ask)\b/i;
const INTERJECTIONS = new Set([
  'yes', 'yeah', 'yep', 'no', 'nope', 'okay', 'ok', 'right', 'sorry', 'hi', 'hello', 'hiya', 'well', 'so', 'oh', 'um', 'erm', 'and',
  'also', 'actually', 'great', 'lovely', 'perfect', 'thanks', 'cheers', 'please', 'sure', 'fine', 'brilliant', 'alright', 'hmm', 'ah',
]);
const ENDEARMENTS = /^(love|babe|darling|hun|honey|mum|dad|kids|guys|mate|sweetheart|son|pal)$/i;
const SECOND_PERSON_Q = /^(do|did|does|are|is|can|what|which|who|where|shall|should|would|will|you|d'you|want|fancy)\b/i;
const BACK =
  /^(sorry|okay|ok|right|so|yeah|yes|hi|hello|are you (still )?there|we('ll| will| would|'d) (have|like|go)|can (we|i)|could (we|i)|and (a|an|the|some|also|two|three|four|one)|she('ll| will| wants)|he('ll| will| wants)|they('ll| will| want)|that'?s it|go on|thanks for waiting|thank you for waiting)\b|\bsorry about that\b|\bare you still there\b/i;
const DONE = /\b(that'?s (it|all|everything)|nothing else|that'?ll be all|that will be all|thanks?,? bye|goodbye|bye now|that'?s the lot)\b/i;
const BACKCHANNEL = /^(mm+-?hm+|uh-?huh|mhm+|yeah|yep|yes|ok(ay)?|right|sure|great|lovely|cheers|thanks|thank you|alright|perfect|brilliant|cool|fine|go on|mm+)[.!,]?$/i;

export function readWords(text: string): WordSigns {
  const t = text.replace(/\s+/g, ' ').trim();
  const tail = t.replace(/[.!?…,;:\-–—\s]+$/, '');
  const trailing = /(\.\.\.|…|,|-|–|—)\s*$/.test(t);
  const sentences = t.split(/(?<=[.!?])\s+/);
  const last = sentences[sentences.length - 1] ?? '';

  // "Jack, do you want..." / "Love, what are you having?": a name or
  // endearment, a comma, then a question to that person.
  let sideTalk = false;
  for (const s of sentences) {
    const m = /^([A-Za-z']+)\s*,\s*(.+)$/.exec(s.trim());
    if (m && !INTERJECTIONS.has(m[1].toLowerCase()) && (ENDEARMENTS.test(m[1]) || /^[A-Z]/.test(m[1])) && SECOND_PERSON_Q.test(m[2])) sideTalk = true;
  }
  if (/\bwhat (do|d') ?you (want|fancy|reckon)\b|\bwhat are you having\b|\bdo you want (chips|a drink|pizza|pasta|anything)\b/i.test(t)) sideTalk = true;

  return {
    unfinished: FILLER_TAIL.test(tail) || (trailing && !/[.!?]\s*$/.test(t)),
    hold: HOLD.test(t),
    sideTalk,
    back: BACK.test(last.trim()) || /\bsorry about that\b/i.test(t),
    done: DONE.test(last),
    backchannel: BACKCHANNEL.test(t),
    digits: countDigits(t),
  };
}
