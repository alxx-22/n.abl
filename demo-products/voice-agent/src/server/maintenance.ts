// A repairs contractor's back office on the server (presets/property-maintenance.md
// §6): what its Jobs, Dispatch, Properties and compliance and Safety log
// views read, and what staff and engineers do to a job. Every move goes
// through the same window rules the receptionist books by, so the board can
// never put gas work with an engineer who isn't Gas Safe, overfill a window,
// or send someone outside their districts.

import type { CallNote } from '../core/call.ts';
import type { JobPatch, Repo } from '../db/repo.ts';
import type { Bus } from './bus.ts';
import { certState } from '../core/maintenance-tools.ts';
import { displayUkPhone, normaliseUkPhone } from '../domain/phone.ts';
import { addDays, isIsoDate, spokenDate, spokenTime, toLocal, tenantNow } from '../domain/time.ts';
import type { Job, JobStatus, Tenant } from '../domain/types.ts';
import { checkWindow, freeWindows, onCallAt, unable, windowOf } from '../domain/windows.ts';
import { inSentence } from '../presets/maintenance/answers.ts';
import { safetyScript, type SafetyKind } from '../presets/maintenance/nations.ts';
import { shortAddress } from '../presets/maintenance/properties.ts';
import { HttpError } from './http.ts';

const DAY = 86_400_000;

