# The sales language index

What a first sentence has to do, why most of them fail, and the rules a machine
can be held to. This is the reference the **strategist** agent works from — see
[`supabase-writer.md`](supabase-writer.md) §2 for where it sits in the pipeline.

Written 15 September 2026, from a review of current B2B outreach practice, then
filtered hard against what n.abl actually sells. A technique that only works
with a case study, a retainer, an enterprise buying committee or a discount is
not in here, because we have none of those.

**This file is the source. The runtime copy lives in `public.outreach_prompt`,
in the `strategist` row.** The agent cannot read the repository — it reads a
row. When this file changes, the row changes, and §9 says how to keep them in
step.

---

## 1. The failure this was written to fix

A real draft, from the live pipeline, about a firm of accountants:

> you mention using a unique diary system to ensure VAT deadlines are not
> missed, which typically relies on someone manually updating those entries to
> keep them accurate

Everything about it is *true*. It is still unusable, and it is worth being
precise about why, because the fault is structural rather than stylistic.

| What it did | Why that is fatal |
|---|---|
| Restated their own page back at them | They wrote it. Being quoted your own marketing copy tells you the sender read one page, not that they understood anything |
| Attached a generic inference — "typically relies on" | "Typically" is the word that admits this was not observed. It is a guess wearing an observation's clothes, and `hooks.md` §3 already disqualifies those |
| Named no consequence | Nothing follows. The reader finishes the sentence in the same state they started it |
| Asked nothing | There is no opening for a reply, so the reply has to be invented by the reader |

The shape is **quote plus paraphrase**, which is the answer to a comprehension
question, not a reason to write to somebody. A comprehension answer proves you
read the passage. A hook proves you understood the business.

The rest of this file is how to tell the difference.

---

## 2. The one structural rule

**Observation → implication → the thing they would recognise.**

The middle step is the one that was missing, and it is the whole job. It is
Rackham's *implication question* from SPIN, thirty years old and still the
mechanism: a problem the buyer has not sized is not a problem they will act on,
and the seller's job is to make its size visible without asserting it.

Applied to the accountants:

| Step | Weak | Working |
|---|---|---|
| Observation | "you mention a unique diary system for VAT deadlines" | same |
| Implication | "which typically relies on manual updating" | "which means the deadline is only as safe as the last person to update it" |
| Recognition | *(none)* | the specific Friday afternoon somebody checks the diary against HMRC and finds a gap |

The working version says nothing the weak one did not, and it is a different
message, because it names a moment they have lived through.

### The recognition has to follow, not be furnished

The moment they would recognise is the payload of §2, and it has a failure mode
of its own that only appeared once real letters existed:

> Operating as a two-person team means that when you are both out at separate
> viewings, client enquiries have to wait until you are back behind a desk.
> **That leaves you taking tenant calls on a hands-free kit while turning into a
> gravel driveway.**

The first sentence follows from the observation. The second is fiction — nobody
supplied a hands-free kit or a driveway, and the recipient knows their own
driveway. It is the mirror image of the hedge: instead of admitting an inference,
it asserts an invention.

The test is the same one the numbers already get from a code guard: **could you
point at the thing that told you this?** "The Monday after a weekend of enquiries"
passes when the promise is a twenty-four-hour turnaround, because the weekend
follows from the promise. A driveway follows from nothing.

Prose cannot be checked in code the way a digit can, so this lives in the
strategist's and the writer's prompts, and the CRM flags scene words that appear
in a letter but not in the observation it was built on — a prompt for the person
at the gate, not a rejection.

### The "so what" test, run twice

Write the sentence. Ask "so what?" If there is an answer, the sentence is not
finished — append the answer and ask again. Stop when the honest reply to "so
what" is *"yes, that is annoying"* rather than another fact.

Two rounds is almost always right. Three and you are lecturing them about their
own business, which is §4.

---

## 3. What a hook is made of

