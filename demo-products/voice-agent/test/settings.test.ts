import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFixtures } from '../src/db/seed.ts';
import { applySettings } from '../src/domain/settings.ts';
import { VOICES, REPLY_SPEEDS, LIVE_MODELS } from '../src/domain/voices.ts';

const lucas = loadFixtures().find((f) => f.slug === 'lucas-trattoria')!;

test('settings: voice, speed, language and model change; nothing else does', () => {
  const r = applySettings(lucas, { voice: 'Sulafat', reply_speed: 'snappy', language_code: null, live_model: LIVE_MODELS[1].id });
  assert.ok(r.ok);
  assert.equal(r.profile.voice, 'Sulafat');
  assert.equal(r.profile.reply_speed, 'snappy');
  assert.equal(r.profile.language_code, null);
  assert.equal(r.profile.live_model, 'gemini-3.8-live');
  assert.equal(r.profile.greeting, lucas.greeting);
  assert.equal(lucas.voice, 'Kore', 'the original profile is untouched');
  const back = applySettings(r.profile, { live_model: '', language_code: 'en-GB' });
  assert.ok(back.ok);
  assert.equal(back.profile.live_model, null);
  assert.equal(back.profile.language_code, 'en-GB');
});

test('settings: bad values are refused with a reason', () => {
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ voice: 'Alexa' }, /Unknown voice/],
    [{ voice: 42 }, /Unknown voice/],
    [{ reply_speed: 'instant' }, /Reply speed/],
    [{ language_code: 'english' }, /Language/],
    [{ live_model: 'gemini-1.0-pro' }, /voice model/],
    [{ greeting: 'Hi' }, /one or two sentences/],
    [{ greeting: 'Hello, thanks for calling Luca’s, how can I help today?' }, /AI assistant/],
    [{ greeting: "Hello, you're through to Luca's AI assistant. How can I help?" }, /demo/],
  ];
  for (const [patch, why] of cases) {
    const r = applySettings(lucas, patch);
    assert.equal(r.ok, false, JSON.stringify(patch));
    if (!r.ok) assert.match(r.error, why);
  }
});

test('settings: a good greeting is trimmed and kept', () => {
  const r = applySettings(lucas, { greeting: "  Ciao! You're through to Luca's, I'm the AI assistant on this demo line. What can I do for you?  " });
  assert.ok(r.ok);
  assert.ok(r.ok && r.profile.greeting.startsWith('Ciao!'));
});

test('voices: thirty unique names, three reply speeds in order', () => {
  assert.equal(VOICES.length, 30);
  assert.equal(new Set(VOICES.map((v) => v.name)).size, 30);
  assert.ok(REPLY_SPEEDS.snappy.silence_ms < REPLY_SPEEDS.normal.silence_ms && REPLY_SPEEDS.normal.silence_ms < REPLY_SPEEDS.patient.silence_ms);
});
