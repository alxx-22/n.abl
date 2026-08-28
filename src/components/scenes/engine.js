/* ============================================================
   SCENE ENGINE

   The six service scenes are timelines in real seconds, sampled per
   frame, not CSS keyframes: a keyframe cannot be asked where it is at
   4.31s, and every one of these scenes needs exactly that to keep a
   cursor, a payload and a panel agreeing with each other.

   The curves are the repository's own. EASE and EASE_OUT are the
   literal values of --ease and --ease-out in tokens.css, solved here
   with Newton-Raphson so JavaScript can evaluate what CSS interpolates.
   EASE_IO exists because the other two are arrival curves: they spend
   most of their travel early, which is right for something coming to
   rest and wrong for anything accumulating. A trend line drawn on
   EASE_OUT is 68% complete in the first sixth of its window and then
   crawls, which reads as a stall rather than a rise.
   ============================================================ */

export function bezier(x1,y1,x2,y2){
  const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx, cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
  const fx=t=>((ax*t+bx)*t+cx)*t, dfx=t=>(3*ax*t+2*bx)*t+cx;
  return x=>{ if(x<=0)return 0; if(x>=1)return 1; let t=x;
    for(let i=0;i<8;i++){const e=fx(t)-x; if(Math.abs(e)<1e-6)break; const d=dfx(t); if(Math.abs(d)<1e-6)break; t-=e/d;}
    return ((ay*t+by)*t+cy)*t; };
}
export const EASE=bezier(.22,1,.36,1), EASE_OUT=bezier(.16,1,.3,1), LINEAR=x=>x;
export const EASE_IO=bezier(.5,0,.5,1);   // for accumulation, not arrival
export const seg=(t,a,b,e)=> t<=a?0 : t>=b?1 : (e||LINEAR)((t-a)/(b-a));
export const lerp=(a,b,p)=>a+(b-a)*p;
export const pulse=(t,a,b,c)=>seg(t,a,b)-seg(t,b,c);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function arc(from,to,p,bow){
  const mx=(from[0]+to[0])/2,my=(from[1]+to[1])/2, dx=to[0]-from[0],dy=to[1]-from[1];
  const L=Math.hypot(dx,dy)||1, cx=mx-dy/L*bow, cy=my+dx/L*bow, q=1-p;
  return [q*q*from[0]+2*q*p*cx+p*p*to[0], q*q*from[1]+2*q*p*cy+p*p*to[1]];
}
export const C={bg:'#0E0C0A',frame:'#16120F',s1:'#1A1613',s2:'#221D18',s3:'#2B241E',s4:'#362D25',
  cream100:'#FBF6EC',cream200:'#F0E7D8',amber:'#E9AC57',amber200:'#F8D9A4',
  creamRGB:'240,231,216',amberRGB:'233,172,87'};
export const cr=a=>`rgba(${C.creamRGB},${a})`, am=a=>`rgba(${C.amberRGB},${a})`;

/* Every scene mints ids for its own gradients, filters and clip paths.
   Two scenes on one page with the same id is one scene borrowing the
   other's mask, so the counter is shared and never resets. */
let uid = 0
export const nextUid = () => ++uid