Ranked. A hook with the first three is worth sending; one with only the last two
is filler.

1. **It is about how they operate, not what they sell.** "Bookings go through a
   phone call" is an observation. "They offer plumbing services" is a
   description. (Carried forward from [`hooks.md`](hooks.md) §3, which got this
   right first.)
2. **It names a failure mode, not a feature.** Not "you use a diary system" but
   "the diary only works while someone updates it". Systems are neutral; the
   moment they break is specific.
3. **It could not be sent to anyone else.** The test from
   `first-contact-letter.md` §6. If it survives a find-and-replace of the
   company name, it is a leaflet.
4. **It is checkable.** They can look at the same thing and agree. Every claim
   still rests on a verbatim quote or a register fact — that gate is in code and
   this file does not relax it.
5. **It points at something n.abl does.** Not stated, implied. If the honest
   answer to the implication is "buy a different accountant", it is a good
   observation and the wrong hook.

### The five shapes that work for us

Derived from what the pipeline can actually see. Each is a *shape*, not a
sentence — 149 leads still get 149 sentences.

| Shape | The tension | Example of what it looks like |
|---|---|---|
| **The manual join** | Two systems that both work, with a person carrying data between them | a booking form that emails you, and a diary somebody types it into afterwards |
| **The single point of memory** | A process that depends on one person remembering | the deadline is only as safe as the last person to update the diary |
| **The promise with a cost behind it** | A commitment on their own page that somebody has to keep by hand | same-day quotes on work that has to be measured first |
| **The tool half-installed** | Something they already pay for that is doing a fraction of its job | a booking widget on the contact page but not on the three service pages |
| **The volume tell** | Scale visible from outside that implies admin they have not staffed for | a third address, and the same enquiries form behind all three |

**A shape is not a template.** If two leads in a batch produce the same sentence
under the same shape, the shape was used as a template and both are wrong.

---

## 4. The identity rule, which overrides everything

Small business owners see themselves as people who worked it out themselves.
That is usually accurate and it is always load-bearing.

So the hook must never imply **you are doing this wrong**. The same fact framed
two ways:

> ✗ "you're still taking bookings over the phone, which is costing you"
> ✓ "bookings come through the phone, which works right up until two people ring
>   at once"

The first is a verdict on their judgement. The second is a verdict on a
*situation* — and it leaves them the person who built something that works,
facing a limit rather than a mistake.

Three corollaries, all of them things that read as criticism and must not appear:

- **Never date their technology.** "Your site was built in 2014" is true,
  unanswerable, and rude.
- **Never imply they are behind.** No "most businesses have moved to…". They
  have heard it, it is what every other sender says, and it is a status claim
  rather than an observation.
- **Never notice something they cannot change cheaply.** Pointing at a problem
  whose fix is a year of work is not help, it is a burden delivered by a
  stranger.
- **Never notice neglect.** An out-of-date footer copyright, a site that looks
  old, a page nobody has touched. The pipeline produced exactly this on 15
  September — *"your footer copyright date still reads 2018 while the rest of
  the site is clearly active"* — which is true, checkable, specific, and a
  stranger writing to say the shop front looks shabby. They know; the fix is
  worth nothing to them; the whole letter reads as petty.

  The trap is that `stale_copyright` is a legitimate **scoring** signal —
  tier 2 in `scoring-model.md` §5.4 — so the pipeline has every reason to
  notice it. Scoring happens in private. An angle is read by the person it is
  about. Same fact, completely different test, and the rule now sits in both
  the scout's prompt and the editor's.

And the specific one for us: **noticing a tool they installed is not criticism.**
Somebody chose that booking widget and it was a good decision. The hook is what
it does not yet cover, never that they have it.

---

## 5. What the research says, and what we take from it

Filtered. Each row says what was found and what n.abl actually does about it.

