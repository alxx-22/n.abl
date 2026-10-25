// The evaluation suite: simulated callers against the receptionist.
//
//   npm run eval                          every scenario, text bridge
//   npm run eval -- --only book-simple,nut-allergy
//   npm run eval -- --audio               full audio through a simulated phone line
//   npm run eval -- --receptionist gemini-3.8-live
//
// The caller is a second Live session (CALLER_MODEL, by default 3.8 Live, on
// its own quota) playing a persona. In text mode, each side's words cross as
// text; in audio mode, each side's voice crosses as audio, squeezed through
// 8 kHz μ-law on the way to the receptionist. Afterwards, the database is
// checked against what the scenario expects, and every guardrail flag fails
// the scenario.

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../config.ts';
import { openPglite, migrate } from '../db/db.ts';
import { Repo } from '../db/repo.ts';
import { seedAll, seedDiary } from '../db/seed.ts';
import { seedFrom } from '../presets/common/random.ts';
import { CallSession, type CallSummary } from '../core/call.ts';
import { LiveSession } from '../core/live.ts';
import { Resampler, mulawDecode, mulawEncode } from '../core/audio.ts';
import { SimulatedSms } from '../channels/sms.ts';
import { BUILDER_TENANTS, SCENARIOS, FRIDAY_EVENING, builderTenant, type Scenario } from './scenarios.ts';
import { spokenDate, spokenTime, toLocal } from '../domain/time.ts';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const config = { ...loadConfig(), summaries: false };
const only = opt('only')?.split(',');
const audio = flag('audio');
const receptionistModels = opt('receptionist') ? [opt('receptionist')!] : config.liveModels;
const callerModel = opt('caller') ?? config.callerModel;
// If the simulated caller goes silent (3.8 Live did, in the spike and in run 2),
// the scenario is re-run once with the other Live model playing the caller.
const callerFallback = callerModel === 'gemini-3.1-flash-live-preview' ? 'gemini-3.8-live' : 'gemini-3.1-flash-live-preview';
const MAX_SECONDS = Number(opt('max-seconds') ?? 240);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (cond()) return true;
    await sleep(50);
  }
  return cond();
}

function callerPrompt(s: Scenario, businessName: string, now: Date): string {
  const l = toLocal(now, 'Europe/London');
  return [
    `You are role-playing a member of the public phoning ${businessName}. It is ${spokenDate(l.date)} 2026, ${spokenTime(l.time)}.`,
    s.persona,
    'Speak like a real person on the phone: short, natural sentences, one thing at a time. Answer the question you are asked.',
    'Say only what the caller would say. Never describe actions, never narrate, never speak as the receptionist.',
    'Answer every question the receptionist asks, including your name, number and allergies, before you say goodbye.',
    'Only hang up once the receptionist has said the booking is made, the order is placed, or they cannot help. Then say a short goodbye and call hang_up.',
  ].join('\n');
}

interface Result {
  id: string;
  title: string;
  kind: string;
  pass: boolean;
  failures: string[];
  seconds: number;
  model: string;
  tokens: number;
  latency_ms: number[];
  transcript: { role: string; text: string }[];
  tools: { name: string; args: unknown; result: unknown }[];
}

