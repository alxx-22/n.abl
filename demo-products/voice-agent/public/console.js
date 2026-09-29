import { h, api, toast } from './common.js';

const TYPE = { restaurant: 'Restaurant', cafe: 'Café & takeaway', takeaway: 'Takeaway', pub: 'Pub', hotel: 'Hotel & spa', salon: 'Salon', barber: 'Barber', other: 'Business' };

async function load() {
  const [cfg, { tenants }] = await Promise.all([api('/api/config'), api('/api/tenants')]);
  document.getElementById('models').textContent = `Voice model: ${cfg.models[0]} · fallback ${cfg.models.slice(1).join(', ') || 'none'}`;
  const status = document.getElementById('status');
  status.replaceChildren(
    h('span', { class: `badge ${cfg.telephony ? 'ok' : 'warn'}`, text: cfg.telephony ? 'Phone line connected' : 'Phone line not connected yet: use Talk in browser' }),
    h('span', { class: `badge ${cfg.sms ? 'ok' : 'info'}`, text: cfg.sms ? 'SMS sending' : 'SMS simulated' }),
    h('span', { class: 'badge info', text: `${cfg.active_calls} of ${cfg.max_calls} lines in use` }),
    h('span', { class: 'badge', text: `Demo card ${cfg.demo_cards.find((c) => c.result === 'approve')?.spoken ?? ''}` }),
  );
  const list = document.getElementById('tenants');
  const details = await Promise.all(tenants.map((t) => api(`/api/tenants/${t.slug}`).then((d) => d.profile)));
  list.replaceChildren(
    ...details.map((p) => {
      const card = h('article', { class: 'panel tenant-card' },
        h('h3', { text: p.name }),
        h('p', { text: p.summary }),
        h('div', { class: 'row' },
          h('span', { class: 'badge', text: TYPE[p.business_type] ?? p.business_type }),
          p.demo_pin ? h('span', { class: 'badge info', text: `PIN ${p.demo_pin}` }) : null,
          h('span', { class: 'badge', text: `Voice ${p.voice}` }),
        ),
        h('div', { class: 'row' }, h('a', { class: 'button primary', href: `/board/${p.slug}`, text: 'Open board' })),
      );
      if (p.brand?.accent) card.style.setProperty('--accent', p.brand.accent);
      return card;
    }),
  );
}

document.getElementById('ingest-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const go = document.getElementById('ingest-go');
  go.disabled = true;
  go.textContent = 'Reading… (up to a minute)';
  try {
    const { profile } = await api('/api/ingest', { method: 'POST', body: JSON.stringify({ url: document.getElementById('ingest-url').value }) });
    const { review_notes: notes = [], pages = [], ...clean } = profile;
    document.getElementById('ingest-notes').replaceChildren(
      h('li', { text: `Read ${pages.length} page${pages.length === 1 ? '' : 's'}.` }),
      ...notes.map((n) => h('li', { text: n })),
    );
    document.getElementById('ingest-json').value = JSON.stringify(clean, null, 2);
    document.getElementById('ingest-result').classList.remove('hidden');
  } catch (err) {
    toast(err.message);
  } finally {
    go.disabled = false;
    go.textContent = 'Read the website';
  }
});

document.getElementById('publish').addEventListener('click', async () => {
  let profile;
  try {
    profile = JSON.parse(document.getElementById('ingest-json').value);
  } catch {
    return toast('The profile is not valid JSON.');
  }
  try {
    await api(`/api/tenants/${profile.slug}`, { method: 'PUT', body: JSON.stringify(profile) });
    await api(`/api/tenants/${profile.slug}/reset`, { method: 'POST' });
    location.href = `/board/${profile.slug}`;
  } catch (err) {
    toast(err.message);
  }
});

load().catch((err) => toast(err.message));