| Finding | Source | What we do |
|---|---|---|
| 40–60% of qualified B2B deals are lost to *no decision*, and the majority of those to indecision rather than a real preference for the status quo | Dixon & McKenna, *The JOLT Effect* | The first contact's job is not urgency. It is making one conversation feel small |
| Doubling down on the cost of inaction **backfired 84% of the time** with indecisive buyers; taking risk off the table worked | *ibid.* | This is why the letter offers a free half hour and an honest "it isn't worth doing" — that is de-risking, and it is load-bearing, not modesty |
| All-lowercase subject lines outperformed Title Case by ~21% across a large cold-email corpus; 2–7 words, one idea | cold-email corpus studies, 2025–26 | Subject lines are lowercase. So is the clause. **So is the company name** — see §6 |
| Buyers now recognise "I noticed…" as an automation tell; >40% of cold email traffic is AI-generated | outreach-tooling surveys, 2026 | The construction "I came across X and noticed Y" is banned. §6 |
| Weak personalisation is a fact with no insight attached to it | *passim* | This is exactly the §1 failure, independently observed |
| What reads as effort is *perceived effort* — evidence of understanding, not evidence of research | *passim* | Never narrate the research. The hook should read as if a person looked, not as if a system scraped |
| Partner-led outreach outperforms SDR outreach substantially in consultancy | consulting outreach practice | Every message is from Alex, by name, replyable. Already true and worth not losing |
| Without case studies, credibility comes from a specific, credible problem named before anything is asked for | consulting outreach practice | We have no case studies (`17-proof-and-case-studies` is empty). The hook *is* the credibility |
| Terms and pricing answer a question the reader has not asked; naming them early reframes a note as a quote | n.abl's own `messaging-spine.md` §1 | No money in a first contact at all — see *What we deliberately reject* |

### What we deliberately reject

- **Money, in any form, in a first contact.** Not a price, not a range, not a
  rate, not a saving, not terms, not "no retainers". The last one is the
  interesting case: it is true, it is a genuine differentiator, and it still
  comes out — because [`messaging-spine.md`](../01-positioning/messaging-spine.md)
  §1 puts the categories before the price and says plainly that **leading with
  price makes us a quote**. A stranger who has not said they are interested is
  not weighing terms. The only thing about cost that may appear is that the
  half hour is free, and that is the ask rather than a price.
- **Cost-of-inaction arithmetic.** "This is costing you £X a month" from a
  stranger who has not asked a single question is a guess with a currency
  symbol on it. The number belongs in the ROI conversation, after they have
  told us the hours. See `12-pricing/README.md`. It is also a code guard:
  every digit in the letter must appear in the observation it was built on.
- **Third-party validation and name-dropping.** Braun's structure has a proof
  element and we cannot fill it honestly. An empty proof slot is left empty.
- **Curiosity gaps.** "There's one thing about your booking page I'd flag" is a
  withheld observation, and withholding is a trick. Say the thing.
- **Multi-touch sequences.** One email, one follow-up after five working days,
  then stop. `first-contact-template.md` §5, and the LIA balance turns on it.
- **Any urgency device.** No scarcity, no deadline, no "before the end of the
  quarter". We have no quarter.

---

## 6. The banned constructions

Hard rules. Each one is here because it appeared in a real draft or because the
research names it as a recognised tell. The strategist and the writer are both
held to these, and the ones that can be checked in code are checked in code.

