import { h, api, toast, when } from './common.js';
import { startTalk } from './talk.js';

const slug = location.pathname.split('/').filter(Boolean)[1];
const $ = (id) => document.getElementById(id);
let state = null;
let selectedDay = null;
let seenRefs = new Set();
let firstRender = true;
let talk = null;
let partial = { caller: null, agent: null };
let callLive = false;
let focusRef = null;

// ── Live call stream ─────────────────────────────────────────────────────

function streamAppend(el) {
  const s = $('stream');
  s.querySelector('.empty')?.remove();
  s.append(el);
  s.scrollTop = s.scrollHeight;
}

function setStatus(kind, text) {
  $('dot').className = `dot ${kind}`;
  $('call-text').textContent = text;
}

function onTranscript(role, text, final) {
  let el = partial[role];
  if (!el) {
    el = h('div', { class: `bubble ${role} partial` }, h('span', { class: 'who', text: role === 'agent' ? 'Receptionist' : 'Caller' }), h('span', { class: 'text' }));
    partial[role] = el;
    streamAppend(el);
  }
  el.querySelector('.text').textContent = text;
  if (final) {
    el.classList.remove('partial');
    partial[role] = null;
  }
  $('stream').scrollTop = $('stream').scrollHeight;
}

function onAction(a) {
  const cls = a.kind === 'payment' ? 'payment' : a.kind === 'sms' ? 'sms' : '';
  if (a.kind === 'call_ending') return;
  if (a.kind === 'booking_created' || a.kind === 'booking_changed') focusRef = a.data?.reference ?? null;
  streamAppend(h('div', { class: `card ${cls}` }, h('b', { text: a.title }), a.detail ? h('span', { class: 'detail', text: a.detail }) : null));
}

function onFlag(f) {
  streamAppend(h('div', { class: 'card flag' }, h('b', { text: 'Guardrail' }), h('span', { class: 'detail', text: `${f.rule.replace(/_/g, ' ')}: "${f.text}"` })));
}

function handleEvent(e) {
  switch (e.type) {
    case 'call_started':
      callLive = true;
      $('stream').replaceChildren();
      partial = { caller: null, agent: null };
      setStatus('live', `On a call (${e.channel === 'phone' ? `phone${e.caller ? `, caller ${e.caller}` : ''}` : e.channel})`);
      $('model').textContent = e.model ?? '';
      break;
    case 'transcript':
      onTranscript(e.role, e.text, e.final);
      break;
    case 'action':
      onAction(e.action);
      if (['booking_created', 'booking_changed', 'booking_cancelled', 'order_placed', 'payment', 'message_taken', 'sms'].includes(e.action.kind)) refreshSoon();
      break;
    case 'flag':
      onFlag(e);
      break;
    case 'call_ended':
      callLive = false;
      setStatus('', `Call ended${e.outcome ? `: ${e.outcome.replace(/_/g, ' ')}` : ''}.`);
      refreshSoon();
      break;
    case 'refresh':
      refreshSoon();
      break;
  }
}

// ── Diary, orders, messages, calls ───────────────────────────────────────

function renderDays() {
  const days = [...new Set(state.bookings.map((b) => b.date))];
  const all = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${state.today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    all.push(d.toISOString().slice(0, 10));
  }
  for (const d of days) if (!all.includes(d)) all.push(d);
  if (!selectedDay) selectedDay = state.today;
  $('days').replaceChildren(
    ...all.slice(0, 10).map((d, i) => {
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
      const n = state.bookings.filter((b) => b.date === d && b.status === 'confirmed').length;
      return h('button', { type: 'button', 'aria-pressed': String(d === selectedDay), onclick: () => { selectedDay = d; renderDiary(); } }, `${label}${n ? ` · ${n}` : ''}`);
    }),
  );
}

