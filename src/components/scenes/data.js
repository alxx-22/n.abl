/* Data & Analytics — ragged rows are cleaned, then stand up as an answer. */

import { EASE, EASE_OUT, EASE_IO, LINEAR, seg, lerp, pulse, clamp, arc, C, cr, am, nextUid } from './engine.js'

export default (function(){
/* ---- geometry ----------------------------------------------
   The table and the chart occupy the same region, because they are
   the same objects at two moments. */
const F={x:340,y:210,w:760,h:480,r:16,chrome:44};
const TX=500, ROW_H=20, ROW_STEP=30, ROW_Y0=320;
const COLW=[176,112,84], COLX=[500,692,820];        // cleaned columns
const N=8, DUPE=4;                                   // row 4 duplicates row 3
const rowY=i=>ROW_Y0 + i*ROW_STEP;
/* the mess: ragged left edges, inconsistent widths, two holes, and a
   row that is simply there twice */
const OFF=[0,16,-10,24,24,8,20,-6];
const WMUL=[[.86,1.14,.72],[1.12,.78,1.22],[.74,1.20,.88],[1.18,.92,.68],
            [1.18,.92,.68],[.82,1.08,1.16],[1.06,.84,.94],[.92,1.16,.78]];
const HOLE=[[1,2],[5,1]];                            // row, column
const isHole=(r,c)=>HOLE.some(h=>h[0]===r&&h[1]===c);
/* rows that survive the clean, in order — these become the bars */
const KEEP=[0,1,2,3,5,6,7];
const BASE=590, BARW=44, BARX=i=>512+i*64;
const BARH=[64,101,74,117,90,154,110];
const PEAK=5;
const REF_Y=BASE-BARH[PEAK];
const CARD={x:892,y:398,w:136,h:52};
const SEL0=[496,312], SEL1=[948,562];
const HOME=[300,780], PEAKC=[BARX(PEAK)+BARW/2, BASE-BARH[PEAK]+16];
const CURSOR_PATH='M1 1 L1 17.6 L5.3 13.7 L7.9 19 L10.9 17.7 L8.2 12.5 L13 12.3 Z';
const DUR=11.0;


function makeScene(){
  const u=nextUid(),S=[];
  S.push(`<svg viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A cursor drags a selection across a table of ragged, misaligned data. The rows align, missing values fill in, a duplicate row collapses, and then the value column stands up into a bar chart where one reading resolves as the answer.">`);
  S.push(`<defs>`,
    `<radialGradient id="bA${u}"><stop offset="0" stop-color="${C.amber}" stop-opacity=".11"/><stop offset="1" stop-color="${C.amber}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="bB${u}"><stop offset="0" stop-color="${C.cream200}" stop-opacity=".075"/><stop offset="1" stop-color="${C.cream200}" stop-opacity="0"/></radialGradient>`,
    `<filter id="cu${u}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="#000" flood-opacity=".6"/></filter>`,
    `<filter id="gl${u}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>`,
    `<filter id="cs${u}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#000" flood-opacity=".45"/></filter>`,
    `</defs>`);
  S.push(`<rect width="1440" height="900" fill="${C.bg}"/>`);
  S.push(`<ellipse cx="380" cy="170" rx="540" ry="380" fill="url(#bA${u})"/>`);
  S.push(`<ellipse cx="1120" cy="770" rx="500" ry="360" fill="url(#bB${u})"/>`);
  S.push(`<rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}" rx="${F.r}" fill="${C.frame}" stroke="${cr(.15)}"/>`);
  S.push(`<path d="M${F.x} ${F.y+F.chrome} H${F.x+F.w}" stroke="${cr(.09)}"/>`);
  const cy=F.y+F.chrome/2;
  for(let i=0;i<3;i++) S.push(`<circle cx="${F.x+26+i*15}" cy="${cy}" r="3.4" fill="${cr(.16)}"/>`);
  S.push(`<rect x="${F.x+F.w/2-120}" y="${cy-6}" width="240" height="12" rx="6" fill="${cr(.07)}"/>`);
  // a page heading, so the table reads as sitting in something
  S.push(`<rect x="${TX}" y="286" width="132" height="9" rx="4.5" fill="${cr(.22)}"/>`);

  S.push(`<path data-el="base" d="M500 ${BASE} H952" stroke="${cr(.13)}" opacity="0"/>`);
  S.push(`<path data-el="ref" d="M500 ${REF_Y} H952" stroke="${am(.38)}" stroke-width="1.2" stroke-dasharray="4 5" opacity="0"/>`);

  // every cell of every row — cell 0 is the one that becomes a bar
  for(let r=0;r<N;r++) for(let c=0;c<3;c++){
    const hole=isHole(r,c);
    S.push(`<rect data-el="c${r}_${c}" x="0" y="0" width="0" height="${ROW_H}" rx="5" `
      + `fill="${C.s3}" stroke="${cr(.16)}"/>`);
    if (hole) S.push(`<rect data-el="h${r}_${c}" x="0" y="0" width="0" height="${ROW_H}" rx="5" `
      + `fill="${C.bgAlt||'#13100E'}" stroke="${cr(.28)}" stroke-dasharray="3 3"/>`);
  }
  // the peak, lit, drawn over its own base bar
  S.push(`<g data-el="peak" opacity="0">`
    + `<rect x="${BARX(PEAK)-5}" y="${BASE-BARH[PEAK]-5}" width="${BARW+10}" height="${BARH[PEAK]+10}" rx="12" fill="${am(.10)}" filter="url(#gl${u})"/>`
    + `<rect x="${BARX(PEAK)}" y="${BASE-BARH[PEAK]}" width="${BARW}" height="${BARH[PEAK]}" rx="5" fill="${am(.30)}" stroke="${C.amber}" stroke-width="1.25"/></g>`);
  S.push(`<circle data-el="peakDot" cx="${BARX(PEAK)+BARW/2}" cy="${REF_Y}" r="4" fill="${C.amber200}" opacity="0"/>`);

  // the reading, beside the peak
  S.push(`<g data-el="card" opacity="0">`
    + `<rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="10" fill="${C.s2}" stroke="${cr(.18)}" filter="url(#cs${u})"/>`
    + `<rect x="${CARD.x+14}" y="${CARD.y+13}" width="36" height="4" rx="2" fill="${cr(.20)}"/>`
    + `<rect data-el="cardVal" x="${CARD.x+14}" y="${CARD.y+27}" width="0" height="10" rx="5" fill="${C.amber}"/></g>`);

  S.push(`<rect data-el="sel" x="0" y="0" width="0" height="0" rx="4" fill="${am(.07)}" stroke="${am(.5)}" stroke-dasharray="4 4" opacity="0"/>`);
  S.push(`<g data-el="cursor"><g transform="scale(1.5)" filter="url(#cu${u})">`
    + `<path d="${CURSOR_PATH}" fill="${C.cream100}" stroke="${C.bg}" stroke-width="1.1" stroke-linejoin="round"/></g></g>`);
  S.push(`</svg>`);
  return S.join('');
}
function bind(r){
  const q=k=>r.querySelector(`[data-el="${k}"]`);
  const cell=[],hole=[];
  for(let i=0;i<N;i++){ cell.push([0,1,2].map(c=>q(`c${i}_${c}`)));
    hole.push([0,1,2].map(c=>q(`h${i}_${c}`))); }
  return { cell, hole, base:q('base'), ref:q('ref'), peak:q('peak'), peakDot:q('peakDot'),
    card:q('card'), cardVal:q('cardVal'), sel:q('sel'), cursor:q('cursor') };
}

function render(E,t){
  /* --- the selection gesture: press, drag, release --- */
  const drag = seg(t,1.15,1.95,EASE);
  let p;
  if      (t < 0.30) p = HOME;
  else if (t < 1.05) p = arc(HOME, SEL0, seg(t,0.30,1.05,EASE), 80);
  else if (t < 1.15) p = SEL0;
  else if (t < 2.10) p = [lerp(SEL0[0],SEL1[0],drag), lerp(SEL0[1],SEL1[1],drag)];
  else if (t < 6.85) p = SEL1;
  else if (t < 7.55) p = arc(SEL1, PEAKC, seg(t,6.85,7.55,EASE), -60);
  else if (t < 9.60) p = PEAKC;
  else               p = arc(PEAKC, HOME, seg(t,9.60,10.5,EASE), 70);
  // held down for the whole drag, not dipped once
  const held = seg(t,1.05,1.14) - seg(t,1.98,2.08);
  E.cursor.setAttribute('transform',
    `translate(${p[0].toFixed(2)},${p[1].toFixed(2)}) scale(${(1-0.10*held).toFixed(3)})`);

  const selOn = seg(t,1.10,1.22) - seg(t,2.02,2.24);
  E.sel.setAttribute('opacity', selOn.toFixed(3));
  E.sel.setAttribute('x', Math.min(SEL0[0],p[0]).toFixed(2));
  E.sel.setAttribute('y', Math.min(SEL0[1],p[1]).toFixed(2));
  E.sel.setAttribute('width', Math.abs(p[0]-SEL0[0]).toFixed(2));
  E.sel.setAttribute('height', Math.abs(p[1]-SEL0[1]).toFixed(2));

  /* --- phases. Each runs forward, then back in reverse order, so the
         frame unbuilds the way it was built. --- */
  const fillP = seg(t,2.75,3.30,EASE_OUT) - seg(t,10.05,10.55,EASE);
  const dupeP = seg(t,3.35,3.90,EASE_OUT) - seg(t,9.95,10.45,EASE);
  const colsP = seg(t,3.98,4.48,EASE_OUT) - seg(t,9.80,10.30,EASE);
  const baseP = seg(t,5.30,5.78,EASE_OUT) - seg(t,9.62,10.02,EASE);
  const insP  = seg(t,6.15,6.72,EASE_OUT) - seg(t,9.34,9.74,EASE);
  const cardP = seg(t,7.60,7.98,EASE_OUT) - seg(t,9.18,9.52,EASE);

  for (let r=0; r<N; r++){
    // alignment is staggered top to bottom, so the table tidies as a wave
    const al = seg(t, 2.25+r*0.05, 2.85+r*0.05, EASE_OUT) - seg(t, 10.15, 10.70, EASE);
    const j  = KEEP.indexOf(r);
    const dead = r===DUPE;
    // rows below the duplicate close the gap it leaves
    const shift = (r>DUPE ? -ROW_STEP*dupeP : 0);
    const y = rowY(r) + shift;

    for (let c=0; c<3; c++){
      const el=E.cell[r][c], ho=E.hole[r][c], hole=isHole(r,c);
      const mx = COLX[c] + OFF[r], mw = COLW[c]*WMUL[r][c];
      let x = lerp(mx, COLX[c], al), w = lerp(mw, COLW[c], al), yy = y, h = ROW_H;
      let op = 1;
      if (hole) { w *= fillP; op = fillP; }              // the gap fills in
      if (dead) { h = ROW_H*(1-dupeP); op *= (1-dupeP); } // the duplicate collapses
      if (c>0)  op *= (1-colsP);                          // metadata leaves before the lift

      // cell 0 of a surviving row stands up into its bar
      if (c===0 && j>=0){
        const st = seg(t, 4.55+j*0.07, 5.55+j*0.07, EASE) - seg(t, 9.55+j*0.03, 10.15+j*0.03, EASE);
        x  = lerp(x, BARX(j), st);
        yy = lerp(yy, BASE-BARH[j], st);
        w  = lerp(w, BARW, st);
        h  = lerp(h, BARH[j], st);
      }
      el.setAttribute('x',x.toFixed(2)); el.setAttribute('y',yy.toFixed(2));
      el.setAttribute('width',Math.max(0,w).toFixed(2)); el.setAttribute('height',Math.max(0,h).toFixed(2));
      el.setAttribute('opacity',clamp(op,0,1).toFixed(3));
      if (ho){ // the dashed outline of a hole, shown until it is filled
        ho.setAttribute('x',lerp(mx,COLX[c],al).toFixed(2)); ho.setAttribute('y',yy.toFixed(2));
        ho.setAttribute('width',Math.max(0,lerp(mw,COLW[c],al)).toFixed(2));
        ho.setAttribute('height',h.toFixed(2));
        ho.setAttribute('opacity',((1-fillP)*(c>0?(1-colsP):1)).toFixed(3));
      }
    }
  }

  E.base.setAttribute('opacity', baseP.toFixed(3));
  E.ref.setAttribute('opacity', (insP*0.9).toFixed(3));
  E.ref.setAttribute('stroke-dasharray', `4 5`);
  E.peak.setAttribute('opacity', insP.toFixed(3));
  E.peakDot.setAttribute('opacity', insP.toFixed(3));
  E.card.setAttribute('opacity', cardP.toFixed(3));
  E.card.setAttribute('transform', `translate(0,${lerp(-8,0,cardP).toFixed(2)})`);
  E.cardVal.setAttribute('width', (78*(seg(t,7.75,8.60,EASE_IO) - seg(t,9.18,9.50,EASE))).toFixed(2));
}


return { make: makeScene, bind, render, dur: DUR };
})()
