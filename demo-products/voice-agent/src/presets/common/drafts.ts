// The common questions a caller asks, drafted from everything the owner has
// set so far. One small text-model call on the text key (config.keys.text),
// then through the same sanitiser as anything the browser sends, so a draft
// can never put more into a profile than a prospect could type.

import type { Config } from '../../config.ts';
import { generateJson } from '../../core/gemini.ts';
import { withArticle } from './profile.ts';
import { sanitiseFaqs } from './sanitise.ts';
import type { FaqAnswer } from './types.ts';

const FAQ_SCHEMA = {
  type: 'OBJECT',
  properties: {
    faqs: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { q: { type: 'STRING' }, a: { type: 'STRING' } }, required: ['q', 'a'] },
    },
  },
  required: ['faqs'],
};

/**
 * `factSheet` is the preset's own summary of the answers; `handles` is what
 * the receptionist does itself ("booking a table or ordering food"), so the
 * draft does not write answers that would compete with its tools.
 */
export async function draftFaqs(factSheet: string, noun: string, handles: string, config: Config): Promise<FaqAnswer[]> {
  const prompt = [
    `These are the facts about a UK ${noun}, set by its owner for an AI phone receptionist demo.`,
    factSheet,
    '',
    `Write the ten questions callers most often ask ${withArticle(noun)} like this that the facts above answer, each with a short spoken answer (one or two sentences, friendly, British English).`,
    `Use only these facts. Where the facts do not cover something, leave that question out rather than guess. No questions about ${handles} themselves; the receptionist handles those.`,
  ].join('\n');
  const d = await generateJson<{ faqs: FaqAnswer[] }>(config.textModel, prompt, config.keys.text, FAQ_SCHEMA, { temperature: 0.4 });
  return sanitiseFaqs(d?.faqs ?? []).slice(0, 12);
}
