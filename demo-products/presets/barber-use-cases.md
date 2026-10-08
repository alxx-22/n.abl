# Barber: every use case

What callers ring a UK barber about, what a great receptionist does, and what the demo needs. Researched on 8 October 2026 (UK rules checked against current sources), then checked for gaps by the same session, not a second reviewer (see "Checked for gaps" at the end). 36 use cases. Priority for the demo: **Must**, **Should**, **Could**.

The sample business: Kingsley's Barbers, 14 Chilwell Road (example), Beeston, Nottingham NG9, so the barber, the takeaway and the repairs demo share a city. Four barbers: Marcus (the owner: skin fades, Afro and textured hair, designs), Dan (classic cuts, beards, hot towel shaves), Jordan (junior: cuts and kids, Tuesday to Saturday) and Amira (Friday and Saturday: cuts, grey blending and beard colour). Closed Monday; Tuesday to Friday 9am to 6pm, Thursday to 8pm; Saturday 8am to 5pm; Sunday 10am to 3pm. Walk-ins welcome when a chair is free; appointments come first. A £5 deposit on a phone booking, taken off the price; free to cancel or move with 24 hours' notice, after that the deposit is kept. Prices: classic cut £18, skin fade £22, cut and beard £28, beard trim £12, hot towel shave £20, kids' cut (under 12) £13, grey blending £25.

## Who calls

- Customers booking a cut, often for this week, often naming their barber
- Customers asking whether they can walk in, and how long the wait is now
- Parents booking for children, sometimes two or three together
- Customers moving, cancelling or running late for a booking
- Customers wanting colour or grey blending, who need a skin test first
- Groups: a wedding party, a dad and two sons, a team before a do
- Customers asking about prices, what a style is, or who does Afro and textured hair
- Women wanting a short cut, and anyone asking whether the shop is for them
- Customers unhappy with a cut, or nicked by a razor
- The shop's own barbers ringing in sick or late
- Suppliers, chair renters, job applicants, apprentices, sales calls

## The moments that sell it in a demo

1. "Can I get a skin fade with Marcus on Saturday morning?": Marcus's real free times on Saturday, one booked, the £5 deposit taken with the demo card, the confirmation texted, and the booking in Marcus's column on the back office.
2. "Can I just walk in? How long is it now?": the wait from the shop's live queue ("Dan's free in about 20 minutes; the others are booked till 3"), and the offer to book that slot so they don't wait.
3. "I want my beard coloured on Friday": the 48-hour skin test first, booked for today or tomorrow, and the colour only from 48 hours after it. A caller who had a reaction before isn't booked for colour at all.
4. "I'm running 15 minutes late": the barber's next booking decides. If there's room, it's kept and the barber told; if not, the next free time is offered, and the policy said honestly.
5. "Can I cancel tomorrow's?" inside 24 hours: the deposit is kept, said plainly, and nothing more is ever claimed.
6. The prospect marks Dan "off sick" on the back office: his bookings today are flagged to move, and a caller asking for Dan hears he's off and is offered Marcus or Jordan.
7. Two kids back to back with Jordan, and their dad straight after with Marcus, in one call.

## Use cases

### Booking

#### A cut with any barber, soonest (Must)

**Caller:** Customer

**The receptionist:** Asks what they'd like (or offers the usual cuts), then gives the first free times across every barber who does that service, two or three at most. Books one, takes the name and checks the number to text. Reads back the service, barber, day, time and price before booking. Asks for the deposit after booking, as the owner sets; a caller who'd rather pay in the shop still has the booking if the owner allows it.

**The system needs:** The restaurant's booking tools with staff as resources (`check_availability` across barbers, `create_booking` with a `resource_key`), each barber's own hours and services, the deposit, and the booking in the barber's column.

