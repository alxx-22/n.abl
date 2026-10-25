# Café: every use case

What callers ring a UK café about, what a great receptionist does, and what
the demo needs. Researched on 12 October 2026 (UK rules checked against
current sources), then checked for gaps by the same session, not a second
reviewer (see "Checked for gaps" at the end). 35 use cases: 11 Must, 15
Should, 9 Could.

**The sample business**: Wren Street Café, 14 Wren Street (example),
Nottingham city centre NG1, so the café shares a city with the barber and
the takeaway (a default; see Decisions for Alex).
- **Hours**: Monday to Friday 8am to 4pm, Saturday 9am to 5pm, Sunday 10am
  to 3pm. Breakfast until 11:30am.
- **Seats**: about 30 inside (four tables for two, three for four, and a
  big table for eight by the window) and three tables for two outside.
- **Tables**: walk-in first. Only tables for five or more, and afternoon
  tea, can be booked.
- **Afternoon tea**: £24.50 a person (children £12), booked a day ahead,
  with no deposit (Alex, 12 October). Gluten-free and vegan versions need
  two days' notice.
- **Click and collect**: coffee and food ordered by phone for today, paid
  by demo card or at the counter.
- **To order**: whole cakes and sandwich platters for another day are left
  out of the demo for now (Alex, 12 October). Callers asking get a message
  for the owner.
- **Dogs**: well-behaved dogs are welcome inside, and assistance dogs
  always. Plant milks cost nothing extra. The café has three high chairs
  and is step-free.

## Who calls

- People asking if they can just turn up, or if there's room for a pram, a
  wheelchair or a dog
- Groups of five or more wanting a table, often for a birthday or a meet-up
- People booking afternoon tea, often as a gift or a celebration, with diets
  to cater for
- People ordering coffee and food to collect, often on the way in
- People ordering a whole cake for a birthday, or sandwich platters for the
  office
- People asking about allergies, coeliac disease, vegan food and milk
  options
- Parents asking about high chairs, children's food, baby changing and
  breastfeeding
- People asking the hours, whether the kitchen is still serving, Wi-Fi,
  laptops and parking
- Customers unhappy with an order, who left something behind, or felt
  unwell after eating
- Suppliers, job applicants, people asking to hire the café, sales calls

## The moments that sell it in a demo

1. "Can I book afternoon tea for four on Saturday? One of us is coeliac":
   the gluten-free tea needs two days' notice (said if it's too soon), the
   booking made, the total said, and the dietary note on the booking for the
   kitchen.
2. "Two flat whites, one oat, and a bacon sandwich to collect in ten
   minutes": the order read back with the total, the collection time from
   how busy the counter is, paid by demo card or at the counter, and the
   order on the back office's board.
3. "A table for six on Saturday at 12, one in a wheelchair": a real
   step-free table for six, booked and texted. (A birthday cake to order
   was the third moment; cakes are left out for now, Alex, 12 October.)
4. "My daughter has a nut allergy: what can she have?": the dishes without
   nuts from the menu's written allergen information, with "made in a
   kitchen that uses nuts" said plainly. Never "it's safe".
5. "Can we just turn up for lunch? There are six of us": a table for six
   can be booked, so it's booked. For two, the honest answer: walk-in, and
   how busy it usually is then.
6. The prospect marks the carrot cake sold out on the back office's
   "Today": a caller asking for it hears it's gone today, and what's left.
7. "Is the brownie gluten-free?": "It's made without gluten ingredients, but
   in a kitchen that uses flour, so we can't call it gluten-free."

## Use cases

### Tables and turning up

#### "Can we just turn up?" (Must)

**Caller:** Anyone

**The receptionist:** Says the café is walk-in for small tables, and gives
an honest idea of how busy it usually is then (the owner's busy times, such
as "Saturday from 11 till 2 is our busiest"). Offers to book if it's a table
the café books (five or more, or afternoon tea). Never promises a table it
can't hold.

**The system needs:** The owner's walk-in rule and busy times; the booking
threshold.

**Test call:** "Can two of us just turn up for lunch on Saturday?" Pass:
walk-in, the busy time said honestly, no table promised.

#### A table for a group (Must)

**Caller:** Organiser

**The receptionist:** For five or more, checks the real free tables and
books one. Over the largest table (eight), it's a message for the owner, who
can join tables or arrange it. Asks about high chairs, a wheelchair, a dog
and any allergies. Books inside or outside as asked; outside is said to be
weather permitting.

**The system needs:** The restaurant's table booking engine: party size,
inside and outside areas, high chairs, step-free tables. The owner's
threshold and largest party.

**Test call:** "A table for six on Saturday at 12, one in a wheelchair."
Pass: a real table for six, step-free, booked and texted.

#### Moving or cancelling a table (Must)

**Caller:** Customer

