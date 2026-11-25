# 02 — Brand

```
Status:       revised 2026-11-25: new type and colourway decided; the website is moving over
Owner:        Alex
Next review:  when the website revamp lands, or before the first printed material
Evidence:     brand-guidelines.md, reference/nabl-scroll-story.html, src/styles/tokens.css,
              public/fonts/*, public/brand/*, scripts/check-email-contrast.mjs
```

The identity is decided and specified. The 2026-11 revision changed two things,
the typeface and the colour, and left the logo exactly as it was:

- **Type:** Manjari, one family for everything. Thin 100 headlines, Regular 400
  text and labels, Bold 700 emphasis.
- **Colour:** three lights on the espresso ground. **Ember** is the problem,
  **amber** is n.abl, **ice** is the AI at work. Gradients run warm to cool.
- **Ground:** lit, not flat. Soft glows drawn as wisps, with grain, fluted glass
  and aurora as the story moves on.
- **Buttons:** frosted glass pills with the three colours glowing inside.

The approved look is in one file you can open in a browser:
[`reference/nabl-scroll-story.html`](reference/nabl-scroll-story.html).

"Decided" does not mean every surface has caught up. The website is being moved
over now. The films, the email pack and some generated assets still use the August
type and the one-accent styling. They are listed under **Next actions**.

Last substantive revision: 2026-11-25. Previous: 2026-08-15.

---

## What this step is for

This folder is the source of truth for how n.abl looks. Palette, typeface, light
and texture, components, motion, the logo masters, contrast rules and usage.

Anything that renders n.abl to a human being inherits from here: the website, the
client portal, the team space, the CRM, the six email templates, the welcome-pack
generator, proposals, the launch films, and any deck or document that carries the
name.

**This step is not** the website copy (`03-website`), the words themselves beyond
tone (`01-positioning`), or the email pack build (`08-email-pack`). Those consume
this folder.

---

## What "done" looks like

- [x] There is one palette, written down with hex values and measured contrast,
      and it matches `src/styles/tokens.css` exactly. Ember, ice, the calm mid
      cream and the three gradients are tokens.
- [x] The rule for every colour on light grounds is stated with measured contrast
      figures, not asserted.
- [x] The typeface is fixed at one family, and every weight named is a file that
      actually ships in `public/fonts/`.
- [x] The fonts are self-hosted, with the reason written down so nobody
      "optimises" them back onto a CDN.
- [x] Every font family's licence ships beside its files, and
      `public/fonts/README.md` records where each file came from.
- [x] The logo exists as vector masters in the repository, drawn as artwork.
- [x] The construction of that artwork is documented well enough to redraw it
      from the numbers alone.
- [x] Clear space, minimum sizes and misuse are specified.
- [x] No document in this folder describes the logo as being "set in" a typeface.
- [x] There is a working reference for the new look in the repository, and the
      guidelines say which wins when they disagree.
- [x] The website uses Manjari, the colourway and the lit ground. Done on the
      branch `claude/modest-wright-2zlwat`; live once that branch is merged.

What is **not** claimed:

- The repository is not fully moved over. The survivors are listed below.
- The minimum sizes are derived from the artwork's geometry. They have not been
  checked against a physical print proof.
- The lit ground has been measured in Chromium on desktop and phone sizes. It has
  not been tested on a real iPhone or in Safari itself.

---

## Next actions

### The 2026-11 revision

- [x] **Move the website over.** Done on the branch
      `claude/modest-wright-2zlwat`, waiting to be merged: `--font-display`
      and `--font-sans` on Manjari, the lit ground behind the homepage and the
      services page (`src/components/ground/`, `LitGround.jsx`), glass
      buttons, cards and modal, the See it work film in Manjari and ember with
      its content unchanged, the AI glyphs in the calm gradient, and a new
      social card. The site no longer requests Space Grotesk or Inter Tight.
      Their files stay in `public/fonts/` while the launch films
      (`marketing/launch-video/film/`) still load them directly.
- [ ] **Films.** `marketing/launch-video/film/film.css` sets Space Grotesk, Inter
      Tight and JetBrains Mono and the one-accent styling. New films use Manjari
      and the colourway (guidelines section 8). Re-cutting the existing ones is a
      marketing decision, not a brand one.
- [ ] **Email fallback stack.** The templates still name `Arial Black` for
      headings. Move them to a light system stack (guidelines section 5.7) and
      re-run `npm run test:emails`.
- [x] **Regenerate the social card.** `scripts/build-og.mjs` now draws the site's
      own lit ground in a headless browser, with the wordmark and the hero's
      line in Manjari Thin. `public/brand/og.png` is rebuilt from it.

### Carried over from 2026-08

Each one is a small, closed job. None of them is a design decision.