function renderDiary() {
  if (!state.tenant.has_booking) {
    $('diary-panel').classList.add('hidden');
    return;
  }
  renderDays();
  const list = state.bookings.filter((b) => b.date === selectedDay);
  $('diary-count').textContent = `${list.filter((b) => b.status === 'confirmed').length} bookings`;
  $('slots').replaceChildren(
    ...(list.length
      ? list.map((b) => {
          const isNew = !firstRender && !seenRefs.has(`b:${b.reference}:${b.status}:${b.time}:${b.party_size}`);
          const party = state.tenant.business_type === 'restaurant' || state.tenant.business_type === 'pub' ? `${b.party_size} ${b.party_size === 1 ? 'person' : 'people'} · ${b.with}` : `${b.service} · ${b.with}`;
          return h('div', { class: `slot ${b.status === 'cancelled' ? 'cancelled' : ''} ${isNew ? 'new' : ''}` },
            h('span', { class: 'time', text: b.time }),
            h('span', {}, h('span', { class: 'who', text: b.name }), h('br'), h('span', { class: 'meta', text: `${party}${b.notes ? ` · ${b.notes}` : ''}` })),
            h('span', { class: 'meta mono' }, b.reference, b.deposit ? h('span', { class: `badge ${b.deposit_paid ? 'ok' : 'warn'}`, text: b.deposit_paid ? `deposit paid` : `deposit ${b.deposit}` }) : null),
          );
        })
      : [h('p', { class: 'empty', text: 'Nothing booked yet.' })]),
  );
}

function renderOrders() {
  const orders = state.orders;
  $('tickets').replaceChildren(
    ...(orders.length
      ? orders.map((o) => {
          const isNew = !firstRender && !seenRefs.has(`o:${o.reference}:${o.payment_status}`);
          return h('article', { class: `ticket ${isNew ? 'new' : ''}` },
            h('header', {},
              h('span', { class: 'ref', text: `#${o.reference}` }),
              h('span', { class: `badge ${o.payment_status === 'paid' ? 'ok' : 'warn'}`, text: o.payment_status === 'paid' ? 'Paid (demo)' : 'Unpaid' }),
            ),
            h('div', { class: 'muted', text: `${o.name} · ${o.fulfilment} ${o.due}${o.address ? ` · ${o.address}` : ''}` }),
            h('ul', {}, ...o.lines.map((l) => h('li', { text: `${l.quantity} × ${l.name}${l.modifiers.length ? ` (${l.modifiers.map((m) => m.name).join(', ')})` : ''}${l.notes ? ` — ${l.notes}` : ''}` }))),
            o.allergy_notes ? h('div', { class: 'allergy', text: `ALLERGY: ${o.allergy_notes}` }) : null,
            h('div', { class: 'muted', text: `Total ${o.total}` }),
          );
        })
      : [h('p', { class: 'empty', text: state.tenant.has_ordering ? 'No orders yet.' : 'This business does not take orders by phone.' })]),
  );
}

function renderMessages() {
  $('messages').replaceChildren(
    ...(state.messages.length
      ? state.messages.slice(0, 12).map((m) =>
          m.kind === 'message'
            ? h('div', { class: 'message' }, h('span', { class: 'from', text: `Message from ${m.from_name ?? 'caller'}` }), m.from_phone ? h('span', { class: 'muted', text: ` · ${m.from_phone}` }) : null, h('div', { text: m.body }))
            : h('div', { class: 'message' }, h('span', { class: `badge ${m.status === 'sent' ? 'ok' : 'info'}`, text: m.status === 'sent' ? 'Text sent' : 'Text (simulated)' }), ' ', h('span', { class: 'muted', text: m.to_number }), h('div', { text: m.body })),
        )
      : [h('p', { class: 'empty', text: 'No messages.' })]),
  );
}

