// Fetch helpers for the two sides of the app.
//
// The team console (/demo/admin) calls /demo/api/admin: a 401 opens the
// sign-in overlay (when the console has a password), waits for it, then
// retries. Prospects (/demo/reception) call /demo/api: a 401 means their
// session ended, so the page goes back to the key entry.

type Listener = () => void;

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, ''); // '/demo'
export const ADMIN_API = `${BASE}/api/admin`;
export const DEMO_API = `${BASE}/api`;

let waiting: Promise<void> | null = null;
let resolveWaiting: (() => void) | null = null;
const signInListeners = new Set<Listener>();
const sessionListeners = new Set<Listener>();

export function onSignInNeeded(fn: Listener): () => void {
  signInListeners.add(fn);
  return () => signInListeners.delete(fn);
}

/** The prospect's session ended (expired, revoked, or never started). */
export function onSessionEnded(fn: Listener): () => void {
  sessionListeners.add(fn);
  return () => sessionListeners.delete(fn);
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

export class ApiError extends Error {
  readonly status: number;
  readonly data: any;
  constructor(status: number, message: string, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** The team console's API. */
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
  if (!res.ok) throw new ApiError(res.status, data.error ?? `The server said ${res.status}.`, data);
  return data as T;
}

/** The prospect's API: paths are relative to /demo/api. */
export async function demoApi<T = any>(path: string, opts: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = opts;
  const res = await fetch(`${DEMO_API}${path}`, {
    ...rest,
    body: json === undefined ? rest.body : JSON.stringify(json),
    headers: { 'content-type': 'application/json', ...(rest.headers ?? {}) },
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/session') for (const fn of sessionListeners) fn();
  if (!res.ok) throw new ApiError(res.status, data.error ?? `The server said ${res.status}.`, data);
  return data as T;
}

export async function audioBlob(path: string, body: unknown, retryOnSignIn = true): Promise<Blob> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (res.status === 401 && retryOnSignIn) {
    await needSignIn();
    return audioBlob(path, body);
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'The preview failed.');
  return res.blob();
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
