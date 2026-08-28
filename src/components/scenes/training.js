/* Training & Support — a resource pack is made, then fans out to a team. */

import { EASE, EASE_OUT, EASE_IO, LINEAR, seg, lerp, pulse, clamp, arc, C, cr, am, nextUid } from './engine.js'

export default (function(){
/* ---- geometry ---------------------------------------------- */
const F={x:340,y:210,w:760,h:480,r:16,chrome:44};
const SRC={x:392,y:372,w:156,h:176};
const SRC_LINES=[[424,108],[442,88],[460,116],[478,74]];
const CTRL={x:408,y:508,w:124,h:28};
const SRC_C=[SRC.x+SRC.w/2, SRC.y+SRC.h/2];              // 470, 460
const PN=4, ROW={x:712,w:196,h:60}, ROW_Y=[336,412,488,564];
const rowC=i=>ROW_Y[i]+ROW.h/2;
const OUT_X=930, OUT_W=[104,78,118,92];
const LINK=i=>`M${SRC.x+SRC.w} 460 C${SRC.x+SRC.w+76} 460, ${ROW.x-76} ${rowC(i)}, ${ROW.x} ${rowC(i)}`;

/* the resource pack — opens out of the card that made it */
const PK={x:420,y:284,w:610,h:382};
const PK_BODY={y:336,h:330};                              // below the header
const CLOSE_C=[996,310];
const VID={x:444,y:352,w:360,h:202};
const VID_ROWS=[396,432,468];                             // what the video is showing
const NAR=[752,453,34];                                   // the narrator, middle-right
const PLAY_C=[560,453];
const STEP_X=828, STEP_Y=[360,396,432,468,504], STEP_W=[128,152,110,140,96];
const SEC2_Y=600, SEC2=[444,636,828], SEC2_W=176;
const SEC3_Y=[720,748,776,804], SEC3_W=[150,196,124,172];
const SEC4_Y=[840,872];
const SCROLL_MAX=210, SCROLL_C=[720,560];

const OFF=[300,780], AWAY=[236,830];
const CURSOR_PATH='M1 1 L1 17.6 L5.3 13.7 L7.9 19 L10.9 17.7 L8.2 12.5 L13 12.3 Z';
const DUR=16.8;

const T={
  card:[0.40,0.90], lines:1.00, cardClick:2.40,
  pack:[2.44,2.90], inner:[2.85,3.20],
  play:3.78, playing:[3.84,5.90],
  scroll:[6.45,7.75], close:8.88, packOut:[8.94,9.40],
  release:[13.40,14.15], out:[15.40,16.50],
};
/* the fan only opens once the pack has been read and closed */
const FAN=[[9.55,10.05],[9.85,10.35],[10.15,10.65],[10.45,10.95]];
/* and they work in an order nobody set */
const WORK=[[11.65,12.10],[12.60,13.05],[11.25,11.70],[12.05,12.50]];

const person=(x,y,stroke,w)=>`<circle cx="${x}" cy="${y-6}" r="6.5" fill="none" stroke="${stroke}" stroke-width="${w}"/>`
  + `<path d="M${x-11} ${y+12} a 11 11 0 0 1 22 0" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;


function makeScene(){
  const u=nextUid(),S=[];
  S.push(`<svg viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A document is written, then opened into a training pack containing numbered steps and an instructional video with a presenter in a bubble at its right. The video plays, the pack is scrolled through to reveal further material, and then closed. Four curved links fan out from the document, each bringing a person into the frame, and each of them begins producing work of their own before the links fade and the source dims.">`);
  S.push(`<defs>`,
    `<radialGradient id="bA${u}"><stop offset="0" stop-color="${C.amber}" stop-opacity=".11"/><stop offset="1" stop-color="${C.amber}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="bB${u}"><stop offset="0" stop-color="${C.cream200}" stop-opacity=".075"/><stop offset="1" stop-color="${C.cream200}" stop-opacity="0"/></radialGradient>`,
    `<filter id="cu${u}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="#000" flood-opacity=".6"/></filter>`,
    `<filter id="gl${u}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>`,
    `<filter id="sh${u}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#000" flood-opacity=".55"/></filter>`,
    `<clipPath id="body${u}"><rect x="${PK.x}" y="${PK_BODY.y}" width="${PK.w}" height="${PK_BODY.h}"/></clipPath>`,
    `</defs>`);
  S.push(`<rect width="1440" height="900" fill="${C.bg}"/>`);
  S.push(`<ellipse cx="380" cy="170" rx="540" ry="380" fill="url(#bA${u})"/>`);
  S.push(`<ellipse cx="1120" cy="770" rx="500" ry="360" fill="url(#bB${u})"/>`);
  S.push(`<rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}" rx="${F.r}" fill="#16120F" stroke="${cr(.15)}"/>`);
  S.push(`<path d="M${F.x} ${F.y+F.chrome} H${F.x+F.w}" stroke="${cr(.09)}"/>`);
  const cy=F.y+F.chrome/2;
  for(let i=0;i<3;i++) S.push(`<circle cx="${F.x+26+i*15}" cy="${cy}" r="3.4" fill="${cr(.16)}"/>`);
  S.push(`<rect x="${F.x+F.w/2-120}" y="${cy-6}" width="240" height="12" rx="6" fill="${cr(.07)}"/>`);

  for(let i=0;i<PN;i++)
    S.push(`<path data-el="lk${i}" d="${LINK(i)}" fill="none" stroke="${am(.42)}" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"/>`);

  S.push(`<g data-el="srcG" opacity="0">`
    + `<rect x="${SRC.x}" y="${SRC.y}" width="${SRC.w}" height="${SRC.h}" rx="12" fill="${C.s2}" stroke="${cr(.18)}"/>`
    + `<rect x="${SRC.x+16}" y="${SRC.y+20}" width="72" height="8" rx="4" fill="${cr(.30)}"/>`
    + `<path d="M${SRC.x+16} ${SRC.y+42} H${SRC.x+SRC.w-16}" stroke="${cr(.09)}"/>`
    + SRC_LINES.map((l,i)=>`<rect data-el="sl${i}" x="${SRC.x+16}" y="${l[0]}" width="0" height="6" rx="3" fill="${cr(.34)}"/>`).join('')
    + `</g>`);
  S.push(`<g data-el="ctrlG" opacity="0">`
    + `<rect data-el="ctrlHov" x="${CTRL.x-4}" y="${CTRL.y-4}" width="${CTRL.w+8}" height="${CTRL.h+8}" rx="12" fill="${cr(.05)}" opacity="0"/>`
    + `<rect x="${CTRL.x}" y="${CTRL.y}" width="${CTRL.w}" height="${CTRL.h}" rx="8" fill="none" stroke="${cr(.26)}"/>`
    + `<rect x="${CTRL.x+CTRL.w/2-22}" y="${CTRL.y+CTRL.h/2-1.5}" width="44" height="3" rx="1.5" fill="${cr(.34)}"/></g>`);
  S.push(`<g data-el="ctrlOn" opacity="0"><rect x="${CTRL.x}" y="${CTRL.y}" width="${CTRL.w}" height="${CTRL.h}" rx="8" fill="${am(.2)}" stroke="${am(.85)}"/>`
    + `<rect x="${CTRL.x+CTRL.w/2-22}" y="${CTRL.y+CTRL.h/2-1.5}" width="44" height="3" rx="1.5" fill="${C.amber200}"/></g>`);

  /* ---------- the resource pack ---------- */
  S.push(`<g data-el="packG" opacity="0"><g data-el="packS">`);
  S.push(`<rect x="${PK.x}" y="${PK.y}" width="${PK.w}" height="${PK.h}" rx="14" fill="${C.s2}" stroke="${cr(.18)}" filter="url(#sh${u})"/>`);
  S.push(`<rect x="${PK.x+24}" y="${PK.y+22}" width="150" height="10" rx="5" fill="${cr(.32)}"/>`);
  S.push(`<rect x="${PK.x+24}" y="${PK.y+40}" width="94" height="6" rx="3" fill="${cr(.13)}"/>`);
  S.push(`<g data-el="closeHov" opacity="0"><circle cx="${CLOSE_C[0]}" cy="${CLOSE_C[1]}" r="16" fill="${cr(.06)}"/></g>`);
  S.push(`<path d="M${CLOSE_C[0]-6} ${CLOSE_C[1]-6} l12 12 M${CLOSE_C[0]+6} ${CLOSE_C[1]-6} l-12 12" stroke="${cr(.40)}" stroke-width="1.6" stroke-linecap="round"/>`);
  S.push(`<path d="M${PK.x} ${PK_BODY.y} H${PK.x+PK.w}" stroke="${cr(.10)}"/>`);

  // everything below the header scrolls
  S.push(`<g clip-path="url(#body${u})"><g data-el="scrollG">`);
  //  the video
  S.push(`<rect x="${VID.x}" y="${VID.y}" width="${VID.w}" height="${VID.h}" rx="10" fill="${C.bg}" stroke="${cr(.14)}"/>`);
  //  what it is showing: a process being carried out, step by step
  VID_ROWS.forEach((y,i)=> S.push(
      `<rect x="${VID.x+24}" y="${y}" width="212" height="24" rx="6" fill="${C.s1}" stroke="${cr(.10)}"/>`
    + `<rect x="${VID.x+36}" y="${y+9}" width="${[120,92,146][i]}" height="6" rx="3" fill="${cr(.22)}"/>`
    + `<g data-el="vh${i}" opacity="0"><rect x="${VID.x+24}" y="${y}" width="212" height="24" rx="6" fill="${am(.13)}" stroke="${am(.6)}"/>`
    + `<rect x="${VID.x+36}" y="${y+9}" width="${[120,92,146][i]}" height="6" rx="3" fill="${am(.7)}"/></g>`
    + `<path data-el="vt${i}" d="M${VID.x+248} ${y+12} l4 4.4 l8 -8.4" fill="none" stroke="${C.amber}" stroke-width="2" `
    + `stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="13" stroke-dashoffset="13"/>`));
  //  the narrator, in a bubble at the middle right — the way an
  //  instructional recording actually looks
  S.push(`<g data-el="narG">`
    + `<circle cx="${NAR[0]}" cy="${NAR[1]}" r="${NAR[2]}" fill="${C.s3}" stroke="${am(.45)}" stroke-width="1.4"/>`
    + `<g data-el="narRing"><circle cx="${NAR[0]}" cy="${NAR[1]}" r="${NAR[2]+5}" fill="none" stroke="${am(.35)}" stroke-width="1.2"/></g>`
    + person(NAR[0], NAR[1]+2, C.amber, 1.8)
    + [0,1,2].map(i=>`<rect data-el="lvl${i}" x="${NAR[0]-9+i*8}" y="${NAR[1]+26}" width="4" height="4" rx="2" fill="${am(.8)}"/>`).join('')
    + `</g>`);
  //  transport
  S.push(`<path d="M${VID.x+16} ${VID.y+VID.h-16} H${VID.x+VID.w-16}" stroke="${cr(.13)}" stroke-width="3" stroke-linecap="round"/>`);
  S.push(`<path data-el="prog" d="M${VID.x+16} ${VID.y+VID.h-16} H${VID.x+VID.w-16}" stroke="${C.amber}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${VID.w-32}" stroke-dashoffset="${VID.w-32}"/>`);
  S.push(`<g data-el="playG"><circle cx="${PLAY_C[0]}" cy="${PLAY_C[1]}" r="24" fill="${am(.16)}" stroke="${am(.7)}"/>`
    + `<path d="M${PLAY_C[0]-6} ${PLAY_C[1]-9} l15 9 l-15 9 z" fill="${C.amber200}"/></g>`);
  //  the steps beside it
  STEP_Y.forEach((y,i)=> S.push(`<circle cx="${STEP_X+12}" cy="${y+6}" r="9" fill="none" stroke="${am(.45)}"/>`
    + `<rect x="${STEP_X+12-2.5}" y="${y+2}" width="5" height="8" rx="1" fill="${am(.6)}"/>`
    + `<rect x="${STEP_X+32}" y="${y+3}" width="${STEP_W[i]}" height="6" rx="3" fill="${cr(.24)}"/>`));
  //  further material, revealed by scrolling
  S.push(`<path d="M${PK.x+24} 580 H${PK.x+PK.w-24}" stroke="${cr(.08)}"/>`);
  SEC2.forEach((x,i)=> S.push(`<rect x="${x}" y="${SEC2_Y}" width="${SEC2_W}" height="76" rx="9" fill="${C.s1}" stroke="${cr(.12)}"/>`
    + `<rect x="${x+16}" y="${SEC2_Y+16}" width="38" height="5" rx="2.5" fill="${cr(.18)}"/>`
    + `<rect x="${x+16}" y="${SEC2_Y+32}" width="${[92,66,110][i]}" height="9" rx="4.5" fill="${i===1?am(.7):cr(.34)}"/>`
    + `<rect x="${x+16}" y="${SEC2_Y+52}" width="${[54,72,46][i]}" height="4" rx="2" fill="${cr(.11)}"/>`));
  S.push(`<path d="M${PK.x+24} 700 H${PK.x+PK.w-24}" stroke="${cr(.08)}"/>`);
  SEC3_Y.forEach((y,i)=> S.push(`<rect x="${PK.x+24}" y="${y}" width="14" height="14" rx="4" fill="none" stroke="${am(.45)}"/>`
    + `<path d="M${PK.x+27} ${y+7} l3 3.2 l5.6 -6" fill="none" stroke="${am(.8)}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<rect x="${PK.x+50}" y="${y+4}" width="${SEC3_W[i]}" height="6" rx="3" fill="${cr(.24)}"/>`));
  SEC4_Y.forEach((y,i)=> S.push(`<rect x="${PK.x+24}" y="${y}" width="${PK.w-48}" height="24" rx="7" fill="${C.s1}" stroke="${cr(.11)}"/>`
    + `<rect x="${PK.x+38}" y="${y+7}" width="12" height="10" rx="2" fill="none" stroke="${cr(.30)}"/>`
    + `<rect x="${PK.x+60}" y="${y+9}" width="${[188,142][i]}" height="6" rx="3" fill="${cr(.22)}"/>`));
  S.push(`</g></g>`);
  //  scroll indicator
  S.push(`<rect x="${PK.x+PK.w-8}" y="${PK_BODY.y+8}" width="3" height="${PK_BODY.h-16}" rx="1.5" fill="${cr(.06)}"/>`);
  S.push(`<rect data-el="bar" x="${PK.x+PK.w-8}" y="${PK_BODY.y+8}" width="3" height="140" rx="1.5" fill="${cr(.22)}"/>`);
  S.push(`</g></g>`);

  /* ---------- the four people ---------- */
  for(let i=0;i<PN;i++){
    const y=rowC(i);
    S.push(`<g data-el="pg${i}" opacity="0">`
      + `<rect x="${ROW.x}" y="${ROW_Y[i]}" width="${ROW.w}" height="${ROW.h}" rx="10" fill="${C.s1}" stroke="${cr(.12)}"/>`
      + person(ROW.x+34, y, cr(.34), 1.6)
      + `<rect x="${ROW.x+62}" y="${y-9}" width="${[96,74,110,84][i]}" height="6" rx="3" fill="${cr(.26)}"/>`
      + `<rect x="${ROW.x+62}" y="${y+3}" width="${[62,90,54,72][i]}" height="4" rx="2" fill="${cr(.12)}"/></g>`);
    S.push(`<g data-el="lit${i}" opacity="0">`
      + `<rect x="${ROW.x-4}" y="${ROW_Y[i]-4}" width="${ROW.w+8}" height="${ROW.h+8}" rx="14" fill="${am(.09)}" filter="url(#gl${u})"/>`
      + `<rect x="${ROW.x}" y="${ROW_Y[i]}" width="${ROW.w}" height="${ROW.h}" rx="10" fill="${C.s3}" stroke="${am(.6)}"/>`
      + person(ROW.x+34, y, C.amber, 1.7)
      + `<rect x="${ROW.x+62}" y="${y-9}" width="${[96,74,110,84][i]}" height="6" rx="3" fill="${am(.75)}"/>`
      + `<rect x="${ROW.x+62}" y="${y+3}" width="${[62,90,54,72][i]}" height="4" rx="2" fill="${am(.35)}"/></g>`);
    S.push(`<g data-el="out${i}" opacity="0">`
      + `<path d="M${OUT_X} ${y} l4.5 4.8 l8.5 -9" fill="none" stroke="${C.amber}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<rect x="${OUT_X+26}" y="${y-3}" width="${OUT_W[i]}" height="6" rx="3" fill="${cr(.28)}"/></g>`);
  }
  S.push(`<g data-el="cursor"><g transform="scale(1.5)" filter="url(#cu${u})">`
    + `<path d="${CURSOR_PATH}" fill="${C.cream100}" stroke="${C.bg}" stroke-width="1.1" stroke-linejoin="round"/></g></g>`);
  S.push(`</svg>`);
  return S.join('');
}
function bind(r){
  const q=k=>r.querySelector(`[data-el="${k}"]`);
  const N=n=>[...Array(n)].map((_,k)=>k);
  const lk=N(PN).map(i=>q('lk'+i));
  return { srcG:q('srcG'), sl:SRC_LINES.map((_,i)=>q('sl'+i)),
    ctrlG:q('ctrlG'), ctrlHov:q('ctrlHov'), ctrlOn:q('ctrlOn'),
    packG:q('packG'), packS:q('packS'), scrollG:q('scrollG'), bar:q('bar'),
    closeHov:q('closeHov'), playG:q('playG'), prog:q('prog'),
    vh:N(3).map(i=>q('vh'+i)), vt:N(3).map(i=>q('vt'+i)),
    narG:q('narG'), narRing:q('narRing'), lvl:N(3).map(i=>q('lvl'+i)),
    lk, lkLen:lk.map(p=>p.getTotalLength()),
    pg:N(PN).map(i=>q('pg'+i)), lit:N(PN).map(i=>q('lit'+i)), out:N(PN).map(i=>q('out'+i)),
    cursor:q('cursor') };
}

function render(E,t){
  const out=seg(t,T.out[0],T.out[1],EASE);
  const card=seg(t,T.card[0],T.card[1],EASE_OUT)*(1-out);
  const released=seg(t,T.release[0],T.release[1],EASE);
  E.srcG.setAttribute('opacity',(card*lerp(1,.34,released)).toFixed(3));
  E.sl.forEach((el,i)=>{
    const s0=T.lines+i*0.14;
    el.setAttribute('width',(t<s0?0:lerp(3,SRC_LINES[i][1],seg(t,s0,s0+0.52,EASE_IO))).toFixed(2));
    el.setAttribute('opacity',(t<s0?0:1));
  });
  E.ctrlG.setAttribute('opacity',(card*(1-released)).toFixed(3));
  E.ctrlHov.setAttribute('opacity',(seg(t,2.20,2.34)-seg(t,T.cardClick+0.02,T.cardClick+0.14)).toFixed(3));
  E.ctrlOn.setAttribute('opacity',((seg(t,T.cardClick,T.cardClick+0.08,EASE_OUT)-seg(t,T.cardClick+0.30,T.cardClick+0.58))*(1-out)).toFixed(3));

  /* the pack grows out of the card that produced it, and collapses
     back into it — it is that document opened, not a new object */
  const pIn=seg(t,T.pack[0],T.pack[1],EASE_OUT), pOut=seg(t,T.packOut[0],T.packOut[1],EASE);
  const pk=pIn-pOut;
  E.packG.setAttribute('opacity',pk.toFixed(3));
  const sc=lerp(lerp(.22,1,pIn),.30,pOut);
  E.packS.setAttribute('transform',
    `translate(${SRC_C[0]},${SRC_C[1]}) scale(${sc.toFixed(4)}) translate(${-SRC_C[0]},${-SRC_C[1]})`);

  /* playback: the recording works through the same three steps the
     list beside it names, and the presenter's levels move while it runs */
  const playing=seg(t,T.playing[0],T.playing[1],LINEAR);
  const live=t>=T.playing[0] && t<=T.playing[1]+0.2;
  E.playG.setAttribute('opacity',(1-seg(t,T.play,T.play+0.24,EASE_OUT)).toFixed(3));
  E.prog.setAttribute('stroke-dashoffset',((VID.w-32)*(1-playing)).toFixed(2));
  VID_ROWS.forEach((_,i)=>{
    const a=T.playing[0]+i*0.62, b=a+0.50;
    E.vh[i].setAttribute('opacity',(seg(t,a,a+0.14)-seg(t,b,b+0.16)).toFixed(3));
    E.vt[i].setAttribute('stroke-dashoffset',(13*(1-seg(t,b-0.10,b+0.22,EASE_OUT))).toFixed(2));
  });
  E.lvl.forEach((el,i)=>{
    const h=live ? 4+9*Math.abs(Math.sin((t-T.playing[0])*7 + i*1.1)) : 4;
    el.setAttribute('height',h.toFixed(2));
    el.setAttribute('y',(NAR[1]+30-h).toFixed(2));
  });
  E.narRing.setAttribute('opacity',(live?0.35+0.35*Math.abs(Math.sin((t-T.playing[0])*3)):0.18).toFixed(3));

  /* scrolling the pack */
  const sy=seg(t,T.scroll[0],T.scroll[1],EASE_IO)*SCROLL_MAX;
  E.scrollG.setAttribute('transform',`translate(0,${(-sy).toFixed(2)})`);
  E.bar.setAttribute('y',(PK_BODY.y+8 + (PK_BODY.h-16-140)*(sy/SCROLL_MAX)).toFixed(2));
  E.closeHov.setAttribute('opacity',(seg(t,8.68,8.82)-seg(t,T.close+0.02,T.close+0.14)).toFixed(3));

  /* only now do the links go out */
  for(let i=0;i<PN;i++){
    const [a,b]=FAN[i], g=seg(t,a,b,EASE_OUT), L=E.lkLen[i];
    E.lk[i].setAttribute('stroke-dasharray',L);
    E.lk[i].setAttribute('stroke-dashoffset',(L*(1-g)).toFixed(2));
    E.lk[i].setAttribute('opacity',((g>0?1:0)*(1-released)*(1-out)).toFixed(3));
    const app=seg(t,b-0.22,b+0.18,EASE_OUT)*(1-out);
    E.pg[i].setAttribute('opacity',app.toFixed(3));
    E.pg[i].setAttribute('transform',`translate(${lerp(14,0,app).toFixed(2)},0)`);
    E.lit[i].setAttribute('opacity',((seg(t,b,b+0.34,EASE_OUT)-seg(t,WORK[i][1]+0.30,WORK[i][1]+0.90,EASE)*0.55)*(1-out)).toFixed(3));
    const [wa,wb]=WORK[i], w=seg(t,wa,wb,EASE_OUT)*(1-out);
    E.out[i].setAttribute('opacity',w.toFixed(3));
    E.out[i].setAttribute('transform',`translate(${lerp(-10,0,w).toFixed(2)},0)`);
  }

  const p=(()=>{
    const legs=[
      [1.75,2.25,OFF,        [CTRL.x+CTRL.w/2,CTRL.y+CTRL.h/2], 80],
      [3.30,3.70,[CTRL.x+CTRL.w/2,CTRL.y+CTRL.h/2], PLAY_C,    -40],
      [6.05,6.45,PLAY_C,     SCROLL_C,   30],
      [8.35,8.80,SCROLL_C,   CLOSE_C,   -34],
      [9.45,10.1,CLOSE_C,    AWAY,       60],
    ];
    let q=legs[0][2];
    for(const [a,b,from,to,bow] of legs){ if(t<a) break; q = t<=b ? arc(from,to,seg(t,a,b,EASE),bow) : to; }
    return q;
  })();
  let dip=1; [T.cardClick,T.play,T.close].forEach(c=>{ dip-=0.12*pulse(t,c,c+0.06,c+0.14); });
  E.cursor.setAttribute('transform',`translate(${p[0].toFixed(2)},${p[1].toFixed(2)}) scale(${dip.toFixed(3)})`);
}


return { make: makeScene, bind, render, dur: DUR };
})()
