import { NG, GCOL, DEPTH, GWARM, KEYS } from './story.js'

/* ============================================================
   THE LIT GROUND: the drawing

   One fixed WebGL canvas behind the page: espresso, eight soft glows drawn
   through twice-warped noise (the wisps), fluted glass that refracts them,
   and an aurora. Ported from the approved reference demo,
   business/02-brand/reference/nabl-scroll-story.html; brand-guidelines.md
   section 4 describes it in words.

   createGround(canvas, { reduced, shields }) returns null where WebGL is not
   available, and the page shows a still CSS version instead. Otherwise it
   returns { setStory(fn), layout(), setReduced(bool), destroy() }, where
   fn() returns [[scrollY, state], ...] for the current layout of the page.
   `shields` selects the blocks of words the light should dim behind
   (strength from data-shield, 0.9 if not given).

   Scroll sets a target state; every frame the drawn state eases toward it,
   so nothing snaps. The light also drifts slowly on its own, leans toward
   the pointer, and trails a fast scroll a little. Quality drops if a
   device cannot hold about 45 frames a second and climbs back when it can.
   ============================================================ */

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
uniform vec4 G[8]; uniform float GM[8]; uniform vec3 M; uniform vec3 WS; uniform vec2 WM; uniform vec3 RW;
float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.;float a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
float shield(vec4 b){ if(b.z<=b.x) return 0.; vec2 p=gl_FragCoord.xy; vec2 d=max(max(b.xy-p,p-b.zw),0.); return 1.-smoothstep(0.,min(220.*S,.35*R.x),length(d)); }

/* The wisps: twice-warped noise. The layout does not draw shapes; it says
   where each colour lives and how strong it is, and the wisps carry it.
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
  /* the brightest strands lift toward cream */
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

const UNIFORMS = ['R', 'T', 'TG', 'TA', 'S', 'Y', 'V', 'TQ', 'EM', 'SV', 'W', 'P', 'F', 'X', 'B0', 'B1', 'B2', 'BS', 'C0', 'CE', 'CA', 'CI', 'CD', 'C3', 'G', 'GM', 'M', 'WS', 'WM', 'RW']

/* Tuned on the demo, by eye and then by measurement (brand-guidelines.md 3.4). */
const EMBER = [1, 8]          // the aurora's ember band: floor strength, and how tightly it hugs the base
const WISP = [0.27, 2.2, 1.5]  // the wisps: noise threshold, contrast, strength
const WARM = [0.6, 0.4]        // ember into amber: how far a strand's core leans amber, and the split (about 60/40)
const ICE = 0.9                // ice a little under the warm colours

/* the reed widths the glass moves between; between two it blends one set into the next, so edges never jitter */
const REEDS = [6, 26, 46, 96, 150]
function reedLevels(fw) {
  const w = Math.max(REEDS[0], Math.min(REEDS[REEDS.length - 1], fw))
  let i = 0
  while (i < REEDS.length - 2 && w > REEDS[i + 1]) i++
  const t = (w - REEDS[i]) / (REEDS[i + 1] - REEDS[i])
  return [REEDS[i], REEDS[i + 1], t * t * (3 - 2 * t)]
}

const rgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const ss = (x) => x * x * (3 - 2 * x)

