import { voice, chat, documents, office, copilot, knowledge, bespoke } from '../film/cards.js'

/* ============================================================
   THE PRODUCTS — what AI can take off a business's hands

   One chapter each on the home page (sections/Products.jsx): the words
   on one side, and the product doing its job on the other, playing as the
   words are read. This replaces two things that said the same thing twice:
   the long See it work film, which ran three of these end to end before
   the rest of the page could be reached, and the grid of wipe cards that
   listed them again underneath.

   The copy is the cards' copy, carried over whole: the customer's own
   sentence, and what we would build for it. "Useful for" and "What you
   get" are new, and every line in them is drawn from words the site or
   business/03-website/assistant-knowledge.md already says: the film's
   captions, the cases' results, the assistant's descriptions. No number
   and no client appears, by the rules in business/03-website/copy-deck.md.

   They are examples, not a menu, in the order the assistant knows them.

   `side` is where the product's animation sits; the words take the other
   half. They pair up, staying on one side while one product leads into a
   related one (the phone into the chat, the paperwork into the admin)
   and crossing when the subject changes, so the light that carries one
   product into the next travels across the page only when the story does.

   scripts/build-knowledge.mjs reads the titles out of this file to check
   the site assistant knows every product the page shows: keep each title
   on one line, as a single-quoted string after the key.
   ============================================================ */
export const PRODUCTS = [
  {
    n: '01', id: 'voice', side: 'right', scene: voice,
    title: 'Voice receptionist', label: 'Voice AI',
    quote: 'We miss calls whenever we’re busy.',
    body: 'An AI that answers your phone, day or night. It takes bookings, moves appointments, answers questions and tells you what happened.',
    uses: [
      'Calls that come in while everyone is with a customer',
      'Evenings, early mornings and weekends',
      'Bookings, changes and cancellations',
      'Questions about orders, opening hours and prices',
    ],
    gets: [
      'Every call answered, in your tone',
      'The booking in the diary, with the deposit taken',
      'A note of what happened on every call',
      'A person can always take over',
    ],
  },
  {
    n: '02', id: 'chat', side: 'right', scene: chat,
    title: 'Chat and messaging', label: 'Chat AI',
    quote: 'It’s the same five questions, all day.',
    body: 'Answers on your website and messaging apps in your tone, books people in, and hands over to a person when it should.',
    uses: [
      'Your website chat, WhatsApp and Instagram',
      'Voice notes as well as typed messages',
      'Bookings, deposits and reminders',
      'Enquiries that arrive after hours',
    ],
    gets: [
      'An answer in seconds, at any hour',
      'Bookings made in the conversation',
      'A person brought in when it needs one',
    ],
  },
  {
    n: '03', id: 'documents', side: 'left', scene: documents,
    title: 'Document AI', label: 'Document AI',
    quote: 'Someone types every invoice in by hand.',
    body: 'Reads invoices, forms and delivery notes, pulls out what matters and files it, with a person checking anything it is unsure of.',
    uses: [
      'Supplier invoices and delivery notes',
      'Forms, applications and orders, in any layout',
      'Paperwork that arrives by email or as a photo',
    ],
    gets: [
      'What matters pulled out and filed where it goes',
      'Each one checked against its order',
      'Only the ones it is unsure of left for a person',
    ],
  },
  {
    n: '04', id: 'office', side: 'left', scene: office,
    title: 'Back-office agent', label: 'AI agent',
    quote: 'The admin eats our evenings.',
    body: 'Chases what is overdue, updates the records and prepares the numbers, and asks before anything goes out.',
    uses: [
      'Overdue invoices and reminders',
      'Keeping the records up to date',
      'Preparing the numbers each week',
    ],
    gets: [
      'The admin run every morning',
      'Nothing sent until you approve it',
      'A report back every week',
    ],
  },
  {
    n: '05', id: 'copilot', side: 'right', scene: copilot,
    title: 'Sales co-pilot', label: 'Call co-pilot',
    quote: 'We lose deals on the call, not before it.',
    body: 'Listens in, transcribes and translates live, spots the objection and suggests what to say next.',
    uses: [
      'Sales calls and video meetings',
      'Calls in another language',
      'The objections that come up every time',
    ],
    gets: [
      'A live transcript, translated as you talk',
      'The objection flagged while there is time to answer it',
      'A suggestion of what to say next',
    ],
  },
  {
    n: '06', id: 'knowledge', side: 'right', scene: knowledge,
    title: 'Knowledge assistant', label: 'AI assistant',
    quote: 'The answer’s in there somewhere. Nobody can find it.',
    body: 'Answers your team’s questions from your own documents, and shows exactly where it found the answer.',
    uses: [
      'The staff handbook, policies and procedures',
      'Terms, price lists and product details',
      'New starters finding their feet',
    ],
    gets: [
      'Answers from your own documents',
      'The source shown with every answer',
      'The same answer, whoever asks',
    ],
  },
  {
    n: '07', id: 'bespoke', side: 'left', scene: bespoke,
    title: 'Built for you', label: 'Your process',
    quote: 'Our business doesn’t fit a template.',
    body: 'Most of what we build starts with one job that eats time. If it is repetitive, rules-based or buried in paperwork, AI can probably take it on. We build it around how you already work, and we will tell you honestly if it can’t.',
    uses: [
      'Anything repetitive, rules-based or buried in paperwork',
      'Work that runs across several of your systems',
    ],
    gets: [
      'Built around how you already work',
      'An honest answer if AI is the wrong tool',
    ],
  },
]
