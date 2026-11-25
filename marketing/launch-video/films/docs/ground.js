/* ============================================================
   THE LIT GROUND, for the docs reel

   The 2026-11 brand's ground (business/02-brand/brand-guidelines.md,
   section 4), lifted from its reference demo, reference/nabl-scroll-story.html,
   as the guidelines say to: the fragment shader and the layouts are the
   demo's, character for character; what drives them is the film's timeline
   instead of the scroll. Eight soft glows (three ember, two amber, three
   ice) drawn as wisps, fluted glass, and aurora, on espresso.

   ground(parent, W, H) puts a canvas in parent and returns draw(s, clk,
   shields): s is a state (mk(...) below, or a mix of two); clk the demo's
   accumulated phases; shields up to three rects [x0, y0, x1, y1, strength]
   in stage pixels, kept dark behind words. Everything is a function of the
   film's time, so any frame can be drawn in any order.
   ============================================================ */

export const NG = 8
export const GWARM = [.12, .3, .2, .78, .62, -1, -1, -1]
const GCOL = ['#FF5A36', '#FF5A36', '#FF5A36', '#E9AC57', '#E9AC57', '#7CCBFF', '#7CCBFF', '#7CCBFF']
const SK = ['g', 'f', 'a', 'fw', 'tau', 'spread', 'cy', 'heat', 'k', 'drift', 'tone', 'sat', 'hp', 'pace', 'shd', 'vig']
const GK = []; for (let i = 0; i < NG; i++) GK.push('g' + i + 'x', 'g' + i + 'y', 'g' + i + 'r', 'g' + i + 'a')
export const KEYS = SK.concat(GK)
const S0 = { g: 1, f: 0, a: 0, fw: 26, tau: .3, spread: .6, cy: .55, heat: .3, k: 1, drift: 1, tone: .45, sat: 1, hp: 0, pace: 1, shd: 1, vig: 0 }
for (let i = 0; i < NG; i++) Object.assign(S0, { ['g' + i + 'x']: .5, ['g' + i + 'y']: .5, ['g' + i + 'r']: .2, ['g' + i + 'a']: 0 })
const lay = rows => { const o = {}; rows.forEach((r, i) => { o['g' + i + 'x'] = r[0]; o['g' + i + 'y'] = r[1]; o['g' + i + 'r'] = r[2]; o['g' + i + 'a'] = r[3] }); return o }
export const mk = (o, rows) => Object.assign({}, S0, rows ? lay(rows) : null, o)
export const dim = (rows, f) => rows.map(r => [r[0], r[1], r[2], r[3] * f])
export const mix = (A, B, t) => { const o = {}; for (const k of KEYS) o[k] = A[k] + (B[k] - A[k]) * t; return o }

/* the demo's layouts: [x 0 left..1 right, y 0 bottom..1 top, radius in screen heights, strength]
   for ember, ember, ember, amber, amber, ice, ice, ice */
export const L = {
  hero:   [[.86, .16, .33, .7], [.24, .97, .2, .55], [.16, .04, .27, .62], [.75, .52, .11, .55], [1.03, .66, .14, .36], [.97, .92, .28, .65], [.02, .55, .2, .45], [1.1, .32, .2, .42]],
  heat1:  [[.82, .28, .23, .62], [.46, 1.0, .17, .48], [.18, .03, .22, .56], [.68, .56, .11, .46], [.99, .72, .11, .28], [1.03, .95, .22, .5], [.01, .64, .16, .36], [1.1, .3, .16, .32]],
  heat2:  [[.78, .3, .22, .62], [.5, 1.0, .18, .5], [.2, .02, .22, .58], [.66, .58, .12, .5], [1.0, .1, .12, .3], [1.02, .96, .22, .48], [.0, .66, .16, .34], [1.1, .5, .15, .3]],
  fix1:   [[.86, .22, .27, .6], [.12, .97, .17, .46], [.2, .02, .24, .48], [.74, .56, .16, .7], [.95, .8, .12, .4], [1.0, .97, .23, .55], [.02, .4, .19, .48], [1.08, .42, .19, .48]],
  fix2:   [[.91, .1, .25, .5], [.3, .98, .15, .4], [.08, .01, .22, .4], [.7, .46, .14, .6], [.88, .87, .12, .4], [.98, .7, .27, .65], [.02, .5, .2, .58], [1.06, .29, .21, .55]],
  fix3:   [[.95, .06, .21, .4], [.36, .99, .13, .3], [.1, .0, .2, .32], [.68, .5, .12, .52], [.84, .91, .1, .36], [.92, .64, .29, .7], [.02, .36, .24, .66], [1.04, .35, .22, .65]],
  cards: [[.66, .66, .24, .52], [.79, .29, .19, .38], [.42, .08, .19, .24], [.56, .87, .09, .32], [.91, .9, .09, .24], [.14, .7, .24, .48], [.97, .54, .2, .42], [.3, .19, .15, .28]],
  step1: [[.7, .6, .24, .48], [.86, .24, .17, .34], [.46, .05, .19, .24], [.6, .84, .11, .38], [.93, .86, .09, .28], [.18, .66, .22, .44], [.98, .5, .19, .42], [.34, .15, .15, .28]],
  step2: [[.74, .56, .22, .44], [.9, .2, .15, .28], [.5, .02, .17, .2], [.64, .8, .13, .42], [.95, .84, .09, .32], [.22, .62, .24, .48], [.98, .44, .2, .48], [.38, .12, .17, .32]],
  pricing: [[.9, .2, .2, .32], [.08, .1, .14, .14], [.5, -.16, .2, .12], [.8, .76, .11, .28], [.2, .92, .08, .14], [.12, .86, .2, .32], [.97, .55, .15, .2], [.6, 1.05, .14, .16]],
  contact: [[.12, .2, .22, .27], [.03, .7, .12, .17], [.28, .99, .11, .14], [.5, -.12, .27, .33], [.82, .07, .13, .19], [.9, .83, .24, .33], [.99, .4, .18, .25], [.62, 1.06, .16, .17]]
};

