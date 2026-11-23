/* ============================================================
   THE MARK'S RENDERER: WebGL2, drawn fresh for every frame asked for

   One HDR frame per call, built in passes:
     scene     the ground, and the wordmark as exact distance fields (its
               strokes are a 13-unit monoline of boxes and true circles),
               so it is crisp at any size, blurs by depth of field, glows,
               draws itself on and burns away, analytically
     text      the type, as signed-distance glyphs made here from the
               site's own fonts, so it blurs, glows and burns the same way
     particles thousands of motes, each a capsule from where it was a
               shutter ago to where it is, so every one carries its own
               motion blur; out of focus they open into bokeh discs
     bloom     a bright pass blurred down and back up a mip chain, light
               shafts from a point, and an anamorphic streak
     final     shockwaves that bend the frame, chromatic aberration,
               camera motion blur, filmic tone mapping, vignette
   The world is in the wordmark's own units (public/brand/wordmark.svg,
   y down); the camera is a real perspective camera over the plane z = 0.
   ============================================================ */

/* ---------- distance-field glyphs, from the page's fonts ---------- */
const INF = 1e20
function edt1d(f, d, v, z, n) {
  v[0] = 0; z[0] = -INF; z[1] = INF
  for (let q = 1, k = 0; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]) }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF
  }
  for (let q = 0, k = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]] }
}
function edt(g, w, h) {                                   // squared distances, in place (Felzenszwalb and Huttenlocher)
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Uint16Array(n), z = new Float64Array(n + 1)
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1d(f, d, v, z, h); for (let y = 0; y < h; y++) g[y * w + x] = d[y] }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1d(f, d, v, z, w); for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]) }
}
export const SPREAD = 18                                  // atlas px of distance either side of the edge
/* glyphs: [{ font, px, chars }] → an R8 atlas and, per font and char, its cell, pen origin and advance */
export function glyphAtlas(sets) {
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true })
  const cells = [], pad = SPREAD + 2
  for (const set of sets) {
    cx.font = `${set.font.replace('PX', set.px)}`
    const m = cx.measureText('Hgjy|'), asc = Math.ceil(m.fontBoundingBoxAscent), desc = Math.ceil(m.fontBoundingBoxDescent)
    for (const ch of new Set(set.chars)) {
      const mm = cx.measureText(ch)
      const left = Math.ceil(Math.max(0, mm.actualBoundingBoxLeft)), right = Math.ceil(Math.max(mm.width, mm.actualBoundingBoxRight))
      cells.push({ key: set.name + ch, set, ch, w: left + right + 2 * pad, h: asc + desc + 2 * pad, ox: pad + left, oy: pad + asc, adv: mm.width })
    }
  }
  // pack in rows
  const AW = 2048; let x = 0, y = 0, rowH = 0
  for (const c of cells) { if (x + c.w > AW) { x = 0; y += rowH; rowH = 0 } c.x = x; c.y = y; x += c.w; rowH = Math.max(rowH, c.h) }
  const AH = y + rowH
  const out = new Uint8Array(AW * AH)
  for (const c of cells) {
    cv.width = c.w; cv.height = c.h
    cx.font = c.set.font.replace('PX', c.set.px); cx.fillStyle = '#fff'; cx.textBaseline = 'alphabetic'
    cx.clearRect(0, 0, c.w, c.h); cx.fillText(c.ch, c.ox, c.oy)
    const a = cx.getImageData(0, 0, c.w, c.h).data, n = c.w * c.h
    const outer = new Float64Array(n).fill(INF), inner = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      const al = a[4 * i + 3] / 255
      if (al === 0) continue
      if (al === 1) { outer[i] = 0; inner[i] = INF } else { const dd = .5 - al; outer[i] = dd > 0 ? dd * dd : 0; inner[i] = dd < 0 ? dd * dd : 0 }
    }
    edt(outer, c.w, c.h); edt(inner, c.w, c.h)
    for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) {
      const d = outer[j * c.w + i] - inner[j * c.w + i]                         // + outside
      out[(c.y + j) * AW + c.x + i] = Math.max(0, Math.min(255, Math.round(255 * (.5 - d / (2 * SPREAD)))))
    }
  }
  const map = {}; for (const c of cells) map[c.key] = c
  return { data: out, w: AW, h: AH, map }
}

/* ---------- GL plumbing ---------- */
function shader(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'))
  return s
}
function program(gl, vs, fs) {
  const p = gl.createProgram(); gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i), name = a.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, a.name) }
  return { p, u }
}
function target(gl, w, h, fmt = 'f16') {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t)
  if (fmt === 'f16') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
  return { t, fb, w, h }
}