**Rules:** Consumer Rights Act 2015 s49: a service must be performed with reasonable care and skill (https://www.legislation.gov.uk/ukpga/2015/15/section/49). Digital Markets, Competition and Consumers Act 2024: the price said must include every compulsory charge (the CMA's price transparency guidance, CMA209, from 6 April 2025).

**Test call:** "Can I get a cut tomorrow afternoon, any barber?" Pass: two or three real times; booked with the barber the time belongs to; read back with the price; the deposit asked after; texted.

#### A cut with a named barber (Must)

**Caller:** A regular

**The receptionist:** Offers that barber's free times only. If they're fully booked on the day asked, says so and offers their next free day, or another barber that day, in that order. Never books someone else without asking.

**The system needs:** Availability for one resource; the barber named by first name or nickname ("Marc").

**Test call:** "Skin fade with Marcus, Saturday morning." Pass: Marcus's times only; booked with Marcus; the deposit by demo card.

#### A barber who doesn't work there, or is off (Must)

**Caller:** Customer

**The receptionist:** "We don't have a Mike here" (no guessing at a near name), or "Dan's not in on Mondays" / "Dan's off today", and offers the barbers who are in. Never says why someone is off.

**The system needs:** The team list; barbers' days; an "off today" switch from the back office, read on every tool call.

#### Two or more services together (Must)

**Caller:** Customer

**The receptionist:** Books "cut and beard" as the shop's own combined service if there is one; otherwise books the services back to back with the same barber, so the time is long enough. Says the total time and price.

**The system needs:** Combined services with their own duration and price; back-to-back bookings with one resource.

#### "What's the difference between a skin fade and a taper?" (Should)

**Caller:** A first-timer

**The receptionist:** Gives the shop's own one-line description of each service and how long it takes; suggests they talk it through with the barber in the chair. Never invents a style the shop doesn't list.

**The system needs:** A description on each service.

#### Kids' cuts, and a parent bringing two (Should)

**Caller:** A parent

**The receptionist:** Books the kids' cut (the owner's age limit, e.g. under 12) back to back with one barber, or side by side with two, as the parent prefers. Says the shop's rule for children: under-16s come with an adult (the owner's policy; there's no legal age).

**The system needs:** Several bookings in one call, linked by the caller; the kids' policy as an answer.

**Test call:** "Two kids' cuts and one for me on Saturday at 10." Pass: three bookings, the kids with one barber back to back, the dad with another or straight after; one confirmation text.

#### A group: a wedding party, a team (Should)

**Caller:** Organiser

**The receptionist:** For up to the owner's limit (e.g. four), books them across the barbers. Larger groups, or an early start before opening, are a message for the owner to arrange, with the date, time, numbers and services. Never promises the shop opens early.

**The system needs:** A group limit; a message category for groups.

#### An appointment every few weeks (Could)

**Caller:** A regular

**The receptionist:** Books the next one and offers to book the one after; standing bookings are the owner's to set up (a message).

#### Moving a booking (Must)

**Caller:** Customer

**The receptionist:** Finds the booking by the calling number or the reference, never reading back anyone else's. Offers the same barber's times first. Moving inside the owner's notice period may lose the deposit: says so before moving.

**The system needs:** `find_booking` by phone or reference; `modify_booking`; the notice rule.

#### Cancelling (Must)

**Caller:** Customer

**The receptionist:** With notice: cancels and says the deposit comes back (in the demo, says it would be refunded; no money moves). Inside the notice period: says plainly that the deposit is kept under the shop's policy, which was said when they booked, and cancels. Never claims more than the deposit, never "by law".

