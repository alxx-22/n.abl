// Answering questions from the business's own words.
//
// A small keyword scorer, not embeddings: a demo tenant has tens of entries,
// not thousands, and every answer has to be traceable to one entry the owner
// can read and correct. No match means "I don't know", never a guess.

import type { KnowledgeEntry } from './types.ts';
import { normalise } from './menu.ts';

const QUESTION_WORDS = new Set([
  'do', 'you', 'your', 'is', 'are', 'can', 'i', 'we', 'have', 'there', 'what', 'where', 'when', 'how', 'any',
  'it', 'to', 'for', 'in', 'on', 'at', 'my', 'me', 'us', 'our', 'be', 'if', 'get', 'does', 'will', 'would', 'about',
  // Verbs that say nothing about the topic: "do you sell petrol" is about petrol.
  'sell', 'bring', 'buy', 'need', 'want', 'like', 'book', 'make', 'take', 'come', 'go', 'know', 'tell', 'got',
  'allowed', 'allow', 'ok', 'okay', 'possible', 'much', 'many', 'any', 'there', 'also',
]);

function terms(s: string): string[] {
  return normalise(s).filter((w) => !QUESTION_WORDS.has(w));
}

export interface KnowledgeHit {
  q: string;
  a: string;
  source?: string;
  score: number;
}

export function searchKnowledge(entries: KnowledgeEntry[], question: string, limit = 3): KnowledgeHit[] {
  const qTerms = terms(question);
  if (!qTerms.length) return [];
  const docs = entries.map((e) => ({
    e,
    head: new Set([...terms(e.q), ...(e.tags ?? []).flatMap((t) => terms(t))]),
    body: new Set(terms(e.a)),
  }));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set([...d.head, ...d.body])) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length || 1;
  const idf = (t: string) => Math.log(1 + n / (df.get(t) ?? 0.5));

  const hits = docs.map((d) => {
    let s = 0;
    for (const t of qTerms) {
      if (d.head.has(t)) s += 2 * idf(t);
      else if (d.body.has(t)) s += idf(t);
      else if ([...d.head].some((h) => h.length >= 5 && t.length >= 5 && (h.startsWith(t.slice(0, 5)) || t.startsWith(h.slice(0, 5))))) {
        s += idf(t);
      }
    }
    const max = qTerms.reduce((acc, t) => acc + 2 * idf(t), 0);
    return { q: d.e.q, a: d.e.a, source: d.e.source, score: max ? s / max : 0 };
  });
  return hits.filter((h) => h.score >= 0.25).sort((a, b) => b.score - a.score).slice(0, limit);
}
