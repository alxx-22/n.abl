/* ============================================================
   LEAD GEN — a placeholder that tells the truth

   Not built yet. It is here because the navigation should not
   rearrange itself the week it arrives, and because an empty tab that
   says what is coming is worth more than no tab at all.

   What it deliberately is NOT: a disabled button, or "coming soon".
   Somebody opening this in three weeks needs to know why it is empty
   and what has to happen first, and both of those are decided and
   written down rather than vague.

   The design, the guards and the compliance position live in
   business/10-lead-sourcing/ai-discovery.md. The short version is
   below, and the two are meant to agree — if you change one, change
   the other.
   ============================================================ */

/* The one thing a reader here is most likely to get wrong, so it is
   said first and said plainly. */
const RULED_OUT = {
  what: 'Search grounding is not the route',
  why: 'Asking a model to search the web for businesses and writing down what comes back breaches the Gemini API terms — Google’s own example of a violation is "using programmatic or automated means to collect Links, using Links to build an index". Grounded results also may not be stored or analysed, and must be shown to the person who submitted the prompt. A scheduled job has no such person and stores everything.',
}

const STEPS = [
  {
    n: 1,
    what: 'A second Google project, and its key',
    who: 'waiting on a person',
    why: 'Gemini’s free quota is per project and per model within it. On 16 September four of five models were exhausted before eleven in the morning with 97 leads still queued, so discovery sharing the writer’s key would be dead on arrival and would take the writer down with it. The key goes in Supabase → Edge Functions → Secrets as GEMINI_DISCOVERY_API_KEY, and nowhere else.',
    done: false,
  },
  {
    n: 2,
    what: 'The prospector',
    who: 'blocked on step 1',
    why: 'Reads register rows we already hold a lawful basis for — Companies House, ICO, FSA, CQC, the charity register — and argues for the ones worth writing to. That is the half a model is actually good at. Finding that a business exists was never the search engine’s job; a register does it lawfully.',
    done: false,
  },
  {
    n: 3,
    what: 'Source disclosure per lead',
    who: 'not started',
    why: 'Every letter’s footer currently says Companies House, because every lead came from there. Article 14 requires that sentence to be true for that lead, so a lead found through a different register needs its own branch. The mechanism exists — the footer already reads sales_leads.source — the branches do not.',
    done: false,
  },
]

/* Guards worth stating before anything is built, because the failure
   mode here is not an awkward sentence. */
const NEVER = [
  ['No contact route from a model. Ever.',
    'Not an email, not a phone number, not a domain. A model may say a business is worth looking at; it may not say how to reach them. An invented email address is the worst thing this system could produce and it is exactly what a model produces confidently.'],
  ['A company must resolve to a register row.',
    'The prospector selects from candidates. It does not conjure them.'],
  ['A website must be fetched and must mention the business.',
    'And directory domains are rejected outright — a Yell or Facebook page is not the business’s own site, and the scout would read the wrong thing off it.'],
  ['Nothing arrives contactable.',
    'marketing_status is do_not_contact, as the existing promotion script already does. Discovery is not approval.'],
]

export default function LeadGen() {
  return (
    <section className="lg" aria-label="Lead generation">
      <header className="lg-head">
        <h2>Lead gen</h2>
        <p>
          Pulling new businesses into the list, rather than working the 149 already in it.
          Not built yet — here is where it stands.
        </p>
      </header>

      <div className="lg-ruled">
        <u>{RULED_OUT.what}</u>
        <p>{RULED_OUT.why}</p>
        <p className="lg-ruled__note">
          Same ruling as the Google Maps correction already at the top of the sourcing
          notes, reached from the other end of the pipeline.
        </p>
      </div>

      <ol className="lg-steps">
        {STEPS.map((s) => (
          <li key={s.n} className={s.done ? 'is-done' : ''}>
            <span className="lg-steps__n" aria-hidden="true">{s.n}</span>
            <div>
              <h3>{s.what} <em>{s.who}</em></h3>
              <p>{s.why}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="lg-never">
        <u>Settled before a line of it is written</u>
        <dl>
          {NEVER.map(([what, why]) => (
            <div key={what}>
              <dt>{what}</dt>
              <dd>{why}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
