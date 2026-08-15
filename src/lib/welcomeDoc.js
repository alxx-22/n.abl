/* ============================================================
   Client welcome pack.

   Two halves, deliberately separated:

   1. The SCAFFOLD is deterministic — welcome copy, the portal key and
      how to use it, contacts, next steps, what to expect. It comes
      straight from the client record and never needs a model. This is
      most of the document, and it works with no API key, no network
      and no cost.

   2. The GOALS section is the only part that needs reading a meeting
      transcript. That is a genuine summarisation job, so it is fed in
      rather than faked. See summarise() in this file for the two ways
      to supply it.

   That split matters: an earlier version of this codebase generated
   plausible "research" prose from keyword matching and presented it as
   analysis. Nothing here invents content about a client. If no goals
   are supplied, the section is honestly omitted rather than padded.
   ============================================================ */

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const PORTAL_URL = 'https://nabl.agency/portal'
const CONTACT_EMAIL = 'hello@nabl.agency'

/** The drawn wordmark, inlined so the document is a single self-contained file. */
const WORDMARK = `<svg viewBox="0 0 273 100" width="150" aria-label="n.abl" role="img">
  <g fill="none" stroke="#FBF6EC" stroke-width="13" stroke-linecap="butt">
    <path d="M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82"/>
    <circle cx="128.25" cy="51.75" r="23.75"/><path d="M152 21.5 L152 82"/>
    <path d="M178 6 L178 82"/><circle cx="201.75" cy="51.75" r="23.75"/>
    <path d="M248.5 6 L248.5 82"/>
  </g>
  <rect x="78" y="69" width="13" height="13" fill="#E9AC57"/>
</svg>`

export const DEFAULT_NEXT_STEPS = [
  ['Sign in to your portal', 'Use the access key below. Quotes, project progress, meetings and documents all live there.'],
  ['We map what you run', 'A short audit of the tools and the workflows around them, so we build against reality rather than an org chart.'],
  ['You see progress as it happens', 'Project milestones update in the portal — you never have to ask where something is.'],
]

/**
 * Turn a meeting transcript into the goals section.
 *
 * There is deliberately no keyword-matching fallback here. Summarising a
 * conversation is a judgement task; a heuristic would produce confident
 * prose that nobody said, which is worse than an empty section.
 *
 * @param {string} transcript
 * @param {object} opts
 *   mode      'manual'   — goals were written or pasted by a human (default)
 *             'endpoint' — POST the transcript to a summarisation endpoint
 *   endpoint  URL of a function that accepts { transcript } and returns
 *             { summary, goals: string[] }
 * @returns {Promise<{summary:string, goals:string[]}|null>}
 */
export async function summarise(transcript, opts = {}) {
  const mode = opts.mode || 'manual'
  if (!transcript || !transcript.trim()) return null

  if (mode === 'manual') {
    // The team has already distilled it. First paragraph is the summary,
    // any list-like lines become the goals.
    const lines = transcript.split('\n').map((l) => l.trim()).filter(Boolean)
    const goals = lines
      .filter((l) => /^[-•*•]|^\d+[.)]\s/.test(l))
      .map((l) => l.replace(/^[-•*•]\s*/, '').replace(/^\d+[.)]\s*/, ''))
    const summary = lines.find((l) => !/^[-•*•]|^\d+[.)]\s/.test(l)) || ''
    return { summary, goals }
  }

  if (mode === 'endpoint') {
    if (!opts.endpoint) throw new Error('No summarisation endpoint configured.')
    const res = await fetch(opts.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    })
    if (!res.ok) throw new Error(`Summariser returned ${res.status}`)
    const data = await res.json()
    return { summary: data.summary || '', goals: Array.isArray(data.goals) ? data.goals : [] }
  }

  throw new Error(`Unknown summarise mode: ${mode}`)
}

/** The prompt to hand a model, whether that is an endpoint or a chat window. */
export function transcriptPrompt(client, transcript) {
  return `You are writing the project-goals section of a welcome document for a new client of n.abl, a UK automation consultancy.

Client: ${client?.business_name || '[business]'}

Below is the transcript or the notes from the discovery call. Read it and return JSON only, in exactly this shape:

{
  "summary": "Two or three sentences, addressed to the client as 'you', describing what we are setting out to achieve together. Plain English, no jargon, no bullet points.",
  "goals": ["A concrete outcome", "Another concrete outcome"]
}

Rules:
- Use only what is actually in the transcript. Do not invent goals, numbers, deadlines or system names that were not mentioned.
- Between two and five goals. Each one an outcome the client would recognise, not a task list.
- If the transcript does not contain enough to state a goal, return fewer goals rather than padding.
- No markdown, no commentary, JSON only.

TRANSCRIPT
----------
${transcript}`
}

/**
 * Build the complete welcome document as a standalone HTML string.
 * Self-contained: no external stylesheet, font or image, so it survives
 * being emailed, printed, or opened from disk years later.
 */
