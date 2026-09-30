import { useCallback, useEffect, useRef, useState } from 'react';
import { startLiveCall, type LiveCall, type LiveMessage, type TurnState } from './engine.ts';

export type Phase = 'idle' | 'connecting' | 'live' | 'ending';
export interface Reply {
  ms: number;
  /** How much of it was the receptionist deliberately waiting (a thinking pause, a hold). */
  waited: number;
}
export interface Turn {
  state: TurnState;
  reason?: string;
  expect: string;
}

export function useLiveCall(slug: string, onError: (message: string) => void) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [model, setModel] = useState<string | null>(null);
  const [latencies, setLatencies] = useState<Reply[]>([]);
  const [turn, setTurn] = useState<Turn | null>(null);
  const call = useRef<LiveCall | null>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const start = useCallback(async () => {
    if (call.current) return;
    setPhase('connecting');
    setLatencies([]);
    setTurn(null);
    setModel(null);
    try {
      call.current = await startLiveCall({
        slug,
        phone: new URLSearchParams(location.search).get('phone'),
        onMessage: (m: LiveMessage) => {
          if (m.type === 'ready') {
            setModel(m.model);
            setPhase('live');
          } else if (m.type === 'latency') setLatencies((l) => [...l, { ms: m.ms, waited: m.waited_ms ?? 0 }]);
          else if (m.type === 'turn') setTurn({ state: m.state, reason: m.reason, expect: m.expect });
          else if (m.type === 'hangup') setPhase('ending');
          else if (m.type === 'error') errorRef.current(m.message);
        },
        onEnd: () => {
          call.current = null;
          setTurn(null);
          setPhase('idle');
        },
      });
    } catch (err) {
      call.current = null;
      setPhase('idle');
      const e = err as Error;
      errorRef.current(
        e.name === 'NotAllowedError'
          ? 'The browser blocked the microphone. Allow it for this page, then try again.'
          : e.name === 'NotFoundError'
            ? 'No microphone was found.'
            : e.message,
      );
    }
  }, [slug]);

  const stop = useCallback(() => {
    if (!call.current) return;
    setPhase('ending');
    call.current.hangup();
  }, []);

  useEffect(() => () => call.current?.hangup(), []);

  return { phase, model, latencies, turn, start, stop, call };
}