| Banned | Why |
|---|---|
| "I came across / I noticed / I saw that…" | The recognised automation opener. Also narrates the research, which §5 says never to do |
| Naming where we found them, anywhere in the body | Article 14 disclosure belongs in the footer and is **already there**. Repeating it in the first line makes a legal obligation sound like a boast about surveillance |
| A company name in capitals — `ACCOUNTING SOLUTIONS (AS) LTD` | That is the Companies House register's shouting, not a name anybody writes. Title-case it, drop the suffix: *Accounting Solutions* |
| The legal suffix — Ltd, Limited, (AS), & Co | Nobody refers to their own business that way in conversation |
| "Typically", "usually", "often", "many businesses" | Every one of them admits the claim was not observed |
| "Just" / "quick" / "simply" as softeners | Minimises their work and reads as a sales tic |
| "I hope this finds you well", "I'll keep this brief" | Filler that costs a line and signals template |
| "Let me know if you'd like to learn more" | Not an ask. Puts the work on them |
| Any invented number | Already a code guard: every digit must appear in the supplied material |
| A named person | Different lawful basis. Already a code guard |
| "Re:" or any implied prior thread | `first-contact-template.md` §2 |

---

## 7. How sector and capability change the hook

This is what the strategist has that the writer does not: it knows which of the
six **capabilities** the work would be, and which **sector** the business is in,
and those change what the tension should be about.

The capability decides the *kind* of tension worth naming:

| Capability | The tension that fits it |
|---|---|
| Automation | A person moving information that could move itself |
| Data & Analytics | A question they clearly need answered that their records cannot answer |
| Web | Something a customer has to do the hard way |
| Custom Software | A process shaped around a tool that does not fit it |
| AI | Reading, drafting or sorting done by someone whose time is worth more |
| Training & Support | A tool they already pay for, doing a fraction of its job |

The sector decides what is **plausible** and what is **presumptuous**. A care
provider's records are regulated, so the tension is evidence, not tidiness. A
trade business's diary is the business, so the tension is what happens when two
jobs overrun. This is judgement, not a lookup table, and the sector prior in
`sector_service_prior` is a hint the strategist may contradict.

**The category and the capability do not line up one to one** —
`01-positioning/README.md` §169–175 — so the strategist may not infer one from
the other, and where the scout could not name a capability the strategist works
from the observation alone rather than guessing.

---

## 8. What the finished thing looks like

The clause is one lower-case fragment, six to forty-five words, which the email
completes. It is not a sentence and it does not end in a full stop, because it
is dropped into a line the letter already started.

Three worked rewrites, all from real material:

> **Observed:** a booking widget on the contact page, none on the three service
> pages.
> ✗ *you have a booking system on your contact page*
> ✓ *the booking form sits on your contact page but not on the three service
> pages, so anyone who lands on emergency callouts has to go looking for it*

> **Observed:** "same-day quotes" on a page about bespoke fabrication.
> ✗ *you offer same-day quotes, which typically requires quick turnaround*
> ✓ *same-day quotes on work that has to be measured first, which puts whoever
> does the measuring on the clock from the moment the enquiry lands*

> **Observed:** a unique diary system for VAT deadlines.
> ✗ *you mention using a unique diary system to ensure VAT deadlines are not
> missed, which typically relies on someone manually updating those entries*
> ✓ *a diary system holding every VAT deadline, which is safe exactly as long as
> the last person to update it remembered to*

Read all three aloud. `first-contact-letter.md` §5 asks for that before a first
send and it is the fastest way to hear a mail merge.

---

## 9. Keeping this file and the row in step

The strategist's prompt is a row in `public.outreach_prompt`. This file is where
the thinking lives; the row is what runs. They drift, and the drift is invisible
until a batch reads badly.

So: **§2, §3, §4 and §6 are reproduced in the prompt almost verbatim.** If you
edit one of those sections, edit the row in the same sitting —

```sql
update public.outreach_prompt set body = $$ ... $$ where key = 'strategist';
```

— and the next tick picks it up. No deploy. §1, §5 and §7 are reasoning and
context and do not need to be in the prompt; §8's examples do, because worked
examples are what a model actually imitates.

**Worked examples get copied, so pick them carefully.** The first batch of
letters produced the subject line *"vat deadlines and the diary"* — which was
apt, and was also lifted word for word from the example in the prompt, because
the lead happened to be a firm of accountants. An example that could plausibly
fit a real lead will eventually be used as a template rather than read as a
shape. Both prompts now say so, and the example was changed to something the
Nottingham list will not produce.

