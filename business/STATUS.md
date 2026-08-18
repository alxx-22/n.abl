# Where everything stands

One row per folder. Read the **Next step** column first — it is the only one
that tells you what to do today.

This file is a summary, not a source. Each folder's own README holds the detail
and the honest status block; if the two ever disagree, the folder wins and this
file is stale. Last reconciled against the folders and the live project on
**16 August 2026**.

## The short version

Two things gate almost everything else:

- **`07-crm` has no compliance fields.** Until that migration is applied, no
  outbound message can lawfully be sent, which freezes `10-lead-sourcing` and
  `11-outreach` behind it. It is the single highest-value unblock on this list.
- **Nothing has been sold.** `12-pricing`, `13-credits`, `16-finance` and
  `17-proof` are all waiting on the same event: a first real quote, from a first
  real conversation. `18-sales-conversation` is the folder that starts it and it
  depends on nothing.

Three folders can be worked on **right now with no dependency at all**:
`14-delivery`, `15-compute` and `18-sales-conversation`.

| # &middot; Folder | Last step, and when | Next step, and what it waits on |
|---|---|---|
| **01** positioning<br>*in progress* | Repositioning to "technology implementation partner" decided, written up, and carried through to the site, the email pack and the CRM's outreach copy. **16 Aug** | Score a real list of 20 local businesses against the ICP and write down why each one fails. **No dependency** — this is the test the folder's own "done" definition asks for, and it has not been run. |
| **02** brand<br>*done* | Ink colourway added for light grounds, deep-amber dot rule enforced in the export script and in the contrast checker. **16 Aug** | Apply the same light-ground dot rule to `scripts/build-logos.mjs`, which still fills the dot with plain amber on the cream variant. **No dependency.** |
| **03** website<br>*in progress* | Homepage restructured to the buyer's journey, sections extracted into components, analytics and the SEO/legal gaps closed. **16 Aug** | Replace the illustrative examples with one real case study. **Waits on `17-proof`**, which waits on a first delivery. |
| **04** legal<br>*in progress* | Contract checklist, scope-of-work template and NDA draft written. Three public pages live. **16 Aug** | Solicitor review. **Waits on budget.** Nothing here has been reviewed and it must not be described as if it has. Blocks the first signature. |
| **05** portal<br>*done* | Access keys rotated to the 19-character CSPRNG format on the live project; the stray anon grant on `prune_portal_login_attempts` revoked. **16 Aug** | Turn on point-in-time recovery. **Waits on a second paying client** — before that the data loss is a rounding error. |
| **06** team space<br>*done* | Key rotation run and verified end to end against live RLS. **16 Aug** | A month of daily use with a real client in it, then review what is actually clumsy. **Waits on the first client.** |
| **07** crm<br>*in progress* | Pipeline in daily use; `compliance-schema.md` specifies the missing fields as DDL. **16 Aug** | **Apply the compliance migration.** Technically depends on nothing — write the SQL and run it. It gates `10` and `11` entirely, so it is the highest-leverage item on this page. |
| **08** email pack<br>*done* | Ink wordmark on light headers, signature set in the drawn mark, and image contrast now measured rather than assumed. **16 Aug** | A real render test through Litmus or Email on Acid, Outlook on Windows first. **Waits on a list provider** and the first sequence. |
| **09** welcome pack<br>*done* | Summariser hardened: schema-enforced response, refusal handling, current model. **16 Aug** | Pass the business name through to the summariser, then run it on a real transcript. **Waits on the first client.** |
| **10** lead sourcing<br>*not started* | Plan written, including the correction that Google Maps must never be the database of record. **16 Aug** | Read `sources.md`, then build sourcing against Companies House. **Waits on `07-crm`** — there is nowhere lawful to put a sourced record until then. |
| **11** outreach<br>*not started* | Plan written: two human approval gates, both before anything leaves the building. **16 Aug** | Finish `07-crm`. **Waits on `07`, then `10`.** Nothing here should be built while the shortlist it sends to does not exist. |
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
