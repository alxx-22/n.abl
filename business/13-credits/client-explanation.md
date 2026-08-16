# Credits, explained

*This page is written for the client. It is the plain-language source for
section 10 of a scope of work, for the credits paragraph in a proposal, and for
answering "so what happens after you finish?"*

**Do not send it yet.** Unlike the other client-facing pages in this repository,
this one describes something that does not exist. Every number in it is a
`[PLACEHOLDER]`, there is no ledger, there is no balance card in the portal, and
no client has ever bought a pack. It becomes sendable when the checklist in
[`README.md`](README.md) reaches item 3, and not before. Sending it with the
placeholders filled in by guesswork would be quoting an invented price.

---

## The client-facing copy

### After we finish

We build the thing, we hand it over, and it is yours. The source code, the
configuration and the passwords needed to run it and change it without us.

Most of the time, that is the end of it. It works, and it keeps working.

Sometimes it is not. Something upstream changes and breaks a connection. You
want it to do one more thing. Someone new joins and needs showing how it works.

That is what credits are for.

### You do not pay us monthly to be on standby. You buy support when you actually need support.

There is no retainer, no monthly fee, no minimum term and no rolling contract.
We do not charge you for the months when nothing happens, because nothing
happened.

Instead you buy a pack of credits up front, and you spend them when you need
something. If you do not need anything, you do not spend anything.

### What credits pay for

Three kinds of work:

| | |
|---|---|
| **Build** | Small changes, a new integration, another automation, an extra report. Something the system did not do before. |
| **Assist** | Troubleshooting, repairs, configuration, technical support. Something stopped working, or never quite worked. |
| **Educate** | Training, workshops, written documentation. Making your team better at what you already have. |

You do not choose in advance how to split them. You buy credits. When you need
something, you tell us, and we take it out of your balance.

### What a credit costs

`[PLACEHOLDER: pack sizes and prices. Larger packs cost less per credit. Credits
bought alongside the implementation cost less again. Fill this in from the real
figures — do not estimate it.]`

Buying credits with the implementation is cheaper than buying them later. That
is a genuine saving on our side rather than a sales tactic: it is one
conversation and one invoice instead of two, and the first time something needs
fixing we are already set up rather than starting from scratch.

### How you know what something will cost

Before we do anything, we tell you how many credits it will take, and you say
yes or no. Nothing is ever taken out of your balance without you agreeing to it
first.

We publish a list of the jobs we get asked for most often and roughly what each
one costs in credits, so you can work most of it out before you even ask.
`[PLACEHOLDER: link to the task menu once it exists.]`

If a job turns out to be much bigger than we said, we stop and come back to you.
We do not quietly spend three times what we quoted.

### How you know what you have left

Your balance is in your portal, next to your quotes and projects. It shows what
you have, what you have spent it on, and when anything is due to expire. You do
not have to email us to ask.

`[PLACEHOLDER: expiry terms. If credits expire, say plainly after how long, and
say that we tell you in advance. If they do not expire, say that instead.]`

### What credits do not cover

Being straight about this now is easier than being straight about it later.

- **A new project.** If it needs its own plan and its own sign-off, it is not a
  small change. We quote it separately, and you decide.
- **A guaranteed response time.** Credits buy work. They do not buy us being
  available within a set number of hours. If you need that, tell us and we will
  price it as its own thing — but it will not be called a credit.
- **Other people's bills.** Software licences, hosting, domain names and API
  charges are yours, at cost. We do not mark them up and we do not absorb them.
- **Fixing systems we did not build.** We can look, and often we can help, but
  we cannot say in advance what it will take. That starts with a paid look and
  then a quote.
- **Legal, medical or financial advice.** We build systems. We do not give
  advice, and we do not take on work that requires it.

### The honest risk

Credits you buy and never use are money you have spent for nothing.

We would rather say that than have you find it out. It is why the balance is in
your portal where you can see it, why the job list is published, and why we tell
you before anything expires. A balance you can see is a balance you will use.

If you are not sure you will need support, buy the smallest pack, or buy none.
You can buy more later. It will cost a little more per credit than buying it
now, and that is the only penalty.

---

## Notes for whoever is using this page

**The sentence in the heading is the one that matters.** *You do not pay us
monthly to be on standby, you buy support when you actually need support.* It
appears in the master plan section 3C, in `04-legal/service-agreement-notes.md`
section 1.1 as the sentence the client should be able to repeat back, and in
substance on the live home page. Keep it word for word. It is the whole
positioning of the offer in one line, and paraphrasing it weakens it.

**Never let "support" become "cover".** Every rewrite of this page will be
tempted toward warmer words — cover, peace of mind, we are there when you need
us. All of them describe a retainer. The offer is work bought in advance, not
availability, and the language has to keep saying so.

**Never imply a response time.** Not in this page, not in an email, not in
conversation. `04-legal`'s contract checklist item 13 makes this a contract
requirement, and it is easy to breach casually by saying "we will get straight
on it".

**Fill in every placeholder or delete the section.** The scope-of-work template
says exactly this at `04-legal/scope-of-work-template.md:288` — delete the
credits section rather than invent a number for it. A proposal with a
`[PLACEHOLDER]` in it is embarrassing. A proposal with a made-up price in it is
a problem.

**Where this copy goes when it is ready:**

| Destination | What to take |
|---|---|
| Scope of work, section 10 | The whole client-facing block, trimmed to the pack the client is buying |
| Proposal | The heading sentence, the three types, and the price |
| Welcome pack | The balance and expiry paragraphs, once the portal card exists |
| Website | Already there in short form, `src/pages/Home.jsx:365-372`. Only revisit it if the model changes. |
| A client asking "can we do a monthly arrangement?" | The heading sentence, then the price of a pack. `01-positioning/objection-handling.md` covers the rest. |
