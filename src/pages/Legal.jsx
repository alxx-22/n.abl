import { Link } from 'react-router-dom'
import { Logo, Reveal } from '../components/ui/index.jsx'
import '../styles/legal.css'

/* Drafts only. Every document renders the review notice — these have not
   been reviewed by a solicitor and must not be relied on as-is. */
const LAST_UPDATED = '15 August 2026'

const DOCS = {
  privacy: {
    label: 'Privacy',
    title: 'Privacy Policy',
    intro:
      'How n.abl collects, uses and protects personal data, and the rights you have over it.',
    body: [
      ['Who we are', [
        'n.abl is an automation consultancy based in the United Kingdom. For the purposes of UK GDPR we are the data controller for the personal data described in this policy.',
        'You can reach us at hello@nabl.agency for any privacy question, including to exercise the rights set out below.',
      ]],
      ['What we collect and why', [
        'Enquiry details. When you submit the discovery-call form we collect your name, business name, email address, business type and whatever you tell us about your challenge. We use this solely to respond to your enquiry and arrange a call.',
        'Client records. If you become a client we hold your business name, contact name and contact email, together with the quotes, project records, meeting details and documents that make up our engagement.',
        'Team accounts. Our own staff sign in with an email address and password to administer the above.',
        'We do not run advertising or analytics tracking, we do not build behavioural profiles, and we do not sell or share personal data for marketing.',
      ]],
      ['Lawful bases', [
        'Legitimate interests — responding to an enquiry you sent us, and administering our own business records.',
        'Contract — where processing is necessary to deliver services we have agreed with you.',
        'Legal obligation — where we must retain records, for example for tax or accounting purposes.',
      ]],
      ['Service providers', [
        'Supabase — hosts our database, authentication and private file storage. Our project is hosted in the EU (eu-north-1).',
        'Web3Forms — delivers submissions from the discovery-call form to our inbox.',
        'Netlify — serves this website.',
        'Each acts as a processor on our instructions. We do not permit them to use your data for their own purposes.',
        'We do not load fonts, scripts or images from third-party content networks. Web fonts are served from our own domain specifically so that visiting the site does not disclose your IP address to another company.',
      ]],
      ['International transfers', [
        'Our database and file storage are hosted in the European Union. Where a provider processes data outside the UK or EEA, transfers rely on the UK International Data Transfer Agreement, the UK Addendum to the EU Standard Contractual Clauses, or an adequacy decision.',
      ]],
      ['How long we keep it', [
        'Enquiries that do not become engagements are deleted once the conversation has clearly ended.',
        'Client records are kept for the life of the engagement and then for as long as we need them for legal, tax and accounting purposes.',
        'Documents in the client portal are held in private storage and are only ever served through short-lived signed links, generated fresh each time and never stored.',
      ]],
      ['Your rights', [
        'You have the right to access your personal data, to have inaccurate data corrected, to request erasure, to restrict or object to processing, and to data portability. To exercise any of these, email hello@nabl.agency.',
        'If you are unhappy with how we have handled your data you can complain to the Information Commissioner’s Office at ico.org.uk, or by calling 0303 123 1113. We would appreciate the chance to put things right first.',
      ]],
      ['Security', [
        'Access to client records is restricted by row-level security so a portal user can only ever read their own data. Files are stored in private buckets rather than being publicly addressable. Access to our internal tools requires an authenticated staff account.',
      ]],
    ],
  },

  terms: {
    label: 'Terms',
    title: 'Terms of Service',
    intro: 'The terms on which n.abl provides consultancy and automation services.',
    body: [
      ['Services', [
        'We provide consultancy, automation and optimisation services, generally delivered within software platforms you already license. The specific scope of any engagement is set out in the quote or statement of work we agree with you.',
        'Nothing on this website is an offer capable of acceptance; it is an invitation to discuss work.',
      ]],
      ['Engagement and quotes', [
        'A quote sets out the scope, deliverables and price for a piece of work. Quotes are valid until the date stated on them. Work begins once you have accepted a quote in writing.',
        'Changes to scope will be agreed in writing and may affect price and timescales.',
      ]],
      ['Your responsibilities', [
        'You agree to provide timely access to the systems, data and people needed to deliver the work, and to ensure you hold the necessary licences and permissions for the platforms we are asked to work within.',
        'You are responsible for maintaining your own backups of business-critical data.',
      ]],
      ['Fees and payment', [
        'Fees are as stated in the accepted quote. Unless agreed otherwise, invoices are payable within 30 days. We may suspend work on overdue accounts.',
        'Prices exclude VAT unless expressly stated.',
      ]],
      ['Intellectual property', [
        'Your data, your content and your business records remain yours at all times. We claim no ownership over them.',
        'Bespoke configurations and automations built specifically for you transfer to you on payment in full.',
        'We retain ownership of our own pre-existing methods, tools and general know-how, and remain free to apply that expertise for other clients.',
      ]],
      ['Confidentiality', [
        'Each party agrees to keep the other’s confidential information confidential and to use it only for the purposes of the engagement. This obligation survives the end of the engagement.',
      ]],
      ['Warranties and disclaimers', [
        'We will perform our services with reasonable care and skill. We do not warrant that any system will be uninterrupted or entirely free of defects, nor do we warrant the performance of third-party platforms outside our control.',
        'Estimates of savings or efficiency gains are illustrative and are not guarantees of outcome.',
      ]],
      ['Limitation of liability', [
        'Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot lawfully be limited.',
        'Subject to that, we are not liable for indirect or consequential loss, or for loss of profit, revenue, data or anticipated savings; and our total liability arising from an engagement is limited to the fees paid by you for that engagement.',
      ]],
      ['Termination', [
        'Either party may end an engagement on reasonable written notice. You remain liable for work properly performed up to the termination date. Provisions that by their nature should survive termination will do so.',
      ]],
      ['Governing law', [
        'These terms are governed by the laws of England and Wales, and the courts of England and Wales have exclusive jurisdiction.',
      ]],
    ],
  },

  cookies: {
    label: 'Cookies',
    title: 'Cookie Policy',
    intro: 'What this site stores in your browser — which is very little.',
    body: [
      ['The short version', [
        'We use no advertising cookies, no analytics cookies and no third-party tracking cookies. Nothing on this site follows you around the internet, and there is no consent banner because there is nothing to consent to.',
      ]],
      ['What we do store', [
        'Team authentication session. If you are a member of the n.abl team and sign in to the internal team space, your browser stores an authentication session so you are not asked to sign in on every page. This is strictly necessary for the sign-in to function and is only ever set after you deliberately sign in.',
        'Client portal. The portal deliberately stores nothing. Your access key is held in memory for the length of your visit and is discarded the moment you close the tab or log out.',
      ]],
      ['Third parties', [
        'Submitting the discovery-call form sends its contents to Web3Forms so the message reaches our inbox. The site is served by Netlify. Neither is used to set tracking cookies on this site.',
      ]],
      ['Controlling storage', [
        'You can clear or block site data at any time through your browser settings. Blocking storage for this site will not affect the marketing pages; it will prevent the internal team sign-in from persisting between pages.',
      ]],
    ],
  },
}

