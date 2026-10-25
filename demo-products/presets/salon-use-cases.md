# Hair salon: every use case

What callers ring a UK hair salon about, what a great receptionist does, and what the demo needs. Researched on 8 October 2026 (UK rules checked against current sources), then checked for gaps by the same session, not a second reviewer (see "Checked for gaps" at the end). 38 use cases (14 Must, 16 Should, 8 Could). Priority for the demo: **Must**, **Should**, **Could**.

The sample business: The Fern Room, 14 Tennyson Mews (example), West Bridgford, Nottingham NG2, so the salon, the barber, the takeaway and the repairs demo share a city. Four stylists, priced by level, not by who the client is: Lucy (the owner, director: colour, balayage, colour correction), Priya (senior: cuts, curly and textured hair, occasion and bridal hair), Tom (stylist: cuts, short cuts, colour; Tuesday to Saturday) and Ellie (graduate stylist: blow-dries, cuts and toners at the lowest price; Wednesday to Saturday). Closed Sunday and Monday; Tuesday, Wednesday and Friday 9am to 6pm; Thursday 10am to 8pm; Saturday 8.30am to 4.30pm. Prices (graduate / stylist / senior / director): cut and blow-dry £32 / £42 / £50 / £60; short cut £22 / £28 / £34 / £40; blow-dry £24 / £28 / £32 / £38. Colour (any colouring stylist): root tint from £55, full head colour from £70, half-head highlights from £75, full-head highlights from £95, balayage from £120, toner £25. Kids' cut (under 12) £18. A free 15-minute consultation and patch test before a first colour. A deposit on colour, up-dos and the bridal trial: 20% of the price (at least £10), taken off the bill; free to cancel or move with 48 hours' notice, after that the deposit is kept.

## Who calls

- Clients booking a cut, a blow-dry or colour, often naming their stylist
- Regulars wanting "my usual" with the same stylist
- New clients wanting colour, who need a consultation and a patch test first
- Clients asking how much something is, and why one stylist costs more than another
- Brides and anyone with an occasion: a trial, the day, a party of bridesmaids
- Parents booking for children, and teenagers wanting colour
- Clients with curly, Afro or textured hair asking who does it
- Clients moving, cancelling or running late for a long colour appointment
- Clients who've had a reaction, are pregnant, or are losing their hair
- Clients unhappy with a colour or a cut
- The salon's own stylists ringing in sick or late
- Suppliers, reps, job applicants, training models, sales calls

## The moments that sell it in a demo

1. "I'd like balayage with Lucy on Saturday; I've never been before": the consultation and patch test booked first (today or tomorrow, 15 minutes), the balayage only from 48 hours after it, the deposit taken with the demo card, both in Lucy's column, and the reason said in one sentence.
2. "My usual root tint with Tom on Friday": the salon remembers. Patch test in May (within six months) and the same colour: booked straight away. Patch test last year: a new patch test first, and Friday only if it's 48 hours after.
3. "How much is a cut and blow-dry?": "From £32 with Ellie, our graduate stylist, up to £60 with Lucy, the director", the same price for anyone, and the caller chooses.
4. Colour with processing time: Lucy's root tint at 10 shows on the back office as applying, processing and finishing; a caller's fringe trim with Lucy lands in the 35 minutes the colour is developing.
5. "Can my 14-year-old have her hair dyed for the prom?": no colour or patch test for under-16s, said kindly with the reason; a cut and an up-do offered instead.
6. "My scalp's itching and my eyes are swelling since my colour yesterday": swelling of the face, lips or throat, or trouble breathing, is 999 now; otherwise rinse with mild shampoo and ask a pharmacist; a message for Lucy marked urgent; no fault admitted, no diagnosis.
7. Cancelling Saturday's balayage on Thursday afternoon: inside 48 hours, the deposit is kept, said once and plainly, and nothing more is claimed.

## Use cases

### Booking

#### A cut and blow-dry with any stylist, soonest (Must)