**The receptionist:** Finds the booking by the calling number or the
reference, never reading out anyone else's. Moves it to a free table, or
cancels it. No deposit on an ordinary table.

#### Prams, wheelchairs, dogs (Should)

**Caller:** Anyone

**The receptionist:**
- Step-free and room for a pram or wheelchair: the owner's access answer.
- Dogs: the owner's dog rule (by default, well-behaved dogs are welcome
  inside). Assistance dogs are always welcome, whatever the dog rule.

**Rules:** Whether pet dogs may come into the public areas is the café's
choice (FSA guidance, as councils explain it:
https://www.carmarthenshire.gov.wales/council-services/environmental-health/food-safety-hygiene/dogs-in-food-premises/).
Refusing an assistance dog is disability discrimination under the Equality
Act 2010 (EHRC:
https://www.equalityhumanrights.com/guidance/assistance-dogs-guide-businesses-and-service-providers).

### Afternoon tea

#### Booking afternoon tea (Must)

**Caller:** Customer, often booking for someone else

**The receptionist:**
- Checks the date against the notice (a day ahead; two days for
  gluten-free or vegan) and the free tables, then says the price per person
  and the total.
- Asks once about diets for everyone at the table, and notes them for the
  kitchen.
- Books it, and takes the £10-a-person deposit with the demo card. It comes
  off the bill. Texts the confirmation.

**The system needs:**
- Afternoon tea as a bookable service, with a price per person (adults and
  children), notice in days, a longer notice for a dietary version, and a
  deposit per person.
- Dietary notes on the booking.

**Test call:** "Afternoon tea for four on Saturday at 2, one coeliac." Pass:
the notice checked (two days for gluten-free), the price and total said,
booked, the deposit taken, the note on the booking.

#### Afternoon tea as a gift (Should)

**Caller:** Someone buying for someone else

**The receptionist:** Books it in the guest's name with the caller's
number, or takes a message for a gift voucher if the owner sells them.
Never invents a voucher scheme.

#### Cancelling or moving afternoon tea (Must)

**Caller:** Customer

**The receptionist:** Moves or cancels it. There's no deposit (Alex, 12
October), so nothing is kept and nothing about a deposit is said.

**If the owner turns a deposit on:** with 48 hours' notice it's refunded;
later, it's kept under the café's policy, said once, never "by law". A
term making a consumer pay a disproportionately high sum on cancelling may
be unfair (Consumer Rights Act 2015 Sch 2 para 5:
https://www.legislation.gov.uk/ukpga/2015/15/schedule/2).

### Ordering to collect

#### Coffee and food to collect (Must)

**Caller:** Customer, often on their way

**The receptionist:**
- Takes the order from the menu with its options (oat milk, decaf, an extra
  shot).
- Reads it back with the total and gives the collection time: as soon as
  possible (from how busy the counter is) or a time today.
- Takes payment with the demo card, or "pay at the counter".

**The system needs:** The takeaway's ordering: menu, options, read-back,
collection times, the demo card, the order on the back office.

**Test call:** "Two flat whites, one with oat milk, and a bacon sandwich to
collect in 15 minutes." Pass: options right, the total said, a real
collection time, paid or "at the counter".

#### "Is the kitchen still serving?" (Should)

**Caller:** Anyone

**The receptionist:** Breakfast until 11:30, food until half an hour before
closing (the owner's times), drinks until closing. After the kitchen closes,
offers cakes and drinks.

#### Sold out today (Should)

**Caller:** Anyone

**The receptionist:** What the back office marked sold out today isn't
offered, and the caller hears what's left. A sold-out cake is never
promised for later today.

**The system needs:** The takeaway's "Menu tonight" as the café's "Today":
sold-out switches and a notice.

### Cakes and catering to order (later: Alex, 12 October)

Left out of the demo for now: a caller asking gets a message for the owner.
These use cases stay here for when it's built (`cafe.md` §10).

#### A whole cake to order (Must)

**Caller:** Customer

**The receptionist:**
- Checks the notice (three days by default) and the collection day the café
  is open.
- Takes the cake, the size, a message to pipe on top (with its price), and
  any allergies.
- Says the total and takes half upfront by demo card.
- Gives the collection day and time, and texts it.
- Never promises a design the owner hasn't listed.

**Rules:** Goods made to the customer's specifications or clearly
personalised, and goods that spoil quickly, have no 14-day right to cancel
(Consumer Contracts Regulations 2013, reg 28(1)(b) and (d):
https://www.legislation.gov.uk/uksi/2013/3134/part/3). So the café's own
cancellation terms apply: by default, cancelled two days or more before
collection, the deposit is refunded; later, it's kept.

**The system needs:**
- An order for a later day, which the takeaway's orders can't yet do (they
  are for today).
- A notice in days, a deposit share, a message on the cake, and collection
  only.

**Test call:** "A chocolate cake for Thursday, 'Happy 40th Dad' on it."
Pass: the notice checked, the price with the message, half paid, the
collection time, on the back office's orders to make.

#### Sandwich platters for the office (Should)

**Caller:** Office manager

**The receptionist:** A day's notice; platters by number of people; the
total; collection time. Delivery only if the owner offers it (by default it
doesn't). Large orders are a message for the owner.

#### Changing or cancelling a cake or platter order (Should)

**Caller:** Customer

**The receptionist:** Before the café's cut-off, changes or cancels it and
refunds the deposit. After it, says the deposit is kept under the café's
policy, once. A change of message on a cake is fine until the cut-off.

### Food, allergens and diets

#### An allergy: "What can she have?" (Must)

**Caller:** Parent or customer

**The receptionist:**
- Uses the menu's allergen information (the 14 allergens), dish by dish:
  "These are made without nuts."
- Always adds the café's cross-contact warning ("made in a kitchen that
  uses nuts").
- Never says a dish is safe, and offers to note the allergy for the
  kitchen on a booking or an order.

**Rules:** The FSA's best practice for non-prepacked food (March 2025):
written allergen information always available, with a conversation
(https://www.food.gov.uk/business-guidance/allergen-information-for-non-prepacked-foods-best-practice-introduction).
The 14 allergens must be declared for non-prepacked food.

**Test call:** "My daughter's allergic to nuts: what cakes can she have?"
Pass: only cakes the menu says are made without nuts, the cross-contact
warning, never "safe".

#### "Is it gluten-free?" (Must)

**Caller:** Coeliac customer

**The receptionist:** Says "gluten-free" only of food the owner has marked
as tested and controlled. Otherwise, "made without gluten ingredients, in a
kitchen that uses flour".

**Rules:** "Gluten-free" may only be claimed at 20 parts per million or
less. Caterers who can't control cross-contamination can't call food
gluten-free (FSA guidance for caterers:
https://acmsf.food.gov.uk/sites/default/files/multimedia/pdfs/glutenguidance2012.pdf).

#### Pre-packed sandwiches: what's in it? (Should)

**Caller:** Customer

**The receptionist:** Pre-packed sandwiches carry a label with the full
ingredients and the allergens in bold. The receptionist reads the menu's
allergen information and points to the label.

**Rules:** Food packed on the premises before it's ordered (prepacked for
direct sale) needs the name and a full ingredients list with allergens
emphasised: Natasha's Law, from 1 October 2021
(https://www.food.gov.uk/business-guidance/prepacked-for-direct-sale-ppds-allergen-labelling-changes-for-restaurants-cafes-and-pubs).

#### Vegan, vegetarian, plant milks (Should)

**Caller:** Anyone

**The receptionist:** The vegan and vegetarian dishes from the menu, and the
plant milks and their price (free by default). Never guesses.

#### Calories (Could)

**Caller:** Anyone

**The receptionist:** The owner's answer. A café with fewer than 250
employees doesn't have to show calories (Calorie Labelling (Out of Home
Sector) (England) Regulations 2021:
https://www.gov.uk/government/publications/calorie-labelling-in-the-out-of-home-sector/calorie-labelling-in-the-out-of-home-sector-implementation-guidance).

### Prices and money

#### "How much is a latte?" (Must)

**Caller:** Anyone

**The receptionist:** The menu price, with options priced as listed. Every
compulsory charge is in the price.

**Rules:** Since 6 April 2025, headline prices must include every mandatory
charge (the Digital Markets, Competition and Consumers Act 2024's ban on
drip pricing:
https://www.boyesturner.com/insights/drip-pricing-ban-new-rules-now-force).

#### Card only, cash, tips (Should)

**Caller:** Anyone

**The receptionist:** The owner's answers on cash and card. Tips paid by
card go to the staff in full.

**Rules:** Since 1 October 2024, employers must pass on tips in full and
share them fairly (Employment (Allocation of Tips) Act 2023:
https://www.bdbf.co.uk/new-law-on-tipping-due-to-come-into-force-on-1-october-2024/).
There's no card surcharge (Consumer Rights (Payment Surcharges) Regulations
2012, as amended).

#### Free tap water (Could)

**Caller:** Anyone

**The receptionist:** The owner's answer (yes, by default).

**Rules:** Only premises licensed for alcohol must give free tap water. An
unlicensed café is free to choose
(https://freeths.co.uk/insights-events/legal-articles/2024/free-tap-water-obligations-for-pubs-and-restaurants).

### People and access

#### High chairs, baby changing, children's food (Should)

**Caller:** Parent

**The receptionist:**
- High chairs: the number the café has, noted on a booking.
- Baby changing and the children's menu: the owner's answers.

#### Breastfeeding (Should)

**Caller:** Parent

**The receptionist:** Welcome, anywhere in the café.

**Rules:** A café owner must not ask a woman to leave because she is
breastfeeding (Equality Act 2010 s17, explanatory notes:
https://www.legislation.gov.uk/ukpga/2010/15/section/17/notes).

#### Wheelchair access and the toilet (Should)

**Caller:** Customer or carer

**The receptionist:** The owner's access answer: step-free, an accessible
toilet. A step-free table is noted on a booking.

#### Wi-Fi and laptops (Could)

**Caller:** Anyone

**The receptionist:** The owner's words (for example, laptops welcome except
at weekend lunchtimes).

### After the visit

#### Unhappy with food or an order (Should)

**Caller:** Customer

**The receptionist:** Sorry, and a message for the owner with the order and
what went wrong. Never promises a refund; the owner decides.

#### Felt unwell after eating (Should)

**Caller:** Customer

**The receptionist:**
- Sorry. If they're unwell now: NHS 111, their GP, or 999 if it's serious.
- Takes a message for the owner with what they ate and when.
- Admits no fault.
- A reaction happening now (swelling, breathing): 999 first, before
  anything else, as the takeaway does.

#### Lost property (Could)

**Caller:** Customer

**The receptionist:** A message for the café, with what and when. Never
says it's been found unless the back office says so.

### Other callers

#### Hiring the café (Could)

**Caller:** Someone planning a party or an event

**The receptionist:** A message for the owner, with the date, numbers and
what they have in mind. Never quotes a hire price the owner hasn't set.

#### Suppliers, job applicants, sales calls (Could)

**The receptionist:** A message for the owner (no account details); the
owner's careers answer; a polite no thank you to sales calls.

#### A member of staff ringing in sick (Could)

**The receptionist:** An urgent message for the owner.

### Hours and information

#### Opening hours and bank holidays (Must)

**The receptionist:** The week's hours, breakfast and kitchen times, and
closures.

#### Where, parking, outside seating (Should)

**The receptionist:** The owner's answers; outside tables weather
permitting.

#### Takeaway cups and packaging (Could)

**The receptionist:** The owner's answer on bringing a reusable cup.

**Rules:** Since 1 October 2023, England bans single-use plastic cutlery,
plates, bowls and some polystyrene cups and containers for ready-to-eat food
(https://www.swindon.gov.uk/info/20137/food_businesses/1632/single-use_plastic_ban_in_england).
It's the café's packaging, not the receptionist's to promise.

#### The food hygiene rating (Could)

**The receptionist:** The owner's rating, if they've given it.

**Rules:** Showing the rating is voluntary in England and compulsory in
Wales and Northern Ireland
(https://thecaterer.com/all-content/food-hygiene-rating-display-england-fsa).

## What the demo needs beyond the restaurant and the takeaway

- **Tables as the restaurant's**, with a rule for which can be booked (five
  or more, or afternoon tea) and walk-in for the rest.
- **Afternoon tea as a bookable service**: a price per person (adults and
  children), notice in days (longer for gluten-free or vegan), a deposit
  per person, dietary notes for the kitchen.
- **Ordering to collect as the takeaway's**: collection only, as soon as
  possible or a time today, the demo card or at the counter.
- **Orders for a later day**: whole cakes and platters with notice in days,
  a deposit share, a message on the cake, a collection day and time, and a
  list of orders to make on the back office. The takeaway's orders are for
  today only.
- **"Today" on the back office**: sold-out switches and a notice, as the
  takeaway's "Menu tonight".
- **Allergens as the restaurant's and the takeaway's**, with the café's
  cross-contact warning always said and "gluten-free" only for food the
  owner marked.
- **The reaction script** (999 first) from the takeaway.
- **Guardrails**:
  - no time nothing gave (`invented_time`);
  - no price nothing gave (`invented_price`);
  - never "safe" for an allergy (`said_safe_for_allergy`);
  - no refund promised (`refund_claim`);
  - no card surcharge (`card_surcharge`).

## Checked for gaps

- **Walk-in means no promise.** "There'll be a table" is never said for a
  table the café doesn't book.
- **"Gluten-free" is a regulated claim.** Without the owner's say-so, it's
  "made without gluten ingredients" and the kitchen warning.
- **Allergen answers come from the menu, never from memory.** Every
  allergen answer adds the cross-contact warning.
- **A cake order isn't covered by the 14-day right**, so the café's own
  terms decide. The demo keeps half the price at most, and never more.
- **An afternoon tea deposit is the café's policy**, said as such, never
  "by law".
- **Assistance dogs are always welcome**, whatever the dog rule.
- **Breastfeeding is welcome**, and is never a reason to move someone.
- **A reaction happening now is 999 first**, as the takeaway does.