export function buildWelcomeDoc({ client, goals = null, owner = null, nextSteps = DEFAULT_NEXT_STEPS }) {
  const name = esc(client?.business_name || 'there')
  const contact = client?.contact_name ? esc(client.contact_name.split(' ')[0]) : null
  const key = esc(client?.access_key || '')
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const goalsBlock = goals && (goals.summary || (goals.goals || []).length)
    ? `<section>
        <h2>What we're setting out to do<span class="dot"></span></h2>
        ${goals.summary ? `<p class="lead">${esc(goals.summary)}</p>` : ''}
        ${(goals.goals || []).length ? `<ul class="goals">${
          goals.goals.map((g) => `<li>${esc(g)}</li>`).join('')
        }</ul>` : ''}
      </section>`
    : ''   // Omitted rather than padded when nothing was supplied.

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to n.abl — ${name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{--bg:#0E0C0A;--surface:#1A1613;--cream:#F0E7D8;--bright:#FBF6EC;
        --muted:#9A8F80;--amber:#E9AC57;--line:rgba(240,231,216,.12)}
  body{background:var(--bg);color:var(--cream);
       font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
       line-height:1.62;font-size:16px;padding:56px 24px}
  .sheet{max-width:760px;margin:0 auto}
  header{display:flex;justify-content:space-between;align-items:flex-end;
         padding-bottom:26px;border-bottom:1px solid var(--line);margin-bottom:44px}
  .date{font-size:13px;color:var(--muted)}
  h1{font-size:40px;line-height:1.08;color:var(--bright);letter-spacing:-.02em;margin-bottom:18px;font-weight:700}
  h2{font-size:21px;color:var(--bright);letter-spacing:-.01em;margin-bottom:14px;font-weight:700}
  section{margin-bottom:40px}
  p{margin-bottom:14px}
  .lead{font-size:17px}
  .muted{color:var(--muted)}
  .dot{display:inline-block;width:.26em;height:.26em;background:var(--amber);margin-left:.1em}
  .keybox{background:var(--surface);border:1px solid var(--line);
          border-left:3px solid var(--amber);border-radius:10px;padding:24px 26px}
  .keylabel{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);margin-bottom:10px}
  .key{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:23px;
       color:var(--bright);letter-spacing:.04em;word-break:break-all}
  .keyhint{font-size:13px;color:var(--muted);margin-top:12px}
  .goals{list-style:none;margin-top:6px}
  .goals li{position:relative;padding-left:22px;margin-bottom:9px}
  .goals li::before{content:"";position:absolute;left:0;top:.62em;width:7px;height:7px;background:var(--amber)}
  ol.steps{list-style:none;counter-reset:s}
  ol.steps li{counter-increment:s;position:relative;padding-left:46px;margin-bottom:20px}
  ol.steps li::before{content:counter(s,decimal-leading-zero);position:absolute;left:0;top:1px;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:var(--amber)}
  ol.steps b{display:block;color:var(--bright);margin-bottom:3px}
  ol.steps span{font-size:15px;color:var(--muted)}
  .contacts{display:flex;gap:34px;flex-wrap:wrap}
  .contacts div{min-width:170px}
  .contacts .role{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
  a{color:var(--amber);text-decoration:none;border-bottom:1px solid rgba(233,172,87,.4)}
  footer{border-top:1px solid var(--line);padding-top:20px;margin-top:8px;
         display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;
         font-size:12px;color:var(--muted)}
  @media print{
    body{background:#fff;color:#14110E;padding:0}
    h1,h2,.key,ol.steps b,.contacts .role{color:#14110E}
    .muted,ol.steps span,footer{color:#5F574F}
    .keybox{background:#F7F2E8;border-color:#D9CFC0}
    header{border-color:#D9CFC0} footer{border-color:#D9CFC0}
    svg g{stroke:#14110E !important}
    a{color:#8F5A0E}
  }
</style></head>
<body><div class="sheet">

  <header>
    ${WORDMARK}
    <span class="date">${today}</span>
  </header>

  <section>
    <h1>Welcome to n.abl<span class="dot"></span></h1>
    <p class="lead">${contact ? `${contact}, thanks` : 'Thanks'} for choosing to work with us${
      client?.business_name ? `, and welcome ${name} aboard` : ''
    }. This is everything you need to get started — including the key to your client portal.</p>
    <p class="muted">We don't ask you to change your tools. We work inside the ones you already have,
    and you'll see progress as it happens rather than waiting for a status call.</p>
  </section>

  ${goalsBlock}

  <section>
    <h2>Your portal access<span class="dot"></span></h2>
    <div class="keybox">
      <div class="keylabel">Access key</div>
      <div class="key">${key || '— to be issued —'}</div>
      <div class="keyhint">Sign in at <a href="${PORTAL_URL}">nabl.agency/portal</a> —
        quotes, project progress, meetings and documents all live there.</div>
    </div>
    <p class="muted" style="margin-top:14px;font-size:14px">
      Treat this key like a password: it is the only thing protecting your information.
      Share it only with people who should see your account, and tell us straight away if it
      goes somewhere it shouldn't — we can issue a new one in minutes.</p>
  </section>

  <section>
    <h2>What happens next<span class="dot"></span></h2>
    <ol class="steps">
      ${nextSteps.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}
    </ol>
  </section>

  <section>
    <h2>Who to talk to<span class="dot"></span></h2>
    <div class="contacts">
      ${owner ? `<div><div class="role">Your lead</div>${esc(owner)}</div>` : ''}
      <div><div class="role">Anything at all</div><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
      ${client?.contact_email ? `<div><div class="role">We'll reach you at</div>${esc(client.contact_email)}</div>` : ''}
    </div>
    <p class="muted" style="margin-top:16px;font-size:14px">We typically respond within 4 hours during the working day.</p>
  </section>

  <footer>
    <span>n.abl · Innovation · Automation · Optimisation</span>
    <span>nabl.agency</span>
  </footer>

</div></body></html>`
}
