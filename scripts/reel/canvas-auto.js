/* ============================================================
   CANVAS — automation.

   The whole story laid out once, larger than the frame, and the frame
   moves over it. Nothing appears or disappears; the viewer is taken
   somewhere. A morph says "and now, this"; a camera move says "these
   are in the same place" — which is the actual argument, because the
   £36bn, the order typed twice and the thing that stops it are one
   situation seen from three distances.

   Laid out as PORTRAIT CELLS, not a web page. A first version used
   wide, short blocks — a desktop layout — and every shot in a 9:16
   frame had a void above and below it and the next block leaking in at
   the edge. Each cell is now 1800x3100, which is the frame's own ratio
   at the zoom the shots hold, so a cell framed is a cell filled.

     A ── B        A  the number          B  the second number
     │              C  a Tuesday
     C              D  the fix
     │              E  sign off
     D ── E
   ============================================================ */

const CELL_W = 1800, CELL_H = 3100
const COL1 = 150, COL2 = 2250
const ROW1 = 150, ROW2 = 3500, ROW3 = 6850
const CANVAS_W = COL2 + CELL_W + 150, CANVAS_H = ROW3 + CELL_H + 150

const cell = (id, x, y, inner) => `
  <div class="cvCell" data-cell="${id}" style="left:${x}px;top:${y}px;width:${CELL_W}px;height:${CELL_H}px">
    ${inner}
  </div>`

/* The stat is real and attributed on screen, because a number a viewer
   cannot source is the thing this business exists not to do. FSB, March
   2026: UK SMEs spend £36bn and 379 million hours a year on regulatory
   compliance. The rules do not go away — the labour behind them is what
   we are talking about, and the copy says exactly that rather than
   implying we delete anyone's obligations. */
const CANVAS_SCENE = 'automation'
const CANVAS_HTML = `
  <div class="cv" style="--w:${CANVAS_W}px;--h:${CANVAS_H}px">

    ${cell('num', COL1, ROW1, `
      <span class="cvKick">FSB, March 2026</span>
      <div class="cvGrow">
        <span class="cvHuge">£36bn</span>
        <p class="cvLine">is what UK small businesses spend a year keeping up with the rules.</p>
      </div>
      <p class="cvFoot">Regulatory compliance, across UK SMEs.</p>`)}

    ${cell('hours', COL2, ROW1, `
      <div class="cvGrow">
        <span class="cvHuge cvHuge--sm">379m</span>
        <p class="cvLine">hours of it.</p>
        <p class="cvLine cvLine--dim">The rules are not going anywhere.</p>
        <p class="cvLine cvLine--amber">The typing is.</p>
      </div>`)}

    ${cell('tuesday', COL1, ROW2, `
      <span class="cvKick">What that looks like on a Tuesday</span>
      <div class="cvStack">
        <div class="cvPane">
          <span class="cvPaneK">An order arrives</span>
          <i class="cvBar" style="width:78%"></i>
          <i class="cvBar" style="width:54%"></i>
          <i class="cvBar" style="width:66%"></i>
        </div>
        <div class="cvDown"></div>
        <div class="cvPane cvPane--dim">
          <span class="cvPaneK">Somebody types it in again</span>
          <i class="cvBar cvBar--typed" style="width:78%"></i>
          <i class="cvBar cvBar--typed" style="width:54%"></i>
          <i class="cvBar" style="width:31%"></i><i class="cvCaret"></i>
        </div>
      </div>`)}

    ${cell('fix', COL1, ROW3, `
      <span class="cvKick">01 &middot; Automation</span>
      <p class="cvLine">Set up once. Then left alone.</p>
      <div class="cvScene" id="cvScene"></div>`)}

    ${cell('sign', COL2, ROW3, `
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
        <p class="cvLine">What&rsquo;s the job in your week that shouldn&rsquo;t need a person?</p>
        <p class="cvLine cvLine--amber">www.nabl.agency</p>
      </div>`)}
  </div>`

/* Where the camera sits for each beat. Derived from the cell grid rather
   than guessed: a cell centre at the zoom that fits 1800x3100 into
   1080x1920 is 0.60, and the two close shots push in on a known point
   inside a known cell. */
const CELL = (cx, cy) => ({ x: cx + CELL_W / 2, y: cy + CELL_H / 2, z: 0.60 })
