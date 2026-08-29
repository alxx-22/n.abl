/* ============================================================
   CANVAS — data.

   Where the automation reel was a column of cells the camera walked
   down, this one is a single object seen at four distances. The canvas
   IS the spreadsheet. The camera opens inside one cell, where the
   number looks fine, and pulls back until you can see how many are not.

   That is the whole argument for the service in one move: nothing is
   wrong with any number you are looking at. The problem is only visible
   from further away.

   The figures are real and attributed on screen. Poon et al., 2024 —
   94% of business spreadsheets contain errors — replicating Panko's
   synthesis of thirteen field audits, which also put the cell error
   rate at 5.2%. The grid below marks exactly 5.2% of its cells, so what
   the viewer counts is the finding rather than a number chosen to look
   alarming.
   ============================================================ */

/* Portrait, not landscape. At 22x34 the sheet was 3740 wide and 2516
   tall — an aspect that can never fill a 9:16 frame, so framing it to
   the width left 4000 canvas pixels of other cells in shot. 12x60 is
   roughly the frame's own shape. */
const COLS = 12, ROWS = 60
const CW = 170, CH = 74
const GRID_X = 250, GRID_Y = 700
const GRID_W = COLS * CW, GRID_H = ROWS * CH

/* Fixed, so the pattern is identical on every replay — a sheet that
   reshuffles cannot be matched across takes. */
const rnd = (n) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1

const TOTAL_CELLS = COLS * ROWS
const ERROR_COUNT = Math.round(TOTAL_CELLS * 0.052)

/* Scatter them rather than spreading them evenly: real errors cluster,
   and an even sprinkle reads as a pattern rather than as a problem. */
const ERRORS = new Set()
for (let i = 0; ERRORS.size < ERROR_COUNT; i++) {
  ERRORS.add(Math.floor(rnd(i + 1) * TOTAL_CELLS))
}

/* The cell the reel opens inside. Deliberately NOT one of the errors —
   the point of the first shot is that it looks fine. */
const HERO = 11 * COLS + 9
const HERO_X = GRID_X + (HERO % COLS) * CW + CW / 2
const HERO_Y = GRID_Y + Math.floor(HERO / COLS) * CH + CH / 2

const cells = () => {
  let out = ''
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const bad = ERRORS.has(i)
    const v = (rnd(i + 500) * 9000 + 120).toFixed(2)
    out += `<div class="dCell${bad ? ' dCell--bad' : ''}${i === HERO ? ' dCell--hero' : ''}">` +
           `<span>${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span></div>`
  }
  return out
}

const CANVAS_SCENE = 'data'
const CANVAS_HTML = `
  <div class="cv" style="--w:4400px;--h:10800px">

    <!-- the sheet, at size -->
    <div class="dSheet" data-cell="sheet"
         style="left:${GRID_X}px;top:${GRID_Y}px;width:${GRID_W}px;height:${GRID_H}px;
                grid-template-columns:repeat(${COLS},${CW}px);
                grid-auto-rows:${CH}px">${cells()}</div>

    <!-- the finding, under it -->
    <div class="cvCell" data-cell="stat"
         style="left:250px;top:${GRID_Y + GRID_H + 260}px;width:1800px;height:2400px">
      <span class="cvKick">Poon et al., 2024</span>
      <div class="cvGrow">
        <span class="cvHuge">94%</span>
        <p class="cvLine">of business spreadsheets contain errors.</p>
        <p class="cvLine cvLine--dim">About one cell in twenty.</p>
      </div>
      <p class="cvFoot">Replicating Panko&rsquo;s synthesis of thirteen field audits.</p>
    </div>

    <!-- what we do about it -->
    <div class="cvCell" data-cell="fix"
         style="left:2300px;top:${GRID_Y + GRID_H + 260}px;width:1800px;height:2400px">
      <span class="cvKick">02 &middot; Data</span>
      <p class="cvLine">Cleaned first. Then reporting you can decide from.</p>
      <div class="cvScene" id="cvScene"></div>
    </div>

    <!-- sign off -->
    <div class="cvCell" data-cell="sign"
         style="left:250px;top:${GRID_Y + GRID_H + 2960}px;width:1800px;height:2400px">
      <div class="cvGrow cvGrow--mid">
        <svg class="cvMark" viewBox="0 0 273 100" aria-hidden="true">
          <g fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="butt">
            <path d="M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82"/>
            <circle cx="128.25" cy="51.75" r="23.75"/><path d="M152 21.5 L152 82"/>
            <path d="M178 6 L178 82"/><circle cx="201.75" cy="51.75" r="23.75"/>
            <path d="M248.5 6 L248.5 82"/>
          </g>
          <rect x="78" y="69" width="13" height="13" fill="var(--amber400)"/>
        </svg>
        <p class="cvLine">Which of your numbers has nobody checked?</p>
        <p class="cvLine cvLine--amber">www.nabl.agency</p>
      </div>
    </div>
  </div>`
