/* Automation — a switch is flipped once and a pipeline builds itself. */

import { EASE, EASE_OUT, EASE_IO, LINEAR, seg, lerp, pulse, clamp, arc, C, cr, am, nextUid } from './engine.js'

export default (function(){
/* ---- geometry ---------------------------------------------- */
const F={x:340,y:210,w:760,h:480,r:16,chrome:44};
const SW={x:434,y:270,w:46,h:24}, SWC=[457,282];
const BW=92, BH=54;
const BOX=[ {x:434,y:343}, {x:580,y:343}, {x:726,y:312}, {x:726,y:380}, {x:914,y:343} ];
const BC=BOX.map(b=>[b.x+BW/2, b.y+BH/2]);
const CONN=[
  'M526 370 H580',
  'M672 370 H691 Q699 370 699 362 V347 Q699 339 707 339 H726',
  'M672 370 H691 Q699 370 699 378 V399 Q699 407 707 407 H726',
  'M818 339 H887 Q895 339 895 347 V362 Q895 370 903 370 H914',
  'M818 407 H887 Q895 407 895 399 V378 Q895 370 903 370 H914',
];
const RAIL=[
  'M480 370 H691 Q699 370 699 362 V347 Q699 339 707 339 H887 Q895 339 895 347 V362 Q895 370 903 370 H960',
  'M480 370 H691 Q699 370 699 378 V399 Q699 407 707 407 H887 Q895 407 895 399 V378 Q895 370 903 370 H960',
];

/* The readout is three separate readings, not one dashboard: what
   happened (a log), what it is worth (a stack), and where it is
   going (a trend). Three thirds of the same 572 the flow occupies,
   so the two bands share one measure. */
const ZA={x:434,w:172}, ZB={x:634,w:172}, ZC={x:834,w:172};
const HEAD_Y=468, RULE_Y=480;
const BUL_Y=[494,514,534,554,574,594], BUL_W=[120,96,138,108,126,112];
/* dealt back to front, each one lower and slightly left, so the ones
   behind show as edges — a deck, not three tiles in a row */
const CARDS=[{x:646,y:510},{x:640,y:518},{x:634,y:526}];
const CARD_W=150, CARD_H=64;
const GR={x:834,w:172,base:596,h:100};
const GV=[.22,.34,.28,.48,.42,.62,.70,.88];
const grX=i=>GR.x + i*(GR.w/(GV.length-1));
const grY=v=>GR.base - v*GR.h;
const LINE_D = GV.map((v,i)=>`${i?'L':'M'}${grX(i).toFixed(1)} ${grY(v).toFixed(1)}`).join(' ');
const AREA_D = LINE_D + ` L${grX(GV.length-1).toFixed(1)} ${GR.base} L${grX(0).toFixed(1)} ${GR.base} Z`;

const HOME=[300,780], EXIT=[232,838];
const CURSOR_PATH='M1 1 L1 17.6 L5.3 13.7 L7.9 19 L10.9 17.7 L8.2 12.5 L13 12.3 Z';
const DUR=11.2;

const BUILD=[
  { box:0, wipe:[1.70,2.02] },
  { conn:0, draw:[2.05,2.45], box:1, wipe:[2.36,2.68] },
  { conn:1, draw:[2.74,3.20], box:2, wipe:[3.10,3.42] },
  { conn:2, draw:[2.74,3.20], box:3, wipe:[3.10,3.42] },
  { conn:3, draw:[3.48,3.94], box:4, wipe:[3.84,4.18] },
  { conn:4, draw:[3.48,3.94] },
];
const SPAWN=[4.35,4.85,5.35,5.85,6.35,6.85], TRAVEL=1.5;


function makeScene(){
  const u=nextUid(),S=[];
  S.push(`<svg viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A cursor flips one switch and leaves. A pipeline then draws itself step by step, branching into two paths and converging again. Work flows through it, and three readouts fill in beneath: a log of completed items, a stack of value cards, and a rising trend line.">`);
  S.push(`<defs>`,
    `<radialGradient id="bA${u}"><stop offset="0" stop-color="${C.amber}" stop-opacity=".11"/><stop offset="1" stop-color="${C.amber}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="bB${u}"><stop offset="0" stop-color="${C.cream200}" stop-opacity=".075"/><stop offset="1" stop-color="${C.cream200}" stop-opacity="0"/></radialGradient>`,
    `<filter id="cu${u}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="#000" flood-opacity=".6"/></filter>`,
    `<filter id="gl${u}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="8"/></filter>`,
    `<filter id="cs${u}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#000" flood-opacity=".45"/></filter>`,
    `<linearGradient id="ar${u}" x1="0" y1="${GR.base-GR.h}" x2="0" y2="${GR.base}" gradientUnits="userSpaceOnUse">`
    + `<stop offset="0" stop-color="${C.amber}" stop-opacity=".20"/>`
    + `<stop offset="1" stop-color="${C.amber}" stop-opacity=".015"/></linearGradient>`);
  BOX.forEach((b,i)=> S.push(
    `<clipPath id="w${i}_${u}"><rect data-el="clip${i}" x="${b.x-14}" y="${b.y-16}" width="0" height="${BH+32}"/></clipPath>`));
  S.push(`<clipPath id="area${u}"><rect data-el="areaClip" x="${GR.x}" y="${GR.base-GR.h-8}" width="0" height="${GR.h+10}"/></clipPath>`);
  S.push(`</defs>`);

  S.push(`<rect width="1440" height="900" fill="${C.bg}"/>`);
  S.push(`<ellipse cx="380" cy="170" rx="540" ry="380" fill="url(#bA${u})"/>`);
  S.push(`<ellipse cx="1120" cy="770" rx="500" ry="360" fill="url(#bB${u})"/>`);
  S.push(`<rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}" rx="${F.r}" fill="${C.frame}" stroke="${cr(.15)}"/>`);
  S.push(`<path d="M${F.x} ${F.y+F.chrome} H${F.x+F.w}" stroke="${cr(.09)}"/>`);
  const cy=F.y+F.chrome/2;
  for(let i=0;i<3;i++) S.push(`<circle cx="${F.x+26+i*15}" cy="${cy}" r="3.4" fill="${cr(.16)}"/>`);
  S.push(`<rect x="${F.x+F.w/2-120}" y="${cy-6}" width="240" height="12" rx="6" fill="${cr(.07)}"/>`);

  S.push(`<rect x="${SW.x}" y="${SW.y}" width="${SW.w}" height="${SW.h}" rx="12" fill="${C.s1}" stroke="${cr(.16)}"/>`);
  S.push(`<rect data-el="swOn" x="${SW.x}" y="${SW.y}" width="${SW.w}" height="${SW.h}" rx="12" fill="${am(.22)}" stroke="${am(.75)}" opacity="0"/>`);
  S.push(`<circle data-el="swKnob" cx="${SW.x+12}" cy="${SWC[1]}" r="8.5" fill="${cr(.42)}"/>`);
  S.push(`<rect x="${SW.x+SW.w+16}" y="${SWC[1]-3.5}" width="110" height="7" rx="3.5" fill="${cr(.14)}"/>`);

  CONN.forEach((d,i)=>{
    S.push(`<path data-el="conn${i}" d="${d}" fill="none" stroke="${cr(.20)}" stroke-width="1.4" stroke-linecap="round"/>`);
    S.push(`<polygon data-el="head${i}" points="0,-4.2 8.5,0 0,4.2" fill="${C.amber}" opacity="0"/>`);
  });
  RAIL.forEach((d,i)=> S.push(`<path data-el="rail${i}" d="${d}" fill="none" stroke="none"/>`));

  BOX.forEach((b,i)=> S.push(`<g clip-path="url(#w${i}_${u})">`
    + `<rect x="${b.x}" y="${b.y}" width="${BW}" height="${BH}" rx="10" fill="${C.s2}" stroke="${cr(.18)}"/>`
    + `<rect x="${b.x+16}" y="${b.y+18}" width="${BW-32}" height="3" rx="1.5" fill="${cr(.24)}"/>`
    + `<rect x="${b.x+16}" y="${b.y+30}" width="${BW-48}" height="3" rx="1.5" fill="${cr(.13)}"/>`
    + `<g data-el="lit${i}" opacity="0">`
      + `<rect x="${b.x-5}" y="${b.y-5}" width="${BW+10}" height="${BH+10}" rx="14" fill="${am(.10)}" filter="url(#gl${u})"/>`
      + `<rect x="${b.x}" y="${b.y}" width="${BW}" height="${BH}" rx="10" fill="${C.s4}" stroke="${am(.7)}" stroke-width="1.25"/>`
      + `<rect x="${b.x+16}" y="${b.y+18}" width="${BW-32}" height="3" rx="1.5" fill="${C.amber}"/>`
      + `<rect x="${b.x+16}" y="${b.y+30}" width="${BW-48}" height="3" rx="1.5" fill="${am(.5)}"/></g>`
    + `</g>`));

  SPAWN.forEach((_,k)=> S.push(`<rect data-el="pay${k}" x="0" y="0" width="15" height="6" rx="3" fill="${C.amber}" opacity="0"/>`));

  /* --- readout: three headers on one line, three readings under it --- */
  [ZA,ZB,ZC].forEach((Z,i)=>{
    S.push(`<g data-el="zhead${i}" opacity="0">`
      + `<rect x="${Z.x}" y="${HEAD_Y}" width="44" height="5" rx="2.5" fill="${cr(.20)}"/>`
      + `<path d="M${Z.x} ${RULE_Y} H${Z.x+Z.w}" stroke="${cr(.10)}"/></g>`);
  });
  // A — what happened
  BUL_Y.forEach((y,k)=> S.push(`<g data-el="bul${k}" opacity="0">`
    + `<circle cx="${ZA.x+4}" cy="${y+3.5}" r="3.2" fill="${am(.85)}"/>`
    + `<rect x="${ZA.x+16}" y="${y}" width="${BUL_W[k]}" height="7" rx="3.5" fill="${cr(.28)}"/></g>`));
  // B — what it is worth, as a deck
  CARDS.forEach((c,i)=>{
    const front = i===CARDS.length-1;
    S.push(`<g data-el="card${i}" opacity="0">`
      + `<rect x="${c.x}" y="${c.y}" width="${CARD_W}" height="${CARD_H}" rx="10" `
      + `fill="${front?C.s2:C.s1}" stroke="${front?cr(.20):cr(.12)}"${front?` filter="url(#cs${u})"`:''}/>`
      + (front
          ? `<rect x="${c.x+14}" y="${c.y+14}" width="40" height="5" rx="2.5" fill="${cr(.20)}"/>`
          + `<rect data-el="cardVal" x="${c.x+14}" y="${c.y+28}" width="0" height="11" rx="5.5" fill="${C.amber}"/>`
          + `<rect x="${c.x+14}" y="${c.y+48}" width="54" height="4" rx="2" fill="${cr(.13)}"/>`
          + `<rect x="${c.x+78}" y="${c.y+48}" width="30" height="4" rx="2" fill="${cr(.08)}"/>`
          : `<rect x="${c.x+14}" y="${c.y+14}" width="34" height="4" rx="2" fill="${cr(.10)}"/>`)
      + `</g>`);
  });
  // C — where it is going
  S.push(`<path data-el="grBase" d="M${GR.x} ${GR.base} H${GR.x+GR.w}" stroke="${cr(.10)}" opacity="0"/>`);
  S.push(`<g clip-path="url(#area${u})"><path d="${AREA_D}" fill="url(#ar${u})" stroke="none"/></g>`);
  S.push(`<path data-el="grLine" d="${LINE_D}" fill="none" stroke="${C.amber}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`);
  S.push(`<circle data-el="grDot" r="3.6" fill="${C.amber200}" opacity="0"/>`);

  S.push(`<circle data-el="rip" cx="${SWC[0]}" cy="${SWC[1]}" r="0" fill="none" stroke="${am(.7)}" stroke-width="1.5" opacity="0"/>`);
  S.push(`<g data-el="cursor"><g transform="scale(1.5)" filter="url(#cu${u})">`
    + `<path d="${CURSOR_PATH}" fill="${C.cream100}" stroke="${C.bg}" stroke-width="1.1" stroke-linejoin="round"/></g></g>`);
  S.push(`</svg>`);
  return S.join('');
}
function bind(r){
  const q=k=>r.querySelector(`[data-el="${k}"]`);
  const conn=CONN.map((_,i)=>q('conn'+i)), rail=RAIL.map((_,i)=>q('rail'+i));
  const grLine=q('grLine');
  return { swOn:q('swOn'), swKnob:q('swKnob'), rip:q('rip'), cursor:q('cursor'),
    clip:BOX.map((_,i)=>q('clip'+i)), lit:BOX.map((_,i)=>q('lit'+i)),
    conn, connLen:conn.map(p=>p.getTotalLength()), head:CONN.map((_,i)=>q('head'+i)),
    rail, railLen:rail.map(p=>p.getTotalLength()), pay:SPAWN.map((_,k)=>q('pay'+k)),
    zhead:[0,1,2].map(i=>q('zhead'+i)), bul:BUL_Y.map((_,k)=>q('bul'+k)),
    card:CARDS.map((_,i)=>q('card'+i)), cardVal:q('cardVal'),
    grBase:q('grBase'), grLine, grLen:grLine.getTotalLength(),
    grDot:q('grDot'), areaClip:q('areaClip') };
}
function tipOn(path, L, p){
  const d=clamp(L*p,0.2,L);
  const a=path.getPointAtLength(d), b=path.getPointAtLength(Math.max(0,d-3));
  return [a.x,a.y,Math.atan2(a.y-b.y,a.x-b.x)*180/Math.PI];
}

function render(E,t){
  let p;
  if (t < 0.30)      p = HOME;
  else if (t < 1.05) p = arc(HOME, SWC, seg(t,0.30,1.05,EASE), 70);
  else if (t < 1.55) p = SWC;
  else if (t < 2.25) p = arc(SWC, EXIT, seg(t,1.55,2.25,EASE), -70);
  else if (t < 10.3) p = EXIT;
  else               p = arc(EXIT, HOME, seg(t,10.3,11.0,EASE), 40);
  E.cursor.setAttribute('transform',
    `translate(${p[0].toFixed(2)},${p[1].toFixed(2)}) scale(${(1-0.12*pulse(t,1.24,1.30,1.38)).toFixed(3)})`);
  const rg=seg(t,1.28,1.88,EASE_OUT);
  E.rip.setAttribute('r', lerp(6,30,rg).toFixed(2));
  E.rip.setAttribute('opacity',(rg>0&&rg<1?(1-rg)*0.6:0).toFixed(3));

  const on=seg(t,1.32,1.64,EASE_OUT) - seg(t,10.45,10.8,EASE);
  E.swOn.setAttribute('opacity', on.toFixed(3));
  E.swKnob.setAttribute('cx', lerp(SW.x+12, SW.x+SW.w-12, on).toFixed(2));
  E.swKnob.setAttribute('fill', on>.5 ? C.amber200 : cr(.42));

  const undo = seg(t,10.30,10.95,EASE);
  BUILD.forEach(step=>{
    if (step.conn !== undefined){
      const i=step.conn, L=E.connLen[i], g=seg(t, step.draw[0], step.draw[1], EASE_OUT);
      E.conn[i].setAttribute('stroke-dasharray', L);
      E.conn[i].setAttribute('stroke-dashoffset', (L*(1-g) + L*undo).toFixed(2));
      const [hx,hy,ha]=tipOn(E.conn[i], L, g);
      E.head[i].setAttribute('transform',`translate(${hx.toFixed(2)},${hy.toFixed(2)}) rotate(${ha.toFixed(1)})`);
      E.head[i].setAttribute('opacity', ((g>0&&g<1?1:0)*(1-undo)).toFixed(3));
    }
    if (step.box !== undefined)
      E.clip[step.box].setAttribute('width',
        (seg(t, step.wipe[0], step.wipe[1], EASE_OUT)*(1-undo)*(BW+28)).toFixed(2));
  });

  const lit=BC.map(()=>0);
  SPAWN.forEach((s0,k)=>{
    const g=seg(t, s0, s0+TRAVEL, LINEAR), live=g>0&&g<1;
    const r=E.rail[k%2], L=E.railLen[k%2];
    if (live){
      const pt=r.getPointAtLength(L*g);
      E.pay[k].setAttribute('x',(pt.x-7.5).toFixed(2));
      E.pay[k].setAttribute('y',(pt.y-3).toFixed(2));
      BC.forEach((c,i)=>{ lit[i]=Math.max(lit[i], clamp(1-Math.hypot(pt.x-c[0],pt.y-c[1])/70,0,1)); });
    }
    E.pay[k].setAttribute('opacity',(live?clamp(Math.min(g*16,(1-g)*16),0,1)*0.95:0).toFixed(3));
  });
  lit.forEach((v,i)=> E.lit[i].setAttribute('opacity',(v*(1-undo)).toFixed(3)));

  /* --- the three readouts --- */
  E.zhead.forEach((h,i)=>
    h.setAttribute('opacity',((seg(t,4.90+i*0.12,5.24+i*0.12,EASE_OUT))*(1-undo)).toFixed(3)));

  // A: one line per item that finished, in the order they finished
  SPAWN.forEach((s0,k)=>{
    const land=s0+TRAVEL;
    const g=seg(t, land, land+0.34, EASE_OUT);
    E.bul[k].setAttribute('opacity',(g*(1-undo)).toFixed(3));
    E.bul[k].setAttribute('transform',`translate(0,${lerp(6,0,g).toFixed(2)})`);
  });

  // B: the deck is dealt back to front, then the front card fills
  CARDS.forEach((_,i)=>{
    const g=seg(t, 5.05+i*0.18, 5.45+i*0.18, EASE_OUT);
    E.card[i].setAttribute('opacity',(g*(1-undo)).toFixed(3));
    E.card[i].setAttribute('transform',`translate(0,${lerp(-10,0,g).toFixed(2)})`);
  });
  E.cardVal.setAttribute('width',(92*seg(t,5.90,8.40,EASE_IO)*(1-undo)).toFixed(2));

  // C: the line draws, its fill follows it, and a dot rides the tip
  const gl=seg(t,5.60,8.60,EASE_IO)*(1-undo);
  E.grBase.setAttribute('opacity',(seg(t,5.20,5.60,EASE_OUT)*(1-undo)).toFixed(3));
  E.grLine.setAttribute('stroke-dasharray', E.grLen);
  E.grLine.setAttribute('stroke-dashoffset',(E.grLen*(1-gl)).toFixed(2));
  E.areaClip.setAttribute('width',(GR.w*gl).toFixed(2));
  const [dx,dy]=tipOn(E.grLine, E.grLen, gl);
  E.grDot.setAttribute('cx',dx.toFixed(2)); E.grDot.setAttribute('cy',dy.toFixed(2));
  E.grDot.setAttribute('opacity',(gl>0.02?(1-undo):0).toFixed(3));
}


return { make: makeScene, bind, render, dur: DUR };
})()
