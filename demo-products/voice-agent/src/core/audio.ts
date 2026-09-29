// Audio plumbing between the phone network, the browser and Gemini Live.
//
// The three ends speak different formats, and every conversion happens here:
//
//   Twilio media streams   G.711 μ-law, 8 kHz, mono, 20 ms frames, base64
//   Gemini Live, input     PCM16 little-endian, 16 kHz (8 kHz is accepted too)
//   Gemini Live, output    PCM16 little-endian, 24 kHz
//   Browser microphone     PCM16 16 kHz, resampled in the page's worklet
//
// Nothing here allocates per sample on the hot path beyond the output arrays,
// and μ-law uses lookup tables, because a call converts ~50 frames a second in
// each direction for its whole length.

const BIAS = 0x84;
const CLIP = 32635;

function encodeSample(sample: number): number {
  let pcm = sample;
  const sign = pcm < 0 ? 0x80 : 0;
  if (sign) pcm = -pcm;
  if (pcm > CLIP) pcm = CLIP;
  pcm += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (pcm & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function decodeSample(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const magnitude = (((mantissa << 3) + BIAS) << exponent) - BIAS;
  return sign ? -magnitude : magnitude;
}

const DECODE_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) DECODE_TABLE[i] = decodeSample(i);

const ENCODE_TABLE = new Uint8Array(65536);
for (let i = 0; i < 65536; i++) ENCODE_TABLE[i] = encodeSample(i - 32768);

export function mulawDecode(bytes: Uint8Array): Int16Array {
  const out = new Int16Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = DECODE_TABLE[bytes[i]];
  return out;
}

export function mulawEncode(pcm: Int16Array): Uint8Array {
  const out = new Uint8Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = ENCODE_TABLE[pcm[i] + 32768];
  return out;
}

/**
 * Streaming windowed-sinc resampler.
 *
 * Linear interpolation is not good enough for the 24 kHz → 8 kHz leg: without
 * a low-pass filter, everything the model says between 4 and 12 kHz folds back
 * into the phone band as hiss. The filter cutoff sits just under the lower of
 * the two Nyquist frequencies, so this is also correct for upsampling.
 *
 * Chunks can be any length. Output is identical whether a signal is processed
 * in one piece or in 20 ms frames, which the tests check.
 */
export class Resampler {
  readonly inRate: number;
  readonly outRate: number;
  private readonly half: number;
  private readonly step: number;
  private readonly cutoff: number;
  private buf: Float32Array;
  private pos: number;

  constructor(inRate: number, outRate: number, halfTaps = 16) {
    this.inRate = inRate;
    this.outRate = outRate;
    this.half = halfTaps;
    this.step = inRate / outRate;
    this.cutoff = Math.min(1, outRate / inRate) * 0.94;
    this.buf = new Float32Array(halfTaps);
    this.pos = halfTaps;
  }

  process(input: Int16Array): Int16Array {
    if (this.inRate === this.outRate) return input.slice();
    const merged = new Float32Array(this.buf.length + input.length);
    merged.set(this.buf, 0);
    for (let i = 0; i < input.length; i++) merged[this.buf.length + i] = input[i];

    const out: number[] = [];
    const half = this.half;
    const fc = this.cutoff;
    while (Math.floor(this.pos) + half < merged.length) {
      const base = Math.floor(this.pos);
      const frac = this.pos - base;
      let acc = 0;
      let norm = 0;
      for (let k = -half + 1; k <= half; k++) {
        const d = k - frac;
        const x = fc * d;
        const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
        const w = 0.5 + 0.5 * Math.cos((Math.PI * d) / half);
        const h = fc * sinc * w;
        acc += merged[base + k] * h;
        norm += h;
      }
      const v = norm !== 0 ? acc / norm : 0;
      out.push(v > 32767 ? 32767 : v < -32768 ? -32768 : Math.round(v));
      this.pos += this.step;
    }

    const keepFrom = Math.max(0, Math.floor(this.pos) - half + 1);
    this.buf = merged.slice(keepFrom);
    this.pos -= keepFrom;
    return Int16Array.from(out);
  }
}

export function pcm16ToBase64(pcm: Int16Array): string {
  return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString('base64');
}

export function base64ToPcm16(b64: string): Int16Array {
  const buf = Buffer.from(b64, 'base64');
  const out = new Int16Array(buf.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}

export function bufferToPcm16(buf: Buffer | Uint8Array): Int16Array {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const out = new Int16Array(b.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = b.readInt16LE(i * 2);
  return out;
}

export function concatPcm16(parts: Int16Array[]): Int16Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Int16Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** A mono PCM16 WAV file, for voice samples and debugging. */
export function wavFromPcm16(pcm: Int16Array, rate: number): Buffer {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Root-mean-square level, 0..32768. Used to tell speech from silence. */
export function rms(pcm: Int16Array): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  return Math.sqrt(sum / pcm.length);
}

/**
 * The phone line, simulated: 24 kHz model or TTS audio squeezed through 8 kHz
 * μ-law and back to 16 kHz. Tests and the evaluation suite use this so a
 * simulated caller sounds like a real one to the receptionist.
 */
export function throughPhoneLine(pcm: Int16Array, inRate: number): Int16Array {
  const down = new Resampler(inRate, 8000).process(pcm);
  const line = mulawDecode(mulawEncode(down));
  return new Resampler(8000, 16000).process(line);
}
