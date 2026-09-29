/* ============================================================
   CANVAS — web.

   A third camera language, so the six reels do not all move the same
   way. Automation walked a staircase down a column of cells. Data never
   left one object, pulling back through it. This one runs on a SINGLE
   HORIZONTAL TRACK: five portrait cells in one row, and the camera only
   ever goes right, or in. Two verbs, no others.

   That is the argument as much as the framing. A booking is a sequence
   — enquiry, slot, payment, confirmation — and a camera that only moves
   forwards along a line is the same shape as the thing being sold.

     A ── B ── C ── D ── E

     A  the number       B  the number two years ago
     C  Thursday night   D  the fix        E  sign off

   Cells are 1800x3100, the frame's own ratio at the zoom the shots
   hold, so a cell framed is a cell filled.
   ============================================================ */

const CELL_W = 1800, CELL_H = 3100
const GUT = 300
const ROW_Y = 150
const COL = (n) => 150 + n * (CELL_W + GUT)
const CANVAS_W = COL(4) + CELL_W + 150, CANVAS_H = ROW_Y + CELL_H + 150

const cell = (id, n, inner) => `
  <div class="cvCell" data-cell="${id}" style="left:${COL(n)}px;top:${ROW_Y}px;width:${CELL_W}px;height:${CELL_H}px">
    ${inner}
  </div>`

/* The enquiries. Times are 24-hour and evening on purpose: the cell is
   not claiming a statistic about when enquiries arrive, it is showing
   one Thursday. The stat on screen is the only number being asserted,
   and it is attributed. */
const TIMES = [
  { t: '21:41', w: 72, live: true },
  { t: '21:12', w: 58 },
  { t: '20:58', w: 64 },
  { t: '19:26', w: 44 },
  { t: '18:40', w: 69 },
]

const rows = () => TIMES.map((r) => `
  <div class="cvPane wRow${r.live ? ' wRow--live' : ''}">
    <span class="cvPaneK">${r.t}</span>
    <i class="cvBar${r.live ? ' cvBar--typed' : ''}" style="width:${r.w}%"></i>
    ${r.live ? '<i class="cvCaret"></i>' : ''}
  </div>`).join('')

/* Both figures are from one primary source, read in the source rather
   than in a secondary write-up of it: UK Business Data Survey 2026,
   DSIT, published 18 June 2026, base 4,450 UK businesses, fieldwork
   October 2025 to January 2026. 78% have a website, "compared to 68% in
   2023 to 2024" — a change the report itself marks as significant.

   Note what is NOT claimed. Nothing here says a share of those sites
   cannot take a booking; there is no figure for that worth putting on
   screen, so the reel shows one Thursday instead and lets the viewer
   recognise it. */
const CANVAS_SCENE = 'web'

/* EVERY cell is one centred block — kick, body and footnote all inside
   the .cvGrow — rather than a kick pinned to the cell's ceiling and a
   footnote to its floor.

   That is a safe-zone decision, not a taste one, and it was made by
   measuring. A 3100-tall cell filling a 1920 frame puts its top padding
   at screen y102 and its bottom padding at y1795. Instagram draws its
   own UI over the top 250px and the caption and profile row over the
   bottom 480px, so in the first layout the source attribution and the
   service label were both outside the band anyone can read. Centred,
   every cell's content now lands between y517 and y1265.
   ============================================================ */
const CANVAS_HTML = `
  <div class="cv cv--rail" style="--w:${CANVAS_W}px;--h:${CANVAS_H}px">

    ${cell('num', 0, `
      <div class="cvGrow">
        <span class="cvKick">UK Business Data Survey, 2026</span>
        <span class="cvHuge">78%</span>
        <p class="cvLine">of UK businesses now have a website.</p>
        <p class="cvFoot">Department for Science, Innovation and Technology, June 2026.</p>
      </div>`)}

    ${cell('turn', 1, `
      <div class="cvGrow">
        <span class="cvKick">Two years ago</span>
        <span class="cvHuge cvHuge--sm cvHuge--dim">68%</span>
        <p class="cvLine cvLine--dim">Everybody caught up.</p>
        <p class="cvLine cvLine--amber">Having one stopped being the difference.</p>
      </div>`)}

    ${cell('night', 2, `
      <div class="cvGrow">
        <span class="cvKick">Thursday night</span>
        <div class="wList">${rows()}</div>
        <p class="cvFoot">You read it in the morning.</p>
      </div>`)}

    ${cell('fix', 3, `
      <div class="cvGrow">
        <span class="cvKick">03 &middot; Web</span>
        <p class="cvLine">Booked and paid, without you.</p>
        <div class="cvScene cvScene--fit" id="cvScene"></div>
      </div>`)}

    ${cell('sign', 4, `
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
        <p class="cvLine">What does your website do when nobody&rsquo;s watching it?</p>
        <p class="cvLine cvLine--amber">www.nabl.agency</p>
      </div>`)}
  </div>`
