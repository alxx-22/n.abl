# 02 — Brand

```
Status:       done
Owner:        Alex
Next review:  when a new surface is added, or before the first printed material
Evidence:     src/styles/tokens.css, public/brand/*, scripts/check-email-contrast.mjs
```

The identity is decided, specified and running in the product.
Nothing about it is still an open design question.

"Done" here means the design work is finished. It does not mean every file in
the repository has caught up. Old-brand wording survives in five places, listed
under **Next actions** below. That cleanup is already tracked in the master plan
as v2 work ("purge remaining old-brand assets and descriptions"), and it is
cleanup, not design.

Last substantive revision: 2026-08-15.

---

## What this step is for

This folder is the source of truth for how n.abl looks. Palette, typefaces, the
logo masters, contrast rules and usage.

Anything that renders n.abl to a human being inherits from here: the website, the
client portal, the team space, the CRM, the six email templates, the welcome-pack
generator, proposals, and any deck or document that carries the name.

**This step is not** the website copy rewrite (`03-website`), the words
themselves beyond tone (`01-positioning`), or the email pack build
(`08-email-pack`). Those consume this folder.

The identity replaced an earlier one. The old scheme was electric lime `#B8FF00`
on pure black `#0A0A0A`, with a wordmark described as being set in a heavy black
sans-serif. None of that survives except the square full stop, which is now
amber. Where you find the old description, this folder wins.

---

## What "done" looks like

Nine statements. All nine are true today.

- [x] There is one palette, written down with hex values, and it matches
      `src/styles/tokens.css` exactly.
- [x] The rule for the accent on light grounds is stated with measured contrast
      figures, not asserted.
- [x] The type stack is fixed at three families, and every weight named is a
      file that actually ships in `public/fonts/`.
- [x] The fonts are self-hosted, with the reason written down so nobody
      "optimises" them back onto a CDN.
- [x] The logo exists as vector masters in the repository, drawn as artwork.
- [x] The construction of that artwork is documented well enough to redraw it
      from the numbers alone.
- [x] Clear space, minimum sizes and misuse are specified.
- [x] The product uses the tokens rather than hard-coded colours, so the palette
      can be changed in one file.
- [x] No document in this folder describes the logo as being "set in" a typeface.

What is **not** claimed:

- The repository is not fully purged of old-brand wording. Five known survivors
  are listed below.
- Three light-ground and licensing gaps in the asset set are open. They are in
  `asset-inventory.md` with the fix for each.
- The minimum sizes are derived from the artwork's geometry. They have not been
  checked against a physical print proof.

---

## Next actions — do these in order

Each one is a small, closed job. None of them is a design decision.

- [ ] **Fix the light-ground dot in the exports.** `scripts/build-logos.mjs`
      fills the square dot with `#E9AC57` for every variant, including the two
      light-ground ones. On a light card that is 1.79:1 and the signature
      element of the identity nearly disappears. Use `#B87718` when the ground
      is light, then re-run `node scripts/build-logos.mjs`.
- [ ] **Correct `logos/README.md`.** It says the exports are "rendered from the
      same self-hosted typeface the site uses". They are not. They are rendered
      from `public/brand/wordmark.svg` and `mark.svg`, which is exactly what
      `scripts/build-logos.mjs` says in its own header comment. This is the old
      identity's description surviving on a file that no longer works that way.
- [ ] **Add `scripts/fetch-fonts.sh`.** `public/fonts/fonts.css` tells the reader
      to regenerate with it. It does not exist, so the font files currently
      cannot be rebuilt from a documented command.
- [ ] **Ship the font licences.** All three families are under the SIL Open Font
      License 1.1, which requires the licence to travel with the files. There is
      no licence file anywhere in the repository, and the fonts are served
      publicly.
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

After those six, this folder is closed until the identity itself changes.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. Status, what done means, what to do next. | You are opening the folder cold. |
| `brand-guidelines.md` | The specification. Palette with measured contrast, the deep-amber light-ground rule, the type stack and why it is self-hosted, the logo's construction, clear space, minimum sizes, misuse. | You are building anything that renders the brand, or reviewing something that does. |
| `voice-and-tone.md` | How n.abl writes. British English, plain and direct, problem-led not tool-led, the things that must be said correctly, and the things that must never be invented. | You are writing copy, an email, a proposal or a page. |
| `asset-inventory.md` | What is actually in `public/brand/`, `public/fonts/` and `logos/`, file by file with sizes and dimensions. What is missing, and the fix for each gap. | You need an asset, or you are working through the checklist above. |
| `intro-reel.md` | The introduction reel's foundations: the tempo measurement protocol, the motion grammar, the inversion rule, the safe zones and the checks. Its own film concept is superseded. | You are making anything that moves with the name on it. |
| `intro-reel-prompt.md` | The build brief for the reel, written to be handed cold to a fresh After Effects session. The ribbon, the camera, the twelve-bar cut, the stations and the acceptance checks. | You are building the reel, or briefing whoever is. |

---

## Where the real assets live

The documents in this folder describe. They do not store. The masters are in the
application:

| Path | What it holds |
|---|---|
| `public/brand/wordmark.svg` | The full wordmark. Drawn artwork, with the construction in comments. |
| `public/brand/mark.svg` | The short mark: the `n` and the dot. |
| `public/favicon.svg` | The mark inset in a rounded espresso tile. |
| `public/fonts/` | Six `.woff2` files and `fonts.css`. 214 KB total. |
| `src/styles/tokens.css` | Every colour, type and spacing token the product uses. |
| `src/components/ui/index.jsx` | The `Logo` component, the same paths inlined. |
| `logos/` | Six generated PNG exports for decks and documents. |

---

## The four rules that must never be broken

1. **The logo is drawn artwork.** A 13-unit monoline stroke with butt caps and
   true-circle curves. It is never "set in" a typeface, in any document, deck or
   conversation.
2. **On light grounds the accent is deep amber `#B87718`.** Plain amber `#E9AC57`
   reaches 1.97:1 on near-white and fails outright.
3. **The fonts are self-hosted.** Requesting them from Google would disclose
   every visitor's IP address to a third party on page load.
4. **The old identity does not come back.** Not lime `#B8FF00`, not pure black
   `#0A0A0A`, not Archivo Black, not a lime dot.