function renderCalls() {
  $('calls').replaceChildren(
    ...(state.calls.length
      ? state.calls.map((c) =>
          h('li', {},
            h('span', { class: 'muted', text: `${when(c.started_at)} · ${c.channel}` }),
            h('span', { text: c.summary ?? (c.ended_at ? 'No summary yet.' : 'In progress…') }),
            h('span', {},
              c.outcome ? h('span', { class: 'badge', text: c.outcome.replace(/_/g, ' ') }) : null, ' ',
              c.guardrail_flags ? h('span', { class: 'badge bad', text: `${c.guardrail_flags} flag${c.guardrail_flags > 1 ? 's' : ''}` }) : null, ' ',
              c.latency?.median_ms ? h('span', { class: 'badge info', text: `${(c.latency.median_ms / 1000).toFixed(1)} s replies` }) : null,
            ),
          ),
        )
      : [h('li', {}, h('span', { class: 'muted', text: 'No calls yet.' }))]),
  );
}

function remember() {
  for (const b of state.bookings) seenRefs.add(`b:${b.reference}:${b.status}:${b.time}:${b.party_size}`);
  for (const o of state.orders) seenRefs.add(`o:${o.reference}:${o.payment_status}`);
}

async function refresh() {
  state = await api(`/api/tenants/${slug}/state`);
  const t = state.tenant;
  document.title = `${t.name} · Live board`;
  $('name').textContent = t.name;
  $('pin').textContent = t.demo_pin ? `PIN ${t.demo_pin}` : '';
  if (t.accent) document.documentElement.style.setProperty('--accent', t.accent);
  // A booking just made on the call: show its day, so it visibly lands.
  const focus = focusRef && state.bookings.find((b) => b.reference === focusRef);
  if (focus) {
    selectedDay = focus.date;
    focusRef = null;
  }
  renderDiary();
  renderOrders();
  renderMessages();
  renderCalls();
  remember();
  firstRender = false;
  if (state.active_calls.length && !callLive) setStatus('live', 'On a call');
}

let timer = null;
function refreshSoon() {
  clearTimeout(timer);
  timer = setTimeout(() => refresh().catch((e) => toast(e.message)), 300);
}

// ── Controls ─────────────────────────────────────────────────────────────

$('talk').addEventListener('click', async () => {
  const btn = $('talk');
  if (talk) {
    talk.hangup();
    return;
  }
  btn.disabled = true;
  setStatus('connecting', 'Connecting…');
  try {
    talk = await startTalk({
      slug,
      phone: new URLSearchParams(location.search).get('phone'),
      onMessage: (m) => {
        if (m.type === 'ready') {
          btn.disabled = false;
          btn.textContent = '■ End call';
          btn.classList.add('danger');
          btn.classList.remove('primary');
        }
        if (m.type === 'error') toast(m.message);
      },
      onEnd: () => {
        talk = null;
        btn.disabled = false;
        btn.textContent = '🎙 Talk to it';
        btn.classList.remove('danger');
        btn.classList.add('primary');
      },
    });
  } catch (err) {
    btn.disabled = false;
    setStatus('', 'Waiting for a call.');
    toast(err.name === 'NotAllowedError' ? 'Microphone access was refused.' : err.message);
  }
});

$('reset').addEventListener('click', async () => {
  if (!confirm('Clear every booking, order, call and message for this demo, and refill the diary?')) return;
  const r = await api(`/api/tenants/${slug}/reset`, { method: 'POST' });
  $('stream').replaceChildren(h('p', { class: 'empty', text: 'Demo reset.' }));
  firstRender = true;
  seenRefs = new Set();
  await refresh();
  toast(`Reset. ${r.bookings} bookings in the diary.`);
});

// ── Start ────────────────────────────────────────────────────────────────

(async () => {
  const cfg = await api('/api/config');
  const card = cfg.demo_cards.find((c) => c.result === 'approve');
  if (card) {
    $('card-num').textContent = card.spoken;
    $('card-sub').textContent = `Expiry ${card.expiry} · Security code ${card.cvc}`;
  }
  $('stream').append(h('p', { class: 'empty', text: 'Transcripts, bookings and orders appear here as the call happens.' }));
  await refresh();
  const es = new EventSource(`/api/tenants/${slug}/events`);
  es.onmessage = (m) => handleEvent(JSON.parse(m.data));
  es.onerror = () => setTimeout(refreshSoon, 2000);
})().catch((err) => toast(err.message));
