/* Web — a customer books a slot without anyone being asked. */

import { EASE, EASE_OUT, EASE_IO, LINEAR, seg, lerp, pulse, clamp, arc, C, cr, am, nextUid } from './engine.js'

export default (function(){
/* ---- geometry ---------------------------------------------- */
const F   = { x:340, y:210, w:760, h:480, r:16, chrome:44 };
const G   = { x:463, y:312, cw:118, ch:60, gap:14, cols:4, rows:2 };
const TARGET = 6, OFF = [1, 4];
const cellXY = i => [ G.x + (i%G.cols)*(G.cw+G.gap), G.y + Math.floor(i/G.cols)*(G.ch+G.gap) ];
const [TX, TY] = cellXY(TARGET);
const TC = [TX + G.cw/2, TY + G.ch/2];                       // 786, 416
const GRID_BOTTOM = G.y + G.rows*G.ch + (G.rows-1)*G.gap;    // 446

const P   = { x:646, y:468, w:280, h:206 };                  // panel
const PI  = P.x + 20, PIW = P.w - 40;                        // inner x / width
const DD  = { x:PI, y:522, w:PIW, h:28 };                    // dropdown
const MENU= { x:PI, y:554, w:PIW, h:78 };
const OPTH = 22, OPTY = [558, 582, 606];
const FLD = [ { x:PI, y:562, w:PIW, h:28 }, { x:PI, y:598, w:PIW, h:28 } ];
const ACT = { x:814, y:636, w:92, h:26 };
const PC  = [P.x + P.w/2, P.y + P.h/2];                      // 786, 571

const DDC  = [DD.x + DD.w/2, DD.y + DD.h/2];                 // 786, 536
const OPT2 = [MENU.x + MENU.w/2, OPTY[1] + OPTH/2];          // 786, 593
const F1C  = [FLD[0].x + FLD[0].w/2, FLD[0].y + FLD[0].h/2]; // 786, 576
const F2C  = [FLD[1].x + FLD[1].w/2, FLD[1].y + FLD[1].h/2]; // 786, 612
const ACTC = [ACT.x + ACT.w/2, ACT.y + ACT.h/2];             // 860, 649
const CHK  = [720, 472];
const HOME = [300, 740], DRIFT = [930, 706];
const TETHER = P.y - GRID_BOTTOM;

const TYPED = [118, 86];          // final pill widths — two fields, two lengths
const VALUE_W = 74;               // the chosen option, echoed in the dropdown
const OPT_W = [96, 74, 118];      // the three options are visibly different

const CURSOR_PATH = 'M1 1 L1 17.6 L5.3 13.7 L7.9 19 L10.9 17.7 L8.2 12.5 L13 12.3 Z';
const TICK_PATH   = 'M-11 0 L-3.5 7.5 L11 -8';
const DUR = 10.6;

const ring = i => Math.abs((i%G.cols) - (TARGET%G.cols))
                + Math.abs(Math.floor(i/G.cols) - Math.floor(TARGET/G.cols));

/* ---- every click in the sequence, in one table -------------- */
const CLICKS = [
  { at:TC,   t:1.25, r1:34 }, { at:DDC,  t:2.64, r1:28 },
  { at:OPT2, t:3.64, r1:24 }, { at:F1C,  t:4.46, r1:22 },
  { at:F2C,  t:5.70, r1:22 }, { at:ACTC, t:7.16, r1:26 },
];
/* every leg of cursor travel, with the bow each one takes */
const LEGS = [
  { a:0.30, b:1.10, from:HOME,  to:TC,    bow: 90 },
  { a:1.95, b:2.50, from:TC,    to:DDC,   bow:-26 },
  { a:3.06, b:3.52, from:DDC,   to:OPT2,  bow: 16 },
  { a:4.02, b:4.42, from:OPT2,  to:F1C,   bow:-30 },
  { a:5.32, b:5.66, from:F1C,   to:F2C,   bow: 18 },
  { a:6.46, b:7.00, from:F2C,   to:ACTC,  bow:-24 },
  { a:7.72, b:8.40, from:ACTC,  to:DRIFT, bow: 20 },
  { a:9.30, b:10.1, from:DRIFT, to:HOME,  bow: 80 },
];
function cursorAt(t){
  for (let i = 0; i < LEGS.length; i++){
    const L = LEGS[i];
    if (t < L.a) return i === 0 ? L.from : LEGS[i-1].to;
    if (t <= L.b) return arc(L.from, L.to, seg(t, L.a, L.b, EASE), L.bow);
  }
  return LEGS[LEGS.length-1].to;
}

/* ---- scene ------------------------------------------------- */

function makeScene(){
  const u = nextUid(), S = [];
  S.push(`<svg viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A cursor books a slot: it picks an available object, a panel opens beneath it, a choice is made from a list, two fields are filled in, and confirming collapses the panel into a single confirmation mark.">`);
  S.push(`<defs>`,
    `<radialGradient id="bA${u}"><stop offset="0" stop-color="${C.amber}" stop-opacity=".11"/><stop offset="1" stop-color="${C.amber}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="bB${u}"><stop offset="0" stop-color="${C.cream200}" stop-opacity=".075"/><stop offset="1" stop-color="${C.cream200}" stop-opacity="0"/></radialGradient>`,
    `<filter id="sh${u}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="14" stdDeviation="20" flood-color="#000" flood-opacity=".55"/></filter>`,
    `<filter id="ms${u}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity=".5"/></filter>`,
    `<filter id="cu${u}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="#000" flood-opacity=".6"/></filter>`,
    `<filter id="gl${u}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>`,
    `</defs>`);
  S.push(`<rect width="1440" height="900" fill="${C.bg}"/>`);
  S.push(`<ellipse cx="380" cy="170" rx="540" ry="380" fill="url(#bA${u})"/>`);
  S.push(`<ellipse cx="1120" cy="770" rx="500" ry="360" fill="url(#bB${u})"/>`);
  S.push(`<rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}" rx="${F.r}" fill="${C.frame}" stroke="${cr(.15)}"/>`);
  S.push(`<path d="M${F.x} ${F.y+F.chrome} H${F.x+F.w}" stroke="${cr(.09)}"/>`);
  const cy = F.y + F.chrome/2;
  for (let i=0;i<3;i++) S.push(`<circle cx="${F.x+26+i*15}" cy="${cy}" r="3.4" fill="${cr(.16)}"/>`);
  S.push(`<rect x="${F.x+F.w/2-120}" y="${cy-6}" width="240" height="12" rx="6" fill="${cr(.07)}"/>`);

  S.push(`<g data-recede="5"><rect x="${G.x}" y="272" width="150" height="10" rx="5" fill="${cr(.26)}"/>`
       + `<rect x="${G.x}" y="290" width="94" height="7" rx="3.5" fill="${cr(.11)}"/></g>`);

  for (let i=0;i<G.cols*G.rows;i++){
    if (i === TARGET) continue;
    const [x,y] = cellXY(i), off = OFF.includes(i);
    S.push(`<g data-recede="${ring(i)}">`
      + `<rect x="${x}" y="${y}" width="${G.cw}" height="${G.ch}" rx="10" fill="${off?C.s1:C.s3}" stroke="${off?cr(.15):cr(.22)}"/>`
      + (off ? '' : `<rect x="${x+(G.cw-40)/2}" y="${y+G.ch/2-1.5}" width="40" height="3" rx="1.5" fill="${cr(.34)}"/>`)
      + `</g>`);
  }
  S.push(`<g data-recede="4"><path d="M${G.x} 480 H${G.x + G.cols*G.cw + (G.cols-1)*G.gap}" stroke="${cr(.07)}"/>`
    + `<rect x="${G.x}" y="500" width="168" height="7" rx="3.5" fill="${cr(.10)}"/>`
    + `<rect x="${G.x}" y="516" width="112" height="7" rx="3.5" fill="${cr(.07)}"/></g>`);
  S.push(`<g data-recede="0"><rect x="${TX}" y="${TY}" width="${G.cw}" height="${G.ch}" rx="10" fill="${C.s3}" stroke="${cr(.22)}"/>`
    + `<rect x="${TX+(G.cw-40)/2}" y="${TY+G.ch/2-1.5}" width="40" height="3" rx="1.5" fill="${cr(.34)}"/></g>`);
  S.push(`<g data-el="hover" opacity="0"><rect x="${TX}" y="${TY}" width="${G.cw}" height="${G.ch}" rx="10" fill="${C.s4}" stroke="${cr(.34)}"/>`
    + `<rect x="${TX+(G.cw-40)/2}" y="${TY+G.ch/2-1.5}" width="40" height="3" rx="1.5" fill="${cr(.48)}"/></g>`);
  S.push(`<g data-el="sel" opacity="0">`
    + `<rect x="${TX-6}" y="${TY-6}" width="${G.cw+12}" height="${G.ch+12}" rx="15" fill="${am(.10)}" filter="url(#gl${u})"/>`
    + `<rect x="${TX}" y="${TY}" width="${G.cw}" height="${G.ch}" rx="10" fill="${C.s4}" stroke="${am(.8)}" stroke-width="1.25"/>`
    + `<rect x="${TX+(G.cw-40)/2}" y="${TY+G.ch/2-1.5}" width="40" height="3" rx="1.5" fill="${C.amber}"/></g>`);
  S.push(`<path data-el="tether" d="M${TC[0]} ${GRID_BOTTOM} V${P.y}" stroke="${am(.45)}" stroke-width="1.25" stroke-dasharray="${TETHER}" stroke-dashoffset="${TETHER}" opacity="0"/>`);

  /* ---- the panel ---- */
  const fld = (i, f) =>
      `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="7" fill="${C.s1}" stroke="${cr(.10)}"/>`
    + `<rect data-el="focus${i}" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="7" fill="none" stroke="${cr(.42)}" stroke-width="1.4" opacity="0"/>`
    // The typed value starts as a dot and extends into a pill — the same
    // placeholder grammar as everything else in the frame, just growing.
    + `<rect data-el="type${i}" x="${f.x+10}" y="${f.y+f.h/2-1.5}" width="3" height="3" rx="1.5" fill="${cr(.44)}"/>`
    + `<rect data-el="caret${i}" x="${f.x+14}" y="${f.y+7}" width="1.2" height="${f.h-14}" fill="${cr(.55)}" opacity="0"/>`;

  S.push(`<g data-el="panel" opacity="0">`
    + `<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="12" fill="${C.s2}" stroke="${cr(.16)}" filter="url(#sh${u})"/>`
    + `<rect x="${PI}" y="${P.y+20}" width="76" height="8" rx="4" fill="${cr(.34)}"/>`
    + `<path d="M${PI} ${P.y+42} H${PI+PIW}" stroke="${cr(.09)}"/>`
    // dropdown: closed control, its placeholder, and the value it gains
    + `<rect x="${DD.x}" y="${DD.y}" width="${DD.w}" height="${DD.h}" rx="7" fill="${C.s1}" stroke="${cr(.10)}"/>`
    + `<rect data-el="ddFocus" x="${DD.x}" y="${DD.y}" width="${DD.w}" height="${DD.h}" rx="7" fill="none" stroke="${cr(.42)}" stroke-width="1.4" opacity="0"/>`
    + `<rect data-el="ddPlace" x="${DD.x+10}" y="${DD.y+DD.h/2-1.5}" width="52" height="3" rx="1.5" fill="${cr(.13)}"/>`
    + `<rect data-el="ddValue" x="${DD.x+10}" y="${DD.y+DD.h/2-1.5}" width="0" height="3" rx="1.5" fill="${C.amber}"/>`
    + `<g data-el="chev" ><path d="M-4.5 -2 L0 2.5 L4.5 -2" fill="none" stroke="${cr(.4)}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></g>`
    + fld(0, FLD[0]) + fld(1, FLD[1])
    + `<rect x="${ACT.x}" y="${ACT.y}" width="${ACT.w}" height="${ACT.h}" rx="8" fill="none" stroke="${cr(.24)}"/>`
    + `<rect x="${ACT.x+ACT.w/2-15}" y="${ACT.y+ACT.h/2-1.5}" width="30" height="3" rx="1.5" fill="${cr(.34)}"/>`
    + `<g data-el="act" opacity="0">`
      + `<rect x="${ACT.x}" y="${ACT.y}" width="${ACT.w}" height="${ACT.h}" rx="8" fill="${am(.16)}" stroke="${am(.85)}"/>`
      + `<rect x="${ACT.x+ACT.w/2-15}" y="${ACT.y+ACT.h/2-1.5}" width="30" height="3" rx="1.5" fill="${C.amber200}"/></g>`
    // the open list sits above the fields it covers, as a real one does
    + `<g data-el="menu" opacity="0"><g data-el="menuScale">`
      + `<rect x="${MENU.x}" y="${MENU.y}" width="${MENU.w}" height="${MENU.h}" rx="9" fill="${C.s3}" stroke="${cr(.18)}" filter="url(#ms${u})"/>`
      + OPTY.map((oy,k) =>
          `<rect x="${MENU.x+4}" y="${oy}" width="${MENU.w-8}" height="${OPTH}" rx="6" fill="none"/>`
        + `<rect x="${MENU.x+12}" y="${oy+OPTH/2-1.5}" width="${OPT_W[k]}" height="3" rx="1.5" fill="${cr(.30)}"/>`).join('')
      + `<g data-el="optHover" opacity="0"><rect x="${MENU.x+4}" y="${OPTY[1]}" width="${MENU.w-8}" height="${OPTH}" rx="6" fill="${cr(.07)}"/>`
      + `<rect x="${MENU.x+12}" y="${OPTY[1]+OPTH/2-1.5}" width="${OPT_W[1]}" height="3" rx="1.5" fill="${cr(.55)}"/></g>`
      + `</g></g>`
    + `</g>`);

  S.push(`<circle data-el="rip" cx="0" cy="0" r="0" fill="none" stroke="${am(.7)}" stroke-width="1.5" opacity="0"/>`);
  S.push(`<g data-el="check" opacity="0"><circle r="27" fill="none" stroke="${am(.26)}"/>`
    + `<path data-el="tick" d="${TICK_PATH}" fill="none" stroke="${C.amber}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="32" stroke-dashoffset="32"/></g>`);
  S.push(`<g data-el="cursor"><g transform="scale(1.5)" filter="url(#cu${u})">`
    + `<path d="${CURSOR_PATH}" fill="${C.cream100}" stroke="${C.bg}" stroke-width="1.1" stroke-linejoin="round"/></g></g>`);
  S.push(`</svg>`);
  return S.join('');
}
function bind(root){
  const q = k => root.querySelector(`[data-el="${k}"]`);
  return { recede:[...root.querySelectorAll('[data-recede]')],
    hover:q('hover'), sel:q('sel'), tether:q('tether'), panel:q('panel'),
    ddFocus:q('ddFocus'), ddPlace:q('ddPlace'), ddValue:q('ddValue'), chev:q('chev'),
    menu:q('menu'), menuScale:q('menuScale'), optHover:q('optHover'),
    focus:[q('focus0'),q('focus1')], type:[q('type0'),q('type1')], caret:[q('caret0'),q('caret1')],
    act:q('act'), rip:q('rip'), check:q('check'), tick:q('tick'), cursor:q('cursor') };
}

/* ---- the timeline: every number is a second ----------------- */
function render(E, t){
  const p = cursorAt(t);
  let dip = 1;
  CLICKS.forEach(c => { dip -= 0.12 * pulse(t, c.t, c.t+0.06, c.t+0.14); });
  E.cursor.setAttribute('transform', `translate(${p[0].toFixed(2)},${p[1].toFixed(2)}) scale(${dip.toFixed(3)})`);

  // one ripple element, reused: no two clicks overlap in time
  let rr = 0, ro = 0, rat = CLICKS[0].at;
  for (const c of CLICKS){
    const g = seg(t, c.t+0.05, c.t+0.61, EASE_OUT);
    if (g > 0 && g < 1){ rr = lerp(5, c.r1, g); ro = (1-g)*0.6; rat = c.at; break; }
  }
  E.rip.setAttribute('cx', rat[0]); E.rip.setAttribute('cy', rat[1]);
  E.rip.setAttribute('r', rr.toFixed(2)); E.rip.setAttribute('opacity', ro.toFixed(3));

  E.hover.setAttribute('opacity', (seg(t,1.00,1.25,EASE_OUT) - seg(t,1.35,1.47)).toFixed(3));
  E.sel.setAttribute('opacity', (seg(t,1.35,1.47,EASE_OUT) - seg(t,7.35,7.75,EASE)).toFixed(3));

  E.recede.forEach(g => {
    const d = +g.dataset.recede * 0.035;
    let o = lerp(1, .45, seg(t, 1.40+d, 1.95+d, EASE_OUT));
    o = lerp(o, .26, seg(t, 7.30+d, 7.85+d, EASE_OUT));
    o = lerp(o, 1,   seg(t, 9.25+d, 9.95+d, EASE));
    g.setAttribute('opacity', o.toFixed(3));
  });

  E.tether.setAttribute('opacity', (seg(t,1.50,1.68) - seg(t,7.25,7.50)).toFixed(3));
  E.tether.setAttribute('stroke-dashoffset', (TETHER*(1 - seg(t,1.50,1.92,EASE_OUT))).toFixed(2));

  const pIn = seg(t,1.40,1.95,EASE_OUT), pOut = seg(t,7.30,7.98,EASE_IO);
  E.panel.setAttribute('opacity', (pIn - pOut).toFixed(3));
  const ps  = lerp(lerp(.92, 1, pIn), .90, pOut);
  const pdy = lerp(lerp(10, 0, pIn), -5, pOut);
  E.panel.setAttribute('transform',
    `translate(${P.x + P.w/2},${(P.y + pdy).toFixed(2)}) scale(${ps.toFixed(4)}) translate(${-(P.x + P.w/2)},${-P.y})`);

  /* dropdown — hover, open, choose, close, and keep the choice */
  E.ddFocus.setAttribute('opacity', (seg(t,2.42,2.64,EASE_OUT) - seg(t,4.30,4.50)).toFixed(3));
  const open = seg(t,2.74,3.06,EASE_OUT) - seg(t,3.74,4.00,EASE);
  E.menu.setAttribute('opacity', open.toFixed(3));
  // grows downward out of the control it belongs to
  E.menuScale.setAttribute('transform',
    `translate(0,${MENU.y}) scale(1,${lerp(.6,1,open).toFixed(4)}) translate(0,${-MENU.y})`);
  E.optHover.setAttribute('opacity', (seg(t,3.46,3.64,EASE_OUT) - seg(t,3.80,3.96)).toFixed(3));
  E.chev.setAttribute('transform',
    `translate(${DD.x+DD.w-18},${DDC[1]}) rotate(${(180*open).toFixed(1)})`);
  const chosen = seg(t,3.86,4.14,EASE_OUT);
  E.ddValue.setAttribute('width', (VALUE_W*chosen).toFixed(2));
  E.ddPlace.setAttribute('opacity', (1 - chosen).toFixed(3));

  /* the two fields: focus, then the dot extends into a pill */
  const TYPE = [ {f:4.50, fo:5.40, a:4.60, b:5.30}, {f:5.74, fo:7.32, a:5.84, b:6.44} ];
  TYPE.forEach((k, i) => {
    E.focus[i].setAttribute('opacity', (seg(t,k.f,k.f+0.18,EASE_OUT) - seg(t,k.fo,k.fo+0.20)).toFixed(3));
    const g = seg(t, k.a, k.b, EASE_OUT);
    const w = lerp(3, TYPED[i], g);
    E.type[i].setAttribute('width', w.toFixed(2));
    E.caret[i].setAttribute('x', (FLD[i].x + 10 + w + 4).toFixed(2));
    // solid while typing, gone the moment focus leaves — carets do not
    // blink while a key is down, and a blinking caret on a loop is noise
    E.caret[i].setAttribute('opacity', (seg(t,k.f,k.f+0.12) - seg(t,k.fo,k.fo+0.12)).toFixed(3));
  });

  E.act.setAttribute('opacity', (seg(t,6.92,7.16,EASE_OUT) - seg(t,7.30,7.50)).toFixed(3));

  const ck = seg(t,7.36,8.06,EASE_OUT);
  E.check.setAttribute('transform',
    `translate(${lerp(PC[0],CHK[0],ck).toFixed(2)},${lerp(PC[1],CHK[1],ck).toFixed(2)}) scale(${lerp(.75,1.5,ck).toFixed(4)})`);
  E.check.setAttribute('opacity', (seg(t,7.36,7.66) - seg(t,9.30,9.90,EASE)).toFixed(3));
  E.tick.setAttribute('stroke-dashoffset', (32*(1 - seg(t,7.46,8.02,EASE_OUT))).toFixed(2));
}


return { make: makeScene, bind, render, dur: DUR };
})()
