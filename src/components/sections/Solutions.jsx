import { Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'
import { WipeGrid } from '../WipeCard.jsx'
import { voice, chat, documents, office, copilot, knowledge, bespoke } from '../film/cards.js'

/* ============================================================
   03 — WHAT THIS CAN LOOK LIKE

   The customer-problem layer, carried over from the old six problem
   cards: each card leads with the sentence the owner would actually say,
   and wipes across to what we would build for it. What changed is what
   we build. n.abl is an AI implementation business now, and these are
   the places AI earns its keep in a small or mid-sized business.

   They are examples, not a menu. The first four are the products being
   built as demos (the voice agent, the chat agent, document reading, the
   back-office agent); the co-pilot and the knowledge assistant are the
   next most asked-for. The seventh card says the rest out loud: we build
   around the business, so the list is where a conversation starts rather
   than the limit of it.

   Each quote names one situation only one card answers, the rule the old
   problem cards were written to; a quote that could sit on three cards
   tells the visitor nothing about which is theirs.
   ============================================================ */
export const SOLUTIONS = [
  { n: '01', title: 'Voice receptionist', glyph: 'voice', scene: voice, label: 'Voice AI',
    quote: 'We miss calls whenever we’re busy.',
    body: 'An AI that answers your phone, day or night. It takes bookings, moves appointments, answers questions and tells you what happened.' },
  { n: '02', title: 'Chat and messaging', glyph: 'chat', scene: chat, label: 'Chat AI',
    quote: 'It’s the same five questions, all day.',
    body: 'Answers on your website and messaging apps in your tone, books people in, and hands over to a person when it should.' },
  { n: '03', title: 'Document AI', glyph: 'document', scene: documents, label: 'Document AI',
    quote: 'Someone types every invoice in by hand.',
    body: 'Reads invoices, forms and delivery notes, pulls out what matters and files it, with a person checking anything it is unsure of.' },
  { n: '04', title: 'Back-office agent', glyph: 'agent', scene: office, label: 'AI agent',
    quote: 'The admin eats our evenings.',
    body: 'Chases what is overdue, updates the records and prepares the numbers, and asks before anything goes out.' },
  { n: '05', title: 'Sales co-pilot', glyph: 'copilot', scene: copilot, label: 'Call co-pilot',
    quote: 'We lose deals on the call, not before it.',
    body: 'Listens in, transcribes and translates live, spots the objection and suggests what to say next.' },
  { n: '06', title: 'Knowledge assistant', glyph: 'answer', scene: knowledge, label: 'AI assistant',
    quote: 'The answer’s in there somewhere. Nobody can find it.',
    body: 'Answers your team’s questions from your own documents, and shows exactly where it found the answer.' },
  { n: '07', title: 'Built for you', glyph: 'bespoke', scene: bespoke, label: 'Your process', note: 'built around it',
    quote: 'Our business doesn’t fit a template.',
    body: 'Most of what we build starts with one job that eats time. If it is repetitive, rules-based or buried in paperwork, AI can probably take it on. We build it around how you already work, and we will tell you honestly if it can’t.' },
]

export default function Solutions() {
  return (
    <section id="what-we-do" className="section">
      <div className="shell">
        <Chapter index={2}>What it can do</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">What this can look like in your business<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            Which of these sounds familiar? None of them is a product off the shelf. Each is
            built around the way you already work, and each is where a conversation starts.
          </p>
        </Reveal>
        <WipeGrid items={SOLUTIONS} wide={['07']} />
      </div>
    </section>
  )
}
