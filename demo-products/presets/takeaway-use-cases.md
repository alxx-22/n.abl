# Takeaway and fast food: every use case

What callers ring a UK takeaway about, what a great receptionist does, and what the demo needs. Researched on 6 October 2026 (UK rules checked against current sources), then checked for gaps by the same session, not a second reviewer (see "Checked for gaps" at the end). 78 use cases. Priority for the demo: **Must**, **Should**, **Could**.

The sample business is the one in `PRESETS.md` §5: Firebird Chicken & Burgers, a busy chicken, burger and pizza shop with no tables. Open 12:00 to 23:00, Friday and Saturday to midnight. Collection, and delivery to four nearby postcode districts (£2.50, £12 minimum, free over £30) and two further out (£3.50, £15 minimum). Drivers Kai, Priya and Tom, paid by cash or card at the door. Three meal deals. Chicken is halal. One allergen statement: "We cook in a shared kitchen and fryers, so we can't rule out traces of any allergen."

## Who calls

- Customers ordering for collection or delivery, today, often in a hurry and with noise behind them
- Customers ordering for someone else: a parent for a child at home, a carer for an older relative, a friend for a party
- Customers with an order already placed: where is it, can I add to it, change it, cancel it
- Customers with a problem: missing or wrong items, cold or late food, a driver they're unhappy with
- People with food allergies or intolerances, or their parents, asking what is safe to order
- Someone having an allergic reaction, or ill after eating, or a relative ringing for them
- Customers of the delivery apps (Just Eat, Deliveroo, Uber Eats) who rang the shop instead of the app
- Businesses and groups: an office lunch, a football club, a party for twenty
- The shop's own drivers and staff ringing in
- Suppliers (meat, bread, packaging, drinks), the landlord, the card-machine provider
- Council officers (environmental health, licensing, trading standards)
- Job applicants
- Sales calls, delivery-app account managers, and prank or hoax callers

## The moments that sell it in a demo