/* the demo's constants */
const EMBER = [1, 8], WISP = [.27, 2.2, 1.5], WARM = [.6, .4], ICE = .9
const REEDS = [6, 26, 46, 96, 150]
function reedLevels(fw) {
  const w = Math.max(REEDS[0], Math.min(REEDS[REEDS.length - 1], fw))
  let i = 0; while (i < REEDS.length - 2 && w > REEDS[i + 1]) i++
  const t = (w - REEDS[i]) / (REEDS[i + 1] - REEDS[i])
  return [REEDS[i], REEDS[i + 1], t * t * (3 - 2 * t)]
}

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 R; uniform float T; uniform float TG; uniform float TA; uniform float S; uniform float Y; uniform float V; uniform vec3 TQ; uniform vec2 EM; uniform vec3 SV;
uniform vec3 W; uniform vec3 P; uniform vec4 F; uniform vec4 X;
uniform vec4 B0; uniform vec4 B1; uniform vec4 B2; uniform vec3 BS;
uniform vec3 C0; uniform vec3 CE; uniform vec3 CA; uniform vec3 CI; uniform vec3 CD; uniform vec3 C3;
uniform vec4 G[8]; uniform vec3 GC[8]; uniform float GM[8]; uniform vec3 M; uniform vec3 WS; uniform vec2 WM; uniform vec3 RW;
float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.;float a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
float shield(vec4 b){ if(b.z<=b.x) return 0.; vec2 p=gl_FragCoord.xy; vec2 d=max(max(b.xy-p,p-b.zw),0.); return 1.-smoothstep(0.,min(220.*S,.35*R.x),length(d)); }

/* The wisps: twice-warped noise, the drafts' grain-gradient shape. The per-beat layout no longer
   draws the shapes; it says where each colour lives and how strong it is, and the wisps carry it.
   Near the pointer the noise curls, so the wisps turn around it. */
