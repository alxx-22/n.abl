// Gemini's prebuilt voices, all 30 of them, checked against the Live models
// on 29 September 2026 (an unknown name is refused at setup). The one-word
// styles are Google's own descriptions.

export const VOICES: { name: string; style: string }[] = [
  { name: 'Achernar', style: 'soft' },
  { name: 'Achird', style: 'friendly' },
  { name: 'Algenib', style: 'gravelly' },
  { name: 'Algieba', style: 'smooth' },
  { name: 'Alnilam', style: 'firm' },
  { name: 'Aoede', style: 'breezy' },
  { name: 'Autonoe', style: 'bright' },
  { name: 'Callirrhoe', style: 'easy-going' },
  { name: 'Charon', style: 'informative' },
  { name: 'Despina', style: 'smooth' },
  { name: 'Enceladus', style: 'breathy' },
  { name: 'Erinome', style: 'clear' },
  { name: 'Fenrir', style: 'excitable' },
  { name: 'Gacrux', style: 'mature' },
  { name: 'Iapetus', style: 'clear' },
  { name: 'Kore', style: 'firm' },
  { name: 'Laomedeia', style: 'upbeat' },
  { name: 'Leda', style: 'youthful' },
  { name: 'Orus', style: 'firm' },
  { name: 'Puck', style: 'upbeat' },
  { name: 'Pulcherrima', style: 'forward' },
  { name: 'Rasalgethi', style: 'informative' },
  { name: 'Sadachbia', style: 'lively' },
  { name: 'Sadaltager', style: 'knowledgeable' },
  { name: 'Schedar', style: 'even' },
  { name: 'Sulafat', style: 'warm' },
  { name: 'Umbriel', style: 'easy-going' },
  { name: 'Vindemiatrix', style: 'gentle' },
  { name: 'Zephyr', style: 'bright' },
  { name: 'Zubenelgenubi', style: 'casual' },
];

export const VOICE_NAMES = new Set(VOICES.map((v) => v.name));

/** How long a pause ends the caller's turn. Shorter is snappier but can cut people off. */
export const REPLY_SPEEDS = {
  snappy: { silence_ms: 400, label: 'Snappy: replies after a 0.4 s pause' },
  normal: { silence_ms: 600, label: 'Normal: replies after a 0.6 s pause' },
  patient: { silence_ms: 900, label: 'Patient: waits 0.9 s, for callers who pause mid-sentence' },
} as const;

export type ReplySpeed = keyof typeof REPLY_SPEEDS;

export const LIVE_MODELS = [
  { id: 'gemini-3.1-flash-live-preview', label: '3 Flash Live' },
  { id: 'gemini-3.8-live', label: '3.8 Live' },
];
