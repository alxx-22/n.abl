==========================================================
n.abl — BRANDED EMAIL TEMPLATE PACK
Innovation. Automation. Optimisation.
==========================================================

This pack contains six branded email templates, each delivered in two
formats:

  • .html  — the rich, branded version for email clients / browser preview
  • .txt   — a plain-text fallback for clients that block HTML

All templates follow the n.abl brand identity: warm espresso (#0E0C0A)
with a raised panel tone (#1A1613), cream text (#F0E7D8 body, #FBF6EC
headings), and a warm amber (#E9AC57) accent with a 4px amber signature
bar across the top. The n.abl logo is still rendered in pure HTML/CSS
(no images), with the square "dot" now amber.

On light card areas the palette shifts for legibility: ink (#14110E) for
body copy, a warm grey (#6B625A) for secondary text, and a deeper amber
(#B87718) for accents — plain amber does not carry enough contrast on a
near-white ground. Every template is checked with
`node scripts/check-email-contrast.mjs`, which renders each file in a
browser and measures the real composited colours; all six pass WCAG AA.

Each footer carries an unsubscribe token plus links to the privacy policy
and terms.


----------------------------------------------------------
1. WHAT EACH TEMPLATE IS FOR
----------------------------------------------------------

email-general    — GENERAL COMMUNICATION
                   Standard client updates, follow-ups, sending documents,
                   checking in. Your everyday workhorse email.

email-alert      — CUSTOMER ALERT
                   Time-sensitive notices: a deadline, a flagged issue, an
                   action or decision required. Includes a black alert
                   banner, a lime action box and a "Respond Now" button.

email-meeting    — MEETING INVITE / CONFIRMATION
                   Confirming a discovery call, review or any scheduled
                   touchpoint. Includes a details box, a prep checklist and
                   an "Add to Calendar" button.

email-proposal   — PROPOSAL / QUOTE DELIVERY
                   Sending a proposal, quote or scope of work after a
                   discovery call. Includes a "What's included" summary, an
                   indicative investment box and a "View Full Proposal"
                   button.

email-welcome    — ONBOARDING WELCOME
                   The first email after a client signs. Sets the tone:
                   a bold welcome banner, a 3-step "what happens next"
                   section, a dedicated-contact box and a portal button.

email-update     — PROJECT UPDATE
                   Regular progress updates during an active engagement.
                   Includes status rows (COMPLETE / IN PROGRESS / UPCOMING),
                   a "this week" box and an action-needed box.


----------------------------------------------------------
2. PLACEHOLDER VALUES TO REPLACE
----------------------------------------------------------

Search each file for square brackets [ ] and replace the values before
sending. Common placeholders across templates:

  [First Name]          — the recipient's first name
  [Your Name]           — the sender's name (signature)
  [Business Name]       — the client's company name (proposal)
  [Date]                — a relevant date (deadline, valid-until, due-by)
  [Day, Date Month Year]— full meeting date, e.g. "Tue, 9 June 2026"
  [00:00 AM – 00:00 AM] — meeting start/end time
  [Amount]              — indicative investment figure (proposal)
  [Month Year]          — reporting period (project update)
  [Meeting URL]         — video call / meeting link
  [Action Link]         — destination for the "Respond Now" button
  [Calendar Link]       — .ics / add-to-calendar link
  [Proposal Link]       — link to the hosted proposal document
  [Client Portal Link]  — link to the client portal (welcome)
  [Reply Link]          — usually mailto:hello@nabl.agency
  [Unsubscribe Link]    — your list provider's unsubscribe URL

Fixed brand values already filled in (no need to change):
  hello@nabl.agency  ·  www.nabl.agency  ·  © 2026 n.abl


----------------------------------------------------------
3. HOW TO PREVIEW THE HTML FILES IN A BROWSER
----------------------------------------------------------

  • Double-click any .html file, or right-click > Open With > your browser.
  • Or drag the file onto an open browser window.

What you should see: a centred 600px email card on a light grey page,
with the lime top bar, the n.abl logo, and lime/black accents. The lime
square should be visible on BOTH white (header/logo) and black (footer
logo) backgrounds.

The .txt files can be opened in any text editor (Notepad, VS Code, etc.).


----------------------------------------------------------
4. TECHNICAL NOTES
----------------------------------------------------------

  • Layout is 100% table-based with fully inline styles — no <style>
    blocks, no flexbox/grid — for maximum email-client compatibility.
  • Buttons use the "bulletproof" pattern with VML fallbacks so they
    render as solid blocks in Outlook (Windows).
  • Fonts are web-safe only: Arial Black / Impact for headings, Arial /
    Helvetica for body. NO Google Fonts (email clients don't support them).
  • Unicode symbols (⚡ 📅 ✓) have been substituted with reliable
    text equivalents ([!], [CAL]) or HTML entities (&#10003;) so they
    render consistently. Adjust if your audience's clients support emoji.
  • Max width is 600px, centred — the standard safe email width.


----------------------------------------------------------
5. BEFORE PRODUCTION USE — PLEASE TEST
----------------------------------------------------------

Browser preview confirms the design, but real email clients vary widely.
Before sending to clients, run each template through a rendering-test
service such as LITMUS (litmus.com) or EMAIL ON ACID (emailonacid.com)
across the major clients (Outlook desktop, Outlook.com, Gmail, Apple
Mail, iOS Mail, and mobile). Pay particular attention to Outlook on
Windows, which uses the Word rendering engine and is the most likely to
need the VML button fallbacks included here.

Always send a paired multipart email: the HTML version plus the matching
.txt version as the plain-text alternative.

==========================================================