vec3 glowsL(vec2 uv){
  float asp=R.x/R.y;
  vec2 p=vec2(uv.x*asp,uv.y);
  vec2 dm=p-vec2(M.x*asp,M.y);
  vec2 pp=p+vec2(0.,Y*.00012)+M.z*.16*vec2(-dm.y,dm.x)*exp(-dot(dm,dm)*5.);
  float t=TG+Y*.0004;
  vec2 q=vec2(fbm(pp*.55+vec2(0.,t)),fbm(pp*.55+vec2(5.2,1.3)-vec2(t*.8,0.)));
  vec2 r=vec2(fbm(pp*.8+1.6*q+vec2(1.7,9.2)+t*.3),fbm(pp*.8+1.6*q+vec2(8.3,2.8)-t*.25));
  float f=fbm(pp*.7+1.7*r);
  /* where each colour lives: the layout, its edges bent by the same warp so they flow with the wisps */
  vec2 pw=p+(r-.5)*.35;
  float wW=0.; float wM=0.; float wI=0.; float wt=0.;
  for(int i=0;i<8;i++){
    vec4 g=G[i];
    if(g.w>.002){
      vec2 d=(pw-vec2(g.x*asp,g.y))/max(g.z*1.45,.01);
      float w=g.w*exp(-dot(d,d)*1.1);
      float w3=w*w*w;
      float m=GM[i];
      if(m<0.){ wI+=w3; } else { wW+=w3; wM+=w3*m; }
      wt+=w;
    }
  }
  float warmAt=wM/max(wW,1e-5);
  float iceShare=wI/max(wW+wI,1e-5);
  float v=clamp((f-WS.x)*WS.y,0.,1.)*(1.-exp(-wt*1.8));
  v=v*v*(3.-2.*v);
  /* the warm colours run on one scale, ember into amber: each strand's core leans amber and its edges ember */
  vec3 warm=mix(CE,CA,clamp(warmAt+(v-.5)*WM.x+WM.y,0.,1.));
  vec3 hue=mix(warm,CI,iceShare);
  /* the brightest strands lift toward cream, as in the drafts */
  vec3 c=mix(hue*.92,mix(hue,C3,.32),smoothstep(.55,1.,v));
  return c*v*WS.z;
}
/* aurora: an amber curtain between an ember one and an ice one; temperature sets their strength */
vec3 auroraL(vec2 uv){
  float asp=R.x/R.y; float x=uv.x*asp; float t=TA+Y*.00018;
  vec3 L=vec3(0.);
  float hot=max(clamp(1.-P.x*1.25,0.,1.),EM.x)*mix(.6,1.,P.y), cool=clamp(P.x*1.25-.1,0.,1.)*mix(.6,1.,P.y);
  for(int i=0;i<3;i++){
    float fi=float(i);
    float w1=fbm(vec2(x*.7+fi*3.7+t*(1.+fi*.3),fi*1.7+t*.3));
    float w2=noise(vec2(x*2.3-t*1.5+fi*9.,fi));
    float hem=X.y-.1+.5*(w1-.5)+.06*(w2-.5)+fi*.07+V*.07*sin(x*3.+T*.8+fi);
    float h=uv.y-hem;
    float below=exp(-pow(max(-h,0.)*13.,2.));
    float above=exp(-max(h,0.)*(fi<.5?EM.y:3.-fi*.6));
    float streak=.5+.5*noise(vec2(x*26.+fi*13.+t*3.,uv.y*.8+t*.2));
    streak=mix(1.,streak,smoothstep(0.,.22,h));
    vec3 k=fi<.5?CE*hot:fi<1.5?CA*.95:mix(CD,CI,.55)*cool;
    L+=k*below*above*streak*(.95-fi*.12);
  }
  return L;
}
vec3 scene(vec2 uv){
  vec3 L=vec3(0.);
  if(W.x>.002) L+=glowsL(uv)*W.x;
  if(W.z>.002) L+=auroraL(uv)*W.z*.9;
  return L;
}
/* one set of reeds at a fixed width: where this pixel samples the ground, and where it sits across its reed */
vec2 reedAt(vec2 uv,float wpx,float lens,out float l){
  float fw=max(wpx,6.)*S/R.x; float fx=uv.x/fw; float id=floor(fx); l=fract(fx);
  float bend=(l-.5)*(1.4+V*1.+lens*2.);
  return vec2((id+.5-bend)*fw,uv.y+bend*bend*.015);
}
void main(){
  vec2 uv=gl_FragCoord.xy/R;
  float present=0.; float shade=1.; float rim=0.;
  vec2 suv=uv;
  if(W.y>.002){
    present=W.y;
    /* the reeds magnify a little around the pointer */
    vec2 pd=(uv-M.xy)*vec2(R.x/R.y,1.);
    float lens=M.z*exp(-dot(pd,pd)*10.);
    float lA; float lB;
    vec2 sA=reedAt(uv,RW.x,lens,lA); vec2 sB=reedAt(uv,RW.y,lens,lB);
    suv=mix(uv,mix(sA,sB,RW.z),present);
    shade=mix(.7+.34*sin(lA*3.14159),.7+.34*sin(lB*3.14159),RW.z);
    rim=mix(pow(smoothstep(.72,.97,lA),4.),pow(smoothstep(.72,.97,lB),4.),RW.z);
  }
  vec3 L=scene(suv);
  L*=mix(1.,shade,present);
  float ll=dot(L,vec3(.2126,.7152,.0722));
  L=mix(vec3(ll),L,TQ.z);
  L=mix(L/(1.+L*TQ.x),L/(1.+ll*TQ.x),TQ.y);
  vec3 col=C0+L;
  col+=C3*rim*.06*present;
  float sh=max(shield(B0)*BS.x,max(shield(B1)*BS.y,shield(B2)*BS.z))*SV.x;
  /* the fixed fade: strongest at the left edge, gone by 78% across; on a portrait screen the copy is full width */
  float vg=SV.y*mix(1.-smoothstep(.3,.78,uv.x),.72,SV.z);
  col=mix(col,C0+(col-C0)*.3,max(sh,vg));
  col=C0+(col-C0)*F.w;
  gl_FragColor=vec4(col,1.);
}`

export function ground(parent, W, H, { q = .5 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * q); canvas.height = Math.round(H * q)
  Object.assign(canvas.style, { position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px' })
  parent.appendChild(canvas)
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false })
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s }
  const prog = gl.createProgram(); gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
  const U = {}
  ;['R', 'T', 'TG', 'TA', 'S', 'Y', 'V', 'TQ', 'EM', 'SV', 'W', 'P', 'F', 'X', 'B0', 'B1', 'B2', 'BS', 'C0', 'CE', 'CA', 'CI', 'CD', 'C3', 'G', 'GC', 'GM', 'M', 'WS', 'WM', 'RW'].forEach(n => U[n] = gl.getUniformLocation(prog, n))
  const rgb = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
  gl.uniform3fv(U.C0, rgb('#0E0C0A')); gl.uniform3fv(U.CE, rgb('#FF5A36')); gl.uniform3fv(U.CA, rgb('#E9AC57'))
  gl.uniform3fv(U.CI, rgb('#7CCBFF')); gl.uniform3fv(U.CD, rgb('#3E8FCC')); gl.uniform3fv(U.C3, rgb('#F0E7D8'))
  gl.uniform3fv(U.GC, new Float32Array([].concat(...GCOL.map(rgb))))
  gl.uniform1fv(U.GM, new Float32Array(GWARM))
  gl.viewport(0, 0, canvas.width, canvas.height)
  const gbuf = new Float32Array(NG * 4)
  /* the glows for this frame: the layout and the demo's slow wander, on the film's clock
     (the scroll's and the pointer's parts held still) */
  function glowBuf(s, wtime) {
    for (let i = 0; i < NG; i++) {
      let x = s['g' + i + 'x'], y = s['g' + i + 'y'], r = s['g' + i + 'r'], a = s['g' + i + 'a']
      x += .018 * Math.sin(wtime * .07 * (1 + i * .13) + i * 1.7)
      y += .016 * Math.cos(wtime * .06 * (1 + i * .11) + i * 2.3)
      a *= .9 + .1 * Math.sin(wtime * .23 + i * 1.3)
      if (GWARM[i] < 0) a *= ICE
      x += .03 * Math.sin(i * 2.1); y += .026 * Math.cos(i * 1.3)
      gbuf[i * 4] = x; gbuf[i * 4 + 1] = y; gbuf[i * 4 + 2] = r; gbuf[i * 4 + 3] = a
    }
    return gbuf
  }
  /* clk: { T, TG, TA, wtime, V }: the demo's clock and accumulated phases, from the film's time */
  return function draw(s, clk, shields = []) {
    gl.uniform2f(U.R, canvas.width, canvas.height); gl.uniform1f(U.T, clk.T); gl.uniform1f(U.TG, clk.TG); gl.uniform1f(U.TA, clk.TA); gl.uniform1f(U.S, q)
    gl.uniform3f(U.SV, s.shd, s.vig, W < H ? 1 : 0)
    gl.uniform1f(U.Y, 0); gl.uniform1f(U.V, (clk.V || 0) * s.drift); gl.uniform3f(U.TQ, s.tone, s.hp, s.sat); gl.uniform2f(U.EM, EMBER[0], EMBER[1])
    gl.uniform3f(U.W, s.g, s.f, s.a); gl.uniform3f(U.P, s.tau, s.spread, 0)
    gl.uniform4f(U.F, 0, s.fw, s.heat, s.k); gl.uniform4f(U.X, 0, s.cy, 0, 0)
    gl.uniform4fv(U.G, glowBuf(s, clk.wtime)); gl.uniform3f(U.M, .5, .5, 0); gl.uniform3f(U.WS, WISP[0], WISP[1], WISP[2])
    gl.uniform2f(U.WM, WARM[0], WARM[1]); gl.uniform3fv(U.RW, reedLevels(s.fw))
    const u = [U.B0, U.B1, U.B2], st = [0, 0, 0]
    for (let j = 0; j < 3; j++) {
      const b = shields[j]
      if (b) { gl.uniform4f(u[j], b[0] * q, (H - b[3]) * q, b[2] * q, (H - b[1]) * q); st[j] = b[4] } else gl.uniform4f(u[j], 0, 0, 0, 0)
    }
    gl.uniform3f(U.BS, st[0], st[1], st[2])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
