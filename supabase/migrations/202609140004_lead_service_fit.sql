-- ============================================================
-- SERVICE FIT PER LEAD, ASSESSED AGAINST THE CATEGORIES
--
-- STATUS: applied to the live project on 14 September 2026.
--
-- The lead register carried `signals` - a semicolon string reading
-- "address the business gave for itself; sector hint: property;
-- trading 4 years". True, and useless for deciding anything. It says
-- nothing about whether this business needs a booking system, whether
-- its data is worth analysing, or whether the people in it would get
-- more from a training day than from a support pack.
--
-- THE MOST IMPORTANT THING IN THIS FILE
--
-- A website assessment is a HYPOTHESIS, never a qualification. Every
-- disqualifying signal in 01-positioning/service-categories.md is
-- learned in a conversation and cannot be learned from a homepage:
--
--   1 Save time        "they will not let you watch the task being done"
--   2 Reduce mistakes  "they can name the person, not the process"
--   3 Understand data  "the data does not exist, or nobody owns it"
--   4 Build new        "they will not answer: what happens on the day
--                       it does not exist?"
--   5 Train the team   "the tool genuinely cannot do the job"
--   6 Fix something    "nobody can produce the source or the credentials"
--
-- So every row carries confirm_question and disqualifier: what to ask
-- on the call, and what answer kills it. A fit score without those two
-- is a guess with a number attached, and that is how a business gets
-- mischaracterised and a first contact wasted. There is one first
-- contact per lead and it does not come back.
--
-- Category 5, Train your team, is deliberately NOT assessed from a
-- website - nothing on a homepage says whether staff can use the
-- software they already pay for. It is inferred much more weakly as
-- technical_capacity on the lead, which points at a credit type rather
-- than at a sale.
-- ============================================================

create table if not exists public.lead_service_fit (
  lead_id     uuid not null references public.sales_leads(id) on delete cascade,
  category    text not null check (category in (
                'save_time', 'reduce_mistakes', 'understand_data',
                'build_new', 'fix_something')),

  -- Four values, not a 0-100 score. A number invites arithmetic across
  -- leads that the evidence cannot support; a small ordered vocabulary
  -- makes you say which bucket and why.
  fit         text not null check (fit in ('strong', 'possible', 'unlikely', 'ruled_out')),

  -- 'observed' means the page or a register says so. 'inferred' means
  -- it follows from the sector. 'guessed' means neither, and should
  -- almost never be written.
  confidence  text not null check (confidence in ('observed', 'inferred', 'guessed')),

  rationale   text not null,
  evidence    text,

  -- The two fields that stop this being a guess with a number attached.
  confirm_question text not null,
  disqualifier     text not null,

  assessed_at timestamptz not null default now(),
  assessed_by text,
  primary key (lead_id, category)
);

comment on table public.lead_service_fit is
  'One row per lead per service category. A HYPOTHESIS from public information, not a qualification: every disqualifying signal in service-categories.md is learned in conversation. confirm_question and disqualifier are what the discovery call is for.';

-- An observed fit with no evidence is an inference wearing a better
-- hat. Refused here rather than trusted to every future caller.
alter table public.lead_service_fit
  drop constraint if exists lead_service_fit_observed_needs_evidence;
alter table public.lead_service_fit
  add constraint lead_service_fit_observed_needs_evidence check (
    confidence <> 'observed' or (evidence is not null and length(btrim(evidence)) > 0)
  );

create index if not exists lead_service_fit_strong_idx
  on public.lead_service_fit (category, fit) where fit in ('strong', 'possible');

-- ---------- what the whole business looks like ----------

alter table public.sales_leads
  -- The difference between "no website", "a Facebook page", "a brochure
  -- site" and "a site that takes bookings" is four completely different
  -- conversations, and `website is not null` collapsed all of them.
  add column if not exists web_presence text,
  -- Drives the credit type, not the sale.
  add column if not exists technical_capacity text,
  -- Whether a chatbot or auto-responder would earn its keep.
  add column if not exists inbound_volume text,
  add column if not exists credit_fit text,
  add column if not exists credit_fit_reason text,
  add column if not exists fit_assessed_at timestamptz,
  add column if not exists fit_summary text;

alter table public.sales_leads drop constraint if exists sales_leads_web_presence_known;
alter table public.sales_leads add constraint sales_leads_web_presence_known check (
  web_presence is null or web_presence in (
    'none', 'social_only', 'placeholder', 'brochure', 'transactional'));

alter table public.sales_leads drop constraint if exists sales_leads_technical_capacity_known;
alter table public.sales_leads add constraint sales_leads_technical_capacity_known check (
  technical_capacity is null or technical_capacity in ('likely', 'mixed', 'unlikely'));

alter table public.sales_leads drop constraint if exists sales_leads_inbound_volume_known;
alter table public.sales_leads add constraint sales_leads_inbound_volume_known check (
  inbound_volume is null or inbound_volume in ('high', 'moderate', 'low'));

alter table public.sales_leads drop constraint if exists sales_leads_credit_fit_known;
alter table public.sales_leads add constraint sales_leads_credit_fit_known check (
  credit_fit is null or credit_fit in ('build', 'assist', 'educate'));

comment on column public.sales_leads.web_presence is
  'none | social_only | placeholder | brochure | transactional. Four different conversations that `website is not null` used to collapse into one.';
comment on column public.sales_leads.credit_fit is
  'Which of 13-credits'' three types to lead with AFTER delivery. Educate where there are technical people to teach, Assist where there are not, Build where the thing we make will keep changing.';
comment on column public.sales_leads.inbound_volume is
  'Whether a chatbot or auto-responder would earn its keep. Only if enough strangers arrive with the same question - selling one to a three-person joinery firm is how a reference is lost.';

alter table public.lead_service_fit enable row level security;
revoke all on public.lead_service_fit from anon, authenticated;