**Caller:** Client

**The receptionist:** Asks what they'd like, then gives the first free times across the stylists who do it, two or three at most, each with that stylist's price. Books one, takes the name and checks the number to text. Reads back the service, stylist, day, time and price before booking.

**The system needs:** The restaurant's booking tools with stylists as resources (`check_availability` across stylists, `create_booking` with a `resource_key`), each stylist's own hours and services, the price by level.

**Rules:** Consumer Rights Act 2015 s49: a service must be performed with reasonable care and skill (https://www.legislation.gov.uk/ukpga/2015/15/section/49). Digital Markets, Competition and Consumers Act 2024: the price said must include every compulsory charge (the CMA's price transparency guidance, CMA209, from 6 April 2025).

**Test call:** "Can I get a cut and blow-dry on Thursday evening, anyone's fine?" Pass: two or three real times, each with its stylist and price; booked with the stylist the time belongs to; read back; texted.

#### A named stylist (Must)

**Caller:** A regular

**The receptionist:** Offers that stylist's free times only. If they're fully booked on the day asked, says so and offers their next free day, or another stylist that day, in that order, with the other stylist's price. Never books someone else without asking.

**The system needs:** Availability for one resource; the stylist named by first name.

**Test call:** "Cut and blow-dry with Priya, Saturday morning." Pass: Priya's times only and her price; booked with Priya.

#### A stylist who doesn't work there, or is off (Must)

**Caller:** Client

**The receptionist:** "We don't have a Sophie here" (no guessing at a near name), or "Ellie isn't in on Tuesdays" / "Tom's not in today", and offers the stylists who are. Never says why someone is off.

**The system needs:** The team list; each stylist's days; the barber's "off today" switch, read on every tool call.

#### "My usual" (Should)

**Caller:** A regular

**The receptionist:** Finds their last visit by the calling number and offers the same service with the same stylist ("a root tint and a cut with Tom, like last time?"). Never reads out anything about another client.

**The system needs:** The client's past bookings by phone (`voice_customers` and the bookings).

#### Colour for a client who's been before: the patch test on record (Must)

**Caller:** A regular wanting colour

**The receptionist:** Checks the salon's record of their last patch test. Under the salon's rule (by default the NHBF's 2023 protocol: every six months for existing clients), a recent test means the colour is booked straight away. A test too old, a new colour brand or product, a reaction since, or a new tattoo, henna or "black henna" since their last colour means a new patch test first, and the colour only from 48 hours after it. Asks the two questions every time: any reaction to colour since last time, and any new tattoo or henna.

**Rules:** NHBF allergy alert testing protocols 2023: a test at least 48 hours before the colour; existing clients retested every six months, and again when the product, brand or manufacturer changes, after a reaction, or after a tattoo, henna or permanent make-up since the last colour; the client is told how to monitor the test for 48 hours and signs the record card (https://www.nhbf.co.uk/documents/nhbf-allergy-alert-testing-protocols/nhbf-allergy-alert-testing-protocols-2023.pdf; FAQs: https://www.nhbf.co.uk/documents/nhbf-harmonised-allergy-alert-testing-faqs-2023/1nhbf-harmonised-allergy-alert-testing-faqs-2023.pdf). The salon must check its insurance wording, which may ask for more (https://www.nhbf.co.uk/news-and-blogs/blog/allergy-alert-tests-industry-tests-and-your-insurance/). The dye makers' own instructions, and the industry's "Colour with confidence" campaign, say before every colour (https://www.thefactsabout.co.uk/hair-dye-allergy); the owner can choose that instead.

**The system needs:** The last patch test's date, product and result on the client; colour services marked "needs a patch test"; the rule (six months or every time); the 48-hour gap enforced in code.

**Test call:** "Root tint with Tom on Friday, same as usual." (test in May, same product) Pass: booked straight away after the two questions. And with a test last October: a new test first, Friday only if 48 hours after.

#### Colour for a new client: consultation and patch test first (Must)

**Caller:** A new client

**The receptionist:** Explains in one sentence that a first colour needs a quick consultation and patch test at least 48 hours before, and books both: the 15-minute consultation and test (free, with a colouring stylist or the colour stylist they'll see), then the colour from 48 hours after it. Anyone who has reacted to hair dye before, or to a "black henna" tattoo, isn't booked for colour; they're told to talk to the stylist and their GP or pharmacist first.

**Rules:** As above; the labelling of oxidative hair dyes in the Cosmetics Regulation as kept in UK law: "Hair dye products can cause severe allergic reactions", not for under-16s, and do not colour if you've reacted to hair colour or a temporary black henna tattoo before (Regulation (EC) 1223/2009, Annex III: https://www.legislation.gov.uk/eur/2009/1223/annex/III).

**The system needs:** A consultation-and-test service; two bookings in one call, the second no earlier than 48 hours after the first; the reason said once.

**Test call:** "Balayage with Lucy on Saturday, I've not been to you before." (on Wednesday) Pass: the test booked for today or Thursday, Saturday's balayage only if 48 hours after; the deposit asked after.

#### A big change or colour correction (Should)

**Caller:** "I dyed it black at home and want to go blonde"

**The receptionist:** Says this starts with a consultation (and the patch test) so the stylist can see the hair and give a price, which may mean more than one visit. Gives no price on the phone beyond "from", and never promises a result.

**The system needs:** A "consultation first" flag on a service; the consultation booked with the colour specialist.

#### Cut and colour together: the processing time (Must)

**Caller:** Client wanting a root tint and a cut

**The receptionist:** Books it as one appointment with one stylist, and says how long the whole visit takes. While the colour develops the stylist can see someone else: a short service (a fringe trim, a blow-dry finish) can go into that gap.

**The system needs:** Colour services in three parts (applying, processing, finishing) with the stylist free during processing; availability that offers a short service in the gap; the Diary showing the parts. Salon software books colour this way (https://www.zenoti.com/en-uk/salon-management-software/hair-salon-appointment-book; https://www.daysmart.com/salon/solutions/salon-spa-software).

**Test call:** "Fringe trim with Lucy at 10.30 on Friday." (Lucy has a root tint at 10, processing 10.20 to 10.55) Pass: 10.30 is free and booked.

#### Long appointments and the deposit (Must)

**Caller:** Client booking balayage or full-head highlights

**The receptionist:** Says how long it takes (often three hours or more) and the deposit (20% by default), which comes off the bill. Takes it with the demo card after booking. If the owner requires a deposit for colour, the booking is held until it's paid; otherwise it stands.

**The system needs:** The restaurant's deposit and `take_demo_payment`; a deposit rule by service (colour, or over a set length).

#### A blow-dry for tonight (Should)

**Caller:** "Can anyone fit me in for a blow-dry today?"

**The receptionist:** The soonest free times today, any stylist, with the price; or the waiting list if the day is full. Never promises a squeeze.

#### Occasion hair, bridal and a party (Should)

**Caller:** A bride, a mother of the bride, a prom-goer

**The receptionist:** Books a trial (the owner's price) and an occasion up-do on the day in the salon. A bridal party, a start before opening, or a stylist travelling to a venue is a message for the owner with the date, the venue, the numbers and the services; never promised on the phone.

**The system needs:** A trial and occasion services; a bridal message category with those fields.

**Test call:** "I'm getting married on 12 June and want hair for me and four bridesmaids at the hotel." Pass: a message with the date, venue and numbers; a trial offered; no promise of a time or price for the party.

#### Kids' cuts, and no colour for under-16s (Must)

**Caller:** A parent

**The receptionist:** Books a kids' cut (the owner's age limit, e.g. under 12). Colour, highlights or a patch test for anyone under 16 is a polite no, with the reason (the dye makers' instructions and the industry's rule), and a cut or an up-do offered instead. Asks the age once, only when colour is asked for a young person.

**Rules:** NHBF 2023 protocol: allergy alert tests and colour services must not be carried out on under-16s (as above). The labelling: "This product is not intended for use on persons under the age of 16" (Cosmetics Regulation Annex III, as above).

**The system needs:** The under-16 rule on colour services, enforced in the booking tool.

**Test call:** "Can my 14-year-old have some pink streaks for her prom?" Pass: no, kindly, with the reason; a cut or up-do offered; nothing booked for colour.

#### Curly, Afro and textured hair (Should)

**Caller:** Client

**The receptionist:** Says who does curly, Afro and textured hair (the owner's answer, by stylist) and books with them; a first visit may need the longer service. Never says the salon can't do their hair if the owner hasn't said so.

**Rules:** Equality Act 2010 s29: a service provider must not discriminate in providing a service, and race is a protected characteristic (https://www.legislation.gov.uk/ukpga/2010/15/section/29).

#### Extensions and smoothing treatments (Could)

**Caller:** Client

**The receptionist:** A consultation first (extensions need the hair matched and ordered; a smoothing treatment needs the hair checked). The owner's deposit for extensions, as the hair is bought for the client. No price beyond "from".

#### Moving a booking (Must)

**Caller:** Client

**The receptionist:** Finds the booking by the calling number or the reference, never reading back anyone else's. Offers the same stylist's times first. A colour moved earlier than 48 hours after the patch test can't be: offers the first time that is. Moving inside the notice period may lose the deposit: says so before moving.

**The system needs:** `find_booking` by phone or reference; `modify_booking`; the patch test gap checked on a move too.

#### Cancelling (Must)

**Caller:** Client

**The receptionist:** With 48 hours' notice: cancels and says the deposit comes back (in the demo, says it would be refunded; no money moves). Inside the notice period: says plainly that the deposit is kept under the salon's policy, which was said when they booked, and cancels. Never claims more than the deposit, never "by law".

**Rules:** Consumer Rights Act 2015 Sch 2 para 5: a term requiring a disproportionately high sum on cancellation may be unfair (https://www.legislation.gov.uk/ukpga/2015/15/schedule/2). Whether the Consumer Contracts Regulations 2013 14-day right to cancel applies to a salon appointment booked by phone is not settled in the guidance found (regulation 28(1)(b): https://www.legislation.gov.uk/uksi/2013/3134/regulation/28), the same open point as the barber's. So the receptionist states the salon's policy and nothing stronger.

**Test call:** "I need to cancel Saturday's balayage." (on Thursday afternoon) Pass: the deposit kept, said once; cancelled; nothing more claimed.

#### Running late (Must)

**Caller:** Client

**The receptionist:** Within the owner's grace (e.g. 10 minutes), says it's fine and tells the stylist. Beyond it, a cut may still fit if the stylist's next booking allows; a long colour usually can't be shortened, so it offers the next free time with the same stylist and says the deposit rule once.

**The system needs:** The barber's "running late" note and the next booking's start; the colour's full length.

#### A waiting list for a cancellation (Should)

**Caller:** Client wanting a full day

**The receptionist:** Adds them to the day's waiting list, with the service and any stylist they'd accept; a freed slot texts the first who fits. Promises nothing.

**The system needs:** The barber's waiting list, with a service and a stylist.

#### Two or more people together (Could)

**Caller:** A mother and daughter, two friends

**The receptionist:** Side by side with two stylists, or one after the other, as they prefer. One confirmation text.

### Prices and money

#### "How much is a cut?" (Must)

**Caller:** Anyone

**The receptionist:** The price by stylist level ("from £32 with Ellie, our graduate stylist, up to £60 with Lucy"), how long it takes, and "from" prices said as "from". The price depends on the service, the length and the stylist, never on whether the caller is a man or a woman. A "short cut" is a short cut for anyone.

**Rules:** Equality Act 2010 s29 (as above): charging more for the same service because of sex is direct discrimination. The NHBF advises pricing by hair type, service, products, time and the stylist's skill, never by gender (https://www.nhbf.co.uk/news-and-blogs/blog/the-importance-of-inclusivity-in-barbershops-and-salons/). The DMCC Act 2024 price rule (as above).

**Test call:** "How much is a cut for a man? And for my wife, she's got long hair?" Pass: the short cut and the cut and blow-dry priced by service and stylist, never by sex.

#### The deposit (Should)

**Caller:** Client booking colour

**The receptionist:** After booking, says the deposit and that it comes off the bill; takes it with the demo card if they're happy to pay now. Required or not as the owner sets.

**The system needs:** The restaurant's deposit and `take_demo_payment` flow; a percentage of the price.

#### "Is there a charge for card?" (Should)

**The receptionist:** No: a salon may not charge more for paying by card (Consumer Rights (Payment Surcharges) Regulations 2012 as amended: https://www.legislation.gov.uk/uksi/2012/3110).

#### Gift vouchers, student prices, training nights (Could)

**The receptionist:** The owner's words only; an offer never changes a total in the demo. Training-night models are a message for the owner.

#### Tips (Could)

**The receptionist:** The owner's tips answer. Tips paid by card go to the stylists in full (Employment (Allocation of Tips) Act 2023, in force from 1 October 2024; the code of practice: https://www.gov.uk/government/publications/distributing-tips-fairly-statutory-code-of-practice).

### People and access

#### Pregnant and wanting colour (Should)

**Caller:** Client

**The receptionist:** Books it if they want it, notes it for the stylist, and suggests telling the stylist so they can talk through options (a strand test, highlights that don't touch the scalp). Gives no medical advice; for worries, their midwife or GP. A patch test as for anyone.

**Rules:** The NHS says most research shows dyeing hair in pregnancy is safe, and advises telling the stylist and having a patch test (https://www.nhs.uk/common-health-questions/pregnancy/is-it-safe-to-use-hair-dye-when-i-am-pregnant-or-breastfeeding/).

#### Hair loss, alopecia or treatment (Should)

**Caller:** Client, or a relative

**The receptionist:** Gently, the owner's answer (a private room, a quieter time, a stylist who does it); notes it for the stylist. No medical advice and no questions about the cause.

#### A quiet appointment, wheelchair access, a guide dog (Should)

**Caller:** Client or carer

**The receptionist:** The owner's access answer (step-free, a basin chair, quiet times); offers the quietest time of day from the diary and notes "quiet appointment" for the stylist. Guide dogs are welcome.

**Rules:** Equality Act 2010: reasonable adjustments for disabled customers.

#### Relay UK, a noisy line, or little English (Should)

**The receptionist:** The shared call engine's relay handling; short sentences; the booking read back slowly.

#### A teenager booking alone (Should)

**Caller:** A young teenager

**The receptionist:** Books a cut if the owner allows under-16s to book; says an adult must come with them if that's the policy; no colour under 16 (as above).

### After the visit

#### A reaction after colour (Must)

**Caller:** Client, the day after colour

**The receptionist:** First, safety: swelling of the face, lips, mouth or throat, trouble breathing, or feeling faint is 999 now. Otherwise, the NHS's advice: wash the hair and scalp with a mild shampoo, ask a pharmacist (antihistamines can help itching), and see a GP if it gets worse; reactions can take up to 72 hours to show. Takes an urgent message for the owner with the colour and the date. Admits no fault, gives no diagnosis, and books no more colour.

**Rules:** NHS, hair dye reactions (https://www.nhs.uk/conditions/hair-dye-reactions/).

**The system needs:** The repairs preset's urgent safety triage pattern (999 first); a message category marked urgent; colour blocked for that client until the owner clears it.

**Test call:** "Since my colour yesterday my scalp's burning and my eyelids are puffy." Pass: asks about breathing and the lips or throat; 999 if so; otherwise the NHS steps; an urgent message; no "it's nothing" and no "we're sorry it was our fault".

#### Unhappy with a colour or cut (Should)

**Caller:** Client

**The receptionist:** Says sorry, and offers the owner's fix (e.g. a free adjustment within seven days with the same stylist, or another if they'd rather), or takes a message for the owner. Never promises a refund.

**Rules:** Consumer Rights Act 2015 s55: where a service isn't performed with reasonable care and skill, the first remedy is repeat performance (https://www.legislation.gov.uk/ukpga/2015/15/section/55).

#### Lost property, compliments (Could)

**The receptionist:** A message for the salon; thanks for a compliment, passed on.

### Other callers

#### A stylist ringing in sick (Should)

**Caller:** "It's Tom, I'm not well."

**The receptionist:** Takes an urgent message for the owner; in the demo, the owner marks Tom off on the back office, which flags his bookings to move. The receptionist never cancels his bookings itself.

**The system needs:** The barber's "off today" and flagged bookings.

#### Suppliers, reps, sales calls (Could)

**The receptionist:** A message for the owner; no account details. Sales calls: no thank you, politely; ends the call.

#### Job applicants, apprentices, training models (Could)

**The receptionist:** The owner's careers answer, or a message.

### Hours and information

#### Opening hours, the late night and bank holidays (Must)

**The receptionist:** The week's hours, the late night, and closures. A stylist's own days on request.

#### Where, and parking (Should)

**The receptionist:** The owner's answers.

#### Products for sale (Could)

**The receptionist:** The owner's answer; nothing sold on the phone in the demo.

## What the demo needs beyond the barber

The barber (`presets/barber.md`) brings stylists as the bookable resource, each person's own hours and services, "off today", running late, the waiting list, back-to-back bookings, the deposit and the Diary. The salon adds:

- **Prices by stylist level**: each stylist has a level, and a service's price is per level ("from £32 to £60"); availability says each time's price.
- **Colour in three parts**: applying, processing and finishing, with the stylist free while it develops, so a short service fits in the gap; the Diary shows the parts.
- **The patch test, remembered**: the last test's date, product and result on the client; the owner's rule (six months, the NHBF's 2023 protocol, or every colour); the two questions (a reaction since, a new tattoo or henna); the 48-hour gap enforced in code on booking and on a move.
- **Consultation first**: services flagged so (colour for a new client, colour correction, extensions), booked before the service itself.
- **No colour for under-16s**, enforced in the booking tool.
- **A deposit by service**: a percentage on colour or long appointments.
- **A reaction after colour**: 999 first, the NHS's steps, an urgent message, colour blocked for that client.
- **Guardrails**: no time nothing gave (`invented_time`), no price nothing gave (`invented_price`), no refund promised (`refund_claim`), no medical advice (`medical_advice`), no colour inside 48 hours of a patch test or for an under-16 (tool refusals, not guardrails).

## Checked for gaps

- **The patch test rule is the owner's, with the insurer.** The NHBF's six-month protocol is the default; the dye makers' "every time" is the stricter choice. Either way the 48-hour gap and the under-16 rule are enforced in code, never left to the model, and "I had one at another salon" isn't the salon's test.
- **A patch test isn't a guarantee.** The receptionist never says a colour is safe for someone; it says the test is the salon's precaution.
- **Price by service, length, time and stylist, never by sex.** "Men's cut" and "ladies' cut" price lists are never suggested; the sample prices are "short cut" and "cut and blow-dry".
- **"By law" is a claim.** The deposit is kept under the salon's policy; the 14-day question is open, as for the barber.
- **A no-show fee bigger than the deposit is risky.** The demo keeps the deposit and nothing more.
- **Medical questions go to the NHS, a pharmacist, a GP or a midwife.** The receptionist relays the NHS's safety steps for a reaction and nothing else.
- **A stylist's absence is private.** "Tom's not in today" and no more.
- **Health notes are sensitive.** Pregnancy, hair loss and reactions are noted for the stylist only, never read back to anyone else.
