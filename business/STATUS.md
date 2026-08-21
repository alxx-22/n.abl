# Where everything stands

One row per folder. Read the **Next step** column first — it is the only one
that tells you what to do today.

This file is a summary, not a source. Each folder's own README holds the detail
and the honest status block; if the two ever disagree, the folder wins and this
file is stale. Last reconciled against the folders and the live project on
**21 August 2026**.

## The short version

Two things gate almost everything else:

- **The compliance layer is live and enforces a ceiling.** Both migrations are
  applied and verified against the live project, including the check that
  matters most: `marketing_tier` returns `C` for an unresolved lead, so the
  gate fails closed in production and not only in the harness. A probe proved
  the gate refuses a real send.
- **The CRM is empty, deliberately.** The eight leads were produced by the old
  AI CRM in a thirteen-minute burst on 1 June: all Birmingham against a
  Nottinghamshire territory, all sized "11-50", all scored 73-92, none with a
  source. Seven were deleted on 21 August and one had already vanished; see
  `07-crm/deleted-leads-2026-08-21.md`, which is the only record of them. The
  pipeline now fills from the register data instead.
- **The channel was wrong, and that reorders the outreach plan.** Cold email
  cannot lawfully reach sole traders or ordinary partnerships, who are 63% of
  UK businesses and are not on the Companies House register at all. Post is
  outside PECR entirely and role-addressed post is not personal data. See
  `10-lead-sourcing/maximum-volume-plan.md`. The next thing `11-outreach` needs
  is a postal assessment and a letter, not an email sequence.
- **Nothing has been sold.** `12-pricing`, `13-credits`, `16-finance` and
  `17-proof` are all waiting on the same event: a first real quote, from a first
  real conversation. `18-sales-conversation` is the folder that starts it and it
  depends on nothing.

Three folders can be worked on **right now with no dependency at all**:
`14-delivery`, `15-compute` and `18-sales-conversation`. `11-outreach` can too,
and is now the one that matters: the leads exist and nothing can be sent to
them until a postal assessment and a letter exist.

