// "Talk to it": microphone to the server, the agent's voice back.
//
// Full duplex, so the caller can interrupt. On laptop speakers the agent can
// hear itself; a simple echo gate mutes quiet microphone frames while the
// agent is talking, and loud speech still barges in. Headphones are better.

export async function startTalk({ slug, phone, onMessage, onEnd }) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const q = new URLSearchParams({ tenant: slug });
  if (phone) q.set('phone', phone);
  const ws = new WebSocket(`${proto}://${location.host}/ws/talk?${q}`);
  ws.binaryType = 'arraybuffer';

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const inCtx = new AudioContext();
  await inCtx.audioWorklet.addModule('/mic-worklet.js');
  const src = inCtx.createMediaStreamSource(stream);
  const mic = new AudioWorkletNode(inCtx, 'mic-capture', { processorOptions: { targetRate: 16000 } });
  const sink = inCtx.createGain();
  sink.gain.value = 0;
  src.connect(mic).connect(sink).connect(inCtx.destination);

  const outCtx = new AudioContext({ sampleRate: 24000 });
  let playhead = 0;
  const playing = new Set();
  const speaking = () => playhead > outCtx.currentTime;

  mic.port.onmessage = (e) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    let frame = new Int16Array(e.data);
    if (speaking()) {
      let sum = 0;
      for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
      if (Math.sqrt(sum / frame.length) < 2000) frame = new Int16Array(frame.length);
    }
    ws.send(frame.buffer);
  };

  let ending = false;
  const finish = () => {
    if (ending) return;
    ending = true;
    const wait = Math.max(0, (playhead - outCtx.currentTime) * 1000) + 300;
    setTimeout(() => {
      stream.getTracks().forEach((t) => t.stop());
      inCtx.close();
      outCtx.close();
      if (ws.readyState === WebSocket.OPEN) ws.close();
      onEnd?.();
    }, wait);
  };

  ws.onmessage = (e) => {
    if (typeof e.data === 'string') {
      const m = JSON.parse(e.data);
      if (m.type === 'clear') {
        for (const s of playing) s.stop();
        playing.clear();
        playhead = 0;
      }
      if (m.type === 'hangup') finish();
      onMessage?.(m);
      return;
    }
    const pcm = new Int16Array(e.data);
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
    const buf = outCtx.createBuffer(1, f.length, 24000);
    buf.copyToChannel(f, 0);
    const s = outCtx.createBufferSource();
    s.buffer = buf;
    s.connect(outCtx.destination);
    const at = Math.max(outCtx.currentTime + 0.04, playhead);
    s.start(at);
    playhead = at + buf.duration;
    playing.add(s);
    s.onended = () => playing.delete(s);
  };
  ws.onclose = () => finish();
  ws.onerror = () => onMessage?.({ type: 'error', message: 'Connection to the server failed.' });

  return {
    hangup() {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'hangup' }));
      playhead = 0;
      finish();
    },
  };
}
