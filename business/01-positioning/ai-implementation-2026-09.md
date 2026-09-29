# Repositioning: AI implementation (29 September 2026)

```
Status:       decided by the owner, 29 September 2026; live on the dev branch, not yet on main
Owner:        Alex
Supersedes:   the "technology implementation, no retainers, credits" positioning in
              positioning-statement.md, service-categories.md, messaging-spine.md,
              ../README.md §3, ../12-pricing and ../13-credits, where they disagree
```

This is the decision record. The older documents are kept, because the
reasoning in them is still useful, but where they disagree with this file,
this file wins.

## What changed

**What n.abl is.** An AI implementation business for small and mid-sized
businesses (SMB and mid-market). The descriptor is *AI implementation for small
and mid-sized businesses*; the line is *AI, built into your business.*, which
is also the launch reel's end card.

**What n.abl sells.** AI built around the way a business already works, then
looked after every month. The website shows seven examples, in this order:

1. Voice receptionist (the voice agent demo, `demo-products/voice-agent`)
2. Chat and messaging (the text chat demo, being built by the other project member)
3. Document AI (document scanning, next on the demo list)
4. Back-office agent (next on the demo list)
5. Sales co-pilot (from the launch reel)
6. Knowledge assistant
7. Built for you: the list is where a conversation starts, not the limit of it

The intent is to start broad and narrow to a niche based on what lands. The
site says the seven are examples, not a menu, so narrowing later is a copy
change, not a repositioning.

**Other services.** Automation, data and analytics, and web stay, labelled as
other services, on their own page (`/services`) with a short band near the foot
of the home page. They were the whole offer before; they stay because not
every problem needs AI, and saying so is part of being trusted with the ones
that do.

**Removed.** Custom software and training as services. Training is part of the
retainer now. AI moved from one capability among six to the offer itself.

## Pricing: a retainer, not credits

"No retainers" and the credit packs are gone. A setup price to build and
launch, then a monthly retainer.

- **Why:** a retainer is steadier for a small business to run on than a
  stream of new clients, and AI is not something you install and leave.
  Models change, the business changes, and the work should keep improving.
- **Setup:** a fixed price, scoped in writing, agreed before work starts.
- **Retainer:** three tiers on the site, **Essentials**, **Growth** and
  **Partner**, with no prices shown. Support, training and small changes are
  included: no credits, no invoice for a question.
- **Face-to-face time is limited and grows with spend.** The site's first
  wording: a review each quarter (Essentials), a session every month (Growth),
  regular sessions planned around them (Partner). **To confirm:** the hours or
  sessions per tier, and the prices, which go in `TIERS` in
  `src/components/sections/Pricing.jsx` and nowhere else.

## Still to do (not done in this change)

- **Contract terms for a retainer.** The Terms of Service now say a retainer's
  inclusions, fee and notice period are set out in the quote. The contract
  itself needs a minimum term, a notice period and a fair-use limit on
  face-to-face time. `04-legal` has not been updated; this wants a solicitor.
- **Prices** for setup and each tier, once the first real quotes exist.
- **The CRM's outreach packs** (`business/knowledge/services`, used by
  `outreach-writer`) and the `research-lead` prompt still pitch the old six
  services. Outreach generated now will describe the old business.
- **The share image** (`public/brand/og.png`) still carries the old line.
- **The business-plan documents** listed under "Supersedes" still describe
  the old model in their body text.
