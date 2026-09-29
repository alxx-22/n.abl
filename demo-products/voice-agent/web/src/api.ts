// Fetch helpers. A 401 opens the sign-in overlay (when the console has a
// password), waits for it, then retries.

type Listener = () => void;

let waiting: Promise<void> | null = null;
let resolveWaiting: (() => void) | null = null;
const signInListeners = new Set<Listener>();

export function onSignInNeeded(fn: Listener): () => void {
  signInListeners.add(fn);
  return () => signInListeners.delete(fn);
}

export function signedIn(): void {
  resolveWaiting?.();
  waiting = null;
  resolveWaiting = null;
}

function needSignIn(): Promise<void> {
  if (!waiting) {
    waiting = new Promise((r) => (resolveWaiting = r));
    for (const fn of signInListeners) fn();
  }
  return waiting;
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
    credentials: 'same-origin',
  });
  if (res.status === 401) {
    await needSignIn();
    return api(path, opts);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `The server said ${res.status}.`);
  return data as T;
}

export async function audioBlob(path: string, body: unknown): Promise<Blob> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    await needSignIn();
    return audioBlob(path, body);
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'The preview failed.');
  return res.blob();
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
