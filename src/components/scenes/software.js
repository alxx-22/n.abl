/* Software — an application assembles, and an edit propagates on save. */

import { EASE, EASE_OUT, EASE_IO, LINEAR, seg, lerp, pulse, clamp, arc, C, cr, am, nextUid } from './engine.js'

export default (function(){
/* ---- geometry ----------------------------------------------
   Every pane now has symmetric padding. The list previously sat 16
   from its left edge and 4 from its right, and the detail pane 40
   and 24 — small enough to look like nothing in particular and
   large enough to make the whole app read as slightly off. */
const F={x:340,y:210,w:760,h:480,r:16,chrome:44};
const APP={x:364,y:278,w:712,h:388};
const DIV=[440,660];
const PAD=20;
const NAV_X=376, NAV_Y=i=>300+i*38, NAV_N=5;
const LIST={x:DIV[0]+PAD, w:DIV[1]-DIV[0]-PAD*2};          // 460, 180
const ROW_H=34, ROW_STEP=44, ROW_Y=i=>292+i*ROW_STEP, ROW_N=8;
const DX=DIV[1]+PAD, DW=APP.x+APP.w-DIV[1]-PAD*2;          // 680, 376
const FLD_Y=[348,386,424,462], CHIP_Y=506;
const MINI_Y=[556,578,600], MINI_W=(DW-40)/3, MINI_X=c=>DX+c*(MINI_W+20);
const CHIP_SLOT=i=>DX+i*((DW-8)/3);
const SAVE={x:DX+DW-96, y:626, w:96, h:28};

/* the home view — everything right of the rail, before the app
   splits itself in two */
const HOME_X=DIV[0]+24, HOME_W=APP.x+APP.w-DIV[0]-48;      // 464, 588
const CARD_W=(HOME_W-32)/3, CARD_X=i=>HOME_X+i*(CARD_W+16);
const HB={x:HOME_X, base:616, n:6, w:30, step:46};
const HB_H=[70,101,81,125,94,135];
const ACT_X=776, ACT_Y=[484,518,552,586], ACT_W=[168,132,196,150];

const REC=[
  { title:110, fields:[96,132,74,110],  chips:[.56,.78,.48], mini:[[.68,.46,.86],[.52,.78,.40],[.90,.38,.62]] },
  { title:86,  fields:[128,88,116,66],  chips:[.72,.50,.66], mini:[[.46,.88,.58],[.80,.42,.70],[.54,.74,.44]] },
  { title:132, fields:[78,118,96,140],  chips:[.60,.86,.42], mini:[[.84,.52,.66],[.44,.90,.60],[.72,.48,.82]] },
];
const RW1=[92,74,110,86,120,68,98,80], RW2=[54,68,44,60,50,72,58,46];

/* the journey */
const NAV_CLICK=3.88, VIEW_OUT=[3.92,4.28], DIV2=[4.10,4.52], LIST_IN=4.35, DET_IN=4.78;
const REC_EV=[ {t:6.02, row:4, rec:1, fill:6.08, dur:0.42}, {t:7.06, row:2, rec:2, fill:7.12, dur:0.34} ];
const CHIP_EV={ t:8.04, idx:1, a:8.10, b:8.40 };
const RETYPE ={ idx:2, t:9.00, focus:9.04, t0:9.10, t1:9.36, t2:9.95, w:142 };
const SAVE_EV={ t:10.62, flash:[10.66,11.00], prop:[10.82,11.30], tick:[10.88,11.18], gone:11.70 };
const PROP_W=126;                                    // what the list row becomes
const HOVERS=[
  {k:'nav', i:1, a:3.76, b:3.98}, {k:'row', i:4, a:5.90, b:6.12},
  {k:'row', i:2, a:6.94, b:7.16}, {k:'chip',i:1, a:7.92, b:8.14},
  {k:'fld', i:2, a:8.88, b:9.12}, {k:'save',i:0, a:10.50, b:10.74},
];
const CLICKS=[NAV_CLICK, REC_EV[0].t, REC_EV[1].t, CHIP_EV.t, RETYPE.t, SAVE_EV.t];

const navC=i=>[NAV_X+22, NAV_Y(i)+5];
const rowC=r=>[LIST.x+90, ROW_Y(r)+ROW_H/2];
const chipC=i=>[CHIP_SLOT(i)+30, CHIP_Y+9];
const fldC=i=>[DX+42, FLD_Y[i]+18];
const saveC=[SAVE.x+SAVE.w/2, SAVE.y+SAVE.h/2];
const OFF=[300,780], REST=[620,624];
const CURSOR_PATH='M1 1 L1 17.6 L5.3 13.7 L7.9 19 L10.9 17.7 L8.2 12.5 L13 12.3 Z';
const DUR=14.0;

function stateAt(t, ev, key, init){
  let i=0;
  for(let k=0;k<ev.length;k++) if (t>=ev[k].fill) i=k+1;
  if (i===0) return {a:init,b:init,p:1};
  const e=ev[i-1];
  return { a: i===1 ? init : ev[i-2][key], b: e[key], p: seg(t,e.fill,e.fill+e.dur,EASE_OUT) };
}
const swap=(a,b,p,delay)=>{ const q=clamp((p-delay)/(1-delay||1),0,1);
  return q<0.5 ? lerp(a,0,q*2) : lerp(0,b,(q-0.5)*2); };


function makeScene(){
  const u=nextUid(),S=[];
  S.push(`<svg viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="An empty panel divides into a navigation rail and a home view of summary cards and a chart. A cursor moves down the rail, which draws a second divider and re-lays the application into a record list and a detail pane. Two records are selected, a chip is toggled, a value is retyped, and a save propagates the change back into the list.">`);
  S.push(`<defs>`,
    `<radialGradient id="bA${u}"><stop offset="0" stop-color="${C.amber}" stop-opacity=".11"/><stop offset="1" stop-color="${C.amber}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="bB${u}"><stop offset="0" stop-color="${C.cream200}" stop-opacity=".075"/><stop offset="1" stop-color="${C.cream200}" stop-opacity="0"/></radialGradient>`,
    `<filter id="cu${u}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="#000" flood-opacity=".6"/></filter>`,
    `<filter id="gl${u}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="8"/></filter>`,
    `</defs>`);
  S.push(`<rect width="1440" height="900" fill="${C.bg}"/>`);
  S.push(`<ellipse cx="380" cy="170" rx="540" ry="380" fill="url(#bA${u})"/>`);
  S.push(`<ellipse cx="1120" cy="770" rx="500" ry="360" fill="url(#bB${u})"/>`);
  S.push(`<rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}" rx="${F.r}" fill="${C.frame}" stroke="${cr(.15)}"/>`);
  S.push(`<path d="M${F.x} ${F.y+F.chrome} H${F.x+F.w}" stroke="${cr(.09)}"/>`);
  const cy=F.y+F.chrome/2;
  for(let i=0;i<3;i++) S.push(`<circle cx="${F.x+26+i*15}" cy="${cy}" r="3.4" fill="${cr(.16)}"/>`);
  S.push(`<rect x="${F.x+F.w/2-120}" y="${cy-6}" width="240" height="12" rx="6" fill="${cr(.07)}"/>`);

  S.push(`<rect data-el="app" x="${APP.x}" y="${APP.y}" width="${APP.w}" height="${APP.h}" rx="10" fill="${C.s1}" stroke="${cr(.14)}" opacity="0"/>`);
  DIV.forEach((x,i)=> S.push(`<path data-el="div${i}" d="M${x} ${APP.y} V${APP.y+APP.h}" stroke="${cr(.14)}" stroke-dasharray="${APP.h}" stroke-dashoffset="${APP.h}"/>`));

  for(let i=0;i<NAV_N;i++){
    S.push(`<g data-el="nav${i}" opacity="0">`
      + `<rect x="${NAV_X}" y="${NAV_Y(i)}" width="11" height="11" rx="3" fill="${cr(.22)}"/>`
      + `<rect x="${NAV_X+18}" y="${NAV_Y(i)+3}" width="28" height="5" rx="2.5" fill="${cr(.16)}"/></g>`);
    S.push(`<rect data-el="navHov${i}" x="${NAV_X-8}" y="${NAV_Y(i)-6}" width="72" height="23" rx="6" fill="${cr(.06)}" opacity="0"/>`);
    S.push(`<g data-el="navOn${i}" opacity="0">`
      + `<rect x="${NAV_X}" y="${NAV_Y(i)}" width="11" height="11" rx="3" fill="${am(.8)}"/>`
      + `<rect x="${NAV_X+18}" y="${NAV_Y(i)+3}" width="34" height="5" rx="2.5" fill="${am(.6)}"/></g>`);
  }

  /* ---- home view ---- */
  S.push(`<g data-el="home">`);
  S.push(`<rect data-el="hp0" x="${HOME_X}" y="300" width="140" height="10" rx="5" fill="${cr(.30)}"/>`);
  [0,1,2].forEach(i=> S.push(`<g data-el="hp${i+1}">`
    + `<rect x="${CARD_X(i)}" y="328" width="${CARD_W}" height="84" rx="10" fill="${C.s2}" stroke="${cr(.13)}"/>`
    + `<rect x="${CARD_X(i)+16}" y="346" width="40" height="5" rx="2.5" fill="${cr(.19)}"/>`
    + `<rect x="${CARD_X(i)+16}" y="362" width="${[86,64,102][i]}" height="12" rx="6" fill="${i===1?C.amber:cr(.5)}"/>`
    + `<rect x="${CARD_X(i)+16}" y="386" width="${[56,72,48][i]}" height="4" rx="2" fill="${cr(.12)}"/></g>`));
  S.push(`<g data-el="hp4"><path d="M${HOME_X} 436 H${HOME_X+HOME_W}" stroke="${cr(.08)}"/>`
    + `<path d="M${HB.x} ${HB.base} H${HB.x+HB.step*(HB.n-1)+HB.w}" stroke="${cr(.11)}"/>`
    + HB_H.map((h,i)=>`<rect x="${HB.x+i*HB.step}" y="${HB.base-h}" width="${HB.w}" height="${h}" rx="3" fill="${i===HB.n-1?am(.7):cr(.22)}"/>`).join('')
    + `</g>`);
  S.push(`<g data-el="hp5">${ACT_Y.map((y,i)=>
      `<circle cx="${ACT_X+4}" cy="${y+3.5}" r="3.2" fill="${am(.8)}"/>`
    + `<rect x="${ACT_X+16}" y="${y}" width="${ACT_W[i]}" height="7" rx="3.5" fill="${cr(.26)}"/>`).join('')}</g>`);
  S.push(`</g>`);

  /* ---- working view ---- */
  for(let i=0;i<ROW_N;i++){
    S.push(`<g data-el="row${i}" opacity="0">`
      + `<rect x="${LIST.x}" y="${ROW_Y(i)}" width="${LIST.w}" height="${ROW_H}" rx="7" fill="${C.s2}" stroke="${cr(.10)}"/>`
      + `<rect data-el="rw1_${i}" x="${LIST.x+14}" y="${ROW_Y(i)+9}" width="0" height="6" rx="3" fill="${cr(.30)}"/>`
      + `<rect data-el="rw2_${i}" x="${LIST.x+14}" y="${ROW_Y(i)+21}" width="0" height="4" rx="2" fill="${cr(.13)}"/></g>`);
    S.push(`<rect data-el="hov${i}" x="${LIST.x}" y="${ROW_Y(i)}" width="${LIST.w}" height="${ROW_H}" rx="7" fill="${cr(.06)}" stroke="${cr(.20)}" opacity="0"/>`);
    S.push(`<g data-el="sel${i}" opacity="0">`
      + `<rect x="${LIST.x-4}" y="${ROW_Y(i)-4}" width="${LIST.w+8}" height="${ROW_H+8}" rx="11" fill="${am(.09)}" filter="url(#gl${u})"/>`
      + `<rect x="${LIST.x}" y="${ROW_Y(i)}" width="${LIST.w}" height="${ROW_H}" rx="7" fill="${C.s4}" stroke="${am(.75)}" stroke-width="1.2"/>`
      + `<rect data-el="sw1_${i}" x="${LIST.x+14}" y="${ROW_Y(i)+9}" width="0" height="6" rx="3" fill="${C.amber}"/>`
      + `<rect data-el="sw2_${i}" x="${LIST.x+14}" y="${ROW_Y(i)+21}" width="0" height="4" rx="2" fill="${am(.45)}"/></g>`);
  }
  S.push(`<g data-el="d0" opacity="0"><rect data-el="dTitle" x="${DX}" y="300" width="0" height="10" rx="5" fill="${cr(.34)}"/>`
    + `<rect x="${DX+DW-38}" y="299" width="38" height="12" rx="6" fill="${am(.18)}" stroke="${am(.5)}"/>`
    + `<path d="M${DX} 326 H${DX+DW}" stroke="${cr(.10)}"/></g>`);
  FLD_Y.forEach((y,i)=> S.push(`<g data-el="d${i+1}" opacity="0">`
    + `<rect x="${DX}" y="${y}" width="52" height="5" rx="2.5" fill="${cr(.17)}"/>`
    + `<rect data-el="fldBox${i}" x="${DX-10}" y="${y+6}" width="${DW+20}" height="24" rx="6" fill="none" stroke="${cr(.30)}" opacity="0"/>`
    + `<rect data-el="fld${i}" x="${DX}" y="${y+14}" width="0" height="8" rx="4" fill="${cr(.44)}"/>`
    + `<rect data-el="caret${i}" x="${DX}" y="${y+9}" width="1.2" height="18" fill="${cr(.55)}" opacity="0"/></g>`));
  S.push(`<g data-el="d5" opacity="0">${[0,1,2].map(i=>
      `<rect data-el="chipHov${i}" x="${CHIP_SLOT(i)-4}" y="${CHIP_Y-4}" width="0" height="26" rx="13" fill="${cr(.05)}" opacity="0"/>`
    + `<rect data-el="chip${i}" x="${CHIP_SLOT(i)}" y="${CHIP_Y}" width="0" height="18" rx="9" fill="none" stroke="${cr(.20)}"/>`
    + `<rect data-el="chipOn${i}" x="${CHIP_SLOT(i)}" y="${CHIP_Y}" width="0" height="18" rx="9" fill="${am(.18)}" stroke="${am(.8)}" opacity="0"/>`).join('')}</g>`);
  S.push(`<g data-el="d6" opacity="0"><path d="M${DX} 538 H${DX+DW}" stroke="${cr(.08)}"/>`
    + MINI_Y.map((y,r)=>[0,1,2].map(c=>
        `<rect data-el="mini${r}_${c}" x="${MINI_X(c)}" y="${y}" width="0" height="6" rx="3" fill="${cr(.13)}"/>`).join('')).join('')
    + `<rect data-el="saveHov" x="${SAVE.x-4}" y="${SAVE.y-4}" width="${SAVE.w+8}" height="${SAVE.h+8}" rx="12" fill="${cr(.05)}" opacity="0"/>`
    + `<rect x="${SAVE.x}" y="${SAVE.y}" width="${SAVE.w}" height="${SAVE.h}" rx="8" fill="none" stroke="${cr(.26)}"/>`
    + `<rect x="${SAVE.x+SAVE.w/2-16}" y="${SAVE.y+SAVE.h/2-1.5}" width="32" height="3" rx="1.5" fill="${cr(.34)}"/>`
    + `<g data-el="saveOn" opacity="0"><rect x="${SAVE.x}" y="${SAVE.y}" width="${SAVE.w}" height="${SAVE.h}" rx="8" fill="${am(.2)}" stroke="${am(.85)}"/>`
    + `<rect x="${SAVE.x+SAVE.w/2-16}" y="${SAVE.y+SAVE.h/2-1.5}" width="32" height="3" rx="1.5" fill="${C.amber200}"/></g>`
    + `<path data-el="tick" d="M${SAVE.x-38} ${SAVE.y+14} l6 6 l12 -13" fill="none" stroke="${C.amber}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="26" stroke-dashoffset="26" opacity="0"/>`
    + `</g>`);

  S.push(`<g data-el="cursor"><g transform="scale(1.5)" filter="url(#cu${u})">`
    + `<path d="${CURSOR_PATH}" fill="${C.cream100}" stroke="${C.bg}" stroke-width="1.1" stroke-linejoin="round"/></g></g>`);
  S.push(`</svg>`);
  return S.join('');
}
function bind(r){
  const q=k=>r.querySelector(`[data-el="${k}"]`);
  const N=n=>[...Array(n)].map((_,k)=>k);
  const mini=[]; for(let a=0;a<3;a++) mini.push([0,1,2].map(c=>q(`mini${a}_${c}`)));
  return { app:q('app'), div:[0,1].map(i=>q('div'+i)),
    nav:N(NAV_N).map(i=>q('nav'+i)), navHov:N(NAV_N).map(i=>q('navHov'+i)), navOn:N(NAV_N).map(i=>q('navOn'+i)),
    hp:N(6).map(i=>q('hp'+i)),
    row:N(ROW_N).map(i=>q('row'+i)), hov:N(ROW_N).map(i=>q('hov'+i)), sel:N(ROW_N).map(i=>q('sel'+i)),
    rw1:N(ROW_N).map(i=>q('rw1_'+i)), rw2:N(ROW_N).map(i=>q('rw2_'+i)),
    sw1:N(ROW_N).map(i=>q('sw1_'+i)), sw2:N(ROW_N).map(i=>q('sw2_'+i)),
    d:N(7).map(i=>q('d'+i)), dTitle:q('dTitle'),
    fld:N(4).map(i=>q('fld'+i)), fldBox:N(4).map(i=>q('fldBox'+i)), caret:N(4).map(i=>q('caret'+i)),
    chip:N(3).map(i=>q('chip'+i)), chipOn:N(3).map(i=>q('chipOn'+i)), chipHov:N(3).map(i=>q('chipHov'+i)),
    mini, saveHov:q('saveHov'), saveOn:q('saveOn'), tick:q('tick'), cursor:q('cursor') };
}

function render(E,t){
  const undo = seg(t,12.60,13.60,EASE);
  const appP = seg(t,0.35,0.80,EASE_OUT) - seg(t,13.30,13.75,EASE);
  const d1P  = seg(t,0.85,1.30,EASE_OUT) - seg(t,13.10,13.55,EASE);
  const d2P  = seg(t,DIV2[0],DIV2[1],EASE_OUT) - seg(t,13.10,13.55,EASE);
  E.app.setAttribute('opacity', appP.toFixed(3));
  E.div[0].setAttribute('stroke-dashoffset',(APP.h*(1-d1P)).toFixed(2));
  E.div[1].setAttribute('stroke-dashoffset',(APP.h*(1-d2P)).toFixed(2));
  E.nav.forEach((g,i)=>{
    const p=seg(t,1.15+i*0.06,1.50+i*0.06,EASE_OUT) - seg(t,12.90+i*0.02,13.25+i*0.02,EASE);
    g.setAttribute('opacity',p.toFixed(3));
    g.setAttribute('transform',`translate(${lerp(-8,0,p).toFixed(2)},0)`);
  });

  /* the rail opens on its first item and moves to the second */
  const navSw = seg(t, NAV_CLICK, NAV_CLICK+0.20, EASE_OUT);
  E.navHov.forEach((el,i)=>{ let o=0;
    HOVERS.forEach(h=>{ if(h.k==='nav'&&h.i===i) o=Math.max(o, seg(t,h.a,h.a+0.14)-seg(t,h.b,h.b+0.12)); });
    el.setAttribute('opacity',o.toFixed(3)); });
  E.navOn.forEach((g,i)=>{
    const o = i===0 ? (1-navSw) : i===1 ? navSw : 0;
    const inP = seg(t,1.15+i*0.06,1.50+i*0.06,EASE_OUT) - seg(t,12.90,13.25,EASE);
    g.setAttribute('opacity',(o*inP).toFixed(3));
  });

  /* home view: builds first, leaves when the rail moves */
  E.hp.forEach((g,i)=>{
    const p = seg(t,1.75+i*0.09,2.20+i*0.09,EASE_OUT) - seg(t,VIEW_OUT[0]+i*0.03,VIEW_OUT[1]+i*0.03,EASE);
    g.setAttribute('opacity',p.toFixed(3));
    g.setAttribute('transform',`translate(0,${lerp(10,0,Math.min(1,p+ (t>VIEW_OUT[0]?1:0))).toFixed(2)})`);
  });

  /* working view: arrives when the second divider does */
  const listIn = i=> seg(t,LIST_IN+i*0.05,LIST_IN+0.40+i*0.05,EASE_OUT) - seg(t,12.35+i*0.03,12.75+i*0.03,EASE);
  E.row.forEach((g,i)=>{
    const p=listIn(i);
    g.setAttribute('opacity',p.toFixed(3));
    g.setAttribute('transform',`translate(0,${lerp(8,0,p).toFixed(2)})`);
  });
  E.d.forEach((g,i)=>{
    const p=seg(t,DET_IN+i*0.05,DET_IN+0.38+i*0.05,EASE_OUT) - seg(t,12.15+i*0.03,12.55+i*0.03,EASE);
    g.setAttribute('opacity',p.toFixed(3));
  });

  /* --- the cursor's journey --- */
  let p;
  const legs=[
    [3.20,3.80,OFF,        navC(1),  80],
    [5.45,5.95,navC(1),    rowC(4),  40],
    [6.60,7.00,rowC(4),    rowC(2), -30],
    [7.55,7.98,rowC(2),    chipC(1), 34],
    [8.55,8.95,chipC(1),   fldC(2), -28],
    [10.15,10.55,fldC(2),  saveC,    26],
    [11.50,11.95,saveC,    REST,     20],
    [12.55,13.4,REST,      OFF,      70],
  ];
  p = legs[0][2];
  for (const [a,b,from,to,bow] of legs){ if (t < a) break; p = t <= b ? arc(from,to,seg(t,a,b,EASE),bow) : to; }
  let dip=1; CLICKS.forEach(c=>{ dip -= 0.12*pulse(t,c,c+0.06,c+0.14); });
  E.cursor.setAttribute('transform',`translate(${p[0].toFixed(2)},${p[1].toFixed(2)}) scale(${dip.toFixed(3)})`);

  const hovOf=(k,i)=>{ let o=0;
    HOVERS.forEach(h=>{ if(h.k===k&&h.i===i) o=Math.max(o, seg(t,h.a,h.a+0.14)-seg(t,h.b,h.b+0.12)); });
    return o; };

  /* records */
  E.hov.forEach((el,r)=> el.setAttribute('opacity',(hovOf('row',r)*listIn(r)).toFixed(3)));
  const rs = stateAt(t, REC_EV, 'row', 0), rc = stateAt(t, REC_EV, 'rec', 0);
  E.sel.forEach((g,r)=>{
    const o = lerp(rs.a===r?1:0, rs.b===r?1:0, rs.p);
    g.setAttribute('opacity',(clamp(o,0,1)*listIn(r)).toFixed(3));
  });
  /* the saved edit lands back on the record it came from */
  const prop = seg(t, SAVE_EV.prop[0], SAVE_EV.prop[1], EASE_OUT);
  E.rw1.forEach((el,i)=>{
    const w = (i===REC_EV[1].row) ? lerp(RW1[i], PROP_W, prop) : RW1[i];
    el.setAttribute('width', w.toFixed(2));
    E.sw1[i].setAttribute('width', w.toFixed(2));
    E.rw2[i].setAttribute('width', RW2[i]);
    E.sw2[i].setAttribute('width', RW2[i]);
  });

  /* detail */
  E.dTitle.setAttribute('width', lerp(REC[rc.a].title, REC[rc.b].title, rc.p).toFixed(2));
  E.fld.forEach((el,i)=>{
    let w = swap(REC[rc.a].fields[i], REC[rc.b].fields[i], rc.p, i*0.09);
    if (i===RETYPE.idx && t>=RETYPE.t0){
      w = lerp(w, 3, seg(t,RETYPE.t0,RETYPE.t1,EASE_OUT));
      w = lerp(w, RETYPE.w, seg(t,RETYPE.t1,RETYPE.t2,EASE_IO));
    }
    w = Math.max(0,w);
    el.setAttribute('width', w.toFixed(2));
    const foc = (i===RETYPE.idx)
      ? seg(t,RETYPE.focus,RETYPE.focus+0.16,EASE_OUT) - seg(t,SAVE_EV.t,SAVE_EV.t+0.2)
      : hovOf('fld',i)*0.5;
    E.fldBox[i].setAttribute('opacity', foc.toFixed(3));
    E.caret[i].setAttribute('x', (DX + w + 5).toFixed(2));
    E.caret[i].setAttribute('opacity',(i===RETYPE.idx ? seg(t,RETYPE.t0,RETYPE.t0+0.1)-seg(t,RETYPE.t2,RETYPE.t2+0.14) : 0).toFixed(3));
  });
  E.chip.forEach((el,i)=>{
    const w = Math.max(0, swap(REC[rc.a].chips[i]*88, REC[rc.b].chips[i]*88, rc.p, 0.06+i*0.06));
    el.setAttribute('width', w.toFixed(2));
    E.chipOn[i].setAttribute('width', w.toFixed(2));
    E.chipOn[i].setAttribute('opacity',(i===CHIP_EV.idx ? seg(t,CHIP_EV.a,CHIP_EV.b,EASE_OUT)-seg(t,12.15,12.55,EASE) : 0).toFixed(3));
    E.chipHov[i].setAttribute('width', (w+8).toFixed(2));
    E.chipHov[i].setAttribute('opacity', hovOf('chip',i).toFixed(3));
  });
  E.mini.forEach((row,r)=> row.forEach((el,c)=>{
    const a=REC[rc.a].mini[r][c]*MINI_W, b=REC[rc.b].mini[r][c]*MINI_W;
    el.setAttribute('width', Math.max(0,swap(a,b,rc.p,0.10+r*0.05)).toFixed(2));
  }));

  /* save, and the confirmation that it went somewhere */
  E.saveHov.setAttribute('opacity', hovOf('save',0).toFixed(3));
  E.saveOn.setAttribute('opacity',(seg(t,SAVE_EV.flash[0],SAVE_EV.flash[0]+0.10,EASE_OUT)-seg(t,SAVE_EV.flash[1],SAVE_EV.flash[1]+0.30)).toFixed(3));
  E.tick.setAttribute('opacity',(seg(t,SAVE_EV.tick[0],SAVE_EV.tick[0]+0.10)-seg(t,SAVE_EV.gone,SAVE_EV.gone+0.25)).toFixed(3));
  E.tick.setAttribute('stroke-dashoffset',(26*(1-seg(t,SAVE_EV.tick[0],SAVE_EV.tick[1],EASE_OUT))).toFixed(2));
}


return { make: makeScene, bind, render, dur: DUR };
})()
