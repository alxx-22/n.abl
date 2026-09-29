// Shared helpers for the console and the board. No framework, no build.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
    credentials: 'same-origin',
  });
  if (res.status === 401) {
    await signIn();
    return api(path, opts);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

let signingIn = null;
function signIn() {
  if (signingIn) return signingIn;
  const overlay = document.getElementById('login');
  const form = document.getElementById('login-form');
  overlay.classList.remove('hidden');
  document.getElementById('password').focus();
  signingIn = new Promise((resolve) => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      if (res.ok) {
        overlay.classList.add('hidden');
        signingIn = null;
        resolve();
      } else {
        toast('That password did not work.');
      }
    };
  });
  return signingIn;
}

export function toast(text, ms = 3500) {
  const t = h('div', { class: 'toast', role: 'status', text });
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

export function when(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