/** What the back office reads for a repairs contractor: its settings in brief, engineers, jobs, properties with their certificates, and the safety log. */
export async function maintenanceState(repo: Repo, t: Tenant, now: Date) {
  const m = t.profile.maintenance!;
  const tz = t.profile.timezone;
  const today = toLocal(now, tz).date;
  const props = await repo.listMtProperties(t.id);
  const byKey = new Map(props.map((p) => [p.key, p]));
  const clients = new Map(m.clients.map((c) => [c.key, c]));
  const certs = await repo.listCertificates(t.id);
  const engineerName = (k: string | null) => m.engineers.find((e) => e.key === k)?.first_name ?? null;
  const mobile = (k: string) => displayUkPhone(normaliseUkPhone(t.profile.team?.find((s) => s.key === k)?.mobile));
  // Open jobs, and the last fortnight's closed ones: enough for the board and the week before.
  const jobs = (await repo.listJobs(t.id)).filter((j) => !['done', 'invoiced', 'cancelled'].includes(j.status) || now.getTime() - (j.done_at ?? j.created_at).getTime() < 14 * DAY);
  const trades = new Map(m.trades.map((x) => [x.key, x.label]));
  return {
    maintenance: {
      nation: m.nation,
      windows: m.windows,
      trades: m.trades,
      on_call_tonight: onCallAt(m, today, '20:00').map((e) => e.first_name),
      duty_manager: m.on_call.duty_manager.name,
      escalate_minutes: m.on_call.escalate_minutes,
      reminder_weeks: m.planned.reminder_weeks,
      attend_hours: m.priorities.emergency.attend_hours,
    },
    engineers: m.engineers.map((e) => ({ ...e, mobile: mobile(e.key) })),
    // The authorisers' phones are the second device: approvals are pressed there.
    clients: m.clients.map((c) => ({
      key: c.key, name: c.name, kind: c.kind, works_limit_pence: c.works_limit_pence, emergency_authority_pence: c.emergency_authority_pence,
      po_required: c.po_required, notice: c.notice, instructions: c.instructions, status: c.status,
      contact: { name: c.contact.name, phone: displayUkPhone(c.contact.phone), email: c.contact.email },
      properties: props.filter((p) => p.client === c.key).length,
    })),
    jobs: jobs.map((j) => {
      const p = j.property_key ? byKey.get(j.property_key) : undefined;
      const w = windowOf(m, j.window_key);
      return {
        reference: j.reference, property_key: j.property_key, address: p ? shortAddress(p) : null, client: j.client_key ? clients.get(j.client_key)?.name ?? j.client_key : null,
        reporter: { name: j.reporter.name, phone: displayUkPhone(j.reporter.phone), role: j.reporter.role },
        trade: j.trade, trade_label: trades.get(j.trade) ?? j.trade, priority: j.priority, reason: j.reason, description: j.description, kind: j.kind, status: j.status,
        date: j.visit_date, day: j.visit_date ? spokenDate(j.visit_date) : null, window_key: j.window_key,
        window: w ? `${w.label}, ${spokenTime(w.from)} to ${spokenTime(w.to)}` : null,
        attend_by: j.attend_by?.toISOString() ?? null, engineer_key: j.engineer_key, engineer: engineerName(j.engineer_key),
        eta_minutes: j.eta_minutes, on_the_way_at: j.on_the_way_at?.toISOString() ?? null, po: j.po, price_pence: j.price_pence,
        clocks: j.clocks, flags: j.flags, waiting_for: j.waiting_for, access_attempts: j.access_attempts, notes: j.notes,
        history: j.history.slice(-6), source: j.source, created_at: j.created_at.toISOString(), done_at: j.done_at?.toISOString() ?? null,
        pets: p?.notes.pets || null, vulnerable: p?.vulnerable ?? [],
      };
    }),
    properties: props.map((p) => ({
      key: p.key, address: shortAddress(p), town: p.town, district: p.district, kind: p.kind, example: p.example,
      client_key: p.client, client: p.client ? clients.get(p.client)?.name ?? p.client : null,
      occupant: { name: p.occupant.name, phone: displayUkPhone(p.occupant.phone) },
      notes: p.notes, access: p.access.method, vulnerable: p.vulnerable, markers: p.markers, gas: p.gas, gas_appliances: p.gas_appliances,
      certificates: certs.filter((c) => c.property_key === p.key).map((c) => ({
        kind: c.kind, issued: c.issued, expires: c.expires, booked_job: c.booked_job, remedials: c.remedials, state: certState(c, today, m.planned.reminder_weeks),
      })),
    })),
    quotes: (await repo.listQuotes(t.id)).map((q) => ({
      reference: q.reference, job_ref: q.job_ref, address: q.property_key && byKey.get(q.property_key) ? shortAddress(byKey.get(q.property_key)!) : null,
      client_key: q.client_key, client: q.client_key ? clients.get(q.client_key)?.name ?? q.client_key : null, description: q.description,
      amount_pence: q.amount_pence, status: q.status, issued: q.issued, valid_until: q.valid_until, decided_at: q.decided_at?.toISOString() ?? null, decided_by: q.decided_by,
    })),
    invoices: (await repo.listInvoices(t.id)).map((i) => ({
      reference: i.reference, job_ref: i.job_ref, address: i.property_key && byKey.get(i.property_key) ? shortAddress(byKey.get(i.property_key)!) : null,
      client_key: i.client_key, client: i.client_key ? clients.get(i.client_key)?.name ?? i.client_key : null,
      payer: { name: i.payer.name, phone: displayUkPhone(i.payer.phone) }, kind: i.kind, description: i.description, amount_pence: i.amount_pence,
      // Overdue is the day's reading of the due date, never stored.
      status: i.status === 'due' && i.due < today ? 'overdue' : i.status, issued: i.issued, due: i.due,
      paid_at: i.paid_at?.toISOString() ?? null, paid_how: i.paid_how, card_last4: i.card_last4,
    })),
    incidents: (await repo.listIncidents(t.id)).map((i) => {
      const p = i.property_key ? byKey.get(i.property_key) : undefined;
      const kind = i.kind as SafetyKind;
      return {
        id: i.id, kind: i.kind, title: safetyScript(kind, m.nation)?.title ?? i.kind, number: safetyScript(kind, m.nation)?.number ?? null,
        address: p ? shortAddress(p) : null, caller_phone: displayUkPhone(i.caller_phone), advised_at: i.advised_at?.toISOString() ?? null,
        created_at: i.created_at.toISOString(), follow_up_job: i.follow_up_job, advice_version: i.advice_version, notes: i.notes, source: i.source,
      };
    }),
  };
}

const OPEN: JobStatus[] = ['new', 'scheduled', 'awaiting_approval', 'waiting'];

/**
 * A staff or engineer action on a job: assign or move it (through the
 * window rules), accept or decline a page, on the way (texts the occupant),
 * on site, done, waiting, invoice, or cancel. Returns what the board says.
 */