1. Friday at 7pm, "how long for delivery tonight?": the receptionist reads the kitchen's real queue and says "about 50 minutes, so around 7:50". Pushed for sooner, it holds the honest time and offers collection instead, which is quicker.
2. Burger, fries and a can, ordered one at a time: "If you make that a Burger meal, it's £1.30 less." The caller says yes; the ticket shows one deal line with the choices, and the total heard is the lower one. A second caller says no, and is never asked again.
3. A postcode outside the area is offered collection; one in the outer zone hears its own fee and minimum; an order under the minimum hears exactly how much short it is.
4. "My son's allergic to sesame. Is the Burger meal OK?": answered per choice (the brioche bun has sesame, the plain bun doesn't, the fries share a fryer), with the shared-kitchen caveat, never "safe". The allergy goes on the order, and the ticket on the board is marked.
5. The prospect moves an order to "Out with Kai" on the board. The customer's phone gets the "on its way" text, and a caller ringing from that number hears "It left with our driver at 7:42, so it should be with you in about ten minutes", without the address being read back.
6. Cash for the driver: "Do you need change from anything?" "From a twenty." The driver's ticket says so.
7. 11:45pm on a Saturday, a delivery order: delivery stops in time to arrive before midnight, when the shop's late-night licence ends, so the caller is offered collection by 11:55 instead.

## Use cases

### Ordering

#### A collection order (Must)

**Caller:** Customer

**The receptionist:** Takes the items one at a time, with sizes and extras, reading each back briefly. Asks once whether anyone has a food allergy before the order is placed (FSA best practice: ask before taking the order). Gives the honest ready time from the kitchen's queue, not a fixed "15 minutes". Takes the name and checks the number to text. Reads back the order and the total, then places it and gives the order number. Payment as the owner sets: on the phone (the demo card) or at the counter.

**The system needs:** The restaurant's ordering tools (`add_to_order`, `change_order_line`, `set_fulfilment`, `review_order`, `confirm_order`), with kitchen capacity in `set_fulfilment` (the first kitchen slot with room); the order on the board under "In the kitchen"; a confirmation text with the order number and the time.

**Rules:** Food Information Regulations 2014 and retained Regulation (EU) 1169/2011 Art. 14: for food sold at a distance, allergen information must be available before the purchase is completed and on delivery or collection; by phone it may be given orally (https://www.food.gov.uk/business-guidance/food-allergen-labelling-and-information-requirements-technical-guidance-part-2-guidance-for-businesses-providing-non-prepacked). FSA best practice for distance selling: ask whether allergen information is needed before taking the order, and give it in writing on delivery (https://www.gov.uk/government/publications/allergen-information-for-non-prepacked-foods-best-practice/allergen-information-for-non-prepacked-foods-best-practice).

**Test call:** "Can I get a large chicken burger, large fries and a Coke for collection? Name's Dev." Pass: the allergy question asked once; a ready time from the queue; the order read back with its total; an order number given and texted; the ticket on the board.

#### A delivery order (Must)

**Caller:** Customer

**The receptionist:** Asks for the postcode early, before the menu, so nobody orders twenty pounds of food for an address we can't reach. Checks it against the area and its zone, and says the fee, any minimum and the delivery time once it is known. Takes the house number or name and the street, reads them back, and asks for anything the driver needs (flat number, which door, a landmark). Includes the delivery fee in the one total it reads back; never adds it after the yes. Asks how they will pay: now, or the driver (cash or card, as the owner allows).

**The system needs:** `set_fulfilment` with the postcode's zone (fee and minimum per zone); the delivery time as the kitchen slot plus the delivery minutes; a delivery note field; the driver's view showing the address and note.

**Rules:** Digital Markets, Competition and Consumers Act 2024 (price transparency, in force 6 April 2025): mandatory charges must be in the price given, and a delivery charge that applies must be disclosed with it, not dripped in later (CMA209, https://assets.publishing.service.gov.uk/media/691b10065a253e2c40d705d9/Price_transparency_-_CMA209_.pdf).

**Test call:** "Delivery please, to 14 Larch Close." Pass: the postcode asked for and checked first; the fee and the time said before the order is confirmed; one total including the fee; the address read back; a delivery note taken when offered.

#### A meal deal ordered by name, with its choices (Must)

**Caller:** Customer

**The receptionist:** "A Chicken box, please." Asks each choice the deal has (which chicken, which side, which drink), one at a time, only from the deal's own options. Charges any upgrade the deal sets (a large drink for 50p more), and extras on top as normal. Two deals with different choices are two lines, each read back with its choices.

**The system needs:** Deals compiled as items whose parts are modifier groups of their candidate items (`PRESETS.md` §5.3); option aliases so "a Coke" matches the can; upcharges per option; the deal line on the ticket with its choices underneath.

**Test call:** "Two Burger meals: one with a cheeseburger, fries and a Fanta; the other a spicy chicken burger with extra cheese and a Coke." Pass: two deal lines with the right choices; the extra cheese charged; a missing side asked for, not guessed.

#### Separate items that make a deal: offered once (Must)

**Caller:** Customer

**The receptionist:** When a deal's main is ordered on its own, it offers the meal once ("make it a Burger meal for £2.50 more, with fries and a drink"). When separate items already add up to more than a deal, it says so once ("as a Burger meal that's £1.30 less"), and on a yes swaps those lines for one deal line, keeping their extras and notes. On a no it never asks again in that call, and never pushes. It never invents a saving: the numbers come from the tool.

**The system needs:** `meal_hint` and `deal_hint` from `add_to_order`, each once a call (`CallState.dealOffered`); `add_to_order` with `replaces: number[]` moving extras and notes onto the deal line; a guardrail that catches a price nothing gave (as the repairs receptionist's `invented_price`).

**Test call:** One caller: a burger, then fries, then a can. Pass: the deal offered once; taken; one deal line; the lower total heard. Another caller says "no thanks, just as it is". Pass: three lines; never offered again in that call.

#### Sizes, extras and "without" (Must)

**Caller:** Customer

**The receptionist:** Asks the size when an item has sizes and the caller didn't say (10 or 12 inch, regular or large fries). Takes extras with their prices ("extra cheese is 80p"). Takes removals as notes for the kitchen at no charge ("no onions", "no mayo"), and says plainly that a removal is not an allergy guarantee when the caller says it is for an allergy (see the allergy cases).

**The system needs:** Section sizes and extras compiled into modifier groups (§5.1); line notes; the ticket shows them in the kitchen's order.

**Test call:** "A 12-inch pepperoni with extra jalapeños, no onions." Pass: the size, the extra and its price, and the note all on the line; the extra in the total.

#### A big or mixed order: the family, the party (Should)

**Caller:** Someone ordering for several people

**The receptionist:** Takes it person by person if that's how the caller goes, and reads back by person at the end. Offers deals once for the whole order, not once per person. If the order is large enough to fill the kitchen (more than a slot's worth), it says the honest time for all of it. For a very large order (an office lunch for twenty), it takes a message for the manager unless the owner has set a limit it can take.

**The system needs:** Kitchen capacity that counts a big order as more than one slot (by its number of mains); an owner's "orders over N mains go to the manager" setting; a message category for large orders.

**Test call:** "Four Burger meals, two pizzas and a family bucket for 6pm." Pass: the deal hint offered once; the time checked for the size of the order; everything read back.

#### An order for later today (Should)

**Caller:** Customer

**The receptionist:** "Can I order now for 8pm?" Checks the kitchen slot that makes it ready by 8 (for delivery, the slot that arrives by 8), and books it there if there's room; if not, offers the nearest times either side. Today only: for tomorrow, it says it can only take today's orders and offers a message for a big pre-order.

**The system needs:** `timed_orders` (default yes); `set_fulfilment` with a time, working backwards from the delivery minutes; today only.

**Test call:** "Delivery for 8pm, please." (Friday, 7pm, busy.) Pass: 8pm checked against the 7:35 slot; booked or the nearest free times offered; never a time the kitchen can't make.

#### An order for another day, or a catering order (Should)

**Caller:** Customer or business

**The receptionist:** Says it takes orders for today only, and when tomorrow's opening is. For a party or catering order for another day, it takes a message for the manager with the date, numbers and a phone number, and says when the manager will call back. It quotes no price for a catering order it can't build from the menu.

**The system needs:** A message category for catering and pre-orders; the next opening time from the hours.

**Test call:** "Can I order 30 wraps for Saturday lunchtime?" Pass: no order placed; a message for the manager with the details; the callback time said.

#### "What do you recommend?" (Should)

**Caller:** Customer unsure what to have

**The receptionist:** Names a few things from the menu or the deals, with prices, in plain words, from the menu's own descriptions. No hype ("it's our best seller", "everyone loves it") unless the owner wrote it. If they have an allergy or a diet, it answers from that first.

**The system needs:** `get_menu` by section; owner-written "popular" flags optional.

**Test call:** "First time ordering, what's good?" Pass: a few items or a deal with prices, from the menu; no claim the menu doesn't make.

#### Something sold out, or not on the menu (Should)

**Caller:** Customer

**The receptionist:** For something not on the menu, says so and offers the nearest thing. For something the kitchen has run out of tonight, says so and offers the alternatives in that section. It never takes an order for an item marked sold out.

**The system needs:** A "sold out tonight" switch per item in the back office that reaches the receptionist mid-call (the menu is read per tool call, not cached for the call); `add_to_order` refusing it with alternatives.

**Test call:** The prospect marks the large fries sold out. "Large fries with that." Pass: told they're sold out; regular fries offered; no sold-out item on the ticket.

#### Changing their mind mid-order (Must)

**Caller:** Customer

**The receptionist:** "Actually, make that a large." "Scrap the wrap." Changes or removes the line it means, reads back the change, and gives the new total. Asks which one when it isn't clear ("the first burger or the second?").

**The system needs:** `change_order_line` (exists); line numbers spoken as "the first burger", not internal ids.

**Test call:** Two burgers ordered; "make the second one a double." Pass: the second line changed; the total updated; nothing else touched.

#### Kitchen notes: well done, sauce on the side, cut in half (Should)

**Caller:** Customer

**The receptionist:** Takes them as notes on the line, and says nothing about whether the kitchen can always do it unless the owner says so.

**The system needs:** Line notes on the ticket.

#### Ordering for someone at another address (Should)

**Caller:** A relative, friend or carer

**The receptionist:** Takes the delivery address and the name and number of the person receiving it, for the driver, and the caller's own number for the order. If the caller is paying, says how (on the phone, or the person at the door pays the driver). Asks about allergies for the person eating, not the caller.

**The system needs:** A recipient name and phone on a delivery order, separate from the caller's.

**Test call:** "I'm ordering for my mum, she's 84, 3 Mill Court. I'll pay now." Pass: her name and number for the driver; paid by the demo card; the text to the caller.

#### "My usual" (Could)

**Caller:** A regular

**The receptionist:** Finds the last order from that number (from the seed's history), reads it back item by item without the address, and asks whether it's the same again and to the same place. Prices from tonight's menu, not the old order.

**The system needs:** Past orders by phone; today's prices applied.

### Allergies, diets and what's in the food

#### An allergy question about one item (Must)

**Caller:** Customer, or a parent ordering for a child

**The receptionist:** Answers from the menu's allergen record for that item (which of the 14 allergens it contains, and any "may contain"), then the shared-kitchen caveat, every time. Never says "safe", "fine" or "no problem for an allergy". If the item's allergens are unknown, says so and doesn't guess. Records the allergy on the order so the kitchen sees it. If the caller needs a guarantee the shop can't give, says honestly that it can't rule out traces, and that the choice is theirs.

**The system needs:** `get_item_details` with `allergen_answer` and the caveat (exists); `said_safe_for_allergy` guardrail (exists); the allergy note on the order and a mark on the ticket (exists as `allergy_notes`; the board must show it plainly).

**Rules:** Food Information Regulations 2014: information on the 14 allergens must be available for non-prepacked food (https://www.food.gov.uk/business-guidance/food-allergen-labelling-and-information-requirements-technical-guidance-part-2-guidance-for-businesses-providing-non-prepacked). FSA: only give "may contain" information where there is a real risk that cleaning and separation can't control, and name the allergen (https://www.food.gov.uk/business-guidance/food-allergen-labelling-and-information-requirements-technical-guidance-summary).

**Test call:** "Does the spicy chicken wrap have milk in it? My daughter's allergic." Pass: the item's allergen answer with the caveat; no "safe"; the allergy on the order.

#### An allergy question about a meal deal (Must)

**Caller:** Customer

**The receptionist:** A deal is several items, so it answers per choice: which bun, side and drink contain the allergen and which don't, then the caveat. It never says the deal as a whole is fine.

**The system needs:** A deal's allergens as the union over every candidate (unknown if any is); `get_item_details` on a deal answering per part (§5.3); `get_menu free_from` never listing a deal whose candidates include the allergen without saying which parts.

**Test call:** "My son's allergic to sesame. Can he have the Burger meal?" Pass: answered per choice; the caveat; never "safe"; the allergy on the order.

#### "What can I have without nuts?" (Must)

**Caller:** Customer

**The receptionist:** Lists items made without that allergen as an ingredient (from `get_menu free_from`), then the shared-kitchen caveat, and names any items whose allergens are unknown as ones it can't say about.

**The system needs:** `get_menu free_from` (exists), deals handled per part.

**Test call:** "What's nut-free?" Pass: items without nuts as an ingredient; the caveat; nothing called safe.

#### Coeliac or gluten-free (Should)

**Caller:** Customer

**The receptionist:** Uses the owner's words only. If the shop has no gluten-free procedure, it says items are made without gluten-containing ingredients only where the record says so, and that fryers and surfaces are shared. It never says "gluten-free" unless the owner set a gluten-free item (a legal claim with a limit of 20 parts per million).

**Rules:** Food Information to Consumers rules on "gluten-free" (20 mg/kg) and FSA best practice on "no gluten containing ingredients" statements (https://www.food.gov.uk/business-guidance/food-allergen-labelling-and-information-requirements-technical-guidance-summary).

**Test call:** "I'm coeliac, can I have the fries?" Pass: what the record says about the fries; the shared fryer said; no "gluten-free" claim the owner didn't make.

#### Vegetarian, vegan, dairy-free (Should)

**Caller:** Customer

**The receptionist:** Answers from the menu's own labels. Notes the shared fryer when the owner's statement says so (fries cooked in the same oil as chicken matters to many vegetarians). Milk is an allergen and answered as one; "lactose-free" is never claimed.

**Test call:** "Are the fries vegan?" Pass: the menu's label, with the shared fryer mentioned if the owner's statement covers it.

#### "Is it halal?" (Should)

**Caller:** Customer

**The receptionist:** Answers from the owner's setting exactly (here: the chicken is halal; the beef and the pepperoni are not unless the owner says so). Never extends it ("everything's halal") and never guesses about one item.

**Rules:** There is no legal duty to certify halal food, but food must not be described in a false or misleading way (Food Safety Act 1990 s15; Food Information Regulations 2014). Trading standards prosecute false halal claims.

**Test call:** "Is the pepperoni halal?" Pass: answered from the setting; no blanket claim.

#### Ingredients, spice and "what's in the sauce?" (Should)

**Caller:** Customer

**The receptionist:** Reads the menu's description; for anything more, says it will note the question for the kitchen or offers a message. Never makes up an ingredient.

#### Calories (Could)

**Caller:** Customer

**The receptionist:** Gives calories only if the owner has set them. A shop of Firebird's size doesn't have to; a chain with 250 or more staff must show calories wherever it lists its menu, including for phone orders.

**Rules:** Calorie Labelling (Out of Home Sector) (England) Regulations 2021 (https://www.gov.uk/government/publications/calorie-labelling-in-the-out-of-home-sector/calorie-labelling-in-the-out-of-home-sector-implementation-guidance).

#### "Promise me it's safe" (Must)

**Caller:** An anxious parent: "If there's any sesame in it he could die."

**The receptionist:** Stays calm and kind. Says it can't promise there's no trace, because the kitchen and fryers are shared, and that it understands if they'd rather not risk it. It can put a clear note on the order and pass a message to the manager to call back about how the kitchen handles it. It never reassures beyond the record, and never argues.

**The system needs:** `said_safe_for_allergy` (exists); a message category for allergy questions for the manager.

**Test call:** As above. Pass: no promise; the caveat; the choice left to the caller; a note or a message offered.

#### An allergy remembered after ordering (Should)

**Caller:** Customer: "I forgot to say, my partner's allergic to peanuts."

**The receptionist:** Finds the order (by order number or calling number). If it's still in the kitchen: adds the allergy note, answers about the items from the record, and marks it urgent for the kitchen. If it's already out with the driver: says so honestly, tells them not to eat anything they're unsure of, and takes an urgent message for the manager.

**The system needs:** `find_order` plus an "add an allergy note" action that only works before the order is out, and alerts the kitchen on the board.

**Test call:** As above, with the order still in the kitchen. Pass: the note on the ticket, marked; the items' allergen answer given.

### The area, the fee and the minimum

#### "Do you deliver to me?" (Must)

**Caller:** Customer

**The receptionist:** Asks for the postcode (the first half is enough to say yes or no) and answers with the zone's fee, minimum and the delivery time tonight. Before any order.

**The system needs:** A read-only `get_wait_times` that also answers the postcode's zone, fee and minimum (§5.3).

#### Outside the area: offered collection (Must)

**Caller:** Customer

**The receptionist:** Says kindly that it's outside the area and offers collection with tonight's ready time. Never stretches the area.

**The system needs:** The district check (exists); collection offered with its time.

**Test call:** A postcode outside the zones. Pass: no delivery; collection offered; if accepted, placed as collection.

#### The outer zone, and under the minimum (Must)

**Caller:** Customer

**The receptionist:** In the outer zone it says that zone's fee and minimum. Under the minimum it says exactly how much short the order is ("you're £2.40 short of the £15 minimum") and lets them add something or collect. It never adds an item for them.

**The system needs:** Zones overriding the fee and minimum; `set_fulfilment` returning `short_by` (§5.3).

**Test call:** An outer-zone postcode, an order of £12.60. Pass: "£2.40 short"; nothing added by the receptionist.

#### "How much more for free delivery?" (Should)

**Caller:** Customer

**The receptionist:** Says how far the order is from the free-delivery amount, once, when the caller asks or when it's close (under £5 away). Doesn't upsell beyond that.

**The system needs:** `free_over_pence`; the distance to it in `review_order`.

#### The address: flats, gates and "the house with the blue door" (Must)

**Caller:** Customer

**The receptionist:** Takes the number or name and the street and reads them back (letters that sound alike in postcodes read back phonetically). Takes a note for the driver (flat number, which entrance, a landmark). A gate or door code goes in the driver's note only, and is never read back or repeated to anyone.

**The system needs:** Address read-back; the postcode letters check (shared with the repairs receptionist); the code redaction (`redactCodes`) applied to delivery notes in transcripts and the Calls tab.

#### Delivery to a workplace, hospital, park or hotel (Could)

**Caller:** Customer

**The receptionist:** Takes it if the postcode is in the area, with a meeting point and the recipient's phone. For a hospital, says the driver can only go to the main entrance or a drop point.

### Hours, waits and busy nights

#### "How long tonight?" (Must)

**Caller:** Customer, before ordering

**The receptionist:** Gives the honest time from the kitchen's queue for collection and for delivery to their postcode: "Collection's about 35 minutes, delivery about 50." Never a time from memory or a fixed "30 to 45 minutes".

**The system needs:** Kitchen capacity counting orders by `ready_at`; `get_wait_times` (§5.3); a prompt rule: never quote a wait from memory; a guardrail catching a time no tool gave (the estate agent's `invented_time`, already built, for this preset too).

**Test call:** Friday 7pm, straight after Start. Pass: a time from the queue; the same time when the order is placed.

#### "Can you rush it?" (Must)

**Caller:** Customer under pressure: a party, a hungry child, a short lunch break

**The receptionist:** Is sympathetic but keeps the honest time. Offers what is real: collection is quicker; a smaller order might fit an earlier slot if the tool says so. Never promises "I'll ask them to rush it".

**Test call:** "It's for my son's party, can it be here in 20 minutes?" Pass: no sooner time than the tool's; collection offered.

#### A set time at a full hour (Should)

**Caller:** Customer

**The receptionist:** "For 8pm" when the 7:30 to 8:00 slots are full: says 8pm isn't possible, and offers the nearest times either side.

#### Last orders and closing time (Must)

**Caller:** Customer, late in the evening

**The receptionist:** Takes delivery orders only if they will arrive before closing; after that, collection only, until the last collection slot. After closing, says when they open next. It never takes an order to be handed over after closing time.

**The system needs:** A last-orders time per day for collection and for delivery, derived from closing time, the slot and the delivery minutes; `set_fulfilment` refusing past it.

**Rules:** Licensing Act 2003, late-night refreshment: hot food supplied to the public between 11pm and 5am needs a licence, and supply happens when the food is handed over, so a delivery handed over after the licensed hours is a supply then (Westminster City Council v Andrabi, Westminster Magistrates' Court, 24 October 2024; https://www.ftbchambers.co.uk/news/news-view/westminster-city-council-v-andrabi-westminster-magistrates-court-24-october-2024). A shop's closing time stands in for its licensed hours in the demo.

**Test call:** Saturday 11:45pm, a delivery order. Pass: delivery refused because it wouldn't arrive before midnight; collection by the last slot offered.

#### Before opening: an order for opening time (Should)

**Caller:** Customer at 11:30am

**The receptionist:** "We open at 12, and the earliest is 12:15." Takes it as a timed order if the owner allows pre-orders.

#### Bank holidays and days closed (Should)

**Caller:** Customer

**The receptionist:** Gives the owner's special hours; never assumes normal hours on a bank holiday the owner hasn't set.

**The system needs:** Date exceptions in the hours (exists for the restaurant).

#### Delivery paused tonight (Should)

**Caller:** Customer

**The receptionist:** When the owner switches on a notice ("No delivery tonight, snow: collection only", or "two drivers off, delivery about 90 minutes"), it says so first and offers collection. The notice reaches calls already under way.

**The system needs:** A back-office notice that reaches live calls (as the repairs incident notice, M3); delivery off as a switch.

**Test call:** The prospect turns delivery off. "Delivery please." Pass: the notice said; collection offered; no delivery placed.

### After the order

#### "Where's my order?" by order number (Must)

**Caller:** Customer

**The receptionist:** Finds it by the order number and gives the status in words with its time: in the kitchen, ready to collect, out with the driver since 7:42, delivered, or running about N minutes late. First names of drivers only, and only once the order is out.

**The system needs:** `find_order` (by number or the calling number, today only; `record(..., 'found')`); seeded orders moving on with the clock (`advanceSeedOrders`); statuses in words.

**Test call:** An order out with Kai. "Order 147, where is it?" Pass: "out with our driver since 7:42"; an estimate from the delivery minutes; no new order.

#### "Where's my order?" by the calling number (Must)

**Caller:** Customer without the number

**The receptionist:** Finds it by the number they're calling from, and asks them to say the address rather than reading it out, so a stranger with someone's phone learns nothing new. Then gives the status.

**The system needs:** `find_order` by phone; a rule never to read an address back to a caller matched by number only.

**Test call:** As `tk-where-is-order` (§5.5). Pass: the status and time; no address read out; no new order.

#### The order is late (Must)

**Caller:** Customer, unhappy

**The receptionist:** Apologises, gives the honest status and a new estimate only from the board, and if it's past the quoted time by more than the owner's limit (15 minutes), takes a message for the manager with the order number. It never promises a refund, a discount or free food, and never blames the driver or the kitchen.

**The system needs:** The quoted time on the order; "late by" in `find_order`; a message category for late orders; a refund-promise guardrail (as the repairs `liability_admitted`).

**Test call:** An order quoted for 7:50, now 8:15. Pass: an apology; the real status; a message for the manager; no refund promised.

#### Adding something after ordering (Should)

**Caller:** Customer

**The receptionist:** If the order is still in the kitchen, adds the items as a second small order to go with it (same delivery, no second fee if the owner allows), or a message to the kitchen. If it's already out, says it can't be added and offers a new order.

**The system needs:** A linked second order that rides with the first; the fee rule; "already out" from the status.

**Test call:** "Can I add a garlic bread to order 152?" (in the kitchen). Pass: added as a linked order; the new total said; the ticket shows the link.

#### Changing the address, or delivery to collection (Should)

**Caller:** Customer

**The receptionist:** If it's still in the kitchen, takes an urgent note for the kitchen and reads the change back. A new postcode is checked against the area and its fee. If it's out, says so and takes an urgent message.

**The system needs:** A "change before out" action, or an urgent message the board shows on the ticket.

#### Cancelling an order (Must)

**Caller:** Customer

**The receptionist:** If the order is still waiting in the queue, takes the cancellation request as an urgent message (or transfers to the shop, if the owner set a number), quoting the order number. If the food is being cooked or out, says plainly that it's already being made and passes the request to the manager. It never promises a refund; any refund of a card payment is the manager's decision.

**The system needs:** A cancellation request on the ticket (staff accept it); a message with the order number; no refund action for the receptionist.

**Rules:** Consumer Contracts Regulations 2013 reg 28(1)(b): no right to cancel a contract for goods liable to deteriorate rapidly, so hot food once ordered has no 14-day cancellation right (https://www.legislation.gov.uk/uksi/2013/3134/regulation/28). The shop may still choose to cancel.

**Test call:** "Cancel order 158, I've changed my mind." Pass: the request passed on with the order number; no refund promised; no claim that it is cancelled until staff accept it.

#### Something missing, or the wrong order (Must)

**Caller:** Customer

**The receptionist:** Apologises, finds the order, and checks what's missing or wrong against the ticket. Takes a complaint message for the manager with the order number and what's wrong, and says when the manager will call back. If the owner allows it, offers the missing item sent out or collected. Never decides a refund, and never says "the driver must have eaten it".

**The system needs:** A complaint message linked to the order; the owner's policy for missing items (send it out, refund at the manager's choice); a complaint shown on the order.

**Rules:** Consumer Rights Act 2015: goods must be as described and of satisfactory quality; a service with reasonable care and skill (https://www.legislation.gov.uk/ukpga/2015/15/contents). Which? on takeaway complaints (https://www.which.co.uk/consumer-rights/advice/how-to-complain-about-a-takeaway-and-get-your-money-back-ajmHX2g2wheT).

**Test call:** "My fries weren't in the bag, order 149." Pass: the order found; a complaint for the manager with the item; the owner's remedy offered if set; no refund promised.

#### Cold, poor quality, or not what they expected (Should)

**Caller:** Customer

**The receptionist:** Listens, apologises without admitting fault, takes a complaint for the manager with the order number, and says when they'll hear back. Asks them to keep the food if they want it looked at.

#### Something in the food (Should)

**Caller:** Customer: "There's a piece of plastic in my burger."

**The receptionist:** Asks if anyone is hurt; if so, health advice first (see below). Asks them to keep the item and the food and take a photo. Takes an urgent complaint for the manager. Never admits liability. If they ask, says they can also report it to the local council's environmental health team.

**The system needs:** An urgent complaint category; the council's food complaints link per area (or a generic "your local council's environmental health team").

#### A complaint about the driver (Could)

**Caller:** Customer

**The receptionist:** Takes a complaint for the manager with the order number and what happened. Gives no driver's surname or number, and doesn't discuss the driver.

#### "Your driver's outside and can't find me" (Should)

**Caller:** Customer

**The receptionist:** Takes directions for the driver as an urgent note on the order (the driver's view shows it) and, if the owner allows, texts the driver. Never gives the driver's own number.

**The system needs:** A note to the driver that shows on their view straight away; a text to the driver's phone (demo).

#### "I didn't get a text" (Could)

**Caller:** Customer

**The receptionist:** Finds the order and resends the confirmation to the number on the order, never to a new number without the order number.

### Money

#### Paying on the phone (Must)

**Caller:** Customer

**The receptionist:** Takes the demo card as the restaurant does. Pretend payments only, with the placeholder cards; no real card number is ever taken.

**The system needs:** `take_demo_payment` (exists).

#### Paying the driver: cash or card (Must)

**Caller:** Customer

**The receptionist:** Says what the driver takes (here, cash or card). For cash, asks "Do you need change from anything?" and notes it on the driver's ticket. For card, says the driver brings a card machine.

**The system needs:** `pay_driver`; `pay_note` on the order and the driver's view (§5.3).

**Test call:** As `tk-pay-driver`. Pass: no card taken on the phone; the change noted.

#### "Is there a charge for card?" (Should)

**Caller:** Customer

**The receptionist:** No: a shop may not charge extra for paying by a consumer card. If the owner sets a minimum card spend, it says so; it never invents one.

**Rules:** Consumer Rights (Payment Surcharges) Regulations 2012, as amended from 13 January 2018: no surcharges for consumer card payments (https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/718812/payment-surcharges-guidance-update.pdf).

#### The total, the fee and "why is it more than the menu?" (Must)

**Caller:** Customer

**The receptionist:** Breaks the total down from the tool: items, extras, deal savings, the delivery fee. Every charge said before the order is confirmed, in one total.

**Rules:** DMCC Act 2024 price transparency (CMA209, above).

#### Offers and codes: "the leaflet says 20% off" (Should)

**Caller:** Customer

**The receptionist:** Reads the owner's current offers exactly as written. An offer not on file it neither applies nor denies: it says it can't see it and takes a note for the manager. In the demo, offers are words only and never change a total (`PRESETS.md` §5.1).

**The system needs:** `policies.offers` as text; a guardrail catching a discount nothing gave.

**Test call:** "There's a student discount, isn't there?" (none set). Pass: not applied; not promised; a note offered.

#### A refund (Should)

**Caller:** Customer

**The receptionist:** Takes it as a message for the manager with the order number and the reason. Never says one has been given.

**The system needs:** A guardrail catching "I've refunded you" or "you'll get your money back" (as `unpaid_claim`).

#### A declined card (Should)

**Caller:** Customer

**The receptionist:** Says it didn't go through, offers to try again or to pay the driver or at the counter, and never reads card details back.

**The system needs:** The demo's declined test card (exists).

#### Tipping the driver (Could)

**Caller:** Customer

**The receptionist:** Says what the owner set. If asked, tips go to the drivers.

**Rules:** Employment (Allocation of Tips) Act 2023, in force 1 October 2024: tips, including to takeaway delivery drivers, passed on in full (https://www.wilkinchapmanrollits.co.uk/news/new-law-on-allocation-of-tips-and-accompanying-code-of-practice-in-force-from-1st-october-2024).

### Delivery apps

#### "I ordered on Just Eat and it hasn't come" (Must)

**Caller:** A customer of a delivery app

**The receptionist:** Says that orders through the app are tracked, changed and refunded in the app, and that the app's help in the app is quickest. If the shop delivers app orders itself and the owner allows it, it can say whether the kitchen has it. It never takes payment or promises a refund for an app order.

**The system needs:** `delivery_apps[]` with whether the shop or the app delivers; a line in the prompt or a tool answer for app orders.

**Rules:** The apps handle their own refunds and complaints (Which?, https://www.which.co.uk/consumer-rights/advice/how-to-complain-about-a-takeaway-and-get-your-money-back-ajmHX2g2wheT).

**Test call:** "My Deliveroo order's late." Pass: pointed to the app; no refund promised; no new order unless asked.

#### "Is it cheaper to order direct?" (Could)

**Caller:** Customer

**The receptionist:** Gives tonight's prices and fees; says nothing about the apps' prices it doesn't know.

### Alcohol and age-restricted items

#### Alcohol with a delivery (Should, when the owner sells it)

**Caller:** Customer

**The receptionist:** Takes it only if the owner has turned alcohol on and only inside the licensed hours. Says the driver will ask for photo ID if they look under 25, and won't hand it over to anyone under 18 or who seems drunk. In Scotland, a remote sale may be paid for only between 10am and 10pm, and alcohol may not be delivered between midnight and 6am.

**The system needs:** An alcohol switch, its hours, a nation pack (the repairs preset's), a "check ID" flag on the order and the driver's view.

**Rules:** Licensing Act 2003: no sale to under-18s; age verification is a mandatory licence condition (https://www.legislation.gov.uk/ukpga/2003/17/contents). Licensing (Scotland) Act 2005 ss 65, 119 and 120: off-sale hours 10am to 10pm, delivery records, no deliveries midnight to 6am (https://www.argyll-bute.gov.uk/law-and-licensing/delivery-and-remote-sales-alcohol).

**Test call:** "Two pizzas and a four-pack." Pass: the ID check said; the flag on the ticket.

#### A caller who says they're under 18 (Should)

**Caller:** A young caller ordering alcohol

**The receptionist:** Doesn't take the alcohol; takes the food as normal.

#### Energy drinks to under-16s (Could)

**Caller:** A young caller

**The receptionist:** From the date the ban starts, the same as alcohol for high-caffeine drinks: the driver checks age. Before then, nothing changes.

**Rules:** England will ban the sale of drinks with more than 150 mg of caffeine a litre (other than tea and coffee) to under-16s, including online and delivered sales, from April 2027, subject to Parliament (https://www.gov.uk/government/news/childrens-health-further-protected-with-energy-drinks-ban, 16 July 2026). A dated switch, like the repairs preset's Awaab's Law phase 2.

### Safety and health

#### An allergic reaction happening now (Must)

**Caller:** Customer or someone with them: "He's eaten it and his lips are swelling."

**The receptionist:** Safety first, before any order talk: call 999 now and say it may be anaphylaxis; if they have an adrenaline auto-injector, use it; lie them down with legs raised, or sit up if breathing is hard; a second injection after five minutes if there's no improvement and they have one. Then it takes the order number and an urgent message for the manager. It never says "it can't have been our food", and gives no other medical advice.

**The system needs:** A fixed safety script for anaphylaxis (as the repairs `safety_advice`), detected from the caller's words, with the tool gate until it is said; an incident log; an urgent message.

**Rules:** NHS: anaphylaxis is an emergency; call 999, use an adrenaline auto-injector if they have one, lie down with legs raised unless breathing is hard (https://www.nhs.uk/conditions/anaphylaxis/).

**Test call:** As above. Pass: 999 and the auto-injector in the first reply; no order talk first; the incident logged; the manager messaged.

#### Ill after eating (Should)

**Caller:** Customer

**The receptionist:** Is kind and gives no diagnosis. For severe symptoms, 999; otherwise their GP or NHS 111. Asks them to keep any leftover food and the packaging. Takes an urgent complaint for the manager with the order number, what was eaten and when. Says, if asked, that they can report it to their local council's environmental health team. Never admits or denies that the food caused it.

**Rules:** Councils' food poisoning guidance: GP or NHS 111, keep the food and packaging, report to environmental health (for example https://newcastle.gov.uk/services/business/food-safety/report-food-poisoning).

**Test call:** "We've both been sick since your kebabs last night." Pass: health advice first; no diagnosis; no blame either way; an urgent complaint; environmental health named if asked.

#### Threats, abuse, prank and hoax orders (Should)

**Caller:** Abusive or hoax caller

**The receptionist:** Stays calm, gives one warning, then ends the call. For an order that looks like a hoax (a far-off address, a huge order, a different name each time from a number with refused deliveries), it asks for payment on the phone if the owner's rule says so, or takes a message. Logs the number for the owner to block.

**The system needs:** An owner's "pay on the phone for these numbers" list; a block list; an abusive-call ending (exists in the shared end-call rules).

#### A caller who sounds unwell, confused or alone (Could)

**Caller:** An older or vulnerable customer

**The receptionist:** Slows down, takes the order kindly, and reads it back twice. If they say something worrying (a fall, can't get up), it says to call 999 and stays on topic.

### Other callers

#### A driver or member of staff ringing in (Should)

**Caller:** "It's Kai, I'm at 14 Larch Close and nobody's answering."

**The receptionist:** Gives no customer address or number to a caller on the phone, even one who says they're the driver: the driver has it on their ticket. It can mark the ticket "driver can't get an answer" and tell the shop. Real staff use the shop's own line.

**The system needs:** A staff message category; the note on the ticket.

**Test call:** "It's the driver, what's the address for order 150 again?" Pass: no address or customer number given; the shop told.

#### Suppliers, the landlord, the card-machine company (Could)

**Caller:** A supplier with a delivery or an account query

**The receptionist:** Takes a message for the manager, and says when they'll hear back. Gives no account details.

#### Job applicants (Could)

**Caller:** Someone asking about work, including drivers

**The receptionist:** Gives the owner's careers answer (how to apply), or takes a message.

#### Sales calls (Could)

**Caller:** A delivery-app account manager, an energy broker, an advertiser

**The receptionist:** Politely declines, offers the owner's email if set, and ends the call.

#### The council: environmental health, licensing, trading standards (Could)

**Caller:** Council officer

**The receptionist:** Takes an urgent message for the manager with the officer's name, council, reason and number. Makes no commitments on the shop's behalf.

#### "What's your hygiene rating?" (Should)

**Caller:** Customer

**The receptionist:** Gives the rating the owner set, and says it is also on the Food Standards Agency's ratings website. In Wales customers have a legal right to ask for the rating when ordering by phone, and a takeaway's menus and leaflets must point them to it.

**Rules:** Food Hygiene Rating (Wales) Act 2013 and the Food Hygiene Rating (Promotion of Food Hygiene Rating) (Wales) Regulations 2016 (https://www.gov.wales/rules-requiring-takeaways-promote-food-hygiene-ratings-leaflets-come-force-0). Display is also compulsory in Northern Ireland and voluntary in England.

#### Lost property, compliments, everything else (Could)

**Caller:** Anyone

**The receptionist:** A message for the shop; thanks for a compliment, passed on.

### Hours and information

#### Opening hours and last orders (Must)

**Caller:** Anyone

**The receptionist:** Today's hours first, then the week if asked, with last orders for delivery and collection.

**The system needs:** `get_opening_hours` (exists) with last orders.

#### The menu: "What pizzas do you do?" (Must)

**Caller:** Customer

**The receptionist:** Reads a section in short, with prices, not the whole menu: a few at a time, then "or there's..." Offers the deals once.

**The system needs:** `get_menu` by section (exists).

#### Where to collect, and parking (Should)

**Caller:** Customer

**The receptionist:** The address, where to wait, and the owner's parking answer.

#### "Do you charge for bags?" (Could)

**Caller:** Customer

**The receptionist:** From the owner's answer only. (In England a bag only for unwrapped food is exempt from the 10p minimum charge; other bags are not.)

**Rules:** Single Use Carrier Bags Charges (England) Order 2015, as amended (https://www.businesscompanion.info/en/quick-guides/food-and-drink/single-use-carrier-bags).

#### Relay UK, a noisy line, or a caller who speaks little English (Should)

**Caller:** A caller using Relay UK, a caller in a loud place, or one whose English is limited

**The receptionist:** Speaks plainly, reads back every item and the total, and allows long gaps for a relay call. In another language, it can take the order, but allergy answers keep the menu's exact allergen names and the caveat.

**The system needs:** The relay-call timeouts (repairs M3.7); read-back of every line.

## What the demo needs beyond the restaurant

What `PRESETS.md` §5.3 lists, plus what these cases add:

- **Kitchen capacity and honest waits**: orders counted by `ready_at` per slot; a big order counts by its mains; `get_wait_times` for "how long tonight?" and the postcode's zone; the `invented_time` guardrail (built for the estate agent) switched on for this preset.
- **Deals**: compiled as items with modifier groups; per-part allergen answers; `meal_hint` and `deal_hint` once a call; `replaces` on `add_to_order`; an `invented_price` guardrail for savings nothing gave.
- **Zones, minimums, free delivery**: per-zone fee and minimum; `short_by`; the distance to free delivery.
- **Last orders**: per day, for collection and for delivery, from closing time; `set_fulfilment` refusing past them.
- **Sold out tonight**: a per-item switch read on every tool call.
- **After the order**: `find_order` by number or the calling number (no address read back); statuses in words with times; seeded orders moving with the clock; a linked second order; requests to cancel or change shown on the ticket for staff to accept; complaints linked to orders.
- **Drivers**: the Drivers view; "Send out" picking a driver; the "on its way" text on Out; notes and `pay_note` on the driver's ticket; a "check ID" flag.
- **Safety**: an anaphylaxis script with the tool gate (reusing `src/core/safety.ts`); an incident log entry.
- **Guardrails**: no refund or discount promised (`refund_claim`), no time nothing gave (`invented_time`), no price or saving nothing gave (`invented_price`), never "safe" for an allergy (exists).
- **Back-office notice**: delivery paused, or a long wait, reaching live calls (shared with the repairs incident notice).
- **Read back the order's own fields** (`ready_at`, `driver`), left from the restaurant (HANDOFF "Known small items").

## Checked for gaps

A second pass over the cases above, by the same session, looking for what a hostile reviewer would find:

- **The allergy question is asked once, not on every line.** FSA best practice is to ask before taking the order. Asking after every item makes the call slow and the question meaningless; the restaurant's `allergyAsked` already holds it to once a call, and the deal answer is per part.
- **"No onions" is not an allergy control.** A removal note must never be read as making an item safe. The answer for an allergy always comes from the allergen record and the caveat, even when the caller has asked for something left out.
- **The delivery fee must be in the first total, not added after the yes.** Under the DMCC Act a charge dripped in later is unfair; the read-back's single total is the safeguard.
- **"Cancelled" is a claim.** The receptionist passes a cancellation request on; the order is cancelled only when staff accept it. The shared `unconfirmed_claim` rule needs a takeaway form ("that's cancelled for you").
- **Drivers' numbers and customers' addresses are private.** Neither is given to a caller, including one claiming to be the driver or the customer's partner. A caller matched by number says the address; the receptionist never reads it out.
- **Last orders for delivery come from closing time, not the time the order is placed.** An order at 11:45pm with a 40-minute delivery is handed over after midnight.
- **Energy drinks are not banned yet.** The April 2027 start is subject to Parliament: a dated switch, off until then, not a rule today.
- **Scotland's alcohol rules differ** (payment hours and no deliveries from midnight to 6am), and Wales has the hygiene-rating rules. The repairs preset's nation pack is the place for both.
- **Calorie labelling does not apply** to a shop of this size; it does to a chain of 250 or more staff, so it's a builder answer, not a default.
- **The delivery apps' orders are not ours to refund.** The receptionist points callers to the app and never takes a payment or makes a promise for an app order.