/* ---------- shaders ---------- */
const FULL_VS = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2. - 1., 0, 1); }`

// the camera, shared: world → device px (y down) and depth along the view
const CAM = `
uniform vec2 uRes, uCenter; uniform float uF; uniform vec3 uCam; uniform mat3 uRot;
uniform float uAperture, uFocus;
vec2 project(vec3 P, out float zc) { vec3 q = transpose(uRot) * (P - uCam); zc = -q.z; return uCenter + uF * q.xy / max(zc, 1e-3); }
float cocPx(float zc) { return uAperture * abs(zc - uFocus) / zc; }`

const NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }`

const SCENE_FS = `#version 300 es
precision highp float;
${CAM}
${NOISE}
uniform float uTime;
uniform float uFrontN, uHeatN;                 // the n, filled from its right foot along its path; how slowly it cools
uniform vec4 uFrontAbl; uniform float uFrontL; // a bowl, a stem, b stem, b bowl; l
uniform vec4 uSpeedAbl; uniform float uSpeedL;
uniform vec4 uDot;                             // shown, scale, heat, pulse
uniform float uSheen, uBurn;                   // a light running across; the burn front (x, units), right of it gone
uniform vec3 uCoreW; uniform float uCore;      // the point of light the motes gather to, in the world, and how bright
uniform vec3 uHaze;                            // the warm haze behind the mark: centre x, y, strength
uniform vec4 uLine;                            // a line of light: from x, to x, at y, how bright
in vec2 vUv; out vec4 o;
const float HW = 6.5;
float boxSD(vec2 p, vec2 a, vec2 b){ vec2 c = (a + b) * .5, h = (b - a) * .5; vec2 q = abs(p - c) - h; return length(max(q, 0.)) + min(max(q.x, q.y), 0.); }
float segD(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
float ring(vec2 p, vec2 c, float r, float a0, float front, out float age){
  // the drawn part of a circle: a true ring once whole; while drawing, an arc whose ends are rounded
  vec2 q = p - c; float a = mod(atan(q.y, q.x) - a0, 6.2831853), drawn = clamp(front / r, 0., 6.2831853);
  if (front <= 0.) { age = 0.; return 1e4; }
  if (a <= drawn) { age = front - a * r; return abs(length(q) - r) - HW; }
  vec2 e0 = c + r * vec2(cos(a0), sin(a0)), e1 = c + r * vec2(cos(a0 + drawn), sin(a0 + drawn));
  float d0 = length(p - e0), d1 = length(p - e1);
  age = front * (a - drawn) / max(6.2831853 - drawn, 1e-3);     // round the undrawn gap, from the head's heat to the start's
  return min(d0, d1) - HW;
}
float stem(vec2 p, float x, float top, float len, float front, out float age){
  age = front - (p.y - top);
  if (front <= 0.) return 1e4;
  return boxSD(p, vec2(x - HW, top), vec2(x + HW, top + min(front, len)));
}
// every stroke keeps its own glow (the brightest wins), so a hot one is never cut off where a cooler one is nearer;
// inside, the hottest stroke covering the point sets its colour
void acc(float dd, float h, float w, inout float d, inout float hin, inout vec3 glow, float ahead){
  d = min(d, dd);
  hin = max(hin, h * smoothstep(w, -w, dd));
  glow = max(glow, mix(vec3(.9, .55, .25) * .04, vec3(1., .6, .25) * .8, h) * exp(-max(dd, 0.) / (2.5 + 6. * h)) * (.25 + .6 * h) * exp(-max(ahead, 0.) / 3.));
}
// the strokes of the name: their distance, how hot what is drawn there is (1 just drawn, cooling to 0), their glow
float strokes(vec2 p, float w, out float hin, out vec3 glow){
  float d = 1e4; hin = 0.; glow = vec3(0);
  // the n: its right stem, the shoulder (a true half circle) and its left stem, along their centre lines,
  // butt-ended on the baseline, set in that order: each its own heat, so nothing jumps between them
  vec2 q = p - vec2(44.5, 48.);
  float fN = uFrontN + (fbm(p * .14) - .5) * 12.;       // a ragged front, where the motes land
  // (what is not set yet does not glow: its glow dies just ahead of the front)
  float sR = clamp(82. - p.y, 0., 34.);
  acc(max(max(segD(p, vec2(64.5, 48), vec2(64.5, 82)) - HW, p.y - 82.), sR - fN), exp(-max(fN - sR, 0.) / uHeatN) , w, d, hin, glow, sR - fN);
  // the shoulder's ends, below its centre line, belong to the stem they meet
  float sA = q.y > 0. ? (q.x < 0. ? 34. + 62.831853 : 34.) : 34. + 20. * clamp(atan(-q.y, q.x), 0., 3.1415927);
  float da = q.y <= 0. ? abs(length(q) - 20.) : min(length(p - vec2(24.5, 48)), length(p - vec2(64.5, 48)));
  acc(max(da - HW, sA - fN), exp(-max(fN - sA, 0.) / uHeatN), w, d, hin, glow, sA - fN);
  float sL = 34. + 62.831853 + clamp(q.y, 0., 34.);
  acc(max(max(segD(p, vec2(24.5, 82), vec2(24.5, 48)) - HW, p.y - 82.), sL - fN), exp(-max(fN - sL, 0.) / uHeatN), w, d, hin, glow, sL - fN);
  float ag, dd;
  dd = ring(p, vec2(128.25, 51.75), 23.75, -1.5707963, uFrontAbl.x, ag); acc(dd, exp(-max(ag, 0.) / (uSpeedAbl.x * .1)), w, d, hin, glow, 0.);
  dd = stem(p, 152., 21.5, 60.5, uFrontAbl.y, ag); acc(dd, exp(-max(ag, 0.) / (uSpeedAbl.y * .1)), w, d, hin, glow, 0.);
  dd = stem(p, 178., 6., 76., uFrontAbl.z, ag); acc(dd, exp(-max(ag, 0.) / (uSpeedAbl.z * .1)), w, d, hin, glow, 0.);
  dd = ring(p, vec2(201.75, 51.75), 23.75, 3.1415927, uFrontAbl.w, ag); acc(dd, exp(-max(ag, 0.) / (uSpeedAbl.w * .1)), w, d, hin, glow, 0.);
  dd = stem(p, 248.5, 6., 76., uFrontL, ag); acc(dd, exp(-max(ag, 0.) / (uSpeedL * .1)), w, d, hin, glow, 0.);
  return d;
}
void main(){
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 dir = uRot * vec3((sp - uCenter) / uF, -1.);
  float t = -uCam.z / dir.z; vec3 P = uCam + t * dir; vec2 p = P.xy;
  float zc = t;
  // the ground: warm black, a haze behind the mark that the camera moves past, slow smoke, light from above
  vec3 col = vec3(.0048, .0040, .0033);
  vec2 hz = (p - uHaze.xy) / 260.;
  col += vec3(.045, .026, .010) * exp(-dot(hz, hz)) * uHaze.z;
  col += vec3(.016, .011, .007) * max(0., fbm(p * .0055 + vec2(uTime * .02, -uTime * .012)) - .35) * uHaze.z;
  col += vec3(.010, .008, .006) * pow(1. - sp.y / uRes.y, 2.5);
  // the point of light the motes gather into
  float czc; vec2 cs = project(uCoreW, czc);
  float cr = length(sp - cs) / uRes.y;
  col += vec3(1., .72, .4) * uCore * (exp(-cr * cr * 3000.) * 5. + exp(-cr * 22.) * .25);
  // the mark
  // the line of light under the type
  if (uLine.w > 0.) {
    float dl = length(vec2(p.x - clamp(p.x, uLine.x, uLine.y), p.y - uLine.z));
    col += vec3(1., .62, .25) * uLine.w * (exp(-dl / .35) * 4. + exp(-dl / 3.) * .5);
  }
  if (p.x > -40. && p.x < 320. && p.y > -40. && p.y < 140.) {
    float upp = length(fwidth(p));
    float w = max(upp * .7, cocPx(zc) * zc / uF * .5);
    float heat; vec3 glow; float d = strokes(p, w, heat, glow);
    float b = 1e4;
    if (uBurn < 1e3) { b = (p.x - uBurn) + (fbm(p * .35) - .5) * 26.; d = max(d, b); glow *= smoothstep(8., -6., b); }
    float cov = smoothstep(w, -w, d);
    vec3 cream = vec3(1.05, .965, .84);
    vec3 hot = mix(vec3(1., .5, .16) * 2.2, vec3(1., .9, .75) * 4.5, smoothstep(.45, 1., heat));
    vec3 sc = mix(cream, hot, smoothstep(0., 1., heat));
    // an edge lit from above, and a light running along
    vec2 g = vec2(dFdx(d), -dFdy(d)); g /= max(length(g), 1e-5);
    float rim = (1. - clamp(-d / 1.8, 0., 1.)) * max(0., dot(-g, normalize(vec2(-.35, 1.))));
    sc += vec3(1., .93, .8) * rim * .35;
    float sx = (p.x - .38 * p.y - uSheen) / 7.;               // (pow of a negative is undefined in GLSL: NaN here)
    sc += vec3(1., .9, .75) * 1.6 * exp(-sx * sx);
    // where it burns away, the edge glows
    float edge = (uBurn < 1e3) ? exp(-abs(b) / 3.) * step(-14., -b) : 0.;
    sc += vec3(1., .45, .12) * edge * 7.;
    col = mix(col, sc, cov);
    float gd = max(d, 0.);
    col += glow;
    col += vec3(1., .45, .12) * edge * exp(-gd / 4.) * 2.;
    // the full stop
    if (uDot.x > 0.) {
      float hs = 6.5 * uDot.y;
      float dd = boxSD(p, vec2(84.5 - hs, 75.5 - hs), vec2(84.5 + hs, 75.5 + hs));
      float dc = smoothstep(w, -w, dd);
      vec3 amber = vec3(1.1, .54, .12) * (1. + .35 * uDot.w);
      vec3 dcol = mix(amber, vec3(1., .88, .7) * 3.2, uDot.z);
      col = mix(col, dcol, dc * uDot.x);
      col += (vec3(.9, .42, .1) * (.5 + .5 * uDot.w) + vec3(1., .75, .45) * uDot.z * 1.6) * exp(-max(dd, 0.) / (4. + 7. * uDot.z)) * uDot.x;
    }
  }
  o = vec4(col, 1.);
}`

