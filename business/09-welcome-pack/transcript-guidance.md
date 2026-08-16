# Getting the goals honestly

The goals section is the only part of the welcome pack that is not generated from
the client record. It comes from what was said in the discovery call. This file
covers how to get that material without creating a problem, what must never be
pasted into a chat window, and what a good set of goals actually looks like.

Two things to be clear about before anything else:

- **Nothing in this file has been reviewed by a solicitor.** It is practical
  guidance for keeping our own house in order, not legal advice, and it does not
  substitute for reading the ICO's own material on recording and on personal
  data.
- **You do not need a recording.** Notes written by hand during the call are
  enough to produce a good goals section, and they carry none of the obligations
  a recording does. Record only when the call is dense enough that notes would
  cost you the conversation.

---

## 1. Recording a call

### Ask before, not during

Put it in the meeting invite so nobody is put on the spot:

> I'd like to record this call so I can write up the goals accurately
> afterwards. If you'd rather I didn't, just say and I'll take notes instead —
> it makes no difference to the meeting.

Then ask again at the start, before the substantive conversation, and wait for a
clear yes from everyone on the call:

> Before we start — is everyone happy for me to record this? It's so I can write
> up what we agree accurately. I'll delete the recording once the write-up is
> done, and nobody outside n.abl sees it.

Three rules around that:

1. **A clear yes, from everyone.** Silence is not consent. If four people are on
   the call, four people need to answer.
2. **Say what it is for, who sees it, and how long you keep it.** All three, in
   the sentence, before the recording starts. If you cannot say how long, you are
   not ready to record.
3. **Start the recording after the yes, not before it.** The consent must not be
   the first thing on the tape.

Most video platforms announce the recording themselves and show a badge for the
duration. That announcement is useful and does not replace asking.

### If anyone says no

Stop. Take notes by hand instead, and do not raise it again during the call. A
client who declines a recording is telling you something about how they handle
their own information, which is worth knowing about them anyway.

Then write the goals from your notes. The document does not know or care which
route the material came from.

### What a recording is

A recording or transcript of a conversation contains personal data about the
people in it — their voices, their opinions, sometimes information about their
colleagues who were never in the room. Under UK data protection law that means
the people recorded have rights over it, and we need a reason to hold it and a
point at which we stop holding it. That is the whole reason for the retention
line below.

**Retention:** [PLACEHOLDER — set a retention period and record it here. A
sensible default is: delete the recording and the transcript within 30 days of
the welcome pack being issued, and delete immediately on request.] Until that
figure is agreed, do not tell a client a number you have not decided on.

---

## 2. Where the transcript goes

This matters more than people expect, because the two routes in
`how-to-run-it.md` send the material to different places.

| Route | Where the transcript ends up |
|---|---|
| **Write it** — you distil the goals yourself and paste those | Nowhere. The transcript never leaves your machine. Only your own sentences reach the composer. |
| **Copy prompt** — you paste the transcript into a chat window | It leaves the building. It goes to whichever account and service you paste it into, under that service's terms, and is subject to that service's retention. |
| **Summarise** — the optional endpoint | It goes to our Supabase Edge Function and on to the model API. Nothing is stored by us in transit, but it is still a third party receiving the client's conversation. |

In all three cases the team space itself stores nothing: the composer holds the
text in the browser tab and discards it when you close it.

**Say so if asked, and do not be evasive about it.** "The notes go through an AI
tool to help me draft the summary" is a true, short answer. If a client says they
would rather that did not happen, use the Write it route and do the distilling
yourself. It takes ten minutes.

---

## 3. What must not be pasted

Before you paste a transcript anywhere, read it and take out:

- **Named individuals who were not in the room.** "Our supplier is slow" is
  fine. "Dave at [supplier] is useless" is a named person's reputation in
  someone else's system.
- **HR and salary detail.** Discovery calls wander into "we pay Sarah £X to do
  this manually" surprisingly often. The number can stay; the name goes.
- **Anything about the client's own customers.** Customer names, order details,
  patient or client information. None of that belongs in a prompt, and some of it
  belongs to a category of data with rules of its own.
- **Credentials of any kind.** Passwords, API keys, account numbers, licence
  keys. If one was read out on the call, remove it from the transcript and tell
  the client to change it.
- **Anything the client marked confidential.** If they said "this bit is
  off the record", it is off the record everywhere, including your prompt.

The rule of thumb: **paste nothing you would not be comfortable reading aloud
back to the client.** If a line makes you hesitate, delete it — the goals section
will be fine without it.

---

## 4. Writing the goals

The section answers one question for the client: *what are we setting out to
achieve together?*

**A good goals block** is one paragraph of summary and two to five outcomes.

- **Outcomes, not tasks.** "One version of the numbers everyone trusts" is an
  outcome. "Build a Supabase view" is a task, and the client did not ask for a
  Supabase view.
- **Their words, not ours.** If they said "the Monday panic", the goal can say
  the Monday panic. Do not translate their problem into our vocabulary — that is
  how a welcome document starts sounding like a brochure.
- **No invented numbers, deadlines or system names.** If they did not say
  "by March", it does not say by March. If they did not name the CRM, do not
  guess which one it is.
- **Fewer is better than padded.** Two real goals beat five where three were
  made up to fill the list. If the call did not produce enough to state a goal,
  the honest answer is no goals section at all — the document is designed to omit
  it cleanly and there is no fallback that will invent one for you.

### Worked example

Raw notes from the call:

```
- monday morning reporting, takes Sarah most of a day, sometimes into tuesday
- three spreadsheets, one from the booking system, one from the bank, one manual
- numbers never quite match, argument every month about which is right
- wants it done before the 9am meeting, not during it
- mentioned wanting to see it on a phone, wasn't sure
```

What to paste into the composer:

```
We're replacing the Monday reporting scramble with something that runs on its own
before the week starts, so the numbers are ready for the 9am meeting rather than
being assembled during it.

- Get the weekly reporting effort down from most of a day to close to nothing
- One version of the numbers that everyone agrees on
- The figures ready before the Monday meeting, not during it
```

Note what did not survive: Sarah's name, the "wasn't sure" phone idea, and the
three specific spreadsheets. The first is a person, the second was not agreed,
and the third is implementation detail the client does not need in a welcome
document.

---

## 5. Before you paste — the checklist

- [ ] Everyone on the call gave a clear yes before the recording started, or
      there is no recording.
- [ ] The client was told what the recording is for, who sees it, and how long it
      is kept.
- [ ] Named third parties, HR detail, customer data and credentials are out of
      the text.
- [ ] Nothing marked confidential is in the text.
- [ ] You know which route you are using and where the text is going.
- [ ] You have a date in your diary to delete the recording and the transcript.

And afterwards, before you press Save to portal:

- [ ] Every goal is something they said, in words they would recognise.
- [ ] No number, date or system name appears that was not spoken on the call.
- [ ] If there were not enough goals, the section is absent rather than padded.