**The examples in §8 are in my voice, not Alex's.** That is the one part of this
that cannot be delegated, it is an `UPDATE` rather than a release, and it is
worth an hour. The same warning is in `registries.md` and `hooks.md` and it is
still true.

---

## 10. What the practitioners say, and where we have to depart from them

Second pass, 16 September, against founder- and operator-led sources rather than
outreach-tool content marketing. Three things land straight, one has to be
adapted, and one we reject on positioning grounds.

### Name the problem, not the business

The complaint that started this file was a sentence that described what a
business *does*. There is a number on how badly that performs: Gong's corpus
puts **problem language at a 16% success rate against 5.5% for buzzwords** —
about three to one. The advice that follows from it, from 30MPC, is blunter than
anything in §3: *"People act on problems more than benefits."*

So the test is not "is this specific to them" — a description can be perfectly
specific and still say nothing. The test is **does this name something that goes
wrong.** "You run a roster of independent experts" is specific, accurate, and
not a hook. "Matching a brief to the right expert means somebody reads six
profiles before answering" is the same fact with the problem in it.

### The ratio is wrong in our letter

30MPC: *"If you spend 80% of the time on the problem, you barely have to explain
the solution."*

Our letter currently spends one paragraph on the observation and two on
ourselves — who Alex is, and what the fix might look like. That is roughly
inverted. The fix is not to pad the observation but to cut our half: the
introduction is one sentence, not two, and it comes after the problem has
landed.

### Ban the buzzwords by name

30MPC names them: *"single source of truth"*, *"all-in-one platform"*, *"leading
provider"*. Ours would be *"streamline"*, *"seamless"*, *"solution"*,
*"leverage"*, *"digital transformation"*, *"efficiency gains"*. Every one is a
word that survives find-and-replace across every business in the batch, which is
the §3 test failing in a different costume.

### Where we depart: the vivid scene

This is the one that matters, and it contradicts §4 of this file, so it is worth
being precise rather than picking a side.

30MPC tells sellers to paint a **triggering scene**: *"I should be able to
visualize the problem... and it should be damn triggering."* Who, where, the
challenge, the emotion. That is the opposite of the rule added on 16 September
after a letter invented a hands-free kit and a gravel driveway.

Both are right, for different businesses. **Their sellers have earned the
scene.** An enterprise rep has run the same discovery call with the same persona
fifty times; when they describe the Tuesday the data team gets asked for a
number nobody can produce, they are reporting, not imagining. The vividness is
downstream of evidence they actually hold.

We hold one homepage and no conversations. Identical words, completely different
epistemic position — and the recipient can tell, because it is *their* Tuesday
and they know whether we got it right.

**So: as vivid as the observation licenses, and not one detail further.** Which
puts the weight back on the observation. If the scene is thin, the answer is a
better-observed fact, never a better-imagined one. That is a harder discipline
than 30MPC's and it is the correct one for a first contact from a stranger with
no proof.

### Where we depart: the free diagnosis

Blair Enns, *The Win Without Pitching Manifesto*: the pitch is *"the attempt to
sell or win approval for one's idea by giving them away for free"*, and
**expertise alone is what gives you a position of power** over a prospective
client.

By that standard our third paragraph — *"For you, that could mean an automation
that matches the incoming brief against specialist records"* — is a small free
pitch. Enns would cut it: naming the fix before they have engaged spends the
only leverage an expert has.

We keep it, deliberately, and the reason is `17-proof-and-case-studies` being
empty. Enns's position assumes proof exists; *"the more proof we have the less we
need to pitch"* is his own formulation. With none, a letter that names a problem
and offers a meeting without any indication of what we would do is asking for
thirty minutes on trust we have not earned.