// the type: one quad per glyph, its distance field sampled, blurred by depth, glowing, burning away
const TEXT_VS = `#version 300 es
precision highp float;
${CAM}
layout(location=0) in vec4 i0;   // pen x, y, z, units per atlas px
layout(location=1) in vec4 i1;   // cell x, y, w, h (atlas px)
layout(location=2) in vec4 i2;   // pen origin in the cell x, y; alpha; extra blur (px)
layout(location=3) in vec4 i3;   // colour, glow
layout(location=4) in vec4 i4;   // burn, heat, seed
uniform vec2 uAtlas;
out vec2 vUv, vCell; out vec4 vCol; out float vA, vBlur, vBurn, vHeat, vSeed;
void main(){
  vec2 c = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1);
  vec2 off = c * i1.zw - i2.xy;
  float zc; vec2 s = project(vec3(i0.xy + off * i0.w, i0.z), zc);
  vUv = (i1.xy + c * i1.zw) / uAtlas; vCell = c * i1.zw;
  vCol = i3; vA = i2.z; vBlur = i2.w + cocPx(zc) * .5; vBurn = i4.x; vHeat = i4.y; vSeed = i4.z;
  gl_Position = vec4(s.x / uRes.x * 2. - 1., 1. - s.y / uRes.y * 2., 0, 1);
  if (vA <= .001) gl_Position = vec4(2, 2, 2, 1);
}`
const TEXT_FS = `#version 300 es
precision highp float;
${NOISE}
uniform sampler2D uTex; uniform float uSpread;
in vec2 vUv, vCell; in vec4 vCol; in float vA, vBlur, vBurn, vHeat, vSeed; out vec4 o;
void main(){
  float d = (texture(uTex, vUv).r - .5) * 2. * uSpread;       // atlas px, + inside
  float fw = max(fwidth(d), 1e-4);
  float bl = min(vBlur * fw, uSpread * .6);
  float e = fw * .7 + bl;
  float a = smoothstep(-e, e, d) / (1. + bl / 5.);
  // burning away (vBurn 0 to 1; below 0 not burning): noise under a rising threshold, a hot rim where it eats
  float rim = 0.;
  if (vBurn >= 0.) {
    float n = fbm(vCell * .05 + vSeed * 9.), th = vBurn * 1.35 - .2;
    rim = smoothstep(.07, 0., abs(n - th)) * smoothstep(-3., 1., d);
    a *= smoothstep(th, th + .05, n);
  }
  vec3 col = mix(vCol.rgb, vec3(1., .88, .7) * 7., vHeat);
  float burnt = vBurn >= 0. ? 1. - smoothstep(.3, .95, vBurn) : 1.;
  float g = (exp(-max(-d, 0.) / (uSpread * .3)) - exp(-1. / .3)) * smoothstep(-uSpread, -uSpread * .55, d) * (vCol.a + vHeat * 1.5) * burnt;
  o = vec4((col * a + col * max(g, 0.) * .5 + vec3(1., .45, .12) * 4. * rim) * vA, a * vA);
}`

