// The estate agent's listings step (presets/estate-agent.md §3): every home
// in a list with its status and how many of its Part A facts (price,
// tenure, council tax band, EPC) are filled in, and an editor for one home at
// a time, in tabs. "Start from the sample" brings back the 18 example homes.

import { useState, type ReactNode } from 'react';
import { CHECKS } from '../../../../../src/domain/listings.ts';
import { CHECK_KEYS, type CheckKey, type CheckValue, type HomeType, type PriceQualifier, type Tenure } from '../../../../../src/domain/types.ts';
import type { EstateAnswers, LeaseAnswer, ListingAnswer } from '../../../../../src/presets/estate/answers.ts';
import type { ListingAnswerStatus } from '../../../../../src/presets/estate/listings.ts';
import { missingPartA } from '../../../../../src/presets/estate/validate.ts';
import { demoApi } from '../../../api.ts';
import { toast } from '../../../components/Toaster.tsx';
import { DraftText, ListText, Num, Select, Text, Toggle } from '../fields.tsx';
import type { StepProps } from '../registry.ts';
import { DayChips, staffOptions } from './steps.tsx';
import { setTenure } from './tenure.ts';

type Props = StepProps<EstateAnswers>;

/** As many as the server keeps (MAX_LISTINGS in src/presets/estate/listings.ts). */
const MAX_LISTINGS = 30;

export const STATUSES: Record<ListingAnswerStatus, { label: string; badge: string }> = {
  coming_soon: { label: 'Coming soon', badge: 'info' },
  available: { label: 'Available', badge: 'ok' },
  under_offer: { label: 'Under offer', badge: 'warn' },
  sale_agreed: { label: 'Sale agreed', badge: 'warn' },
  exchanged: { label: 'Exchanged', badge: '' },
  withdrawn: { label: 'Withdrawn', badge: 'bad' },
};
const QUALIFIERS: Record<PriceQualifier, string> = { guide: 'Guide price', offers_over: 'Offers over', oiro: 'Offers in the region of', fixed: 'Fixed price', share: 'Price of the share' };
const TYPES: Record<HomeType, string> = {
  flat: 'Flat', maisonette: 'Maisonette', terraced: 'Terraced house', end_terrace: 'End of terrace', semi: 'Semi-detached', detached: 'Detached', bungalow: 'Bungalow', cottage: 'Cottage', other: 'Other',
};
const TENURES: Record<Tenure, string> = { freehold: 'Freehold', leasehold: 'Leasehold', share_of_freehold: 'Share of freehold', shared_ownership: 'Shared ownership', unknown: 'Not known yet' };
const options = <T extends string>(r: Record<T, string>) => (Object.keys(r) as T[]).map((value) => ({ value, label: r[value] }));

const TABS = ['Home', 'Price and status', 'Money and legal', 'Checklist', 'Viewings and safety', 'Seller', 'Links'] as const;
type Tab = (typeof TABS)[number];

