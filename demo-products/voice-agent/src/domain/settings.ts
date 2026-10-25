// The settings panel's changes, validated and merged into a tenant profile.
// Only these fields can be changed this way; everything else goes through the
// full profile editor.

import type { TenantProfile } from './types.ts';
import { LIVE_MODELS, REPLY_SPEEDS, VOICE_NAMES, type ReplySpeed } from './voices.ts';

export interface SettingsPatch {
  voice?: unknown;
  greeting?: unknown;
  language_code?: unknown;
  reply_speed?: unknown;
  live_model?: unknown;
  turn_taking?: unknown;
}

export function applySettings(profile: TenantProfile, patch: SettingsPatch): { ok: true; profile: TenantProfile } | { ok: false; error: string } {
  const next: TenantProfile = { ...profile };
  if (patch.voice !== undefined) {
    if (typeof patch.voice !== 'string' || !VOICE_NAMES.has(patch.voice)) return { ok: false, error: `Unknown voice "${String(patch.voice)}".` };
    next.voice = patch.voice;
  }
  if (patch.greeting !== undefined) {
    const g = typeof patch.greeting === 'string' ? patch.greeting.trim() : '';
    if (g.length < 10 || g.length > 300) return { ok: false, error: 'The greeting should be one or two sentences.' };
    // Callers are always told they are talking to an AI, and on a demo line, that it is a demo.
    if (!/\bAI\b/.test(g)) return { ok: false, error: 'The greeting must say it is an AI assistant.' };
    if (next.status === 'demo' && !/\bdemo\b/i.test(g)) return { ok: false, error: 'On a demo line the greeting must say it is a demo.' };
    next.greeting = g;
  }
  if (patch.language_code !== undefined) {
    if (patch.language_code === null || patch.language_code === '') next.language_code = null;
    else if (typeof patch.language_code === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(patch.language_code)) next.language_code = patch.language_code;
    else return { ok: false, error: 'Language must be like en-GB, or empty to follow the caller.' };
  }
  if (patch.reply_speed !== undefined) {
    if (typeof patch.reply_speed !== 'string' || !(patch.reply_speed in REPLY_SPEEDS)) return { ok: false, error: 'Reply speed must be snappy, normal or patient.' };
    next.reply_speed = patch.reply_speed as ReplySpeed;
  }
  if (patch.live_model !== undefined) {
    if (patch.live_model === null || patch.live_model === '') next.live_model = null;
    else if (typeof patch.live_model === 'string' && LIVE_MODELS.some((m) => m.id === patch.live_model)) next.live_model = patch.live_model;
    else return { ok: false, error: 'Unknown voice model.' };
  }
  if (patch.turn_taking !== undefined) {
    if (patch.turn_taking !== 'contextual' && patch.turn_taking !== 'standard') return { ok: false, error: 'Turn-taking must be contextual or standard.' };
    next.turn_taking = patch.turn_taking;
  }
  return { ok: true, profile: next };
}