export default function Legal({ doc }) {
  const d = DOCS[doc] || DOCS.privacy

  return (
    <div className="grain">
      <div className="app-top">
        <Link to="/" aria-label="n.abl home"><Logo size={22} /></Link>
        <Link to="/" className="app-back">← Back to site</Link>
      </div>

      <div className="shell legal">
        <Reveal><span className="eyebrow">{d.label}</span></Reveal>
        <Reveal delay={0.05}>
          <h1 className="legal__title">{d.title}<span className="dot" /></h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="legal__intro">{d.intro}</p>
        </Reveal>

        <Reveal delay={0.14}>
          <aside className="legal__notice" role="note">
            <strong>Draft — not yet reviewed.</strong> This document is a starting point
            drafted for n.abl, not legal advice. It must be reviewed and approved by a
            qualified solicitor before you rely on it or publish it as binding, and the
            &ldquo;last updated&rdquo; date below needs setting once it is.
          </aside>
        </Reveal>

        <div className="legal__body prose">
          {d.body.map(([heading, paras]) => (
            <section key={heading} className="legal__section">
              <h2>{heading}</h2>
              {paras.map((p, i) => <p key={i}>{p}</p>)}
            </section>
          ))}

          <section className="legal__section">
            <h2>Contact</h2>
            <p>
              Questions about this document? Email{' '}
              <a href="mailto:hello@nabl.agency">hello@nabl.agency</a>.
            </p>
            <p className="legal__updated">Last updated: {LAST_UPDATED}</p>
          </section>
        </div>

        <nav className="legal__nav" aria-label="Legal documents">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/cookies">Cookie Policy</Link>
        </nav>
      </div>
    </div>
  )
}