export const homeName = (l: Pick<ListingAnswer, 'number' | 'street'>) => `${l.number} ${l.street}`.trim() || 'A new home';
export const pounds = (pence: number) => `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const fresh = () => Date.now().toString(36);

function blankHome(a: EstateAnswers): ListingAnswer {
  return {
    key: `home_${fresh()}`, ref: '', number: '', street: '', district: a.patch.districts[0] ?? '', town: a.basics.town,
    status: 'available', price_pence: 0, qualifier: 'guide', marketed_days_ago: 0, reduced: null, back_on_market_days_ago: null, viewings_from_days: null,
    type: 'semi', beds: 3, baths: 1, receptions: 1, features: [], summary: '', rooms: [],
    tenure: 'freehold', lease: null, local_tax: '', epc: '',
    checks: Object.fromEntries(CHECK_KEYS.map((k) => [k, { v: 'unknown', note: '' }])) as ListingAnswer['checks'],
    say_up_front: [], seller_position: '', fall_through: '',
    viewing: { windows: [], notice_hours: a.viewings.notice_hours, occupied: 'owner', key_held: false },
    negotiator: a.team.find((t) => t.does.includes('viewings'))?.key ?? '',
    personal_interest: null, other_agents: '', links: { brochure: true, floorplan: true, video: false, epc: true }, example: false,
  };
}


export function StepListings({ a, set, ws, me }: Props) {
  const [open, setOpen] = useState<string | null>(a.listings[0]?.key ?? null);
  const [tab, setTab] = useState<Tab>('Home');
  const [busy, setBusy] = useState(false);
  const i = a.listings.findIndex((l) => l.key === open);
  const home = i >= 0 ? a.listings[i] : null;

  const sample = async () => {
    if (a.listings.length && !confirm(`Replace your ${a.listings.length} homes with the 18 example homes?`)) return;
    setBusy(true);
    try {
      const { answers } = await demoApi<{ answers: EstateAnswers }>(`/workspaces/${ws.id}/defaults`);
      set((d) => void (d.listings = answers.listings));
      setOpen(answers.listings[0]?.key ?? null);
      toast(`${answers.listings.length} example homes added. Their negotiators are the sample team’s.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const add = () => {
    const h = blankHome(a);
    set((d) => void d.listings.push(h));
    setOpen(h.key);
    setTab('Home');
  };
  const duplicate = () => {
    if (!home) return;
    const h = { ...structuredClone(home), key: `${home.key.slice(0, 30)}_${fresh()}`, ref: '', number: `${home.number} (copy)`.trim(), example: false };
    set((d) => void d.listings.splice(i + 1, 0, h));
    setOpen(h.key);
  };
  const remove = () => {
    if (!home || !confirm(`Delete ${homeName(home)}?`)) return;
    set((d) => void d.listings.splice(i, 1));
    setOpen(a.listings[i + 1]?.key ?? a.listings[i - 1]?.key ?? null);
  };

  return (
    // es-listings sets the list and its checklist closer (estate.css), so eighteen homes and twenty-five checks fit in less than two screens.
    <div className="fields es-listings">
      <p className="lead">The homes you sell. The receptionist answers from these facts alone, and says “that isn’t in the details” for anything you leave unknown.</p>
      <StockDraft
        workspace={ws.id} draftsLeft={Math.max(0, me.limits.drafts_per_day - me.used.drafts)} has={a.listings.filter((l) => !l.example).length}
        onDrafted={(homes) => { set((d) => void (d.listings = homes)); setOpen(homes[0]?.key ?? null); }}
      />
      <div className="home-list" role="list">
        {a.listings.map((l) => {
          const missing = missingPartA(l);
          const s = STATUSES[l.status];
          return (
            <div role="listitem" key={l.key}>
              <button type="button" className={`home-row${l.key === open ? ' on' : ''}`} aria-current={l.key === open} onClick={() => setOpen(l.key)}>
                <span className="home-name">{homeName(l)}{l.example ? <span className="muted small"> · example</span> : null}</span>
                <span className="muted small">{l.price_pence ? pounds(l.price_pence) : 'no price'}</span>
                <span className={`badge home-status ${s.badge}`}>{s.label}</span>
                <span className={`badge ${missing.length ? 'warn' : 'ok'}`} title={missing.length ? `Missing: ${missing.join(', ')}` : 'Price, tenure, council tax band and EPC'}>Part A {4 - missing.length}/4</span>
              </button>
            </div>
          );
        })}
        {!a.listings.length ? <p className="muted">No homes yet.</p> : null}
      </div>
      <div className="row-tools">
        <button type="button" className="small" onClick={add} disabled={a.listings.length >= MAX_LISTINGS}>+ Add a home</button>
        {home ? <button type="button" className="small" onClick={duplicate} disabled={a.listings.length >= MAX_LISTINGS}>Duplicate</button> : null}
        {home ? <button type="button" className="ghost small" onClick={remove}>Delete</button> : null}
        <button type="button" className="ghost small" onClick={sample} disabled={busy}>{busy ? 'Fetching…' : 'Start from the sample'}</button>
      </div>

      {home ? (
        <div className="group on home-editor">
          <h3 className="sub">{homeName(home)}</h3>
          <div className="tabs" role="tablist" aria-label="About this home">
            {TABS.map((t) => (
              <button type="button" role="tab" key={t} aria-selected={t === tab} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <div role="tabpanel" aria-label={tab} className="fields">
            <HomeTab tab={tab} l={home} edit={(fn) => set((d) => fn(d.listings[i]))} a={a} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Edit = (fn: (l: ListingAnswer) => void) => void;

function HomeTab({ tab, l, edit, a }: { tab: Tab; l: ListingAnswer; edit: Edit; a: EstateAnswers }): ReactNode {
  switch (tab) {
    case 'Home': return <HomeFacts l={l} edit={edit} />;
    case 'Price and status': return <PriceStatus l={l} edit={edit} />;
    case 'Money and legal': return <MoneyLegal l={l} edit={edit} nation={a.patch.nation} />;
    case 'Checklist': return <Checklist l={l} edit={edit} />;
    case 'Viewings and safety': return <ViewingRules l={l} edit={edit} a={a} />;
    case 'Seller': return <Seller l={l} edit={edit} a={a} />;
    case 'Links': return <Links l={l} edit={edit} />;
  }
}

function HomeFacts({ l, edit }: { l: ListingAnswer; edit: Edit }) {
  return (
    <>
      <div className="three">
        <Text label="Number or name" value={l.number} max={60} placeholder="Flat 2, 41" onChange={(v) => edit((x) => void (x.number = v))} />
        <Text label="Street" value={l.street} max={80} onChange={(v) => edit((x) => void (x.street = v))} />
        <Text label="Town" value={l.town} max={60} onChange={(v) => edit((x) => void (x.town = v))} />
        <DraftText label="Postcode district" value={l.district} max={4} placeholder="BK2" onChange={(v) => edit((x) => void (x.district = v.toUpperCase()))} />
        <Text label="Your reference" value={l.ref} max={12} placeholder="HG104" onChange={(v) => edit((x) => void (x.ref = v.toUpperCase()))} hint="As on the portals." />
        <Select label="Type" value={l.type} options={options(TYPES)} onChange={(v) => edit((x) => void (x.type = v))} />
      </div>
      <div className="three">
        <Num label="Bedrooms" min={0} max={20} value={l.beds} onChange={(v) => edit((x) => void (x.beds = v))} />
        <Num label="Bathrooms" min={0} max={10} value={l.baths} onChange={(v) => edit((x) => void (x.baths = v))} />
        <Num label="Reception rooms" min={0} max={10} value={l.receptions} onChange={(v) => edit((x) => void (x.receptions = v))} />
      </div>
      <Text label="In one sentence" area rows={2} max={200} value={l.summary} onChange={(v) => edit((x) => void (x.summary = v))} hint="Facts only: the receptionist reads it as it is." />
      <ListText label="Features" value={l.features} placeholder="garden, parking, garage" onChange={(v) => edit((x) => void (x.features = v.slice(0, 12)))} hint="Separate them with commas; callers search by these." />
      <div className="field">
        <label>Rooms</label>
        {l.rooms.map((r, j) => (
          <div className="field-row" key={j}>
            <input aria-label="Room" value={r.name} maxLength={40} onChange={(e) => edit((x) => void (x.rooms[j].name = e.target.value))} />
            <input aria-label={`${r.name || 'Room'} size`} placeholder="4.6m x 3.9m" value={r.size} maxLength={30} onChange={(e) => edit((x) => void (x.rooms[j].size = e.target.value))} />
            <button type="button" className="ghost" aria-label={`Remove ${r.name || 'this room'}`} onClick={() => edit((x) => void x.rooms.splice(j, 1))}>✕</button>
          </div>
        ))}
        <button type="button" className="ghost small" disabled={l.rooms.length >= 20} onClick={() => edit((x) => void x.rooms.push({ name: '', size: '' }))}>+ Add a room</button>
        <p className="hint">Leave a size empty if it hasn’t been measured.</p>
      </div>
      <Toggle label="An example home" checked={l.example} onChange={(v) => edit((x) => void (x.example = v))} hint="Labelled as an example everywhere, so nobody takes it for a real address." />
    </>
  );
}

function PriceStatus({ l, edit }: { l: ListingAnswer; edit: Edit }) {
  return (
    <>
      <div className="three">
        <Select label="Status at Start" value={l.status} options={(Object.keys(STATUSES) as ListingAnswerStatus[]).map((value) => ({ value, label: STATUSES[value].label }))} onChange={(v) => edit((x) => {
          x.status = v;
          // What the box below shows is what is saved: coming soon starts at a week, and only then does the receptionist say when viewings begin.
          if (v === 'coming_soon' && x.viewings_from_days === null) x.viewings_from_days = 7;
        })} />
        <Num label="Price in pounds" min={0} max={20_000_000} step={1000} value={Math.round(l.price_pence / 100)} onChange={(v) => edit((x) => void (x.price_pence = Math.round(v) * 100))} />
        <Select label="Asking" value={l.qualifier} options={options(QUALIFIERS)} onChange={(v) => edit((x) => void (x.qualifier = v))} />
        <Num label="On the market for" suffix="days" min={0} max={3650} value={l.marketed_days_ago} onChange={(v) => edit((x) => void (x.marketed_days_ago = v))} hint="Counted back from Start, so the demo never goes stale." />
      </div>
      {l.status === 'coming_soon' ? (
        <Num label="First viewings" suffix="days after Start" min={0} max={90} value={l.viewings_from_days ?? 7} onChange={(v) => edit((x) => void (x.viewings_from_days = v))} />
      ) : null}
      <Toggle label="The price has been reduced" checked={!!l.reduced} onChange={(v) => edit((x) => void (x.reduced = v ? { days_ago: 7, from_pence: x.price_pence } : null))} />
      {l.reduced ? (
        <div className="two">
          <Num label="Reduced from, in pounds" min={0} max={20_000_000} step={1000} value={Math.round(l.reduced.from_pence / 100)} onChange={(v) => edit((x) => void (x.reduced && (x.reduced.from_pence = Math.round(v) * 100)))} />
          <Num label="Reduced" suffix="days ago" min={0} max={3650} value={l.reduced.days_ago} onChange={(v) => edit((x) => void (x.reduced && (x.reduced.days_ago = v)))} />
        </div>
      ) : null}
      <Toggle label="Back on the market" checked={l.back_on_market_days_ago !== null} onChange={(v) => edit((x) => void (x.back_on_market_days_ago = v ? 3 : null))} hint="A sale fell through." />
      {l.back_on_market_days_ago !== null ? (
        <Num label="Back on" suffix="days ago" min={0} max={3650} value={l.back_on_market_days_ago} onChange={(v) => edit((x) => void (x.back_on_market_days_ago = v))} />
      ) : null}
    </>
  );
}

function MoneyLegal({ l, edit, nation }: { l: ListingAnswer; edit: Edit; nation: EstateAnswers['patch']['nation'] }) {
  const leased = l.tenure === 'leasehold' || l.tenure === 'share_of_freehold' || l.tenure === 'shared_ownership';
  const lease = l.lease;
  const setLease = (fn: (x: LeaseAnswer) => void) => edit((x) => void (x.lease && fn(x.lease)));
  const shared = lease?.shared;
  return (
    <>
      <div className="three">
        <Select label="Tenure" value={l.tenure} options={options(TENURES)} onChange={(v) => edit((x) => setTenure(x, v))} />
        <Text label={nation === 'northern_ireland' ? 'Rates' : 'Council tax band'} value={l.local_tax} max={30} placeholder={nation === 'northern_ireland' ? '£1,150 a year' : 'C'} onChange={(v) => edit((x) => void (x.local_tax = v))} />
        <Text label="EPC rating" value={l.epc} max={12} placeholder="C, or exempt" onChange={(v) => edit((x) => void (x.epc = v))} hint="Empty if it isn’t in yet." />
      </div>
      {leased && lease ? (
        <div className="group">
          <b>The lease</b>
          <div className="three">
            <div className="field">
              <label htmlFor={`lease-${l.key}`}>Lease ends</label>
              <input id={`lease-${l.key}`} type="date" value={lease.expires} onChange={(e) => setLease((x) => void (x.expires = e.target.value))} />
              <p className="hint">The years left are worked out on the day.</p>
            </div>
            <Text label="Service charge" value={lease.service_charge} max={200} placeholder="£1,320 a year" onChange={(v) => setLease((x) => void (x.service_charge = v))} />
            <Text label="Ground rent" value={lease.ground_rent} max={200} placeholder="£250 a year" onChange={(v) => setLease((x) => void (x.ground_rent = v))} />
            <Text label="Reserve fund" value={lease.reserve_fund} max={200} onChange={(v) => setLease((x) => void (x.reserve_fund = v))} />
            <Text label="Fee on selling (event fee)" value={lease.event_fee} max={200} onChange={(v) => setLease((x) => void (x.event_fee = v))} />
            <Text label="Managing agent" value={lease.managing_agent} max={100} onChange={(v) => setLease((x) => void (x.managing_agent = v))} />
          </div>
          <Toggle label="An age limit" checked={lease.age_limit !== null} onChange={(v) => setLease((x) => void (x.age_limit = v ? 55 : null))} hint="Retirement homes." />
          {lease.age_limit !== null ? <Num label="Residents aged at least" min={0} max={100} value={lease.age_limit} onChange={(v) => setLease((x) => void (x.age_limit = v))} /> : null}
        </div>
      ) : null}
      {l.tenure === 'shared_ownership' && shared ? (
        <div className="group">
          <b>Shared ownership</b>
          <div className="three">
            <Num label="Share for sale" suffix="%" min={1} max={100} value={shared.share_percent} onChange={(v) => setLease((x) => void (x.shared && (x.shared.share_percent = v)))} />
            <Num label="Rent on the rest" suffix="£ a month" min={0} max={10_000} value={Math.round(shared.rent_pence_month / 100)} onChange={(v) => setLease((x) => void (x.shared && (x.shared.rent_pence_month = Math.round(v) * 100)))} />
            <Text label="Housing provider" value={shared.provider} max={100} onChange={(v) => setLease((x) => void (x.shared && (x.shared.provider = v)))} />
            <Num label="Provider’s nomination period" suffix="weeks" min={0} max={52} value={shared.nomination_weeks} onChange={(v) => setLease((x) => void (x.shared && (x.shared.nomination_weeks = v)))} />
          </div>
          <Text label="Who can buy" area rows={2} max={300} value={shared.eligibility} onChange={(v) => setLease((x) => void (x.shared && (x.shared.eligibility = v)))} />
        </div>
      ) : null}
    </>
  );
}

function Checklist({ l, edit }: { l: ListingAnswer; edit: Edit }) {
  const unknown = CHECK_KEYS.filter((k) => l.checks[k].v === 'unknown').length;
  return (
    <>
      <p className="hint">What buyers must be told. “Not in the details” is said as unknown, never as no. {unknown ? `${unknown} still unknown.` : 'All answered.'}</p>
      <div className="check-list">
        {CHECK_KEYS.map((k: CheckKey) => {
          const c = l.checks[k];
          return (
            <div className="check-row" key={k}>
              <label htmlFor={`check-${l.key}-${k}`}>{cap(CHECKS[k].unknown)}</label>
              <select id={`check-${l.key}-${k}`} value={c.v} onChange={(e) => edit((x) => void (x.checks[k].v = e.target.value as CheckValue))}>
                <option value="yes">{CHECKS[k].yes}</option>
                <option value="no">{CHECKS[k].no}</option>
                <option value="unknown">Not in the details</option>
              </select>
              <input aria-label={`${cap(CHECKS[k].unknown)}: note`} placeholder="A note (optional)" value={c.note} maxLength={200} onChange={(e) => edit((x) => void (x.checks[k].note = e.target.value))} />
            </div>
          );
        })}
      </div>
    </>
  );
}

function ViewingRules({ l, edit, a }: { l: ListingAnswer; edit: Edit; a: EstateAnswers }) {
  const v = l.viewing;
  return (
    <>
      <div className="three">
        <Select label="Negotiator" value={l.negotiator} options={staffOptions(a.team.filter((t) => t.does.includes('viewings') || t.key === l.negotiator), 'Choose someone')} onChange={(n) => edit((x) => void (x.negotiator = n))} />
        <Select label="Who lives there" value={v.occupied} options={[{ value: 'owner', label: 'The owner' }, { value: 'tenant', label: 'A tenant' }, { value: 'vacant', label: 'Nobody: it’s empty' }]} onChange={(n) => edit((x) => void (x.viewing.occupied = n))} />
        <Num label="Notice for a viewing" suffix="hours" min={0} max={168} value={v.notice_hours} onChange={(n) => edit((x) => void (x.viewing.notice_hours = n))} hint="More for a tenanted home." />
      </div>
      <Toggle label="You hold the keys" checked={v.key_held} onChange={(n) => edit((x) => void (x.viewing.key_held = n))} hint="Never said to callers, nor whether it is empty." />
      <div className="field">
        <label>When the seller allows viewings</label>
        {v.windows.map((w, j) => (
          <div className="group window" key={j}>
            <DayChips legend="Days" days={w.days} onChange={(days) => edit((x) => void (x.viewing.windows[j].days = days))} />
            {!w.days.length ? <p className="warn-line">No days chosen: these hours are left out until you tick one.</p> : null}
            <div className="field-row">
              <input aria-label="From" type="time" step={900} value={w.from} onChange={(e) => edit((x) => void (x.viewing.windows[j].from = e.target.value))} />
              <span className="muted">to</span>
              <input aria-label="To" type="time" step={900} value={w.to} onChange={(e) => edit((x) => void (x.viewing.windows[j].to = e.target.value))} />
              <button type="button" className="ghost" aria-label="Remove these hours" onClick={() => edit((x) => void x.viewing.windows.splice(j, 1))}>✕</button>
            </div>
          </div>
        ))}
        <button type="button" className="ghost small" disabled={v.windows.length >= 6} onClick={() => edit((x) => void x.viewing.windows.push({ days: [6], from: '10:00', to: '13:00' }))}>+ Add hours</button>
        <p className="hint">{v.windows.some((w) => w.days.length) ? 'Viewings are offered only in these.' : 'None set: any time in your viewing hours.'}</p>
      </div>
    </>
  );
}

function Seller({ l, edit, a }: { l: ListingAnswer; edit: Edit; a: EstateAnswers }) {
  const pi = l.personal_interest;
  return (
    <>
      <Text label="The seller’s position" value={l.seller_position} max={200} placeholder="No onward chain" onChange={(v) => edit((x) => void (x.seller_position = v))} hint="Only what the seller agreed can be shared." />
      <Text label="Why a sale fell through" value={l.fall_through} max={200} onChange={(v) => edit((x) => void (x.fall_through = v))} hint="Only a reason you may share, if it is back on the market." />
      <div className="field">
        <label>Said up front to every caller</label>
        {l.say_up_front.map((s, j) => (
          <div className="field-row" key={j}>
            <input aria-label={`Up front ${j + 1}`} value={s} maxLength={200} onChange={(e) => edit((x) => void (x.say_up_front[j] = e.target.value))} />
            <button type="button" className="ghost" aria-label="Remove this" onClick={() => edit((x) => void x.say_up_front.splice(j, 1))}>✕</button>
          </div>
        ))}
        <button type="button" className="ghost small" disabled={l.say_up_front.length >= 4} onClick={() => edit((x) => void x.say_up_front.push(''))}>+ Add one</button>
        <p className="hint">Up to four: a short lease, a cash buyers only rule, an auction date.</p>
      </div>
      <Toggle label="Someone in the team has a personal interest" checked={!!pi} onChange={(v) => edit((x) => void (x.personal_interest = v ? { staff: '', wording: '' } : null))} hint="A relative selling, or staff buying: the law says buyers are told." />
      {pi ? (
        <div className="two">
          <Select label="Who" value={pi.staff} options={staffOptions(a.team, 'Choose someone')} onChange={(v) => edit((x) => void (x.personal_interest && (x.personal_interest.staff = v)))} />
          <Text label="How buyers are told" value={pi.wording} max={300} onChange={(v) => edit((x) => void (x.personal_interest && (x.personal_interest.wording = v)))} />
        </div>
      ) : null}
      <Text label="Also listed with" value={l.other_agents} max={120} placeholder="Harper & Co, until June" onChange={(v) => edit((x) => void (x.other_agents = v))} hint="Buyers are asked once whether they have viewed it through them." />
    </>
  );
}

function Links({ l, edit }: { l: ListingAnswer; edit: Edit }) {
  const link = (k: keyof ListingAnswer['links'], label: string) => (
    <Toggle label={label} checked={l.links[k]} onChange={(v) => edit((x) => void (x.links[k] = v))} />
  );
  return (
    <>
      <p className="hint">What the receptionist can text a caller. Each is a demo link made from your website and the reference.</p>
      {link('brochure', 'Brochure')}
      {link('floorplan', 'Floorplan')}
      {link('video', 'Video tour')}
      {link('epc', 'EPC certificate')}
    </>
  );
}

/** The listings in the Review summary: "18 homes: 11 available, 2 under offer...". */
export function stockLine(listings: ListingAnswer[]): string {
  if (!listings.length) return 'none yet';
  const counts = (Object.keys(STATUSES) as ListingAnswerStatus[]).map((s) => [s, listings.filter((l) => l.status === s).length] as const).filter(([, n]) => n);
  return `${listings.length} home${listings.length === 1 ? '' : 's'}: ${counts.map(([s, n]) => `${n} ${STATUSES[s].label.toLowerCase()}`).join(', ')}`;
}


/**
 * Describe your stock (M3): the AI drafts homes from a few words, on made-up
 * streets in your districts, with every checklist answer left unknown for
 * you to fill in. It replaces the list; the next autosave keeps it.
 */
function StockDraft({ workspace, draftsLeft, has, onDrafted }: { workspace: string; draftsLeft: number; has: number; onDrafted: (homes: ListingAnswer[]) => void }) {
  const [description, setDescription] = useState('');
  const [homes, setHomes] = useState(8);
  const [busy, setBusy] = useState(false);
  const draft = async () => {
    if (has && !confirm(`Replace your ${has} home${has === 1 ? '' : 's'} with a new draft?`)) return;
    setBusy(true);
    try {
      const { listings } = await demoApi<{ listings: ListingAnswer[] }>(`/workspaces/${workspace}/menu-draft`, { method: 'POST', json: { description, homes } });
      onDrafted(listings);
      toast(`Drafted ${listings.length} homes. Every checklist answer is unknown until you fill it in.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="group on draft-box">
      <h3>Describe your stock</h3>
      <textarea
        className="prose" rows={2} maxLength={600} aria-label="Describe your stock"
        placeholder="Mostly Victorian terraces and 1930s semis, £200,000 to £450,000, a few new-build flats and the odd bungalow"
        value={description} onChange={(e) => setDescription(e.target.value)}
      />
      <div className="field-row">
        <select aria-label="How many homes" value={homes} onChange={(e) => setHomes(Number(e.target.value))}>
          {[4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n} homes</option>)}
        </select>
        <button type="button" className="primary" disabled={busy || !description.trim()} onClick={draft}>{busy ? 'Drafting… (about 20 s)' : 'Draft my homes'}</button>
      </div>
      <p className="hint">Made-up addresses on streets in your area, marked as examples. {draftsLeft} drafts left today.</p>
    </div>
  );
}
