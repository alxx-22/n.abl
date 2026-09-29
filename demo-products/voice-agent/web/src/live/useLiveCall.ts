import { useCallback, useEffect, useRef, useState } from 'react';
import { startLiveCall, type LiveCall, type LiveMessage } from './engine.ts';

export type Phase = 'idle' | 'connecting' | 'live' | 'ending';

export function useLiveCall(slug: string, onError: (message: string) => void) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [model, setModel] = useState<string | null>(null);
  const [latencies, setLatencies] = useState<number[]>([]);
  const call = useRef<LiveCall | null>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const start = useCallback(async () => {
    if (call.current) return;
    setPhase('connecting');
    setLatencies([]);
    setModel(null);
    try {
      call.current = await startLiveCall({
        slug,
        phone: new URLSearchParams(location.search).get('phone'),
        onMessage: (m: LiveMessage) => {
          if (m.type === 'ready') {
            setModel(m.model);
            setPhase('live');
          } else if (m.type === 'latency') setLatencies((l) => [...l, m.ms]);
          else if (m.type === 'hangup') setPhase('ending');
          else if (m.type === 'error') errorRef.current(m.message);
        },
        onEnd: () => {
          call.current = null;
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

  return { phase, model, latencies, start, stop, call };
}