// the motes: a capsule each, from a shutter ago to now; small and sharp in focus, opening into discs out of it
const PART_VS = `#version 300 es
precision highp float;
${CAM}
layout(location=0) in vec4 a0;   // kind, seed, seed, brightness
layout(location=1) in vec4 a1;   // from, at
layout(location=2) in vec4 a2;   // to, at  (embers: velocity, life)
layout(location=3) in vec4 a3;   // the curve's control point, or the swirl; size
uniform float uT, uDt, uDust, uDpr;
out vec2 vA, vB; out float vR, vDisc; out vec3 vC;
vec3 posAt(float t, out float vis, out float heat){
  int k = int(a0.x + .5);
  if (k == 0) {                                                  // dust, drifting
    vis = uDust; heat = 0.;
    return a1.xyz + vec3(sin(t * .23 + a0.y * 6.28) * 26., cos(t * .19 + a0.z * 6.28) * 20., sin(t * .11 + a0.y * 3.1) * 30.);
  }
  if (k == 1) {                                                  // spiralling in to a point, faster as it nears
    float u = clamp((t - a1.w) / (a2.w - a1.w), 0., 1.);
    vis = smoothstep(a1.w, a1.w + .15, t) * step(t, a2.w);
    float e = pow(u, 2.4);
    vec3 r = a1.xyz - a2.xyz;
    float ang = a3.x * (1. - pow(1. - u, 2.5));
    float c = cos(ang), s = sin(ang);
    r.xy = mat2(c, s, -s, c) * r.xy;
    heat = u * u;
    return a2.xyz + r * (1. - e);
  }
  if (k == 2) {                                                  // thrown out along a curve to its place, and fused there
    float u = clamp((t - a1.w) / (a2.w - a1.w), 0., 1.);
    float e = 1. - pow(1. - u, 2.2);
    vis = smoothstep(a1.w, a1.w + .06, t) * (1. - smoothstep(a2.w, a2.w + .06, t));
    heat = 1.;
    return mix(mix(a1.xyz, a3.xyz, e), mix(a3.xyz, a2.xyz, e), e);
  }
  float tau = t - a1.w;                                          // an ember: thrown, slowed by the air, falling a little
  vis = step(0., tau) * step(tau, a2.w) * (1. - smoothstep(a2.w * .6, a2.w, tau));
  heat = 1. - tau / a2.w;
  return a1.xyz + a2.xyz * (1. - exp(-2.4 * tau)) / 2.4 + vec3(0., 30., 0.) * tau * tau;
}
void main(){
  float v1, h1, v0, h0;
  vec3 p1 = posAt(uT, v1, h1), p0 = posAt(uT - uDt, v0, h0);
  float z1, z0; vec2 s1 = project(p1, z1), s0 = project(p0, z0);
  int k = int(a0.x + .5);
  float bright = a0.w * v1;
  bright *= smoothstep(uFocus * .16, uFocus * .42, z1);
  if (bright < .002 || z1 < 8. || z0 < 8.) { gl_Position = vec4(2, 2, 2, 1); return; }
  float core = max(a3.w * uF / z1, .7 * uDpr);                  // its own size, in px
  float coc = cocPx(z1);
  float r = min(max(core, coc * .5), uRes.y * .07);
  // colour: dust cream and amber; the hot ones white going amber going red as they cool
  vec3 c;
  if (k == 0) c = mix(vec3(.9, .78, .6), vec3(.95, .55, .2), a0.y) * (a0.z > .95 ? vec3(.8, .9, 1.15) : vec3(1.));
  else c = mix(mix(vec3(.9, .2, .03), vec3(1., .55, .15), smoothstep(0., .45, h1)), vec3(1., .9, .75), smoothstep(.55, 1., h1));
  float len = length(s1 - s0);
  // a mote keeps its light: smeared or opened up, it dims to match
  c *= bright * (core * core) / (r * r) * (2. * r) / (2. * r + len);
  vC = c; vR = r; vDisc = smoothstep(2.5 * uDpr, 7. * uDpr, coc * .5 - core);
  vec2 ax = len > 1e-3 ? (s1 - s0) / len : vec2(1, 0), nx = vec2(-ax.y, ax.x);
  vec2 cc = vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1);
  float pad = r * 1.6 + 1.5;
  vec2 q = mix(s0 - ax * pad, s1 + ax * pad, cc.x) + nx * (cc.y * 2. - 1.) * pad;
  vA = s0; vB = s1;
  gl_Position = vec4(q.x / uRes.x * 2. - 1., 1. - q.y / uRes.y * 2., 0, 1);
}`
const PART_FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
in vec2 vA, vB; in float vR, vDisc; in vec3 vC; out vec4 o;
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 ba = vB - vA; float h = clamp(dot(p - vA, ba) / max(dot(ba, ba), 1e-4), 0., 1.);
  float q = length(p - vA - ba * h) / vR;
  float glow = exp(-q * q * 2.2);
  float disc = smoothstep(1., .86, q) * (.75 + .35 * smoothstep(.5, .95, q));
  o = vec4(vC * mix(glow, disc * .6, vDisc), 0.);
}`

// bloom: a bright pass and 13-tap down, a tent back up
const DOWN_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThresh, uFirst;
in vec2 vUv; out vec4 o;
vec3 s(vec2 d){ return texture(uTex, vUv + d * uTexel).rgb; }
void main(){
  vec3 a = s(vec2(-2,-2)), b = s(vec2(0,-2)), c = s(vec2(2,-2)), d = s(vec2(-1,-1)), e = s(vec2(1,-1)), f = s(vec2(-2,0)), g = s(vec2(0)), h = s(vec2(2,0)), i = s(vec2(-1,1)), j = s(vec2(1,1)), k = s(vec2(-2,2)), l = s(vec2(0,2)), m = s(vec2(2,2));
  vec3 col = (d + e + i + j) * .125 + (a + b + f + g) * .03125 + (b + c + g + h) * .03125 + (f + g + k + l) * .03125 + (g + h + l + m) * .03125;
  if (uFirst > .5) { col = min(col, vec3(10.)); float br = max(col.r, max(col.g, col.b)); float soft = clamp(br - uThresh + .5, 0., 1.); soft = soft * soft * .5; col *= max(soft, br - uThresh) / max(br, 1e-4); }
  o = vec4(col, 1.);
}`
const UP_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uRadius, uGain;
in vec2 vUv; out vec4 o;
void main(){
  vec2 d = uTexel * uRadius;
  vec3 c = texture(uTex, vUv).rgb * 4.;
  c += (texture(uTex, vUv + vec2(-d.x, 0)).rgb + texture(uTex, vUv + vec2(d.x, 0)).rgb + texture(uTex, vUv + vec2(0, -d.y)).rgb + texture(uTex, vUv + vec2(0, d.y)).rgb) * 2.;
  c += texture(uTex, vUv + vec2(-d.x, -d.y)).rgb + texture(uTex, vUv + vec2(d.x, -d.y)).rgb + texture(uTex, vUv + vec2(-d.x, d.y)).rgb + texture(uTex, vUv + vec2(d.x, d.y)).rgb;
  o = vec4(c / 16. * uGain, 1.);
}`
// light shafts from a point, and a long horizontal streak
const RAYS_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uLight;
in vec2 vUv; out vec4 o;
void main(){
  vec2 d = (uLight - vUv) / 48.; float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec2 uv = vUv + d * j; float w = 1.; vec3 c = vec3(0);                          // jittered, so the shafts do not band
  for (int i = 0; i < 48; i++) { c += texture(uTex, uv).rgb * w; w *= .955; uv += d; }
  o = vec4(c / 18., 1.);
}`
const STREAK_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uTexel;
in vec2 vUv; out vec4 o;
void main(){
  vec3 c = vec3(0); float ws = 0.;
  for (int i = -60; i <= 60; i++) { float w = exp(-abs(float(i)) / 20.); c += texture(uTex, vUv + vec2(float(i) * 1.5 * uTexel.x, 0)).rgb * w; ws += w; }
  o = vec4(c / ws * vec3(1., .72, .42), 1.);
}`
const FINAL_FS = `#version 300 es
precision highp float;
uniform sampler2D uScene, uBloom, uRays, uStreak;
uniform vec2 uRes; uniform vec4 uShock[3]; uniform float uShockW;
uniform float uCA, uExposure, uBloomAmt, uRaysAmt, uStreakAmt, uFade, uTime;
uniform vec2 uMB; uniform float uDbgNan;
in vec2 vUv; out vec4 o;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
float acesL(float x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
vec3 tone(vec3 c){ float L = max(max(c.r, c.g), max(c.b, 1e-5)); return mix(c * acesL(L) / L, aces(c), smoothstep(1.2, 5., L)); }
vec3 tap(vec2 uv, vec2 dir, float ca){ return vec3(texture(uScene, uv + dir * ca).r, texture(uScene, uv).g, texture(uScene, uv - dir * ca).b); }
void main(){
  vec2 uv = vUv;
  vec2 off = vec2(0); float ring = 0.;
  for (int i = 0; i < 3; i++) {
    vec4 s = uShock[i]; if (s.w <= 0.) continue;
    vec2 dp = (uv - s.xy) * uRes; float r = length(dp); float x = (r - s.z) / uShockW;
    off += dp / max(r, 1.) * x * exp(-x * x) * s.w / uRes; ring += exp(-x * x) * min(1., s.w / 40.);
  }
  uv -= off;
  vec2 dir = uv - .5;
  float ca = uCA * (dot(dir, dir) * 2.5 + .2) + ring * .003;
  vec3 col;
  if (length(uMB * uRes) > 3.) { col = vec3(0); for (int i = 0; i < 10; i++) col += tap(uv + uMB * (float(i) / 9. - .5), dir, ca); col /= 10.; }
  else col = tap(uv, dir, ca);
  col += texture(uBloom, uv).rgb * uBloomAmt;
  col += texture(uRays, uv).rgb * uRaysAmt;
  col += texture(uStreak, uv).rgb * uStreakAmt;
  col += vec3(1., .78, .5) * ring * .05;
  col *= uExposure;
  col = tone(col);
  float v = smoothstep(1.25, .35, length((vUv - .5) * vec2(uRes.x / uRes.y, 1.) * 1.05));
  col *= mix(.55, 1., v) * uFade;
  col = pow(col, vec3(1. / 2.2));
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453) - .5) / 255.;
  o = vec4(col, 1.);
  if (uDbgNan > .5) { vec3 a = texture(uScene, vUv).rgb, b = texture(uBloom, vUv).rgb;
    if (any(isnan(a)) || any(isinf(a))) o = vec4(1, 0, 1, 1); else if (any(isnan(b)) || any(isinf(b))) o = vec4(0, 1, 1, 1); }
}`

/* ---------- the renderer ---------- */
export function renderer(canvas, { atlas, particles }) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false })
  if (!gl) throw new Error('no WebGL2')
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no float render targets')
  const W = canvas.width, H = canvas.height
  const P = {
    scene: program(gl, FULL_VS, SCENE_FS), text: program(gl, TEXT_VS, TEXT_FS), part: program(gl, PART_VS, PART_FS),
    down: program(gl, FULL_VS, DOWN_FS), up: program(gl, FULL_VS, UP_FS), rays: program(gl, FULL_VS, RAYS_FS),
    streak: program(gl, FULL_VS, STREAK_FS), final: program(gl, FULL_VS, FINAL_FS),
  }
  const scene = target(gl, W, H)
  const mips = []; for (let i = 1, w = W, h = H; i <= 6; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); mips.push(target(gl, w, h)) }
  const raysT = target(gl, mips[1].w, mips[1].h), streakT = target(gl, mips[2].w, mips[2].h)
  const empty = new VertexArrayObjectStub(gl)

  // the atlas
  const atex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, atex)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, atlas.w, atlas.h, 0, gl.RED, gl.UNSIGNED_BYTE, atlas.data)
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v)

  // the motes: four attributes each, fixed; the glyphs: five, rewritten each frame
  const pvao = gl.createVertexArray(); gl.bindVertexArray(pvao)
  const pbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pbuf); gl.bufferData(gl.ARRAY_BUFFER, particles, gl.STATIC_DRAW)
  for (let i = 0; i < 4; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 64, i * 16); gl.vertexAttribDivisor(i, 1) }
  const nPart = particles.length / 16
  const tvao = gl.createVertexArray(); gl.bindVertexArray(tvao)
  const tbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tbuf); gl.bufferData(gl.ARRAY_BUFFER, 4 * 20 * 256, gl.DYNAMIC_DRAW)
  for (let i = 0; i < 5; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 80, i * 16); gl.vertexAttribDivisor(i, 1) }
  gl.bindVertexArray(null)

  function cam(pr, c) {
    gl.uniform2f(pr.u.uRes, W, H); gl.uniform2f(pr.u.uCenter, c.cx, c.cy); gl.uniform1f(pr.u.uF, c.f)
    gl.uniform3f(pr.u.uCam, ...c.pos); gl.uniformMatrix3fv(pr.u.uRot, false, c.rot)
    gl.uniform1f(pr.u.uAperture, c.aperture); gl.uniform1f(pr.u.uFocus, c.focus)
  }
  function full(pr, dst) { gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null); gl.viewport(0, 0, dst ? dst.w : W, dst ? dst.h : H); gl.bindVertexArray(empty.vao); gl.drawArrays(gl.TRIANGLES, 0, 3) }
  function tex(unit, t, pr, name) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(pr.u[name], unit) }

  const DBG = new URLSearchParams(location.search).get('dbg') || ''   // dbg=nobloom,noparts,notext,nopost: leave a pass out
  return function draw(f) {
    const c = f.cam
    gl.disable(gl.BLEND)
    // the ground and the mark
    let pr = P.scene; gl.useProgram(pr.p); cam(pr, c)
    const u = pr.u
    gl.uniform1f(u.uTime, f.t)
    gl.uniform1f(u.uFrontN, f.frontN); gl.uniform1f(u.uHeatN, f.heatN)
    gl.uniform4f(u.uFrontAbl, ...f.frontAbl.slice(0, 4)); gl.uniform1f(u.uFrontL, f.frontAbl[4])
    gl.uniform4f(u.uSpeedAbl, ...f.speedAbl.slice(0, 4)); gl.uniform1f(u.uSpeedL, f.speedAbl[4])
    gl.uniform4f(u.uDot, ...f.dot); gl.uniform1f(u.uSheen, f.sheen); gl.uniform1f(u.uBurn, f.burn)
    gl.uniform3f(u.uCoreW, ...f.core); gl.uniform1f(u.uCore, f.coreI); gl.uniform3f(u.uHaze, ...f.haze); gl.uniform4f(u.uLine, ...f.line)
    full(pr, scene)
    // the type
    gl.enable(gl.BLEND)
    if (f.glyphs.length && !DBG.includes('notext')) {
      pr = P.text; gl.useProgram(pr.p); cam(pr, c)
      gl.uniform2f(pr.u.uAtlas, atlas.w, atlas.h); gl.uniform1f(pr.u.uSpread, f.spread); tex(0, atex, pr, 'uTex')
      gl.bindVertexArray(tvao); gl.bindBuffer(gl.ARRAY_BUFFER, tbuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, f.glyphs)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb); gl.viewport(0, 0, W, H)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, f.glyphs.length / 20)
    }
    // the motes, adding light
    pr = P.part; gl.useProgram(pr.p); cam(pr, c)
    gl.uniform1f(pr.u.uT, f.t); gl.uniform1f(pr.u.uDt, f.shutter); gl.uniform1f(pr.u.uDust, f.dust); gl.uniform1f(pr.u.uDpr, c.dpr)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.bindVertexArray(pvao); gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb); gl.viewport(0, 0, W, H)
    if (!DBG.includes('noparts')) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nPart)
    gl.disable(gl.BLEND)
    // bloom: down the chain from the bright pass, then back up, adding
    pr = P.down; gl.useProgram(pr.p)
    let src = scene
    mips.forEach((m, i) => { tex(0, src.t, pr, 'uTex'); gl.uniform2f(pr.u.uTexel, 1 / src.w, 1 / src.h); gl.uniform1f(pr.u.uThresh, f.threshold); gl.uniform1f(pr.u.uFirst, i === 0 ? 1 : 0); full(pr, m); src = m })
    // the shafts and the streak, from the bright pass before it is added back up
    if (f.rays > 0) { pr = P.rays; gl.useProgram(pr.p); tex(0, mips[1].t, pr, 'uTex'); gl.uniform2f(pr.u.uLight, f.rayAt[0], f.rayAt[1]); full(pr, raysT) }
    if (f.streak > 0) { pr = P.streak; gl.useProgram(pr.p); tex(0, mips[2].t, pr, 'uTex'); gl.uniform2f(pr.u.uTexel, 1 / mips[2].w, 1 / mips[2].h); full(pr, streakT) }
    pr = P.up; gl.useProgram(pr.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE)
    for (let i = mips.length - 2; i >= 0; i--) { tex(0, mips[i + 1].t, pr, 'uTex'); gl.uniform2f(pr.u.uTexel, 1 / mips[i + 1].w, 1 / mips[i + 1].h); gl.uniform1f(pr.u.uRadius, 1.); gl.uniform1f(pr.u.uGain, i >= 3 ? .35 : .55); full(pr, mips[i]) }
    gl.disable(gl.BLEND)
    // the frame
    pr = P.final; gl.useProgram(pr.p)
    tex(0, scene.t, pr, 'uScene'); tex(1, mips[0].t, pr, 'uBloom'); tex(2, raysT.t, pr, 'uRays'); tex(3, streakT.t, pr, 'uStreak')
    gl.uniform2f(pr.u.uRes, W, H)
    const sh = new Float32Array(12); if (!DBG.includes('noshock')) f.shocks.slice(0, 3).forEach((s, i) => sh.set(s, i * 4)); gl.uniform4fv(pr.u.uShock, sh)
    gl.uniform1f(pr.u.uShockW, f.shockW); gl.uniform1f(pr.u.uCA, f.ca); gl.uniform1f(pr.u.uExposure, f.exposure)
    gl.uniform1f(pr.u.uBloomAmt, DBG.includes('nobloom') ? 0 : f.bloom); gl.uniform1f(pr.u.uRaysAmt, DBG.includes('norays') ? 0 : f.rays); gl.uniform1f(pr.u.uStreakAmt, DBG.includes('nostreak') ? 0 : f.streak)
    gl.uniform1f(pr.u.uFade, f.fade); gl.uniform1f(pr.u.uDbgNan, DBG.includes('nan') ? 1 : 0); gl.uniform1f(pr.u.uTime, f.t); gl.uniform2f(pr.u.uMB, ...f.mb)
    full(pr, null)
  }
}
/* drawing a full-screen triangle needs no attributes, only a bound vertex array */
function VertexArrayObjectStub(gl) { this.vao = gl.createVertexArray() }