async function runOne(s: Scenario, repo: Repo, db: Awaited<ReturnType<typeof openPglite>>, caller_model = callerModel): Promise<Result> {
  const tenant = (await repo.getTenant(s.tenant))!;
  const now0 = s.now ?? FRIDAY_EVENING;
  await repo.resetTenantData(tenant.id);
  // Businesses from the demo builder get their preset's own week, as a prospect's workspace does.
  const built = BUILDER_TENANTS.find((b) => b.slug === s.tenant);
  if (built) await repo.insertSeed(tenant.id, builderTenant(built).preset.seed(tenant.profile, now0, seedFrom(s.id)));
  else await seedDiary(repo, tenant, now0);
  await s.setup?.(repo, tenant, now0);
  const started = Date.now();
  const clock = () => new Date(now0.getTime() + (Date.now() - started));

  const call = new CallSession({
    tenant, repo, config, channel: 'eval', callerPhone: s.callerPhone ?? null, sms: new SimulatedSms(),
    telephony: null, now: clock, models: receptionistModels, textMode: !audio,
  });
  const caller = await LiveSession.connect(
    {
      model: caller_model,
      systemInstruction: callerPrompt(s, tenant.profile.name, now0),
      tools: [{ name: 'hang_up', description: 'End the call after saying goodbye.', parameters: { type: 'OBJECT', properties: {} } }],
      transcribeOutput: true,
      transcribeInput: audio,
      voiceName: 'Puck',
      languageCode: 'en-GB',
      vad: audio ? { silenceDurationMs: 700 } : undefined,
    },
    config.geminiApiKey,
  );

  let agentTurns: string[] = [];
  let agentActive = 0;
  let hungUp = false;
  let callerText = '';
  let callerComplete = false;
  let callerActive = 0;
  let callerHung = false;

  call.on('agentTurn', (t) => {
    agentTurns.push(t);
    agentActive = Date.now();
  });
  call.on('transcript', (l) => {
    if (l.role === 'agent') agentActive = Date.now();
  });
  call.on('action', (a) => {
    agentActive = Date.now();
    // Someone on another device (a landlord's phone, an engineer's) acting while the call is on.
    void Promise.resolve(s.during?.({ action: a, repo, tenant, now: clock(), note: (n) => call.note(n) })).catch(() => {});
  });
  call.on('hangup', () => (hungUp = true));
  caller.on('outputTranscript', (t) => {
    callerText += t;
    callerActive = Date.now();
  });
  caller.on('turnComplete', () => {
    callerComplete = true;
    callerActive = Date.now();
  });
  caller.on('toolCall', (calls) => {
    if (calls.some((c) => c.name === 'hang_up')) callerHung = true;
    caller.sendToolResponses(calls.map((c) => ({ id: c.id, name: c.name, response: { ok: true } })));
  });

  let summary: CallSummary | null = null;
  call.on('ended', (x) => (summary = x));

  if (audio) {
    // Both voices cross as audio, in real time; the caller's through a phone line.
    const toAgent = new Resampler(24000, 8000);
    const up = new Resampler(8000, 16000);
    const toCaller = new Resampler(24000, 16000);
    call.on('audio', (pcm) => {
      agentActive = Date.now();
      caller.sendAudio(toCaller.process(pcm), 16000);
    });
    caller.on('audio', (pcm) => {
      callerActive = Date.now();
      call.sendAudio(up.process(mulawDecode(mulawEncode(toAgent.process(pcm)))), 16000);
    });
    const silence16 = new Int16Array(320);
    const pump = setInterval(() => {
      // Keep both lines open with silence, as a phone line would.
      if (Date.now() - agentActive > 60) caller.sendAudio(silence16, 16000);
      if (Date.now() - callerActive > 60) call.sendAudio(silence16, 16000);
    }, 20);
    await call.start();
    await waitFor(() => hungUp || callerHung || Date.now() - started > MAX_SECONDS * 1000, MAX_SECONDS * 1000);
    await sleep(3000);
    clearInterval(pump);
  } else {
    await call.start();
    for (let turn = 0; turn < 24 && Date.now() - started < MAX_SECONDS * 1000; turn++) {
      // The receptionist has finished when it has spoken and gone quiet for 1.8 s.
      await waitFor(() => hungUp || (agentTurns.length > 0 && Date.now() - agentActive > 1800), 45000);
      if (hungUp || callerHung || !agentTurns.length) break;
      const said = agentTurns.join(' ');
      agentTurns = [];
      callerText = '';
      callerComplete = false;
      caller.sendText(`The receptionist says: "${said}"`);
      await waitFor(() => callerHung || (callerComplete && Date.now() - callerActive > 700 && callerText.trim().length > 0), 30000);
      if (!callerText.trim() && !callerHung) {
        // A silent caller gets one nudge before the turn is given up.
        caller.sendText(`The receptionist says: "${said}" (Please reply as the caller.)`);
        await waitFor(() => callerHung || (callerComplete && Date.now() - callerActive > 700 && callerText.trim().length > 0), 20000);
      }
      const words = callerText.trim();
      if (words) call.sendText(words);
      if (callerHung) {
        await waitFor(() => hungUp || (agentTurns.length > 0 && Date.now() - agentActive > 1800), 12000);
        break;
      }
    }
  }
  caller.close();
  await call.end('eval finished');
  await waitFor(() => summary !== null, 5000);
  const sum = summary as CallSummary | null;
  const s2: CallSummary = sum ?? { call_id: call.callId, outcome: 'unknown', model: call.model, duration_s: 0, flags: [], tokens: 0, latency_ms: [], transcript: [], tools: [] };
  const agentText = s2.transcript.filter((l) => l.role === 'agent').map((l) => l.text).join('\n');
  let failures: string[];
  try {
    failures = await s.check({ repo, db, tenant, callId: call.callId, summary: s2, agentText });
  } catch (err) {
    failures = [`check crashed: ${(err as Error).message}`];
  }
  if (s2.transcript.filter((l) => l.role === 'caller').length === 0) failures.push('the caller never spoke');
  return {
    id: s.id, title: s.title, kind: s.kind, pass: failures.length === 0, failures,
    seconds: Math.round((Date.now() - started) / 1000), model: call.model, tokens: s2.tokens,
    latency_ms: s2.latency_ms, transcript: s2.transcript, tools: s2.tools,
  };
}