| # &middot; Folder | Last step, and when | Next step, and what it waits on |
|---|---|---|
| **01** positioning<br>*in progress* | Repositioning to "technology implementation partner" decided, written up, and carried through to the site, the email pack and the CRM's outreach copy. **16 Aug** | Score a real list of 20 local businesses against the ICP and write down why each one fails. **No dependency** — this is the test the folder's own "done" definition asks for, and it has not been run. |
| **02** brand<br>*done* | Ink colourway added for light grounds, deep-amber dot rule enforced in the export script and in the contrast checker. **16 Aug** | Apply the same light-ground dot rule to `scripts/build-logos.mjs`, which still fills the dot with plain amber on the cream variant. **No dependency.** |
| **03** website<br>*in progress* | Homepage restructured to the buyer's journey, sections extracted into components, analytics and the SEO/legal gaps closed. **16 Aug** | Replace the illustrative examples with one real case study. **Waits on `17-proof`**, which waits on a first delivery. |
| **04** legal<br>*in progress* | Contract checklist, SOW template and NDA draft written. Privacy policy given an Article 14 section for people we approach, which the LIA depended on. **18 Aug** | Solicitor review. **Waits on budget.** Nothing here has been reviewed and must not be described as if it has. The Article 14 notice for leads is published, so `LIA-2026-08-v1` is no longer blocked on legal. |
| **05** portal<br>*done* | Access keys rotated to the 19-character CSPRNG format on the live project; the stray anon grant on `prune_portal_login_attempts` revoked. **16 Aug** | Turn on point-in-time recovery. **Waits on a second paying client** — before that the data loss is a rounding error. |
| **06** team space<br>*done* | Key rotation run and verified end to end against live RLS. **16 Aug** | A month of daily use with a real client in it, then review what is actually clumsy. **Waits on the first client.** |
| **07** crm<br>*in progress* | Three migrations live and verified behaviourally. A **Compliance tab** now shows what each value permits, states which channels are open for that lead, and refuses an invalid combination before the save rather than letting the database do it in SQL. Old AI-CRM leads deleted and recorded. Stale-mirror bug fixed. **21 Aug** | A deletion tombstone — nothing records that a lead existed and stopped existing, which is why one disappearing mid-session could not be explained. Then bulk import: promoting leads currently means generating SQL, because the anon key cannot write and there is no service key on hand. **No dependency.** |
| **08** email pack<br>*done* | Ink wordmark on light headers, signature set in the drawn mark, and image contrast now measured rather than assumed. **16 Aug** | A real render test through Litmus or Email on Acid, Outlook on Windows first. **Waits on a list provider** and the first sequence. |
| **09** welcome pack<br>*done* | Summariser hardened: schema-enforced response, refusal handling, current model. **16 Aug** | Pass the business name through to the summariser, then run it on a real transcript. **Waits on the first client.** |
| **10** lead sourcing<br>*done for now* | **Five registers, 84,349 businesses in territory at £0.** Band one swept in full: 11,901 candidates, 4,463 confirmed websites, and extraction yielding a role email for roughly 45% of those. 2,532 named addresses found and deliberately discarded. Twenty leads promoted into the CRM, each with a published contact route. Sectors take turns in a batch, after two separate attempts filled it with a single sector. **21 Aug** | Rebuild monthly with `rebuild-base.mjs` — the registers republish daily and a stored copy is a stale copy. Sweep the second band when band one's ~3,000 routes run down, which at the ceilings is several months. **No dependency.** |
| **11** outreach<br>*not started* | Two human approval gates written, both before anything leaves the building. First-contact email template written, mapping every element to the rule requiring it. **18 Aug** | **Write the postal assessment and a role-addressed letter.** Post is outside PECR and reaches all 81,286 candidates rather than the corporate minority, so it is the primary channel and neither LIA covers it yet. The email template stands for the corporate tier. **No dependency.** |
| **12** pricing<br>*not started* | ROI worksheet and quote template written around the £240→£40 worked example. **16 Aug** | Send three real quotes and let them set the placeholders. **Waits on qualified conversations** from `18`. |
| **13** credits<br>*not started* | Build / Assist / Educate defined; pack sizes deliberately left as placeholders. **16 Aug** | Decide the credit unit — the one decision everything else in the folder waits on. **Waits on the first three quotes** (`12`). |
| **14** delivery<br>*not started* | Onboarding checklist, project runbook and handover notes written. **16 Aug** | Write the handover pack template: folder structure and contents list. **No dependency** — this can be written before there is anything to hand over, and should be. |
| **15** compute<br>*not started* | Class 1/2/3 routing rules written, including that Claude Code local is not a local Claude model. **16 Aug** | Write down the actual hardware: CPU, RAM, GPU, VRAM on both machines. **No dependency** — ten minutes, and Class 2 planning is guesswork without it. |
| **16** finance<br>*not started* | Running costs, spend order and tax questions written; every figure marked as a placeholder. **16 Aug** | Write down the domain cost, then decide sole trader vs limited company. **Waits on an accountant conversation** for the entity decision; the domain cost waits on nothing. |
| **17** proof &amp; case studies<br>*not started* | Folder created; the rule established that a baseline is captured *before* work starts, not after. **16 Aug** | Prepare the baseline sheet. **Waits on delivery #1 being scheduled** — and must be done before it begins, or the proof is unrecoverable. |
| **18** sales conversation<br>*not started* | Folder created alongside the proof engine. **16 Aug** | Read `01-positioning/objection-handling.md` and `saying-no.md`, then have a real conversation. **No dependency.** This is the folder that unfreezes `12`, `13`, `16` and `17`. |

## Entries corrected while writing this

Four folders listed a next action that had already been done. Left alone, a
tracker like this becomes a list of things you have stopped believing, so they
were checked against the repository and the live project rather than copied:

- **05** and **06** both said to schedule and run the access-key rotation. It
  was applied on 16 August; the migration header records it and the old key was
  verified dead.
- **08** said to rewrite `nabl-emails/README.txt` because it described a black
  alert banner and lime accents. That rewrite happened on 16 August.
- **03** said to fix retired framing on the public legal pages. `Legal.jsx` no
  longer contains it.

Those folder READMEs still carry the stale wording and should be trimmed the
next time each is opened.