**Rules:** Consumer Rights Act 2015 Sch 2 para 5: a term requiring a disproportionately high sum on cancellation may be unfair; a business may keep what reasonably covers its loss (https://www.legislation.gov.uk/ukpga/2015/15/schedule/2). Whether the Consumer Contracts Regulations 2013 14-day right to cancel applies to a haircut booked by phone is not settled in the guidance found: regulation 28(1)(b) exempts leisure services for a specific date, and a haircut may not be one (https://www.legislation.gov.uk/uksi/2013/3134/regulation/28). So the receptionist states the owner's policy and nothing stronger; see Decisions for Alex.

**Test call:** "I need to cancel tomorrow at 10." (booked today for tomorrow) Pass: the deposit kept, said once; the booking cancelled; no "you'll lose more".

#### Running late (Must)

**Caller:** Customer

**The receptionist:** Within the owner's grace (e.g. 10 minutes), says it's fine and tells the barber. Beyond it, checks the barber's next booking: if there's room after, keeps it or moves it slightly; if not, offers the next free time or another barber. The deposit rule as the policy says, said once.

**The system needs:** A "running late" note on the booking for the barber; the next booking's start; a move.

#### Walk-ins and the wait now (Must)

**Caller:** "Can I just walk in?"

**The receptionist:** Says walk-ins are welcome when a chair is free, then gives the honest wait from the shop's live queue: who's free soonest and roughly when, counting the bookings and the people already waiting. Offers to book that slot so they don't wait. Never promises a walk-in a time.

**The system needs:** A live queue on the back office (waiting walk-ins added and removed by staff), each barber's next free gap; a tool for the wait now.

**Test call:** "How long's the wait if I come down now?" Pass: the wait from the queue and the diary, a barber's name, the offer to book it.

#### A waiting list for a cancellation (Should)

**Caller:** Customer who wants a full day

**The receptionist:** Adds them to the day's waiting list with their number; a slot freed by a cancellation texts the first on the list (the shop confirms). Promises nothing.

**The system needs:** A waiting list per day; a text on cancellation.

#### Colour, grey blending and beard colour: the skin test (Must, when the shop offers colour)

**Caller:** Customer

**The receptionist:** Asks whether they've had the shop's skin test for this colour (by default before every colour, as the dye's instructions say; the owner may choose otherwise with their insurer). If not, books the 48-hour skin test (a few minutes, any barber who does colour) and the colour only from 48 hours after it. Anyone who has reacted to hair dye before isn't booked for colour; they're told to speak to the barber and their GP or pharmacist. Never says a dye is safe for them.

**Rules:** Hair dye products carry the instruction to do an allergy alert test 48 hours before each use; PPD can, rarely, cause anaphylaxis (Anaphylaxis UK, "Allergy to hair dye" fact sheet: https://www.anaphylaxis.org.uk/wp-content/uploads/2022/06/Allergy-to-Hair-Dye-Factsheet.pdf). The test is required each time, as allergy can develop.

**The system needs:** A colour service flagged "needs a skin test"; a skin-test service; the 48-hour gap enforced in code; the test's date on the customer.

**Test call:** "Can I get my beard coloured on Friday?" (on Wednesday, no test) Pass: the test booked today or tomorrow; the colour on Friday only if 48 hours after; the reason said.

#### A hot towel shave with sensitive skin (Should)

**Caller:** Customer

**The receptionist:** Books it and notes the sensitive skin for the barber; for a skin condition or a rash, suggests they mention it to the barber first and doesn't advise. No medical advice.

#### First visit with long or textured hair (Should)

**Caller:** Customer

**The receptionist:** Says who in the shop does Afro and textured hair (the owner's answer, by barber), and books with them; a longer cut may need the longer service.

**Rules:** Equality Act 2010: race is a protected characteristic, and refusing or charging more for a service because of it is unlawful (the EHRC's guidance for businesses that provide services). Afro hair itself isn't separately protected yet (World Afro Day campaign, 2024).

#### Home or care-home visits (Could)

**Caller:** A relative

**The receptionist:** The owner's answer: offered (a message to arrange) or not. Never books one as a shop appointment.

### Prices and money

#### "How much is a skin fade?" (Must)

**Caller:** Anyone

**The receptionist:** The service's price and how long it takes; "from" prices said as "from". Every compulsory charge in the first price (DMCC Act 2024).

#### The deposit (Should)

**Caller:** Customer booking

**The receptionist:** After booking, says the deposit and that it comes off the price; takes it with the demo card if they're happy to pay now. If they decline and the owner allows it, the booking stands; if the owner requires it, it's held until paid (the owner's choice).

**The system needs:** The restaurant's deposit and `take_demo_payment` flow.

#### "Is there a charge for card?" (Should)

**The receptionist:** No: a shop may not charge more for paying by card (Consumer Rights (Payment Surcharges) Regulations 2012 as amended).

#### Gift vouchers, student and older people's prices (Could)

**The receptionist:** The owner's words only; an offer never changes a total in the demo.

#### Tips (Could)

**The receptionist:** The owner's tips answer. Tips paid by card go to the barbers in full (Employment (Allocation of Tips) Act 2023).

### People and access

#### Women's short cuts (Should)

**Caller:** A woman wanting a short cut or a fade

**The receptionist:** Books it as the same service at the same price as anyone else's. Never "we only do men".

**Rules:** Equality Act 2010: refusing a service because of sex, or charging more for the same service, is direct discrimination (EHRC; NHBF "Cut out inequality at your barbershop": https://www.nhbf.co.uk/news-and-blogs/blog/cut-out-inequality-at-your-barbershop/).

**Test call:** "Do you cut women's hair? I want a short back and sides." Pass: yes, booked as the cut, the same price.

#### A quiet appointment, wheelchair access, a guide dog (Should)

**Caller:** Customer or carer

**The receptionist:** The owner's access answer (step-free, quiet times); offers the quietest time of day from the diary and notes "quiet appointment" for the barber. Guide dogs are welcome.

**Rules:** Equality Act 2010: reasonable adjustments for disabled customers.

#### Relay UK, a noisy line, or little English (Should)

**The receptionist:** The shared call engine's relay handling; short sentences; the booking read back slowly.

#### A child ringing alone (Should)

**Caller:** A young teenager

**The receptionist:** Books a cut if the owner allows under-16s to book; says an adult must come with them if that's the policy. Takes the parent's number if offered.

### After the visit

#### Unhappy with the cut (Should)

**Caller:** Customer

**The receptionist:** Says sorry, and offers the owner's fix (e.g. a free tidy-up within seven days with the same barber or another), or takes a message for the owner. Never promises a refund.

**Rules:** Consumer Rights Act 2015 s55: where a service isn't performed with reasonable care and skill, the first remedy is repeat performance (https://www.legislation.gov.uk/ukpga/2015/15/section/55).

#### Cut or nicked by a razor (Should)

**Caller:** Customer

**The receptionist:** For a small cut that's still bleeding, press with something clean for ten minutes; if it won't stop, or it's deep, NHS 111 or A&E. Takes a message for the owner. Admits no fault.

#### Lost property, compliments (Could)

**The receptionist:** A message for the shop; thanks for a compliment, passed on.

### Other callers

#### A barber ringing in sick (Should)

**Caller:** "It's Dan, I'm not well."

**The receptionist:** Takes an urgent message for the owner; in the demo, the owner marks him off on the back office, which flags his bookings to move. The receptionist never cancels his bookings itself.

**The system needs:** A staff message category; "off today" per barber; flagged bookings ("needs a new time"), as the repairs preset's engineer absence.

#### A chair renter, supplier, landlord (Could)

**The receptionist:** A message for the owner; no account details.

#### Job applicants and apprentices (Could)

**The receptionist:** The owner's careers answer, or a message.

#### Sales calls (Could)

**The receptionist:** No thank you, politely; ends the call.

### Hours and information

#### Opening hours, late nights and bank holidays (Must)

**The receptionist:** The week's hours, the late night, and closures. A barber's own days on request.

#### Where, and parking (Should)

**The receptionist:** The owner's answers.

#### Products for sale (Could)

**The receptionist:** The owner's answer; nothing sold on the phone in the demo.

## What the demo needs beyond the restaurant

- **Barbers as the bookable resource**: each with services, days and hours; "any barber" across all; named by nickname; the restaurant's booking engine already does staff as resources (the estate agent's diaries, `fade-and-co`).
- **Combined and back-to-back services**; several bookings in one call.
- **The walk-in queue**: waiting walk-ins on the back office, and the wait now from the queue and the diaries.
- **Off today**: a per-barber switch read on every tool call; their bookings flagged, as the repairs preset's engineer absence.
- **The skin test**: a "needs skin test" flag on colour services, a test service, the 48-hour gap enforced in code, the test date on the customer.
- **Running late**: a note on the booking for the barber.
- **A waiting list** per day, texted on a cancellation.
- **Cancellation and deposits** as the restaurant's, with the notice period and the policy said once.
- **Guardrails**: no time nothing gave (`invented_time`), no price nothing gave (`invented_price`), no refund promised (`refund_claim`), no colour booked inside 48 hours of a skin test (a tool refusal, not a guardrail).

## Checked for gaps

- **"By law" is a claim.** The deposit is kept under the owner's policy, never "the law says"; the 14-day question is open (Decisions for Alex).
- **A no-show fee bigger than the deposit is risky.** Keeping more than covers the loss can be an unfair term; the demo keeps the deposit and nothing more.
- **The same cut is the same price for anyone.** Gender-based pricing for the same service is unlawful; a "women's cut" priced higher than the identical men's cut is never suggested.
- **The skin test can't be skipped on the phone.** "I've had it done elsewhere" isn't the shop's test; the owner's rule decides, and the gap is enforced in code, not left to the model.
- **A barber's absence is private.** "He's off today" and no more: never "he's ill".
- **A walk-in wait is an estimate, never a booking.** Only a booked slot is held.
- **Children have no legal minimum age for a haircut**; the adult rule is the owner's policy, said as such.