- [ ] **Fix the light-ground dot in the exports.** `scripts/build-logos.mjs`
      fills the square dot with `#E9AC57` for every variant, including the two
      light-ground ones. On a light card that is 1.79:1 and the signature element
      of the identity nearly disappears. Use `#B87718` when the ground is light,
      then re-run `node scripts/build-logos.mjs`.
- [ ] **Correct `logos/README.md`.** It says the exports are "rendered from the
      same self-hosted typeface the site uses". They are not. They are rendered
      from `public/brand/wordmark.svg` and `mark.svg`, as
      `scripts/build-logos.mjs` says in its own header comment.
- [ ] **Clean the email pack's old wording.** `nabl-emails/README.txt` still
      describes "a lime top bar", "lime/black accents" and "Arial Black / Impact
      for headings". Eight template files carry `<!-- LIME TOP BORDER -->` and
      `<!-- CTA BUTTON (lime) -->` comments. The rendered colours are already
      amber. Only the descriptions are stale.
- [ ] **Tidy the welcome-pack print path.** `src/lib/welcomeDoc.js` uses
      `#8F5A0E` for printed links, a fourth amber that is not in the palette,
      and leaves the wordmark dot and the goal bullets at `#E9AC57` on white.
      Either promote `#8F5A0E` to a named token or replace it with `#B87718`,
      and apply the light-ground rule to the dot and bullets.

Done in this revision: the font licences now ship (`public/fonts/*-OFL.txt`), and
`public/fonts/fonts.css` no longer points at a `scripts/fetch-fonts.sh` that does
not exist; `public/fonts/README.md` records each file's source instead.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. Status, what done means, what to do next. | You are opening the folder cold. |
| `brand-guidelines.md` | The specification. The logo's construction and rules, the palette with measured contrast and what each colour means, how much of each, gradients, the lit ground, Manjari and how to set it, components, motion, film. | You are building anything that renders the brand, or reviewing something that does. |
| `reference/nabl-scroll-story.html` | The approved look, working: the homepage as a scroll story, self-contained. | You want to see it, or lift the background into a page or a film. |
| `reference/README.md` | What is in the demo, where each part sits in the file, and how to drive the background from a timeline. | You are lifting something from the demo. |
| `voice-and-tone.md` | How n.abl writes. British English, plain and direct, problem-led not tool-led, the things that must be said correctly, and the things that must never be invented. | You are writing copy, an email, a proposal or a page. |
| `asset-inventory.md` | What is actually in `public/brand/`, `public/fonts/` and `logos/`, file by file. What is missing, and the fix for each gap. | You need an asset, or you are working through the lists above. |
| `intro-reel.md` | The introduction reel's foundations: the tempo measurement protocol, the motion grammar, the safe zones and the checks. Its type and its "no gradient" rule are replaced by the guidelines. | You are making anything that moves with the name on it. |
| `intro-reel-prompt.md` | The build brief for the reel, written for a fresh After Effects session. Same caveat on type and gradients. | You are building the reel, or briefing whoever is. |

---

## Where the real assets live

The documents in this folder describe. They do not store. The masters are in the
application:

| Path | What it holds |
|---|---|
| `public/brand/wordmark.svg` | The full wordmark. Drawn artwork, with the construction in comments. |
| `public/brand/mark.svg` | The short mark: the `n` and the dot. |
| `public/favicon.svg` | The mark inset in a rounded espresso tile. |
| `public/fonts/` | Manjari in three weights, Latin and Latin Extended (six `.woff2` files, 78,604 bytes), the August families while the launch films still use them, each family's licence, `fonts.css` and a `README.md` of sources. |
| `src/styles/tokens.css` | Every colour, gradient, type and spacing token the product uses. |
| `src/components/ui/index.jsx` | The `Logo` component, the same paths inlined. |
| `logos/` | Six generated PNG exports for decks and documents. |
| `business/02-brand/reference/` | The working reference for the look. |

---

## The five rules that must never be broken

1. **The logo is drawn artwork.** A 13-unit monoline stroke with butt caps and
   true-circle curves. It is never "set in" a typeface, in any document, deck or
   conversation.
2. **The dot is always amber, and the logo never takes a gradient.** On light
   grounds the dot is deep amber `#B87718`; plain amber `#E9AC57` reaches 1.97:1
   on near-white and fails outright.
3. **Dark is the majority of every frame.** Ember, amber and ice are light on the
   espresso ground, in separate pools with dark between them. Never a full screen
   of one colour, never a flat fill of one.
4. **The fonts are self-hosted.** Requesting them from Google would disclose
   every visitor's IP address to a third party on page load.
5. **The old identities do not come back.** Not lime `#B8FF00`, not pure black
   `#0A0A0A`, not Archivo Black, not a lime dot; and not the August type in
   anything new.