const dir = join(tmpdir(), `va-eval-${Date.now()}`);
const db = await openPglite(dir);
await migrate(db);
const repo = new Repo(db);
await seedAll(repo, FRIDAY_EVENING, { diary: false });
for (const b of BUILDER_TENANTS) await repo.upsertTenant(builderTenant(b).profile);

const chosen = SCENARIOS.filter((s) => !only || only.includes(s.id));
const results: Result[] = [];
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = join('eval-results', `${stamp}${audio ? '-audio' : ''}`);
mkdirSync(out, { recursive: true });

for (const s of chosen) {
  process.stdout.write(`${s.id.padEnd(24)} `);
  let r: Result;
  try {
    r = await runOne(s, repo, db);
    if (r.failures.includes('the caller never spoke')) {
      process.stdout.write(`(caller silent on ${callerModel}; retrying with ${callerFallback}) `);
      r = await runOne(s, repo, db, callerFallback);
    }
  } catch (err) {
    r = { id: s.id, title: s.title, kind: s.kind, pass: false, failures: [`run failed: ${(err as Error).message}`], seconds: 0, model: '', tokens: 0, latency_ms: [], transcript: [], tools: [] };
  }
  results.push(r);
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.seconds}s  ${r.failures.join(' | ')}`);
  writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 1));
  await sleep(1500);
}

const passed = results.filter((r) => r.pass).length;
const lat = results.flatMap((r) => r.latency_ms).sort((a, b) => a - b);
const med = lat.length ? lat[Math.floor(lat.length / 2)] : null;
const md = [
  `# Evaluation run ${stamp}`,
  '',
  `Mode: ${audio ? 'audio through a simulated phone line' : 'text bridge'} · receptionist ${receptionistModels.join(' → ')} · caller ${callerModel}`,
  '',
  `**${passed} of ${results.length} passed.** Guardrail flags: ${results.filter((r) => r.failures.some((f) => f.startsWith('guardrail'))).length} scenario(s).${med !== null ? ` Median reply latency ${med} ms.` : ''}`,
  '',
  '| Scenario | Kind | Result | Seconds | Tokens | What failed |',
  '|---|---|---|---|---|---|',
  ...results.map((r) => `| ${r.id}: ${r.title} | ${r.kind} | ${r.pass ? 'pass' : '**fail**'} | ${r.seconds} | ${r.tokens} | ${r.failures.join('; ').replace(/\|/g, '/')} |`),
  '',
  ...results.flatMap((r) => [
    `## ${r.id}`,
    '',
    ...r.transcript.map((l) => `- **${l.role}:** ${l.text}`),
    '',
    `Tools: ${r.tools.map((t) => {
      const res = t.result as Record<string, unknown>;
      const ok = res && (res.error || res.placed === false || res.booked === false || res.ok === false || res.result === 'refused') ? '✗' : '✓';
      return `${t.name}${ok}`;
    }).join(' → ') || 'none'}`,
    '',
  ]),
].join('\n');
writeFileSync(join(out, 'report.md'), md);
console.log(`\n${passed}/${results.length} passed. Report: ${join(out, 'report.md')}`);
await db.close();
process.exit(0);