export async function jobAction(
  repo: Repo, t: Tenant, ref: string, b: any, text: (to: string | null, body: string) => Promise<void>, now = new Date(), note: (n: CallNote) => void = () => {},
): Promise<string> {
  const m = t.profile.maintenance;
  if (!m) throw new HttpError(400, 'This business has no jobs.');
  const [job] = await repo.listJobs(t.id, { reference: ref });
  if (!job) throw new HttpError(404, 'No such job.');
  const p = job.property_key ? await repo.getMtProperty(t.id, job.property_key) : null;
  const where = p ? shortAddress(p) : job.reference;
  const occupant = p?.occupant.phone ?? job.reporter.phone;
  const name = (k: string | null) => m.engineers.find((e) => e.key === k)?.first_name ?? 'the engineer';
  const done = (r: Job | null, msg: string) => {
    if (!r) throw new HttpError(409, 'That job has moved on: refresh and try again.');
    return msg;
  };
  const tz = t.profile.timezone;
  const today = toLocal(now, tz);
  // Every change is stamped with the action's own time, so a page's escalation counts from when it went.
  const update = (r: string, patch: JobPatch, what: string, o: { by?: string; from?: JobStatus[] }) => repo.updateJob(t.id, r, patch, what, { ...o, at: now });
  switch (b.action) {
    case 'assign': {
      // Dispatch: an engineer, and for a booked visit a date and window too.
      const engineer = m.engineers.find((e) => e.key === String(b.engineer ?? ''));
      if (!engineer) throw new HttpError(400, 'Choose an engineer.');
      if (!OPEN.includes(job.status) && job.status !== 'scheduled') throw new HttpError(409, `It's ${job.status.replace(/_/g, ' ')}: it can't be reassigned now.`);
      const why = unable(m, engineer, { trade: job.trade, gas: job.flags.includes('gas'), district: p?.district });
      if (why) throw new HttpError(409, `${why}.`);
      const date = b.date === undefined ? job.visit_date : String(b.date);
      const window = b.window === undefined ? job.window_key : String(b.window);
      if (job.priority !== 'emergency' || (date && window)) {
        if (!date || !isIsoDate(date) || !window) throw new HttpError(400, 'Choose a day and a window.');
        if (date < today.date) throw new HttpError(409, "That day has gone.");
        const c = checkWindow(m, await repo.listJobs(t.id), { date, window, trade: job.trade, gas: job.flags.includes('gas'), district: p?.district, engineer: engineer.key, exclude: job.reference });
        if (!c.ok) {
          throw new HttpError(409, c.reason === 'full' ? `${engineer.first_name}'s ${c.window!.label.toLowerCase()} is full.` : c.reason === 'not_that_day' ? `There's no ${c.window!.label.toLowerCase()} window that day.` : c.reason === 'nobody' ? `${engineer.first_name} doesn't work that day.` : 'No such window.');
        }
        const w = c.window;
        const r = await update(job.reference, { engineer_key: engineer.key, visit_date: date, window_key: w.key, status: job.status === 'new' ? 'scheduled' : job.status }, `assigned to ${engineer.first_name}, ${spokenDate(date)} ${inSentence(w.label)}`, { by: 'staff', from: [job.status] });
        if (date !== job.visit_date || w.key !== job.window_key) await text(occupant, `${t.profile.name}: your visit for job ${job.reference} is now ${spokenDate(date)}, ${inSentence(w.label)} (${spokenTime(w.from)} to ${spokenTime(w.to)}). (Demo)`);
        return done(r, `${job.reference}: ${engineer.first_name}, ${spokenDate(date)} ${inSentence(w.label)}.`);
      }
      // An emergency handed to someone by hand is a fresh page: the escalation clock starts again.
      const r = await update(job.reference, { engineer_key: engineer.key, flags: [...job.flags.filter((f) => f !== 'paged' && f !== 'duty_manager'), 'paged'] }, `paged ${engineer.first_name}`, { by: 'staff', from: [job.status] });
      await text(normaliseUkPhone(t.profile.team?.find((s) => s.key === engineer.key)?.mobile), `${t.profile.name} URGENT: job ${job.reference} at ${where}: ${job.description}. Accept on the job sheet.`);
      return done(r, `${job.reference}: ${engineer.first_name} paged.`);
    }
    case 'accept': {
      // The engineer's phone: a paged emergency accepted. Only now does the caller hear a name.
      if (job.status !== 'new' || !job.engineer_key) throw new HttpError(409, 'There is no page waiting on this job.');
      const r = await update(job.reference, { status: 'scheduled', flags: job.flags.filter((f) => f !== 'paged') }, `accepted by ${name(job.engineer_key)}`, { by: name(job.engineer_key), from: ['new'] });
      const by = job.attend_by ? ` by about ${spokenTime(toLocal(job.attend_by, tz).time)}` : '';
      await text(job.reporter.phone ?? occupant, `${t.profile.name}: ${name(job.engineer_key)} is ${job.flags.includes('out_of_hours') ? 'on call tonight and ' : ''}coming to you${by}. Ref ${job.reference}. (Demo)`);
      if (r) note({ kind: 'accepted', job: job.reference, text: `${name(job.engineer_key)} has accepted job ${job.reference} and is coming, aiming to be there${by}. You may now tell the caller ${name(job.engineer_key)}'s first name and that time; they've had a text too.` });
      return done(r, `${name(job.engineer_key)} accepted ${job.reference}; the caller has been texted.`);
    }
    case 'decline':
    case 'no_answer': {
      // Declined on the engineer's phone, or no answer within the escalation time: the next engineer
      // on call who can do it and hasn't been asked, else the duty manager by text.
      if (job.status !== 'new' || !job.engineer_key || !job.flags.includes('paged')) throw new HttpError(409, 'There is no page waiting on this job.');
      const l = toLocal(now, tz);
      const asked = triedOn(job, m);
      const pool = onCallAt(m, l.date, l.time).filter((e) => !asked.has(e.key));
      // As when it was raised: out of hours, whoever is on call makes it safe even outside their trade; gas still needs Gas Safe.
      const next = pool.find((e) => !unable(m, e, { trade: job.trade, gas: job.flags.includes('gas'), district: p?.district }))
        ?? (job.flags.includes('out_of_hours') ? pool.find((e) => !job.flags.includes('gas') || e.gas_safe) : undefined);
      const why = b.action === 'decline' ? `declined by ${name(job.engineer_key)}` : `no answer from ${name(job.engineer_key)} in ${m.on_call.escalate_minutes} minutes`;
      const r = await update(
        job.reference,
        { engineer_key: next?.key ?? null, flags: next ? job.flags : [...job.flags.filter((f) => f !== 'paged'), 'duty_manager'] },
        `${why}${next ? `; paged ${next.first_name}` : `; ${m.on_call.duty_manager.name} (duty manager) told`}`,
        { by: b.action === 'decline' ? name(job.engineer_key) : 'system', from: ['new'] },
      );
      const to = next ? t.profile.team?.find((s) => s.key === next.key)?.mobile : m.on_call.duty_manager.mobile;
      await text(normaliseUkPhone(to), `${t.profile.name} URGENT: job ${job.reference} at ${where} needs someone: ${job.description}.${next ? ' Accept on the job sheet.' : ' Nobody on call has accepted.'}`);
      const first = b.action === 'decline' ? "The engineer paged couldn't take" : `The engineer paged hasn't answered in ${m.on_call.escalate_minutes} minutes on`;
      if (r) note({ kind: 'repaged', job: job.reference, text: `${first} job ${job.reference}, so ${next ? 'another engineer on call has been paged' : 'the duty manager has been told and will arrange someone'}. Still no name or arrival time for the caller: they'll get a text when someone accepts.` });
      if (b.action === 'decline') return done(r, next ? `Declined: ${next.first_name} paged instead.` : `Declined: nobody else on call, so ${m.on_call.duty_manager.name} has been texted.`);
      return done(r, next ? `No answer: ${next.first_name} paged instead.` : `No answer from anyone on call, so ${m.on_call.duty_manager.name} has been texted.`);
    }
    case 'on_the_way': {
      if (!['scheduled', 'new'].includes(job.status) || !job.engineer_key) throw new HttpError(409, 'Assign an engineer first.');
      const eta = Math.min(180, Math.max(5, Math.round(Number(b.eta_minutes) || 20)));
      const r = await update(job.reference, { status: 'on_the_way', eta_minutes: eta, on_the_way_at: now }, `on the way, about ${eta} minutes`, { by: name(job.engineer_key), from: ['scheduled', 'new'] });
      await text(occupant, `${t.profile.name}: ${name(job.engineer_key)} is on the way, about ${eta} minutes. Ref ${job.reference}. (Demo)`);
      return done(r, `${name(job.engineer_key)} is on the way; the occupant has been texted.`);
    }
    case 'on_site': {
      const r = await update(job.reference, { status: 'on_site' }, 'on site', { by: name(job.engineer_key), from: ['on_the_way', 'scheduled'] });
      return done(r, `${job.reference}: on site.`);
    }
    case 'done': {
      const notes = String(b.notes ?? '').trim().slice(0, 500);
      if (!notes) throw new HttpError(400, 'Add what was done.');
      const r = await update(job.reference, { status: 'done', done_at: now, notes }, 'done', { by: name(job.engineer_key), from: ['on_site', 'on_the_way', 'scheduled', 'waiting'] });
      return done(r, `${job.reference}: done.`);
    }
    case 'waiting': {
      const reason = ['parts', 'access', 'quote'].includes(b.reason) ? b.reason : null;
      if (!reason) throw new HttpError(400, 'Waiting for parts, access or a quote?');
      const note = String(b.note ?? '').trim().slice(0, 200);
      const r = await update(job.reference, { status: 'waiting', waiting_for: note ? `${reason}: ${note}` : reason, ...(reason === 'access' ? { access_attempts: job.access_attempts + 1 } : {}) }, `waiting for ${reason}`, { by: 'staff', from: ['scheduled', 'on_site', 'on_the_way', 'new'] });
      if (reason === 'access' && m.visits.abortive_fee_pence) await text(occupant, `${t.profile.name}: sorry we missed you for job ${job.reference}. Please call us to rebook. (Demo)`);
      return done(r, `${job.reference}: waiting for ${reason}.`);
    }
    case 'authorise': {
      // The client's own phone: the only place a yes or no to work over their limit is given (decision 4).
      if (job.status !== 'awaiting_approval') throw new HttpError(409, "It isn't waiting for approval any more.");
      const client = job.client_key ? m.clients.find((c) => c.key === job.client_key) : undefined;
      const who = client?.contact.name ?? 'the client';
      const [quote] = (await repo.listQuotes(t.id, { job: job.reference })).filter((q) => q.status === 'sent');
      const what = quote ? `quote ${quote.reference}` : `job ${job.reference}`;
      if (b.answer === 'no') {
        const r = await update(job.reference, { status: 'cancelled' }, `declined by ${who}`, { by: who, from: ['awaiting_approval'] });
        if (!r) throw new HttpError(409, 'That job has moved on: refresh and try again.');
        if (quote) await repo.decideQuote(t.id, quote.reference, 'declined', who, now);
        const reporter = job.reporter.phone && job.reporter.phone !== client?.contact.phone ? job.reporter.phone : occupant;
        if (reporter && reporter !== client?.contact.phone) await text(reporter, `${t.profile.name}: ${client?.name ?? 'Your landlord'} hasn't approved job ${job.reference} at ${where}, so it isn't going ahead for now. Please speak to them. (Demo)`);
        note({ kind: 'declined', job: job.reference, text: `${client?.name ?? 'The client'} has just declined ${what} on their own phone, so it isn't going ahead. Tell the caller kindly; for a tenant, they should speak to ${client?.name ?? 'their landlord'}. Never say why.` });
        return `${what[0].toUpperCase()}${what.slice(1)} declined.`;
      }
      if (b.answer !== 'yes') throw new HttpError(400, 'Approve or decline?');
      // Approved: booked into the first free window with someone who can do it, and the tenant told when.
      // From tomorrow, so the tenant has notice, and a window without the evening's extra charge if there is one.
      const slots = freeWindows(m, await repo.listJobs(t.id), { trade: job.trade, gas: job.flags.includes('gas'), district: p?.district, from: addDays(today.date, 1), now: today, limit: 6 });
      const slot = slots.find((x) => !x.window.premium_pence) ?? slots[0];
      const patch = slot ? { status: 'scheduled' as const, visit_date: slot.date, window_key: slot.window.key, engineer_key: slot.engineers[0].key } : { status: 'new' as const };
      const r = await update(job.reference, patch, `approved by ${who}${slot ? `; booked ${spokenDate(slot.date)} ${inSentence(slot.window.label)} with ${slot.engineers[0].first_name}` : ''}`, { by: who, from: ['awaiting_approval'] });
      if (!r) throw new HttpError(409, 'That job has moved on: refresh and try again.');
      if (quote) await repo.decideQuote(t.id, quote.reference, 'approved', who, now);
      const when = slot ? `${spokenDate(slot.date)}, ${inSentence(slot.window.label)} (${spokenTime(slot.window.from)} to ${spokenTime(slot.window.to)})` : null;
      // A block's shared parts: everyone who reported it hears, not only the first.
      for (const to of new Set([occupant, ...job.reporters.map((x) => x.phone)])) {
        if (!to || to === client?.contact.phone) continue;
        await text(to, `${t.profile.name}: ${client?.name ?? 'your landlord'} has approved job ${job.reference}. ${when ? `${slot!.engineers[0].first_name} will come ${when}. Call us if that doesn't suit.` : "We'll call you to arrange a time."} (Demo)`);
      }
      if (client?.contact.phone) await text(client.contact.phone, `${t.profile.name}: thank you, ${what} approved.${when ? ` Booked for ${when}.` : ''} (Demo)`);
      note({
        kind: 'approved', job: job.reference,
        text: `${client?.name ?? 'The client'} has just approved ${what} on their own phone. ${when ? `It's booked for ${when} with ${slot!.engineers[0].first_name}, and the tenant has had a text.` : "The office will arrange a time."} Tell the caller now.`,
      });
      return `${what[0].toUpperCase()}${what.slice(1)} approved${when ? `: booked ${when} with ${slot!.engineers[0].first_name}` : ''}.`;
    }
    case 'invoice': {
      // The office bills a finished job: the job's own price, or the call-out. A client pays on account; a homeowner within a week.
      if (job.status !== 'done') throw new HttpError(409, 'Only a finished job can be invoiced.');
      const client = job.client_key ? m.clients.find((c) => c.key === job.client_key) : undefined;
      const amount = Math.round(Number(b.amount_pence) || job.price_pence || m.prices.callout_pence);
      if (amount <= 0 || amount > 5_000_000) throw new HttpError(400, 'Give an amount.');
      const issued = today.date;
      const due = new Date(`${issued}T12:00:00Z`);
      due.setUTCDate(due.getUTCDate() + (client ? m.prices.account_days : 7));
      const r = await update(job.reference, { status: 'invoiced' }, 'invoiced', { by: 'office', from: ['done'] });
      if (!r) throw new HttpError(409, 'That job has moved on: refresh and try again.');
      const inv = await repo.createInvoice(t.id, {
        job_ref: job.reference, property_key: job.property_key, client_key: job.client_key,
        payer: client ? { name: client.contact.name, phone: client.contact.phone } : { name: p?.occupant.name ?? job.reporter.name, phone: p?.occupant.phone ?? job.reporter.phone },
        kind: 'job', description: `${job.description} (${where})`, amount_pence: amount, status: 'due', issued, due: due.toISOString().slice(0, 10),
        paid_at: null, paid_how: null, card_last4: null, auth_code: null,
      });
      await text(inv.payer.phone, `${t.profile.name}: invoice ${inv.reference} for £${(amount / 100).toFixed(2)} (${job.reference}, ${where}). Due by ${spokenDate(inv.due)}. (Demo)`);
      return `${job.reference}: invoice ${inv.reference} sent.`;
    }
    case 'cancel': {
      const r = await update(job.reference, { status: 'cancelled' }, 'cancelled by staff', { by: 'staff', from: [...OPEN, 'on_the_way'] });
      if (b.notify !== false) await text(job.reporter.phone ?? occupant, `${t.profile.name}: job ${job.reference} at ${where} is cancelled. Call us if you still need us. (Demo)`);
      return done(r, `${job.reference}: cancelled.`);
    }
    default:
      throw new HttpError(400, 'Unknown action.');
  }
}

/**
 * Quotes and invoices: the office sends a reminder for an unpaid invoice
 * (to the payer's phone, with how to pay; never bank details by text), or
 * marks one paid by bank transfer when it arrives.
 */
export async function invoiceAction(repo: Repo, t: Tenant, ref: string, b: any, text: (to: string | null, body: string) => Promise<void>, now = new Date()): Promise<string> {
  const m = t.profile.maintenance;
  if (!m) throw new HttpError(400, 'This business has no invoices.');
  const [inv] = await repo.listInvoices(t.id, { reference: ref.toUpperCase() });
  if (!inv) throw new HttpError(404, 'No such invoice.');
  if (inv.status !== 'due') throw new HttpError(409, `${inv.reference} is ${inv.status === 'paid' ? 'already paid' : 'cancelled'}.`);
  const pounds = `£${(inv.amount_pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  if (b.action === 'remind') {
    const today = toLocal(now, t.profile.timezone).date;
    const late = inv.due < today;
    await text(inv.payer.phone, `${t.profile.name}: a reminder that invoice ${inv.reference} for ${pounds} ${late ? `was due on ${spokenDate(inv.due)}` : `is due by ${spokenDate(inv.due)}`}. Call us to pay by card, or pay by bank transfer as shown on the invoice. (Demo)`);
    return `Reminder sent to ${inv.payer.name ?? 'the payer'}.`;
  }
  if (b.action === 'paid_bank') {
    const r = await repo.markInvoicePaidByBank(t.id, inv.reference, now);
    if (!r) throw new HttpError(409, 'That invoice has moved on: refresh and try again.');
    return `${inv.reference} marked paid by bank transfer.`;
  }
  throw new HttpError(400, 'Unknown action.');
}

/** The engineers a page has already gone to: the one holding it, and any who declined or didn't answer. */
function triedOn(job: Job, m: NonNullable<Tenant['profile']['maintenance']>): Set<string> {
  const keys = new Set<string>(job.engineer_key ? [job.engineer_key] : []);
  for (const h of job.history) {
    for (const hit of h.what.matchAll(/\b(?:paged|declined by|no answer from|accepted by) ([A-Z][a-z]+)/g)) {
      const e = m.engineers.find((x) => x.first_name === hit[1]);
      if (e) keys.add(e.key);
    }
  }
  return keys;
}

/**
 * Pages nobody has answered (presets/property-maintenance.md §2.1,
 * escalate_minutes): once the time has passed since the page went, the
 * next engineer on call is paged, and when there is nobody left, the duty
 * manager is texted. A call waiting on the job hears it.
 */
export async function escalatePages(repo: Repo, now: Date, text: (tenantId: string, to: string | null, body: string) => Promise<void>, note: (tenantId: string, n: CallNote) => void): Promise<string[]> {
  const out: string[] = [];
  for (const { tenant_id, job } of await repo.listUnansweredPages()) {
    const t = await repo.getTenantById(tenant_id);
    const m = t?.profile.maintenance;
    if (!t || !m) continue;
    const since = Date.parse(job.history.at(-1)?.at ?? job.created_at.toISOString());
    // On the workspace's own clock: its pages were stamped with it.
    const at = tenantNow(t, now.getTime());
    if (at.getTime() - since < m.on_call.escalate_minutes * 60_000) continue;
    try {
      out.push(await jobAction(repo, t, job.reference, { action: 'no_answer' }, (to, body) => text(t.id, to, body), at, (n) => note(t.id, n)));
    } catch {
      // Accepted or moved on between the read and the change: nothing to do.
    }
  }
  return out;
}

/** Checks for unanswered pages every half minute. */
export function startPager(deps: { repo: Repo; bus: Bus }, everyMs = 30_000): () => void {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const done = await escalatePages(
        deps.repo, new Date(),
        async (tenantId, to, body) => {
          if (to) await deps.repo.addMessage({ tenant_id: tenantId, kind: 'sms', to_number: to, body, status: 'simulated' });
          deps.bus.publish({ type: 'refresh', tenant_id: tenantId, call_id: '', at: new Date().toISOString(), reason: 'staff' });
        },
        (tenantId, n) => deps.bus.note(tenantId, n),
      );
      if (done.length) console.log(`pager: ${done.length} page${done.length > 1 ? 's' : ''} escalated`);
    } catch (err) {
      console.error(`pager: ${(err as Error).message}`);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void run(), everyMs);
  return () => clearInterval(timer);
}

const PLANNED: Record<string, { kind: 'gas_record' | 'eicr' | 'boiler_service'; trade: string; what: string; gas: boolean }> = {
  gas_record: { kind: 'gas_record', trade: 'boiler_servicing', what: 'Gas safety record', gas: true },
  boiler_service: { kind: 'boiler_service', trade: 'boiler_servicing', what: 'Boiler service', gas: true },
  eicr: { kind: 'eicr', trade: 'electrical', what: 'Electrical installation condition report', gas: false },
};

const minusMonths = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

/**
 * Properties and compliance: book a certificate's renewal straight from its
 * row, into the first free window that keeps a gas record's date, with an
 * engineer who may do it. The occupant is texted.
 */
export async function propertyAction(repo: Repo, t: Tenant, key: string, b: any, text: (to: string | null, body: string) => Promise<void>, now = new Date()): Promise<string> {
  const m = t.profile.maintenance;
  if (!m) throw new HttpError(400, 'This business has no properties.');
  const p = await repo.getMtProperty(t.id, key);
  if (!p) throw new HttpError(404, 'No such property.');
  if (b.action !== 'book') throw new HttpError(400, 'Unknown action.');
  const plan = PLANNED[String(b.what ?? '')];
  if (!plan) throw new HttpError(400, 'Book a gas safety record, a boiler service or an EICR.');
  if (!m.trades.some((x) => x.key === plan.trade)) throw new HttpError(409, "That trade is turned off in the setup.");
  const cert = (await repo.listCertificates(t.id, key)).find((c) => c.kind === plan.kind);
  if (cert?.booked_job) throw new HttpError(409, `Already booked: job ${cert.booked_job}.`);
  const l = toLocal(now, t.profile.timezone);
  // A gas record renewed more than two months early loses its date: start from the day that keeps it.
  const keeps = plan.kind === 'gas_record' && cert?.expires ? minusMonths(cert.expires, 2) : l.date;
  const [slot] = freeWindows(m, await repo.listJobs(t.id), { trade: plan.trade, gas: plan.gas, district: p.district, from: keeps > l.date ? keeps : l.date, now: l, limit: 1 });
  if (!slot) throw new HttpError(409, 'No free window in the next three weeks.');
  const e = slot.engineers[0];
  const price = plan.kind === 'eicr' ? m.planned.eicr_from_pence : plan.kind === 'boiler_service' ? m.planned.boiler_service_pence
    : m.planned.gas_record_pence + Math.max(0, p.gas_appliances - 1) * m.planned.extra_appliance_pence;
  const client = p.client ? m.clients.find((c) => c.key === p.client) : undefined;
  const job = await repo.createJob(t, {
    property_key: p.key, client_key: p.client, reporter: { name: client?.contact.name ?? p.occupant.name, phone: client?.contact.phone ?? p.occupant.phone, role: client ? 'landlord' : 'homeowner' },
    trade: plan.trade, priority: 'routine', reason: 'Planned: safety check', description: plan.what, kind: plan.kind, status: 'scheduled',
    visit_date: slot.date, window_key: slot.window.key, engineer_key: e.key, price_pence: price, flags: plan.gas ? ['gas'] : [], source: 'console',
  }, 'staff');
  await repo.setCertificateBooked(t.id, p.key, plan.kind, job.reference);
  const when = `${spokenDate(slot.date)}, ${inSentence(slot.window.label)} (${spokenTime(slot.window.from)} to ${spokenTime(slot.window.to)})`;
  if (p.occupant.texts_ok) await text(p.occupant.phone, `${t.profile.name}: a ${plan.what.toLowerCase()} is booked at your home for ${when} with ${e.first_name}. Someone over 18 needs to be in. Ref ${job.reference}. (Demo)`);
  return `${shortAddress(p)}: ${plan.what.toLowerCase()} booked for ${when} with ${e.first_name}.`;
}
