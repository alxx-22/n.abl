# Case-study template, and the homepage replacement process

---

## 1. The template

Copy this, fill it, get it signed off, then use it. Anything in `[square
brackets]` is a placeholder. **A placeholder left unfilled means the case study
is not ready** — it does not mean the section can be dropped.

---

### `[Client name]` — or `[A size sector business in region]`

**Capability:** `[Automation | Data & Analytics | Software | Web | AI | Training & Support]`
**Category:** `[Save time | Reduce mistakes | Understand your data | Build something new | Train your team | Fix something]`
**Delivered:** `[month, year]`
**Permission:** `[named | anonymised]`, recorded `[date]`

#### The problem

`[2–4 sentences, in plain terms, leading with what it cost rather than what was
technically wrong. Where possible use the client's own description from the
baseline sheet — it is nearly always better than ours.]`

> `[Optional: a verbatim line from the client describing the problem.]`

#### The numbers before

| | |
|---|---|
| What happened | `[the process]` |
| How often | `[frequency]` |
| Time taken | `[hours per period]` |
| How measured | `[timed / from a system / client estimate]` |
| Cost per month | `[£, arithmetic shown]` |

#### What we built

`[3–5 sentences. What it is, in terms a business owner understands. Tools named
at the end, as detail, not as the headline. If the answer involved not building
something — a licence they already had, an afternoon of training — say that,
because it is more persuasive than a build.]`

#### The numbers after

| | |
|---|---|
| Measured | `[date, at least one full cycle after handover]` |
| Time taken now | `[hours per period]` |
| Residual | `[what is still manual, and why]` |
| Cost per month | `[£]` |
| Saving | `[£ per month, £ per year — rounded down]` |

#### What did not go to plan

`[Honest. Every real project has one. Omitting it makes the rest read like
marketing; including it makes the numbers believable. If genuinely nothing went
wrong, say the scope was small and well understood.]`

#### In their words

> `[Verbatim quote, their wording, with permission recorded.]`
> — `[Name, role, company]` or `[Role, anonymised descriptor]`

#### Evidence held

`[Before/after screenshots, recording, baseline sheet, sign-off email. Note
where each is stored and whether it is redacted.]`

---

## 2. Writing rules

1. **Lead with the cost, not the technology.** "Twelve hours a month" before
   "a Power Automate flow".
2. **The client's words beat ours.** Use the baseline sheet's verbatim
   description wherever it is serviceable.
3. **Round down.** Always, and to a number that sounds approximate, because it
   is: "about £5,500", not "£5,880".
4. **Name the residual.** A case study claiming a process now takes zero time is
   not believed by anyone who has ever run a process.
5. **No superlatives, no percentages without the absolute number.** "40% faster"
   means nothing without knowing 40% of what.
6. **One case study, one engagement.** Never composite.
7. **Projection and outcome are different numbers.** The quote said one thing,
   the result was another. Publish the result.

---

## 3. Where case studies are used

| Surface | Form |
|---|---|
| Homepage `In practice` cards | The three-line version: problem, fix, result |
| Proposals | The full write-up, chosen to match the prospect's category |
| A conversation | The story, told. Usually the most effective form |
| `12-pricing` | As a real worked example alongside the illustrative ones |

The homepage card is a **compression** of the full study, not a separate
artefact. Write the study first; the card falls out of it.

---

## 4. The one-for-one homepage replacement

The examples component was built so that swapping in real proof is a data
change and nothing else. The procedure:

**Before you start:** confirm the study clears all five criteria in the
README §1. If it does not, stop — an illustrative card is better than a weak
real one.

1. **Pick the card to replace.** Match on capability where possible: a real
   automation study replaces the illustrative automation card, so the section
   keeps its spread across Automation, Data & Analytics and Web.

2. **Edit one entry** in `CASES`, `src/components/sections/Examples.jsx`:

   ```js
   {
     provenance: 'client',              // was 'illustrative'
     client: 'Name Ltd',                // or the agreed anonymised descriptor
     capability: 'Automation',
     problem: '12 hours of manual reporting every month.',
     fix:     'An automated reporting pipeline.',
     result:  '10 hours returned to the business every month.',
     tools:   ['Power Automate', 'Excel', 'Power BI'],
   }
   ```

   Every string must trace to the signed-off study. The component renders the
   client name in place of the "Illustrative example" label automatically; the
   explanatory standfirst disappears by itself once no card is illustrative.

3. **Change nothing else.** No markup, no styling, no copy elsewhere. If you find
   yourself editing anything but this object, stop and work out why.

4. **Update `03-website/copy-deck.md`** in the same commit: section 9, and a row
   in the claims audit recording the source and the permission date.

5. **Archive the illustrative card** into this folder, so the set does not
   silently shrink and the wording is recoverable if permission is withdrawn.

6. **Rebuild and check** the card renders, the label is right, and there is no
   horizontal overflow at 390, 820 and 1440px.

**One at a time.** Three real cases is the point at which the standfirst
explaining the illustrative label stops rendering, and the section becomes
proof rather than illustration.

---

## 5. If permission is withdrawn

Immediately, and without discussion:

1. Revert that card to an illustrative example — the archived wording from step
   5 above.
2. Remove the study from proposals and any deck.
3. Update the copy deck and the claims audit in the same commit.
4. Record the withdrawal in the permission log.
5. Do not ask them to reconsider.
