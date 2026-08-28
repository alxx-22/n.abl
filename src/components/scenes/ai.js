/* AI — an assistant that answers, and an agent that acts and checks in. */

import { EASE, EASE_OUT, EASE_IO, LINEAR, seg, lerp, pulse, clamp, arc, C, cr, am, nextUid } from './engine.js'

export default (function(){
/* ---- shared furniture -------------------------------------- */
const F={x:340,y:210,w:760,h:480,r:16,chrome:44};
const CURSOR_PATH='M1 1 L1 17.6 L5.3 13.7 L7.9 19 L10.9 17.7 L8.2 12.5 L13 12.3 Z';
const OFF=[300,780];

/* The four-point spark. n.abl already uses one on its own assistant
   launcher, so this is the house mark rather than a borrowed one —
   and it is the single element that says "this is the AI" without a
   word, a logo or a robot. */
const SPARK='M0 -10 C1 -2.5 2.5 -1 10 0 C2.5 1 1 2.5 0 10 C-1 2.5 -2.5 1 -10 0 C-2.5 -1 -1 -2.5 0 -10 Z';
const spark=(x,y,r,fill,o=1)=>`<path d="${SPARK}" transform="translate(${x},${y}) scale(${r/10})" fill="${fill}" opacity="${o}"/>`;
const defs=u=>`<defs>`
  + `<radialGradient id="bA${u}"><stop offset="0" stop-color="${C.amber}" stop-opacity=".11"/><stop offset="1" stop-color="${C.amber}" stop-opacity="0"/></radialGradient>`
  + `<radialGradient id="bB${u}"><stop offset="0" stop-color="${C.cream200}" stop-opacity=".075"/><stop offset="1" stop-color="${C.cream200}" stop-opacity="0"/></radialGradient>`
  + `<filter id="cu${u}" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="#000" flood-opacity=".6"/></filter>`
  + `<filter id="gl${u}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10"/></filter>`
  + `</defs>`;
const backdrop=u=>`<rect width="1440" height="900" fill="${C.bg}"/>`
  + `<ellipse cx="380" cy="170" rx="540" ry="380" fill="url(#bA${u})"/>`
  + `<ellipse cx="1120" cy="770" rx="500" ry="360" fill="url(#bB${u})"/>`
  + `<rect x="${F.x}" y="${F.y}" width="${F.w}" height="${F.h}" rx="${F.r}" fill="#16120F" stroke="${cr(.15)}"/>`
  + `<path d="M${F.x} ${F.y+F.chrome} H${F.x+F.w}" stroke="${cr(.09)}"/>`
  + [0,1,2].map(i=>`<circle cx="${F.x+26+i*15}" cy="${F.y+F.chrome/2}" r="3.4" fill="${cr(.16)}"/>`).join('')
  + `<rect x="${F.x+F.w/2-120}" y="${F.y+F.chrome/2-6}" width="240" height="12" rx="6" fill="${cr(.07)}"/>`;
/* the identity strip both scenes carry */
const header=(x,w,right)=>`<g data-el="head" opacity="0">`
  + `<rect x="${x}" y="264" width="32" height="32" rx="9" fill="${C.s3}" stroke="${am(.35)}"/>`
  + `<g data-el="mark">${spark(x+16,280,8.5,C.amber)}</g>`
  + `<rect x="${x+44}" y="271" width="126" height="9" rx="4.5" fill="${cr(.28)}"/>`
  + `<rect x="${x+44}" y="286" width="78" height="6" rx="3" fill="${cr(.12)}"/>`
  + `<rect x="${right-64}" y="272" width="64" height="20" rx="10" fill="${am(.12)}" stroke="${am(.45)}"/>`
  + `<path d="M${x} 314 H${right}" stroke="${cr(.09)}"/></g>`;
const cursorNode=u=>`<g data-el="cursor"><g transform="scale(1.5)" filter="url(#cu${u})">`
  + `<path d="${CURSOR_PATH}" fill="${C.cream100}" stroke="${C.bg}" stroke-width="1.1" stroke-linejoin="round"/></g></g>`;
function legWalk(t, legs){
  let p=legs[0][2];
  for (const [a,b,from,to,bow] of legs){ if (t<a) break; p = t<=b ? arc(from,to,seg(t,a,b,EASE),bow) : to; }
  return p;
}
const dipOf=(t,clicks)=>{ let d=1; clicks.forEach(c=>{ d-=0.12*pulse(t,c,c+0.06,c+0.14); }); return d; };
/* a value that is not there yet must not be a visible dot */
const written=(t,start,end,w)=> t<start ? {w:0,o:0} : {w:lerp(3,w,seg(t,start,end,EASE_IO)),o:1};

/* ============================================================
   5a — ASSISTANT
   ============================================================ */
const A={
  x:475, right:937,
  user:{y:330,w:276,h:54}, bot:{x:517,y:404,w:420,h:148},
  av:{x:475,y:404},
  lineY:[428,452,476,500,524], lineW:[344,306,356,262,190],
  src:{x:517,y:566,w:172,h:28},
  input:{x:475,y:610,w:406,h:44}, send:{x:891,y:610,w:46,h:44},
  chips:[{y:408,w:286},{y:446,w:238},{y:484,w:312}],
  typed:[190,128],
};
const A_T={ shell:[0.30,0.75], empty:[0.85,1.30], click:1.86, emptyOut:[1.90,2.25],
  type0:[1.96,2.66], type1:[2.70,3.40], send:4.02, lift:[4.08,4.52],
  think:[4.62,5.42], grow:[5.42,5.92], lines:5.86, src:[7.80,8.20], out:[9.30,10.20] };
const A_DUR=10.5;
const aInC=[A.input.x+40, A.input.y+A.input.h/2];
const aSendC=[A.send.x+A.send.w/2, A.send.y+A.send.h/2];

function aMake(){
  const u=nextUid(),S=[];
  S.push(`<svg viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="An assistant with a spark mark and three suggested prompts. A cursor types a question, the suggestions clear, the typed text lifts out of the input to become the sent message, the assistant thinks and writes an answer, and a source reference appears beneath it.">`);
  S.push(defs(u), backdrop(u), header(A.x, 0, A.right));
  /* empty state — a large watermark spark and three suggestions */
  S.push(`<g data-el="empty" opacity="0">`
    + A.chips.map((c,i)=>`<rect x="${A.x}" y="${c.y}" width="${c.w}" height="32" rx="16" fill="${C.s1}" stroke="${cr(.11)}"/>`
      + `${spark(A.x+22,c.y+16,6,am(.5))}`
      + `<rect x="${A.x+38}" y="${c.y+13}" width="${c.w-62}" height="6" rx="3" fill="${cr(.20)}"/>`).join('')
    + `</g>`);
  S.push(`<rect data-el="inBox" x="${A.input.x}" y="${A.input.y}" width="${A.input.w}" height="${A.input.h}" rx="10" fill="${C.s1}" stroke="${cr(.13)}" opacity="0"/>`);
  S.push(`<rect data-el="inFocus" x="${A.input.x}" y="${A.input.y}" width="${A.input.w}" height="${A.input.h}" rx="10" fill="none" stroke="${cr(.40)}" stroke-width="1.4" opacity="0"/>`);
  S.push(`<g data-el="sendG" opacity="0"><rect x="${A.send.x}" y="${A.send.y}" width="${A.send.w}" height="${A.send.h}" rx="10" fill="${C.s2}" stroke="${cr(.18)}"/>`
    + `<path d="M${aSendC[0]-6} ${aSendC[1]} h12 M${aSendC[0]+1} ${aSendC[1]-5} l5 5 l-5 5" fill="none" stroke="${cr(.45)}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  S.push(`<g data-el="sendOn" opacity="0"><rect x="${A.send.x}" y="${A.send.y}" width="${A.send.w}" height="${A.send.h}" rx="10" fill="${am(.20)}" stroke="${am(.85)}"/>`
    + `<path d="M${aSendC[0]-6} ${aSendC[1]} h12 M${aSendC[0]+1} ${aSendC[1]-5} l5 5 l-5 5" fill="none" stroke="${C.amber200}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  // the message bubble is painted first; the typed lines travel over it
  S.push(`<g data-el="userG" opacity="0"><rect x="${A.right-A.user.w}" y="${A.user.y}" width="${A.user.w}" height="${A.user.h}" rx="12" fill="${C.s3}" stroke="${cr(.16)}"/></g>`);
  A.typed.forEach((w,i)=> S.push(`<rect data-el="typed${i}" x="${A.input.x+20}" y="${A.input.y+15+i*12}" width="0" height="6" rx="3" fill="${cr(.46)}" opacity="0"/>`));
  S.push(`<rect data-el="caret" x="${A.input.x+24}" y="${A.input.y+12}" width="1.2" height="20" fill="${cr(.55)}" opacity="0"/>`);
  // the reply, with the assistant's own mark beside it
  S.push(`<g data-el="avG" opacity="0"><rect x="${A.av.x}" y="${A.av.y}" width="30" height="30" rx="9" fill="${C.s3}" stroke="${am(.3)}"/>`
    + `<g data-el="avMark">${spark(A.av.x+15,A.av.y+15,8,C.amber)}</g></g>`);
  S.push(`<g data-el="botG" opacity="0"><rect data-el="botBox" x="${A.bot.x}" y="${A.bot.y}" width="${A.bot.w}" height="44" rx="12" fill="${C.s2}" stroke="${cr(.14)}"/></g>`);
  S.push(`<g data-el="thinkG" opacity="0">${[0,1,2].map(i=>
    `<circle data-el="dot${i}" cx="${A.bot.x+26+i*14}" cy="${A.bot.y+22}" r="3.4" fill="${am(.8)}"/>`).join('')}</g>`);
  A.lineY.forEach((y,i)=> S.push(`<rect data-el="ln${i}" x="${A.bot.x+24}" y="${y}" width="0" height="7" rx="3.5" fill="${cr(.40)}" opacity="0"/>`));
  S.push(`<g data-el="srcG" opacity="0">`
    + `<rect x="${A.src.x}" y="${A.src.y}" width="${A.src.w}" height="${A.src.h}" rx="8" fill="none" stroke="${am(.45)}"/>`
    + `<rect x="${A.src.x+12}" y="${A.src.y+7}" width="10" height="14" rx="2" fill="none" stroke="${am(.75)}" stroke-width="1.3"/>`
    + `<path d="M${A.src.x+15} ${A.src.y+12} h4 M${A.src.x+15} ${A.src.y+16} h4" stroke="${am(.6)}" stroke-width="1.1" stroke-linecap="round"/>`
    + `<rect x="${A.src.x+32}" y="${A.src.y+11}" width="96" height="6" rx="3" fill="${am(.5)}"/></g>`);
  S.push(cursorNode(u));
  S.push(`</svg>`);
  return S.join('');
}
function aBind(r){ const q=k=>r.querySelector(`[data-el="${k}"]`);
  return { head:q('head'), mark:q('mark'), empty:q('empty'),
    inBox:q('inBox'), inFocus:q('inFocus'), sendG:q('sendG'), sendOn:q('sendOn'),
    typed:[0,1].map(i=>q('typed'+i)), caret:q('caret'), userG:q('userG'),
    avG:q('avG'), avMark:q('avMark'), botG:q('botG'), botBox:q('botBox'),
    thinkG:q('thinkG'), dot:[0,1,2].map(i=>q('dot'+i)),
    ln:A.lineY.map((_,i)=>q('ln'+i)), srcG:q('srcG'), cursor:q('cursor') }; }

function aRender(E,t){
  const out=seg(t,A_T.out[0],A_T.out[1],EASE);
  const shell=seg(t,A_T.shell[0],A_T.shell[1],EASE_OUT)*(1-out);
  E.head.setAttribute('opacity', shell.toFixed(3));
  E.inBox.setAttribute('opacity', shell.toFixed(3));
  E.sendG.setAttribute('opacity', shell.toFixed(3));
  E.empty.setAttribute('opacity',((seg(t,A_T.empty[0],A_T.empty[1],EASE_OUT)-seg(t,A_T.emptyOut[0],A_T.emptyOut[1],EASE))*(1-out)).toFixed(3));
  E.inFocus.setAttribute('opacity',((seg(t,A_T.click,A_T.click+0.16,EASE_OUT)-seg(t,A_T.send,A_T.send+0.2))*(1-out)).toFixed(3));

  /* typed lines: nothing at all until typing starts, then the same
     two objects lift into the message */
  const lift=seg(t,A_T.lift[0],A_T.lift[1],EASE);
  const spans=[A_T.type0,A_T.type1];
  let lastW=0, lastRow=0;
  A.typed.forEach((w,i)=>{
    const {w:wid,o}=written(t,spans[i][0],spans[i][1],w);
    const x0=A.input.x+20, y0=A.input.y+15+i*12;
    const x1=A.right-A.user.w+22, y1=A.user.y+17+i*14;
    E.typed[i].setAttribute('width',wid.toFixed(2));
    E.typed[i].setAttribute('x',lerp(x0,x1,lift).toFixed(2));
    E.typed[i].setAttribute('y',lerp(y0,y1,lift).toFixed(2));
    E.typed[i].setAttribute('opacity',(o*(1-out)).toFixed(3));
    if (o) { lastW=wid; lastRow=i; }
  });
  E.caret.setAttribute('x',(A.input.x+20+lastW+5).toFixed(2));
  E.caret.setAttribute('y',(A.input.y+12+lastRow*12).toFixed(2));
  E.caret.setAttribute('opacity',(seg(t,A_T.type0[0],A_T.type0[0]+0.08)-seg(t,A_T.type1[1],A_T.type1[1]+0.16)).toFixed(3));
  E.sendOn.setAttribute('opacity',((seg(t,A_T.send,A_T.send+0.08,EASE_OUT)-seg(t,A_T.send+0.30,A_T.send+0.55))*(1-out)).toFixed(3));
  E.userG.setAttribute('opacity',(seg(t,A_T.lift[0],A_T.lift[0]+0.26,EASE_OUT)*(1-out)).toFixed(3));

  const think=seg(t,A_T.think[0],A_T.think[0]+0.22,EASE_OUT)-seg(t,A_T.think[1],A_T.think[1]+0.20);
  E.avG.setAttribute('opacity',(seg(t,A_T.think[0],A_T.think[0]+0.26,EASE_OUT)*(1-out)).toFixed(3));
  E.botG.setAttribute('opacity',(seg(t,A_T.think[0],A_T.think[0]+0.26,EASE_OUT)*(1-out)).toFixed(3));
  E.thinkG.setAttribute('opacity',think.toFixed(3));
  E.dot.forEach((d,i)=>{
    const ph=((t-A_T.think[0])*1.6-i*0.22)%1;
    d.setAttribute('opacity',(think*(0.3+0.7*Math.max(0,Math.sin(Math.max(0,ph)*Math.PI)))).toFixed(3));
  });
  /* the mark is alive only while it is working */
  const busy=seg(t,A_T.think[0],A_T.think[0]+0.2)-seg(t,A_T.src[0],A_T.src[0]+0.3);
  const puls=1+0.14*busy*Math.sin((t-A_T.think[0])*4.4);
  E.mark.setAttribute('transform',`translate(${A.x+16},280) scale(${puls.toFixed(3)}) translate(${-(A.x+16)},-280)`);
  E.avMark.setAttribute('transform',`translate(${A.av.x+15},${A.av.y+15}) scale(${puls.toFixed(3)}) translate(${-(A.av.x+15)},${-(A.av.y+15)})`);

  const grow=seg(t,A_T.grow[0],A_T.grow[1],EASE_OUT);
  E.botBox.setAttribute('height',lerp(44,A.bot.h,grow).toFixed(2));
  E.ln.forEach((el,i)=>{
    const s0=A_T.lines+i*0.30;
    const {w,o}=written(t,s0,s0+0.62,A.lineW[i]);
    el.setAttribute('width',w.toFixed(2));
    el.setAttribute('opacity',(o*(1-out)).toFixed(3));
  });
  E.srcG.setAttribute('opacity',(seg(t,A_T.src[0],A_T.src[1],EASE_OUT)*(1-out)).toFixed(3));

  const p=legWalk(t,[
    [1.20,1.80,OFF,        aInC,      80],
    [3.52,3.94,aInC,       aSendC,   -30],
    [4.60,5.20,aSendC,     [1010,700],26],
    [9.40,10.2,[1010,700], OFF,       70],
  ]);
  E.cursor.setAttribute('transform',
    `translate(${p[0].toFixed(2)},${p[1].toFixed(2)}) scale(${dipOf(t,[A_T.click,A_T.send]).toFixed(3)})`);
}

/* ============================================================
   5b — OPERATING AGENT
   ============================================================ */
const B={
  x:408, right:1032,
  bar:{x:408,y:324,w:558,h:42}, run:{x:976,y:324,w:56,h:42},
  step:{x:408,w:624,h:38}, stepY:[396,444,492,540],
  labelW:[196,240,168,214], resW:[92,64,110,78],
  approve:{x:836,y:498,w:112,h:26},
  art:{x:408,y:600,w:624,h:62},
  chips:[{y:430,w:320},{y:468,w:268},{y:506,w:356}],
  typed:230,
};
const B_T={ shell:[0.30,0.75], empty:[0.85,1.30], click:1.84, emptyOut:[1.88,2.24],
  type:[1.94,2.74], run:3.34, plan:3.40,
  steps:[[3.90,4.55],[4.70,5.35],[5.50,5.85],[7.30,7.90]],
  pause:[5.90,6.20], approve:6.68, resume:[6.72,7.15],
  art:[8.05,8.60], out:[9.80,10.75] };
const B_DUR=11.0;
const bBarC=[B.bar.x+40,B.bar.y+B.bar.h/2];
const bRunC=[B.run.x+B.run.w/2,B.run.y+B.run.h/2];
const bAppC=[B.approve.x+B.approve.w/2,B.approve.y+B.approve.h/2];
const RING=2*Math.PI*9;

function bMake(){
  const u=nextUid(),S=[];
  S.push(`<svg viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="An agent with a spark mark and three example instructions. A cursor types one instruction and runs it. The agent lays out a four-step plan and works through it alone, ticking each step off. At the third step it stops and waits for approval; once approved it finishes and produces a summary.">`);
  S.push(defs(u), backdrop(u), header(B.x, 0, B.right));
  S.push(`<g data-el="empty" opacity="0">`
    + B.chips.map(c=>`<rect x="${B.x}" y="${c.y}" width="${c.w}" height="30" rx="15" fill="${C.s1}" stroke="${cr(.11)}"/>`
      + `${spark(B.x+21,c.y+15,6,am(.5))}`
      + `<rect x="${B.x+36}" y="${c.y+12}" width="${c.w-58}" height="6" rx="3" fill="${cr(.20)}"/>`).join('')
    + `</g>`);
  S.push(`<rect data-el="bar" x="${B.bar.x}" y="${B.bar.y}" width="${B.bar.w}" height="${B.bar.h}" rx="10" fill="${C.s1}" stroke="${cr(.13)}" opacity="0"/>`);
  S.push(`<rect data-el="barFocus" x="${B.bar.x}" y="${B.bar.y}" width="${B.bar.w}" height="${B.bar.h}" rx="10" fill="none" stroke="${cr(.40)}" stroke-width="1.4" opacity="0"/>`);
  S.push(`<rect data-el="typed" x="${B.bar.x+20}" y="${B.bar.y+18}" width="0" height="6" rx="3" fill="${cr(.46)}" opacity="0"/>`);
  S.push(`<rect data-el="caret" x="${B.bar.x+24}" y="${B.bar.y+11}" width="1.2" height="20" fill="${cr(.55)}" opacity="0"/>`);
  S.push(`<g data-el="runG" opacity="0"><rect x="${B.run.x}" y="${B.run.y}" width="${B.run.w}" height="${B.run.h}" rx="10" fill="${C.s2}" stroke="${cr(.18)}"/>`
    + `<path d="M${bRunC[0]-5} ${bRunC[1]-7} l11 7 l-11 7 z" fill="${cr(.42)}"/></g>`);
  S.push(`<g data-el="runOn" opacity="0"><rect x="${B.run.x}" y="${B.run.y}" width="${B.run.w}" height="${B.run.h}" rx="10" fill="${am(.20)}" stroke="${am(.85)}"/>`
    + `<path d="M${bRunC[0]-5} ${bRunC[1]-7} l11 7 l-11 7 z" fill="${C.amber200}"/></g>`);
  B.stepY.forEach((y,i)=>{
    const cxx=B.step.x+30, cyy=y+B.step.h/2;
    S.push(`<g data-el="st${i}" opacity="0">`
      + `<rect x="${B.step.x}" y="${y}" width="${B.step.w}" height="${B.step.h}" rx="9" fill="${C.s1}" stroke="${cr(.10)}"/>`
      + `<circle cx="${cxx}" cy="${cyy}" r="9" fill="none" stroke="${cr(.20)}" stroke-width="1.6"/>`
      + `<circle data-el="ring${i}" cx="${cxx}" cy="${cyy}" r="9" fill="none" stroke="${C.amber}" stroke-width="1.8" `
      + `stroke-linecap="round" stroke-dasharray="${RING}" stroke-dashoffset="${RING}" transform="rotate(-90 ${cxx} ${cyy})"/>`
      + `<path data-el="tick${i}" d="M${cxx-4.2} ${cyy} l3 3.2 l5.6 -6" fill="none" stroke="${C.amber}" stroke-width="1.9" `
      + `stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14" stroke-dashoffset="14"/>`
      + `<rect x="${B.step.x+52}" y="${cyy-3}" width="${B.labelW[i]}" height="6" rx="3" fill="${cr(.26)}"/>`
      + `<rect data-el="res${i}" x="${B.step.x+B.step.w-24-B.resW[i]}" y="${cyy-3}" width="0" height="6" rx="3" fill="${cr(.42)}"/></g>`);
  });
  S.push(`<g data-el="appG" opacity="0">`
    + `<rect data-el="appHov" x="${B.approve.x-4}" y="${B.approve.y-4}" width="${B.approve.w+8}" height="${B.approve.h+8}" rx="12" fill="${cr(.05)}" opacity="0"/>`
    + `<rect x="${B.approve.x}" y="${B.approve.y}" width="${B.approve.w}" height="${B.approve.h}" rx="8" fill="${am(.12)}" stroke="${am(.7)}"/>`
    + `<rect x="${B.approve.x+B.approve.w/2-20}" y="${B.approve.y+B.approve.h/2-1.5}" width="40" height="3" rx="1.5" fill="${am(.85)}"/></g>`);
  S.push(`<g data-el="appOn" opacity="0"><rect x="${B.approve.x}" y="${B.approve.y}" width="${B.approve.w}" height="${B.approve.h}" rx="8" fill="${am(.3)}" stroke="${C.amber}"/>`
    + `<rect x="${B.approve.x+B.approve.w/2-20}" y="${B.approve.y+B.approve.h/2-1.5}" width="40" height="3" rx="1.5" fill="${C.amber200}"/></g>`);
  S.push(`<g data-el="artG" opacity="0">`
    + `<rect x="${B.art.x}" y="${B.art.y}" width="${B.art.w}" height="${B.art.h}" rx="10" fill="${C.s2}" stroke="${cr(.16)}"/>`
    + `${spark(B.art.x+30,B.art.y+31,11,am(.8))}`
    + `<rect x="${B.art.x+52}" y="${B.art.y+15}" width="44" height="5" rx="2.5" fill="${cr(.20)}"/>`
    + `<rect x="${B.art.x+52}" y="${B.art.y+30}" width="180" height="10" rx="5" fill="${C.amber}"/>`
    + `<rect x="${B.art.x+254}" y="${B.art.y+32}" width="118" height="6" rx="3" fill="${cr(.22)}"/>`
    + `<rect x="${B.art.x+390}" y="${B.art.y+32}" width="84" height="6" rx="3" fill="${cr(.14)}"/></g>`);
  S.push(cursorNode(u));
  S.push(`</svg>`);
  return S.join('');
}
function bBind(r){ const q=k=>r.querySelector(`[data-el="${k}"]`);
  return { head:q('head'), mark:q('mark'), empty:q('empty'),
    bar:q('bar'), barFocus:q('barFocus'), typed:q('typed'), caret:q('caret'),
    runG:q('runG'), runOn:q('runOn'),
    st:B.stepY.map((_,i)=>q('st'+i)), ring:B.stepY.map((_,i)=>q('ring'+i)),
    tick:B.stepY.map((_,i)=>q('tick'+i)), res:B.stepY.map((_,i)=>q('res'+i)),
    appG:q('appG'), appHov:q('appHov'), appOn:q('appOn'), artG:q('artG'), cursor:q('cursor') }; }

function bRender(E,t){
  const out=seg(t,B_T.out[0],B_T.out[1],EASE);
  const shell=seg(t,B_T.shell[0],B_T.shell[1],EASE_OUT)*(1-out);
  E.head.setAttribute('opacity',shell.toFixed(3));
  E.bar.setAttribute('opacity',shell.toFixed(3));
  E.runG.setAttribute('opacity',shell.toFixed(3));
  E.empty.setAttribute('opacity',((seg(t,B_T.empty[0],B_T.empty[1],EASE_OUT)-seg(t,B_T.emptyOut[0],B_T.emptyOut[1],EASE))*(1-out)).toFixed(3));
  E.barFocus.setAttribute('opacity',((seg(t,B_T.click,B_T.click+0.16,EASE_OUT)-seg(t,B_T.run,B_T.run+0.2))*(1-out)).toFixed(3));

  const {w:tw,o:to}=written(t,B_T.type[0],B_T.type[1],B.typed);
  E.typed.setAttribute('width',tw.toFixed(2));
  E.typed.setAttribute('opacity',(to*(1-out)).toFixed(3));
  E.caret.setAttribute('x',(B.bar.x+20+tw+5).toFixed(2));
  E.caret.setAttribute('opacity',(seg(t,B_T.type[0],B_T.type[0]+0.08)-seg(t,B_T.type[1],B_T.type[1]+0.16)).toFixed(3));
  E.runOn.setAttribute('opacity',((seg(t,B_T.run,B_T.run+0.08,EASE_OUT)-seg(t,B_T.run+0.30,B_T.run+0.55))*(1-out)).toFixed(3));

  /* the mark works while the agent does */
  const busy=seg(t,B_T.run,B_T.run+0.2)-seg(t,B_T.art[0],B_T.art[0]+0.3);
  const puls=1+0.14*busy*Math.sin((t-B_T.run)*4.4);
  E.mark.setAttribute('transform',`translate(${B.x+16},280) scale(${puls.toFixed(3)}) translate(${-(B.x+16)},-280)`);

  B.stepY.forEach((y,i)=>{
    const inP=seg(t,B_T.plan+i*0.09,B_T.plan+0.38+i*0.09,EASE_OUT)*(1-out);
    E.st[i].setAttribute('opacity',inP.toFixed(3));
    E.st[i].setAttribute('transform',`translate(0,${lerp(8,0,inP).toFixed(2)})`);
    const [a,b]=B_T.steps[i];
    let ring;
    if (i===2){
      ring=lerp(0,.60,seg(t,a,b,EASE_IO));
      ring=lerp(ring,1,seg(t,B_T.resume[0],B_T.resume[1],EASE_OUT));
    } else ring=seg(t,a,b,EASE_IO);
    E.ring[i].setAttribute('stroke-dashoffset',(RING*(1-ring)).toFixed(2));
    const done=i===2 ? seg(t,B_T.resume[1]-0.06,B_T.resume[1]+0.20,EASE_OUT) : seg(t,b-0.06,b+0.20,EASE_OUT);
    E.tick[i].setAttribute('stroke-dashoffset',(14*(1-done)).toFixed(2));
    E.res[i].setAttribute('width',(B.resW[i]*done*(1-out)).toFixed(2));
  });
  const paused=seg(t,B_T.pause[0],B_T.pause[1],EASE_OUT)-seg(t,B_T.approve,B_T.approve+0.22);
  E.appG.setAttribute('opacity',(paused*(1-out)).toFixed(3));
  E.appHov.setAttribute('opacity',(seg(t,6.48,6.62)-seg(t,B_T.approve+0.02,B_T.approve+0.14)).toFixed(3));
  E.appOn.setAttribute('opacity',(seg(t,B_T.approve,B_T.approve+0.07,EASE_OUT)-seg(t,B_T.approve+0.22,B_T.approve+0.44)).toFixed(3));
  const artP=seg(t,B_T.art[0],B_T.art[1],EASE_OUT);
  E.artG.setAttribute('opacity',(artP*(1-out)).toFixed(3));
  E.artG.setAttribute('transform',`translate(0,${lerp(10,0,artP).toFixed(2)})`);

  const p=legWalk(t,[
    [1.20,1.78,OFF,        bBarC,      80],
    [2.86,3.26,bBarC,      bRunC,     -28],
    [3.50,4.10,bRunC,      [1120,706], 30],
    [6.05,6.60,[1120,706], bAppC,     -50],
    [7.10,7.70,bAppC,      [1120,706], 34],
    [9.90,10.7,[1120,706], OFF,        70],
  ]);
  E.cursor.setAttribute('transform',
    `translate(${p[0].toFixed(2)},${p[1].toFixed(2)}) scale(${dipOf(t,[B_T.click,B_T.run,B_T.approve]).toFixed(3)})`);
}

/* ---- scene registry ---------------------------------------- */
const SCENES=[
  { id:'5a', dur:A_DUR, make:aMake, bind:aBind, render:aRender,
    note:'A question is typed, sent, thought about and answered — and the answer arrives attached to the thing it came from. The typed text is not replaced by a message; it lifts out of the input and becomes one.',
    beats:[
      ['0.30 – 1.30','01 Empty state','A spark mark, a title, and three suggested prompts centred in the conversation area. The frame is never a blank box with an input at the bottom.','--ease-out'],
      ['1.20 – 1.86','02 Focus','Cursor arcs to the input and clicks. Cream focus ring, not amber.','--ease'],
      ['1.90 – 3.40','03 Typing','The suggestions clear, then two lines write themselves from nothing — no dot is visible before the first keystroke. Typing finishes at 3.40; the cursor does not leave for the send control until 3.52.','ease-in-out'],
      ['4.02 – 4.52','04 Sent','The send control flashes and the two typed lines lift out of the input into the message bubble. Same two objects.','--ease'],
      ['4.62 – 5.42','05 Thinking','Three dots roll on an offset sine, and the spark marks pulse — the mark is alive only while it is working.','sine'],
      ['5.42 – 7.68','06 Answering','The reply grows to height, then five lines write in 0.30s apart.','--ease-out / ease-in-out'],
      ['7.80 – 8.20','07 Sourced','A reference appears beneath the answer. This is the beat the scene exists for.','--ease-out'],
      ['9.30 – 10.2','08 Out','Everything leaves together.','--ease'],
    ],
  },
  { id:'5b', dur:B_DUR, make:bMake, bind:bBind, render:bRender,
    note:'One instruction, a four-step plan, and work that runs on its own — until the step with consequences, where it stops and waits. The cursor is out of frame for most of it and comes back only to decide.',
    beats:[
      ['0.30 – 1.30','01 Empty state','Spark mark, title, and three example instructions sitting where the plan will later go.','--ease-out'],
      ['1.88 – 2.74','02 Typing','The examples clear and one line writes itself from nothing.','ease-in-out'],
      ['3.34 – 4.10','03 Run','The run control flashes and the cursor leaves the frame.','--ease'],
      ['3.40 – 3.87','04 Plan','Four steps drop in 0.09s apart, each with an empty ring. The agent says what it intends before doing any of it.','--ease-out'],
      ['3.90 – 5.35','05 Working','Steps one and two fill their rings, tick, and grow a result. The spark mark pulses throughout. No cursor.','ease-in-out'],
      ['5.50 – 6.20','06 Stopped','The third ring fills to 60% and halts. An approval control appears.','--ease-out'],
      ['6.05 – 6.68','07 Approved','The cursor returns, for one click, and only for this.','--ease'],
      ['6.72 – 7.90','08 Finishing','The third ring completes from where it stopped; the fourth runs.','--ease-out'],
      ['8.05 – 8.60','09 Produced','A summary rises into place, carrying the same spark mark.','--ease-out'],
    ],
  },
];
const NOTES=[
  ['The spark is the house mark','n.abl already puts a spark on its own assistant launcher, so this is the studio’s own iconography rather than a borrowed one — the single element that says "this is the AI" with no word, no logo and no robot. It appears where it labels something: the header, the reply avatar, each suggestion, and the agent’s output. A large one floating in the middle of the frame was the one place it was decorating rather than labelling, so it is gone.'],
  ['The mark is alive only while it works','Both scenes pulse the spark on a slow sine, and only between the moment work starts and the moment it produces something. A mark that pulses permanently is an advert; one that pulses while thinking is a status.'],
  ['Nothing is visible before it is written','A value that has not been typed yet was rendering as a 3-unit dot from the first frame, so both scenes opened with stray marks sitting in an empty input. Written values now have no width and no opacity until their own start time.'],
  ['Typing finishes before the cursor leaves','The second line was still being written while the cursor was already travelling to send, which read as the message being sent half-composed. The type window now closes at 3.40 and the cursor does not move until 3.52.'],
  ['An empty state, not an empty box','Both scenes opened as a large void above a single input. They now open the way real assistants do — a watermark mark and three suggestions — which fills the frame, sets the register, and clears itself the moment someone starts typing.'],
  ['The agent stops','Three steps run unattended with the cursor off-frame. The third fills to 60% and waits. Building the version that runs the consequential step without asking is the easy one and the wrong one; the checkpoint is the product.'],
];


return SCENES.map(s=>({ make:s.make, bind:s.bind, render:s.render, dur:s.dur, id:s.id }));
})()
