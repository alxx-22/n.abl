// A second pair of ears on the caller: Transcribe Live, fed the same audio,
// hands back each phrase about a second after it ends. The turn manager uses
// the words to tell "and, um..." from "that's everything", and "hang on,
// let me ask the kids" from an order. (With turn-taking under our control
// the receptionist model only transcribes a turn after it closes, which is
// too late for that decision.)
//
// Optional: if it will not connect (quota, model withdrawn), turn-taking
// falls back to what the receptionist asked, without the caller's words.

import { EventEmitter } from 'node:events';
import type { Config } from '../config.ts';
import { LiveSession } from './live.ts';

export class CallerListener extends EventEmitter<{ text: [text: string]; closed: [] }> {
  private readonly session: LiveSession;

  private constructor(session: LiveSession) {
    super();
    this.session = session;
    session.on('inputTranscript', (t) => {
      const text = t.trim();
      if (text) this.emit('text', text);
    });
    session.on('close', () => this.emit('closed'));
    session.on('error', () => {});
  }

  static async open(config: Config, languageCode?: string): Promise<CallerListener | null> {
    if (!config.transcribeModel || !config.keys.calls) return null;
    try {
      const s = await LiveSession.connect(
        {
          model: config.transcribeModel,
          systemInstruction: `Transcribe the caller exactly${languageCode?.startsWith('en') ? ', in English' : ''}. Output only the words spoken.`,
          responseModality: 'TEXT',
          transcribeInput: true,
          vad: { silenceDurationMs: 300, prefixPaddingMs: 100 },
        },
        config.keys.calls,
        8000,
      );
      return new CallerListener(s);
    } catch {
      return null;
    }
  }

  get alive(): boolean {
    return this.session.isOpen;
  }

  send(pcm: Int16Array, rate: number): void {
    this.session.sendAudio(pcm, rate);
  }

  close(): void {
    this.session.removeAllListeners();
    this.session.close();
  }
}
