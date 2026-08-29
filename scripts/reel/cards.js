/* ============================================================
   CARDS — one container that morphs.

   The reference is an iOS Live Activity: a compact pill grows into a
   full card, the content blurring while the container is in motion and
   sharpening as it settles, and the container itself never disappears.
   That continuity is the whole trick. Six things cutting to each other
   is a slideshow; one thing becoming six things is a product.

   So every state below is a size and some content. The player lerps
   width, height and radius between whichever two it is between, blurs
   both contents by how fast the box is currently changing, and
   cross-dissolves them. Nothing here animates itself.

   Content is deliberately structural rather than numeric: bars stand in
   for text the way the site's own scenes do it, because a card full of
   invented figures is a claim, and we do not have those figures.
   ============================================================ */

/* Text stand-ins, at a given width. The site's scenes use the same
   device, so a card reads as the same family as the product shots. */
const cBar = (w, o = 1) =>
  `<i class="cb" style="width:${w}px;opacity:${o}"></i>`

const cChip = (label, on) =>
  `<span class="cchip${on ? ' cchip--on' : ''}">${label}</span>`

const CARDS = {
  /* The idle state. Everything grows out of this and returns to it. */
  idle: { w: 470, h: 150, r: 75, html: `
    <div class="cIdle">
      <svg class="cMark" viewBox="0 0 104 100" aria-hidden="true">
        <path d="M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82" fill="none"
              stroke="currentColor" stroke-width="13"/>
        <rect x="78" y="69" width="13" height="13" fill="var(--amber400)"/>
      </svg>
      <span class="cIdleTxt">n.abl</span>
    </div>` },


  automation: { w: 980, h: 540, r: 52, html: `
    <div class="cHead"><span>Automation</span>${cChip('Running', true)}</div>
    <div class="cFlow">
      <i class="cNode"></i><i class="cWire"></i>
      <i class="cNode cNode--on"></i><i class="cWire"></i>
      <i class="cNode"></i><i class="cWire"></i>
      <i class="cNode"></i>
    </div>
    <div class="cRows">
      <div class="cRow">${cBar(210)}${cBar(64, .4)}</div>
      <div class="cRow">${cBar(150)}${cBar(64, .4)}</div>
    </div>` },

  data: { w: 940, h: 640, r: 52, html: `
    <div class="cHead"><span>Data</span>${cChip('Cleaned', true)}</div>
    <div class="cBars">
      <i style="--h:38%"></i><i style="--h:62%"></i><i style="--h:47%"></i>
      <i style="--h:78%"></i><i style="--h:66%"></i><i class="on" style="--h:94%"></i>
    </div>
    <div class="cRow">${cBar(240)}</div>` },

  web: { w: 990, h: 580, r: 52, html: `
    <div class="cHead"><span>Web</span>${cChip('Booked', true)}</div>
    <div class="cGrid">
      ${Array.from({ length: 12 }, (_, i) => `<i${i === 6 ? ' class="on"' : ''}></i>`).join('')}
    </div>
    <div class="cRow">${cBar(190)}${cBar(96, .4)}</div>` },

  ai: { w: 960, h: 640, r: 52, html: `
    <div class="cHead"><span>Assistant</span>${cChip('Sourced', true)}</div>
    <div class="cAsk">${cBar(300, .5)}</div>
    <div class="cAns">
      <div class="cRow">${cBar(360)}</div>
      <div class="cRow">${cBar(280)}</div>
      <div class="cRow">${cChip('page 14')}${cChip('policy.pdf')}</div>
    </div>` },

  software: { w: 900, h: 660, r: 52, html: `
    <div class="cHead"><span>Software</span>${cChip('Checked', true)}</div>
    <div class="cForm">
      <div class="cField">${cBar(150, .45)}<i class="cInput"></i></div>
      <div class="cField">${cBar(110, .45)}<i class="cInput"></i></div>
      <div class="cField cField--ok">${cBar(130, .45)}<i class="cInput"></i><i class="cTick"></i></div>
    </div>` },

  training: { w: 980, h: 620, r: 52, html: `
    <div class="cHead"><span>Training</span>${cChip('4 of 4', true)}</div>
    <div class="cPeople">
      ${Array.from({ length: 4 }, () =>
        `<div class="cPerson"><i class="cAv"></i>${cBar(130, .5)}<i class="cTick"></i></div>`).join('')}
    </div>` },

  /* The mark on its own. The address is no longer in here — it arrives
     after the card has shut, so the two do not compete. */
  outro: { w: 620, h: 300, r: 52, html: `
    <div class="cOutro">
      <svg class="cMark cMark--lg" viewBox="0 0 104 100" aria-hidden="true">
        <path d="M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82" fill="none"
              stroke="currentColor" stroke-width="13"/>
        <rect x="78" y="69" width="13" height="13" fill="var(--amber400)"/>
      </svg>
      <span class="cOutroTxt">n.abl</span>
    </div>` },
}

/* A pillar is the same card three times with different words, so it is
   built rather than written out. */
const pillarCard = (n, term, def) => ({
  w: 960, h: 470, r: 52, html: `
    <div class="cHead"><span>Pillar ${n} of 3</span></div>
    <div class="cPillar">
      <span class="cTerm">${term}</span>
      <i class="cRule"></i>
      <span class="cDef">${def}</span>
    </div>` })