So the sentence stays, and it stays **one sentence, a direction, never a plan**.
It is a stated exception rather than an oversight, and it should be revisited the
moment there is a case study — at which point cutting it makes us stronger, not
weaker.

### What we were already doing right

30MPC's *"sell the test drive, not the product"* is the half hour, free, with an
honest answer if it is not worth doing. That was arrived at from the JOLT
research in §5 and it is the same conclusion from a different direction, which
is the most reassuring kind of agreement.

---

## 11. Sources

Practitioner and research material reviewed 15 September 2026. Listed so the
claims in §5 can be checked rather than taken on trust.

- Matt Dixon and Ted McKenna, *The JOLT Effect* — the no-decision and
  cost-of-inaction findings, via [salesmotion.io](https://salesmotion.io/blog/jolt-effect-overcoming-buyer-indecision)
  and [shift90.partners](https://www.shift90.partners/blog/the-jolt-effect-and-the-high-cost-of-buyer-indecision)
- Neil Rackham, *SPIN Selling* — implication questions, via
  [shortform.com](https://www.shortform.com/blog/implication-questions-spin-selling/)
  and [salespop.net](https://salespop.net/sales-professionals/spin-selling/)
- Josh Braun, *Poke the Bear* — problem-first openers, low-friction asks, the
  detach: [joshbraun.com](https://joshbraun.com/before-after-cold-emails/),
  [methodology summary](https://github.com/LeadGrowGTM/poke-the-bear-skill)
- Keenan, *Gap Selling* — current state / future state, via
  [highspot.com](https://www.highspot.com/blog/gap-selling/) and
  [gong.io](https://www.gong.io/blog/gap-selling)
- Subject-line and personalisation corpus findings, 2025–26:
  [instantly.ai](https://instantly.ai/blog/subject-line-trends-2026-why-authenticity-and-ai-outperform-gimmicks/),
  [lemlist](https://www.lemlist.com/blog/personalized-cold-email),
  [evaboot](https://evaboot.com/blog/cold-email-best-practices-in-2026)
- Consultancy outreach without proof:
  [100signals](https://100signals.com/email-outreach-for-consulting-firms/),
  [mylance](https://www.mylance.co/post/a-warm-approach-to-cold-sales-a-consultants-guide-to-winning-cold-outreach)
- SME buyer psychology — the identity rule in §4:
  [kevinharrington.com](https://www.kevinharrington.com/2023/07/solving-pains-and-gaining-trust-the-nuances-of-the-sme-sales-process/),
  [smartsimplemarketing](https://smartsimplemarketing.com/selling-to-small-businesses/)

Second pass, 16 September, practitioner and operator sources:

- Armand Farrokh and Nick Cegelski, *30 Minutes to President's Club* / *Cold
  Calling Sucks (And That's Why It Works)* — the problem proposition, the
  triggering scene, the buzzword list, sell the test drive:
  [the framework](https://www.30mpc.com/newsletter/the-ultimate-30mpc-cold-calling-framework),
  [the pitch](https://www.30mpc.com/newsletter/how-to-build-the-perfect-cold-call-pitch)
- Gong's corpus on problem language versus buzzwords (16% against 5.5%), via the
  same
- Blair Enns, *The Win Without Pitching Manifesto* — expertise as the position of
  power, the pitch as giving your thinking away:
  [summary](https://www.blinkist.com/en/books/the-win-without-pitching-manifesto-en),
  [Goodreads](https://www.goodreads.com/en/book/show/8576838-the-win-without-pitching-manifesto)

**On the sources.** Most of the cold-outreach material online is content
marketing for outreach tooling, and its numbers are unaudited. The two book
findings are from real research corpora and are treated as evidence; the
subject-line and personalisation figures are treated as directional, which is
why §5 says "~21%" and not "21%". Nothing here was taken as an instruction — the
JOLT finding in particular contradicts most of the rest, and it is the one we
built the letter around.