export function createGround(canvas, { reduced = false, shields: shieldSel = '[data-shield]' } = {}) {
  let gl = null
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power' })
  } catch (e) { gl = null }
  if (!gl || gl.isContextLost()) return null

  let RM = reduced
  let prog = null
  const U = {}

  function compile(type, src) {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null }
    return s
  }
  function initGL() {
    prog = null
    const v = compile(gl.VERTEX_SHADER, VERT), f = compile(gl.FRAGMENT_SHADER, FRAG)
    if (!v || !f) return
    const p = gl.createProgram()
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return }
    prog = p
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const a = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(a)
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    UNIFORMS.forEach((n) => { U[n] = gl.getUniformLocation(prog, n) })
    gl.uniform3fv(U.C0, rgb('#0E0C0A')); gl.uniform3fv(U.CE, rgb('#FF5A36')); gl.uniform3fv(U.CA, rgb('#E9AC57'))
    gl.uniform3fv(U.CI, rgb('#7CCBFF')); gl.uniform3fv(U.CD, rgb('#3E8FCC')); gl.uniform3fv(U.C3, rgb('#F0E7D8'))
    gl.uniform1fv(U.GM, new Float32Array(GWARM))
  }
  initGL()
  if (!prog) return null

  /* ---------- size, and quality that adapts to the device ---------- */
  let scale = 1, quality = 1, lowSince = 0, highSince = 0
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    scale = dpr * 0.6 * quality
    const w = Math.max(1, Math.round(canvas.clientWidth * scale)), h = Math.max(1, Math.round(canvas.clientHeight * scale))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h
      gl.viewport(0, 0, w, h)
      // a resize clears the canvas: draw again straight away rather than show a black frame
      if (lastS) { shields(); draw(lastS) }
    } else gl.viewport(0, 0, w, h)
  }

  /* ---------- the story: scroll position to state ---------- */
  let story = null, KF = [], vh = window.innerHeight
  function layout() {
    vh = window.innerHeight
    if (story) {
      try { KF = story() || [] } catch (e) { console.warn(e); KF = [] }
    }
    shieldEls = [...document.querySelectorAll(shieldSel)]
  }
  const mix = (A, B, t) => { const o = {}; for (const k of KEYS) o[k] = A[k] + (B[k] - A[k]) * t; return o }
  function sample(y) {
    if (!KF.length) return null
    if (y <= KF[0][0]) return KF[0][1]
    for (let j = 1; j < KF.length; j++) {
      const [y1, s1] = KF[j], [y0, s0] = KF[j - 1]
      if (y <= y1) {
        let t = ss(clamp01((y - y0) / (y1 - y0)))
        if (RM) t = t < 0.5 ? 0 : 1
        return mix(s0, s1, t)
      }
    }
    return KF[KF.length - 1][1]
  }

  /* ---------- shields: keep the light quiet behind the words in view ---------- */
  let shieldEls = []
  const range = document.createRange()
  function shields() {
    const ch = canvas.clientHeight, cw = canvas.clientWidth, out = []
    for (const el of shieldEls) {
      const r0 = el.getBoundingClientRect()
      if (r0.bottom < 0 || r0.top > ch || r0.right < 0 || r0.left > cw || r0.height === 0) continue
      range.selectNodeContents(el)
      const r = range.getBoundingClientRect()
      const area = Math.max(0, Math.min(r.bottom, ch) - Math.max(r.top, 0)) * Math.max(0, r.width)
      if (area > 0) out.push([area, r, parseFloat(el.dataset.shield) || 0.9])
    }
    out.sort((a, b) => b[0] - a[0])
    const u = [U.B0, U.B1, U.B2], st = [0, 0, 0]
    for (let j = 0; j < 3; j++) {
      const r = out[j] && out[j][1]
      if (r) { gl.uniform4f(u[j], r.left * scale, (ch - r.bottom) * scale, r.right * scale, (ch - r.top) * scale); st[j] = out[j][2] }
      else gl.uniform4f(u[j], 0, 0, 0, 0)
    }
    gl.uniform3f(U.BS, st[0], st[1], st[2])
  }

  /* ---------- pointer: nearby glows lean toward it and brighten; over the glass the reeds magnify ---------- */
  const ptr = { x: 0.7, y: 0.5, a: 0, tx: 0.7, ty: 0.5, ta: 0 }
  const onPointer = (e) => {
    if (e.pointerType === 'touch') return
    ptr.tx = e.clientX / Math.max(1, window.innerWidth)
    ptr.ty = 1 - e.clientY / Math.max(1, window.innerHeight)
    ptr.ta = 1
  }
  const onLeave = () => { ptr.ta = 0 }
  window.addEventListener('pointermove', onPointer, { passive: true })
  document.documentElement.addEventListener('mouseleave', onLeave)
  window.addEventListener('blur', onLeave)

  /* ---------- the frame ---------- */
  const COARSE = window.matchMedia('(pointer: coarse)').matches
  let clock = 6, gphase = 0.3, aphase = 0.25, wtime = 0, vsm = 0, sy = window.scrollY
  let sflow = window.scrollY * 0.25, vel = 0
  const gbuf = new Float32Array(NG * 4)
  function glowBuf(s) {
    const asp = canvas.clientWidth / Math.max(1, canvas.clientHeight)
    for (let i = 0; i < NG; i++) {
      let x = s[`g${i}x`], y = s[`g${i}y`], a = s[`g${i}a`]
      const r = s[`g${i}r`]
      x += 0.018 * Math.sin(wtime * 0.07 * (1 + i * 0.13) + i * 1.7)
      y += 0.016 * Math.cos(wtime * 0.06 * (1 + i * 0.11) + i * 2.3)
      a *= 0.9 + 0.1 * Math.sin(wtime * 0.23 + i * 1.3)
      if (GWARM[i] < 0) a *= ICE
      /* a small wander tied to the scroll position: scroll down and the glows drift, scroll back and they drift back */
      x += 0.03 * Math.sin(sy * 0.0024 * (1 + i * 0.17) + i * 2.1)
      y += 0.026 * Math.cos(sy * 0.002 * (1 + i * 0.13) + i * 1.3)
      y += vsm * DEPTH[i] * 0.07
      if (ptr.a > 0.001) {
        const dx = (ptr.x - x) * asp, dyy = ptr.y - y, w = ptr.a * Math.exp(-(dx * dx + dyy * dyy) / 0.1)
        x += (ptr.x - x) * 0.16 * w; y += (ptr.y - y) * 0.16 * w; a *= 1 + 0.5 * w
      }
      gbuf[i * 4] = x; gbuf[i * 4 + 1] = y; gbuf[i * 4 + 2] = r; gbuf[i * 4 + 3] = a
    }
    return gbuf
  }

  let lastS = null
  function draw(s) {
    if (!prog || !s) return
    const live = !RM
    gl.uniform2f(U.R, canvas.width, canvas.height); gl.uniform1f(U.T, clock); gl.uniform1f(U.TG, gphase); gl.uniform1f(U.TA, aphase); gl.uniform1f(U.S, scale)
    gl.uniform3f(U.SV, s.shd, s.vig, canvas.clientWidth < canvas.clientHeight ? 1 : 0)
    gl.uniform1f(U.Y, live ? sflow : 0); gl.uniform1f(U.V, vel * s.drift); gl.uniform3f(U.TQ, s.tone, s.hp, s.sat); gl.uniform2f(U.EM, EMBER[0], EMBER[1])
    gl.uniform3f(U.W, s.g, s.f, s.a); gl.uniform3f(U.P, s.tau, s.spread, 0)
    gl.uniform4f(U.F, 0, s.fw, s.heat, s.k); gl.uniform4f(U.X, 0, s.cy, 0, 0)
    gl.uniform4fv(U.G, glowBuf(s)); gl.uniform3f(U.M, ptr.x, ptr.y, ptr.a); gl.uniform3f(U.WS, WISP[0], WISP[1], WISP[2])
    gl.uniform2f(U.WM, WARM[0], WARM[1]); gl.uniform3fv(U.RW, reedLevels(s.fw))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const t0 = performance.now()
  let cur = null, last = t0, lastY = window.scrollY, lastMoveAt = 0, frameN = 0, fpsAvg = 60, raf = 0, alive = true
  /* the light fades up out of the dark when the page opens at the top */
  const introOn = !RM && window.scrollY < 10
  function step(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
    last = now
    const y = window.scrollY
    const dy = y - lastY, rawV = Math.abs(dy) / dt
    if (y !== lastY) lastMoveAt = now
    lastY = y
    const live = !RM
    sflow += dy * (cur ? cur.drift : 1)
    const vt = live ? Math.min(1, rawV / 2600) : 0
    vel += (vt * (COARSE ? 0.6 : 1) - vel) * (1 - Math.exp(-dt * (vt > vel ? 4 : 2)))
    if (live && !document.hidden) clock += dt

    const target = sample(y)
    if (!target) return !RM
    if (!cur) cur = { ...target }
    const ease = RM ? 1 : 1 - Math.exp(-dt * (3 + 4 * cur.drift))
    let moving = false
    for (const k of KEYS) { const d = target[k] - cur[k]; if (Math.abs(d) > 0.0005) moving = true; cur[k] += d * ease }
    const s = { ...cur }
    /* the drift, accumulated so a change of speed never jumps the pattern */
    if (live && !document.hidden) { gphase += dt * (0.03 + 0.06 * s.heat) * s.pace; aphase += dt * 0.04 * s.pace; wtime += dt * s.pace }
    /* signed scroll speed, eased: the glows trail it a little and settle when scrolling stops */
    const vsT = live ? Math.max(-1, Math.min(1, (dy / dt) / 2500)) : 0
    vsm += (vsT * (COARSE ? 0.7 : 1) - vsm) * (1 - Math.exp(-dt * 2.5))
    if (live) { const dsy = y - sy; sy += dsy * (1 - Math.exp(-dt * 6)); if (Math.abs(dsy) > 0.5) moving = true }
    const pe = 1 - Math.exp(-dt * 5)
    ptr.x += (ptr.tx - ptr.x) * pe; ptr.y += (ptr.ty - ptr.y) * pe
    ptr.a += ((live ? ptr.ta : 0) - ptr.a) * (1 - Math.exp(-dt * 3))
    if (Math.abs(ptr.tx - ptr.x) + Math.abs(ptr.ty - ptr.y) > 0.001 || Math.abs(vsm) > 0.002) moving = true
    if (introOn) {
      const t = (now - t0) / 1000
      if (t < 1.6) { s.k *= ss(clamp01(t / 1.4)); moving = true }
    }

    shields()
    const idle = !moving && now - lastMoveAt > 1500 && vel < 0.01
    lastS = s
    /* With motion off nothing drifts, so it draws only when something
       changes (the scroll moves it to another state, the page resizes) and
       then the loop stops: a still page does no work. Wakes on the next
       scroll or resize (kick). With motion on it keeps drifting, so it never
       stops, but once nothing else is moving it draws at half rate. */
    if (RM) {
      const fresh = frameN++ < 2
      if (moving || fresh || dy !== 0) draw(s)
      return moving || fresh || dy !== 0
    }
    if (!idle || (frameN++ & 1) === 0) draw(s)

    fpsAvg += (1 / dt - fpsAvg) * 0.05
    if (!document.hidden && now - t0 > 2500) {
      if (fpsAvg < 45) { lowSince = lowSince || now; if (now - lowSince > 1500 && quality > 0.45) { quality = Math.max(0.45, quality * 0.78); resize(); lowSince = now } } else lowSince = 0
      if (fpsAvg > 58) { highSince = highSince || now; if (now - highSince > 5000 && quality < 1) { quality = Math.min(1, quality / 0.78); resize(); highSince = now } } else highSince = 0
    }
    return true
  }
  function frame(now) {
    raf = 0
    if (!alive) return
    let more = true
    try { more = step(now) } catch (err) { if (!frame.warned) { frame.warned = true; console.warn(err) } }
    if (more) raf = requestAnimationFrame(frame)
  }
  /* start the loop if it has stopped (reduced motion, once still) */
  function kick() {
    if (raf || !alive) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  window.addEventListener('scroll', kick, { passive: true })
  window.addEventListener('resize', kick)

  const onLost = (e) => { e.preventDefault(); prog = null }
  const onRestored = () => { initGL(); resize() }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  const ro = new ResizeObserver(() => { resize(); kick() })
  ro.observe(canvas)

  resize()
  raf = requestAnimationFrame(frame)

  return {
    setStory(fn) { story = fn; layout(); frameN = 0; kick() },
    layout() { layout(); frameN = 0; kick() },
    setReduced(r) { RM = !!r; frameN = 0; kick() },
    destroy() {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
      window.removeEventListener('pointermove', onPointer)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('blur', onLeave)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      /* The context is not deliberately lost here. React mounts a component
         twice in development, and the canvas element survives the first
         unmount: losing its context would leave the second mount nothing to
         draw with. The context goes with the canvas when it leaves the page. */
    },
  }
}
