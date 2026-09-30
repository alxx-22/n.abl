import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import type { AppConfig } from '../types.ts';

// Says so plainly when the Gemini key is missing or wrong: otherwise the
// first sign is a call that will not connect.
export function KeyBanner() {
  const [status, setStatus] = useState<AppConfig['gemini_key']>('ok');
  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      api<AppConfig>('/api/config')
        .then((c) => {
          setStatus(c.gemini_key);
          if (c.gemini_key === 'checking' && tries++ < 10) timer = setTimeout(load, 1500);
        })
        .catch(() => {});
    load();
    return () => clearTimeout(timer);
  }, []);

  if (status !== 'missing' && status !== 'rejected') return null;
  return (
    <div className="key-banner" role="alert">
      <b>{status === 'missing' ? 'No Gemini API key yet.' : 'Google rejected the Gemini API key.'}</b> Calls cannot connect until it is set. Put{' '}
      <code>GEMINI_API_KEY=your-key</code> in <code>.env.local</code> (get one at{' '}
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>), then stop and restart{' '}
      <code>npm run dev</code>.
    </div>
  );
}
