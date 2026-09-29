// Microphone capture: whatever rate the browser runs at, out as 16 kHz PCM16
// in 20 ms frames. A one-pole low-pass keeps the downsampling from aliasing.

class MicCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.target = options.processorOptions?.targetRate ?? 16000;
    this.step = sampleRate / this.target;
    this.alpha = 1 - Math.exp((-2 * Math.PI * 7000) / sampleRate);
    this.lp = 0;
    this.last = 0;
    this.phase = 0;
    this.frame = new Int16Array(this.target / 50);
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.lp += this.alpha * (ch[i] - this.lp);
      const cur = this.lp;
      while (this.phase <= 1) {
        const v = this.last + (cur - this.last) * this.phase;
        this.frame[this.n++] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
        if (this.n === this.frame.length) {
          this.port.postMessage(this.frame.buffer.slice(0));
          this.n = 0;
        }
        this.phase += this.step;
      }
      this.phase -= 1;
      this.last = cur;
    }
    return true;
  }
}

registerProcessor('mic-capture', MicCapture);
