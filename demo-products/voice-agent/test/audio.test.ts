import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Resampler, base64ToPcm16, concatPcm16, mulawDecode, mulawEncode, pcm16ToBase64, rms, throughPhoneLine,
} from '../src/core/audio.ts';

function sine(freq: number, rate: number, seconds: number, amp = 10000): Int16Array {
  const n = Math.round(rate * seconds);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.round(amp * Math.sin((2 * Math.PI * freq * i) / rate));
  return out;
}

function zeroCrossings(pcm: Int16Array): number {
  let n = 0;
  for (let i = 1; i < pcm.length; i++) if ((pcm[i - 1] < 0) !== (pcm[i] < 0)) n++;
  return n;
}

test('μ-law: the standard reference values', () => {
  assert.equal(mulawEncode(Int16Array.of(0))[0], 0xff);
  assert.equal(mulawDecode(Uint8Array.of(0xff))[0], 0);
  assert.equal(mulawDecode(Uint8Array.of(0x00))[0], -32124);
  assert.equal(mulawDecode(Uint8Array.of(0x80))[0], 32124);
});

test('μ-law: every code survives decode then encode (bar negative zero)', () => {
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  const back = mulawEncode(mulawDecode(all));
  for (let i = 0; i < 256; i++) {
    if (i === 0x7f) continue; // negative zero decodes to 0, which encodes as 0xFF
    assert.equal(back[i], i, `code ${i}`);
  }
});

test('μ-law: quantisation error stays within the companding bound', () => {
  const pcm = sine(440, 8000, 0.1, 20000);
  const back = mulawDecode(mulawEncode(pcm));
  for (let i = 0; i < pcm.length; i++) {
    const err = Math.abs(back[i] - pcm[i]);
    assert.ok(err <= Math.max(16, Math.abs(pcm[i]) * 0.07), `sample ${i}: ${pcm[i]} → ${back[i]}`);
  }
});

test('resampler: 24 kHz → 8 kHz keeps a 440 Hz tone', () => {
  const out = new Resampler(24000, 8000).process(sine(440, 24000, 1));
  assert.ok(Math.abs(out.length - 8000) <= 20, `length ${out.length}`);
  const zc = zeroCrossings(out);
  assert.ok(Math.abs(zc - 880) <= 4, `zero crossings ${zc}`);
  assert.ok(Math.abs(rms(out) - 10000 / Math.SQRT2) < 400, `rms ${rms(out)}`);
});

test('resampler: 24 kHz → 8 kHz removes a 6 kHz tone instead of aliasing it', () => {
  const out = new Resampler(24000, 8000).process(sine(6000, 24000, 0.5));
  assert.ok(rms(out.subarray(100)) < 700, `rms ${rms(out)} — should be strongly attenuated`);
});

test('resampler: 8 kHz → 16 kHz keeps a 1 kHz tone', () => {
  const out = new Resampler(8000, 16000).process(sine(1000, 8000, 1));
  assert.ok(Math.abs(out.length - 16000) <= 40);
  assert.ok(Math.abs(zeroCrossings(out) - 2000) <= 8); // exact-zero samples blur the count
});

test('resampler: 20 ms frames give the same output as one block', () => {
  const input = sine(523, 24000, 0.5);
  const whole = new Resampler(24000, 8000).process(input);
  const r = new Resampler(24000, 8000);
  const parts: Int16Array[] = [];
  for (let off = 0; off < input.length; off += 480) parts.push(r.process(input.subarray(off, off + 480)));
  const chunked = concatPcm16(parts);
  assert.equal(chunked.length, whole.length);
  for (let i = 0; i < whole.length; i++) assert.ok(Math.abs(chunked[i] - whole[i]) <= 1, `sample ${i}`);
});

test('base64 round trip is little-endian PCM16', () => {
  const pcm = Int16Array.of(0, 1, -1, 32767, -32768, 1234);
  assert.deepEqual(base64ToPcm16(pcm16ToBase64(pcm)), pcm);
  assert.equal(pcm16ToBase64(Int16Array.of(1)), Buffer.from([1, 0]).toString('base64'));
});

test('the simulated phone line keeps speech-band audio', () => {
  const out = throughPhoneLine(sine(700, 24000, 1), 24000);
  assert.ok(Math.abs(out.length - 16000) <= 60);
  assert.ok(Math.abs(zeroCrossings(out) - 1400) <= 8);
});
