/* darkroom.js — the work, hanging to dry in a darkroom.
   A cord runs across the room on two pulleys; scrolling pulls it, and the prints clipped to it travel with it,
   swinging back when the cord starts or stops, turning a little in the air, settling again. The cord curves
   away from you at the sides, so the prints there turn and recede into the dark.
   The room is lit by a dim red safelight, under which every print is only a grey shape. In the middle hangs a
   white inspection lamp: a print that reaches it develops, from blank paper (the shadows first, then the
   greys) to black and white, and then its colour arrives. Prints you have seen keep their black and white.
   Everything is drawn here: the plaster wall with the shadows of the prints on it, the cord, the wooden pegs,
   the paper (bent by its own weight, curling at the corners, wet and glossy), and then the same film finish
   as the landing: filmic tone, bloom, a soft focus at the edges, grain. WebGL2, no dependencies. */
(() => {
  // ---------- tiny matrix kit (column-major, like GL) ----------
  const M = {
    persp(f, a, n, z) { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (z + n) / (n - z), -1, 0, 0, (2 * z * n) / (n - z), 0]; },
    look(e, c, u) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
    },
    mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    T(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; },
    S(x, y, z) { return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]; },
    X(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
    Y(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
    Z(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
    inv(m) {
      const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
      const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
      return [(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
        (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
        (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
        (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d];
    },
    xf(m, p) { const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w, (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w]; },
  };

  // ---------- the room ----------
  const ROOM = {
    fov: 30 * Math.PI / 180, camZ: 3.73, wallZ: -1.15,
    lineY: 0.62, sag: 0.075, depth: 0.12,          // the cord: height at the centre, how it rises and recedes towards the sides
    drop: 0.055,                                    // the peg holds the paper this far under the cord
    lamp: [0, 1.85, 1.35], lampAt: [0, -0.12, 0], lampR: 0.09, cone: [0.8, 0.94],
    safe: [-3.2, 1.9, 0.6], safeR: 0.5,
  };

  const LIGHT = `
uniform vec3 uEye, uLamp, uLampDir, uLampCol, uSafe, uSafeCol, uAmb; uniform vec2 uCone;
float spot(vec3 P) { vec3 L = normalize(uLamp - P); return smoothstep(uCone.x, uCone.y, dot(-L, uLampDir)); }
vec3 shade(vec3 P, vec3 N, vec3 alb, float rough, float spec, float shL, float shS) {
  vec3 V = normalize(uEye - P);
  if (dot(N, V) < 0.) N = -N;
  vec3 col = alb * uAmb;
  vec3 Lv = uLamp - P; float d = length(Lv); vec3 L = Lv / d, H = normalize(L + V);
  float fr = .04 + .96 * pow(1. - max(dot(N, V), 0.), 5.);
  float att = spot(P) / (1. + .08 * d * d) * shL;
  float sp = pow(max(dot(N, H), 0.), mix(900., 24., rough)) * mix(12., 1.4, rough);
  col += uLampCol * att * (alb * max(dot(N, L), 0.) + spec * sp * (.25 + fr));
  vec3 Sv = uSafe - P; float ds = length(Sv); vec3 S = Sv / ds, Hs = normalize(S + V);
  float as = shS / (1. + .04 * ds * ds);
  col += uSafeCol * as * (alb * (.25 + .75 * max(dot(N, S), 0.)) + spec * pow(max(dot(N, Hs), 0.), 40.) * .35);
  return col;
}`;

  // the paper: a grid, bent by its weight, curling at the edges, waving a little when it moves
  const PRINT_VS = `#version 300 es
in vec2 aUv;
uniform mat4 uVP, uM; uniform vec2 uSize; uniform vec4 uBend; // curl, corner curl, wave amplitude, wave phase
out vec3 vP; out vec3 vN; out vec2 vUv;
vec3 bend(vec2 uv) {
  float x = (uv.x - .5) * uSize.x, y = -uv.y * uSize.y, ex = (uv.x - .5) * 2., fy = uv.y;
  float z = uBend.x * ex * ex * .045;                                    // bowed along its width as it dries
  z += uBend.y * smoothstep(.55, 1., fy) * ex * ex * .07;                // the lower corners lift
  z += uBend.z * sin(fy * 5.5 - uBend.w) * fy * .035;                    // a soft wave when it moves through the air
  y -= .018 * ex * ex * (1. - smoothstep(0., .35, fy));                  // one peg: the top corners droop
  return vec3(x, y, z);
}
void main() {
  vec3 p = bend(aUv), px = bend(aUv + vec2(.01, 0.)), py = bend(aUv + vec2(0., .01));
  vec3 n = normalize(cross(px - p, p - py));
  vec4 w = uM * vec4(p, 1.);
  vP = w.xyz; vN = normalize(mat3(uM) * n); vUv = aUv;
  gl_Position = uVP * w;
}`;
  const PRINT_FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform float uDev, uHas, uSeed, uT, uLift; uniform vec2 uBorder;
${LIGHT}
float h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.), f.x), f.y); }
void main() {
  vec3 paper = vec3(.93, .92, .885);
  vec2 iuv = (vUv - uBorder) / (1. - 2. * uBorder);
  float inImg = step(0., iuv.x) * step(iuv.x, 1.) * step(0., iuv.y) * step(iuv.y, 1.);
  vec3 alb = paper; float rough = .55, spec = .35;
  if (!gl_FrontFacing) { alb = vec3(.8, .79, .76); }
  else if (inImg > .5 && uHas > .5) {
    vec3 c = texture(uTex, vec2(iuv.x, 1. - iuv.y)).rgb;
    c = pow(c, vec3(2.2));
    float lum = dot(c, vec3(.2126, .7152, .0722));
    float D = 1. - pow(lum, 1. / 2.2);                        // how dark the print wants to be here
    // the developer: the shadows come first, then the greys; it spreads a little unevenly over the sheet
    float k = uDev / .62 + (n2(iuv * 3.1 + uSeed) - .5) * .22;
    float e = smoothstep(0., 1., k * 1.6 - (1. - D) * .9);
    float bw = 1. - D * e;
    vec3 grey = paper * pow(bw, 2.2);
    vec3 colr = c * paper * 1.04;
    alb = mix(grey, colr, smoothstep(.62, 1., uDev));
    rough = .16; spec = 1.;                                      // the image is glossy, still wet
  }
  vec3 col = shade(vP, normalize(vN), alb, rough, spec, 1., 1.);
  // a very fine tooth in the paper
  col *= .97 + .03 * n2(vUv * vec2(260., 330.));
  o = vec4(col, 1.);
}`;

  // the wooden pegs and the cord: plain lit shapes
  const SOLID_VS = `#version 300 es
in vec3 aP; in vec3 aN;
uniform mat4 uVP, uM;
out vec3 vP; out vec3 vN; out vec3 vL;
void main() { vec4 w = uM * vec4(aP, 1.); vP = w.xyz; vN = normalize(mat3(uM) * aN); vL = aP; gl_Position = uVP * w; }`;
  const SOLID_FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec3 vL; out vec4 o;
uniform float uKind;
${LIGHT}
float h(float x) { return fract(sin(x * 127.1) * 43758.5); }
void main() {
  vec3 alb; float rough = .6, spec = .2;
  if (uKind < .5) {
    // wood, with its grain running along the peg, and the steel spring across the middle
    float g = sin(vL.y * 90. + sin(vL.x * 30.) * 2.) * .5 + .5;
    alb = mix(vec3(.42, .3, .19), vec3(.58, .44, .3), g * .6 + .2);
    float spring = smoothstep(.09, .06, abs(vL.y - .08));
    alb = mix(alb, vec3(.5, .5, .52), spring); rough = mix(.6, .25, spring); spec = mix(.2, 1., spring);
    float slit = smoothstep(.06, .0, abs(vL.x)) * step(vL.y, -.05);
    alb *= 1. - slit * .5;
  } else { alb = vec3(.62, .6, .56); rough = .45; spec = .5; }
  o = vec4(shade(vP, normalize(vN), alb, rough, spec, 1., 1.), 1.);
}`;

  // the wall, ray-traced per pixel, with the prints' and the cord's shadows from both lights
  const QUAD = `#version 300 es
in vec2 p; out vec2 vUv; void main() { vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
  const WALL_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform mat4 uIVP; uniform float uWallZ, uLampR, uSafeR, uLineY, uSag, uDepth, uDrop;
uniform mat4 uPI[8]; uniform vec2 uPS[8]; uniform int uPN;
${LIGHT}
float h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 7.1; a *= .5; } return s; }
float box(float x, float r, float w) { return smoothstep(-r - w, -r + w, x) * (1. - smoothstep(r - w, r + w, x)); }
// how much of a light at Lp (radius R) the prints and the cord hide from the wall point P
float occ(vec3 P, vec3 Lp, float R) {
  float lit = 1.;
  for (int k = 0; k < 8; k++) {
    if (k >= uPN) break;
    vec3 a = (uPI[k] * vec4(P, 1.)).xyz, b = (uPI[k] * vec4(Lp, 1.)).xyz;
    float t = -a.z / (b.z - a.z);
    if (t <= 0. || t >= 1.) continue;
    vec3 q = a + t * (b - a);
    float w = R * t / (1. - t) + .003;
    lit *= 1. - .92 * box(q.x, uPS[k].x, w) * box(q.y + uPS[k].y * .5, uPS[k].y * .5, w);
  }
  // the cord: where the ray to the light crosses the cord's own depth
  vec3 d = Lp - P; float t = (0. - P.z) / d.z;
  for (int i = 0; i < 2; i++) { vec3 q = P + t * d; float zc = -uDepth * q.x * q.x; t = (zc - P.z) / d.z; }
  if (t > 0. && t < 1.) { vec3 q = P + t * d; float yc = uLineY + uSag * q.x * q.x; float w = R * t / (1. - t) + .002; lit *= 1. - .7 * box(q.y - yc, .0035, w) / (1. + w * 60.); }
  return lit;
}
void main() {
  vec4 a = uIVP * vec4(vUv * 2. - 1., -1., 1.), b = uIVP * vec4(vUv * 2. - 1., 1., 1.);
  vec3 ro = a.xyz / a.w, rd = normalize(b.xyz / b.w - ro);
  vec3 P = ro + rd * ((uWallZ - ro.z) / rd.z);
  // old plaster: uneven, a few stains, a fine tooth
  float f = fbm(P.xy * 1.3), g = fbm(P.xy * 7. + 3.);
  vec3 alb = vec3(.085, .082, .079) * (.8 + .35 * f) * (.92 + .1 * g);
  alb *= 1. - .18 * smoothstep(.62, .8, fbm(P.xy * .6 + 11.));
  vec3 N = normalize(vec3((g - .5) * .06, (fbm(P.xy * 7. + 9.) - .5) * .06, 1.));
  float sl = occ(P, uLamp, uLampR), ss = occ(P, uSafe, uSafeR);
  o = vec4(shade(P, N, alb, .9, .05, sl, ss), 1.);
}`;
  // the finish: the same filmic grade, bloom, edge softness and grain as the landing
  const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene; uniform vec2 uRes; uniform float uT, uGrain, uBloom, uSoft, uVig, uFade;
float h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 filmic(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main() {
  vec2 uv = vUv, c = uv - .5;
  float edge = smoothstep(.18, .95, abs(c.x) * 2.) * uSoft;
  vec3 col;
  float ca = .0016 * (.4 + edge);
  col.r = textureLod(uScene, uv + c * ca, edge).r;
  col.g = textureLod(uScene, uv, edge).g;
  col.b = textureLod(uScene, uv - c * ca, edge).b;
  vec3 bl = max(textureLod(uScene, uv, 4.).rgb - .8, 0.) * .5 + max(textureLod(uScene, uv, 6.).rgb - .55, 0.) * .4;
  col += bl * uBloom;
  col = filmic(col * 1.05);
  col *= 1. - uVig * pow(length(c * vec2(1.05, 1.)), 2.4);
  col = pow(col, vec3(1. / 2.2));
  col += (h(gl_FragCoord.xy * .71 + fract(uT * 6.3) * 97.) - .5) * uGrain;
  o = vec4(col * uFade, 1.);
}`;

  class Darkroom {
    static get supported() { try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; } }
    constructor(canvas, items, opts = {}) {
      this.c = canvas; this.items = items; this.reduce = !!opts.reduce;
      const gl = (this.gl = canvas.getContext("webgl2", { antialias: true, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" }));
      if (!gl) return;
      this.ok = true;
      this.hf = !!gl.getExtension("EXT_color_buffer_float") && !!gl.getExtension("OES_texture_float_linear");
      this.pPrint = this.prog(PRINT_VS, PRINT_FS); this.pSolid = this.prog(SOLID_VS, SOLID_FS);
      this.pWall = this.prog(QUAD, WALL_FS); this.pPost = this.prog(QUAD, POST_FS);
      if (!this.pPrint || !this.pSolid || !this.pWall || !this.pPost) { this.ok = false; return; }
      this.geo();
      this.p = 0; this.pv = 0; this.off = 0; this.v = 0; this.a = 0; this.last = 0;
      this.mx = 0; this.my = 0; this.cmx = 0; this.cmy = 0; this.hover = -1; this.fade = 1;
      this.active = false; this.t0 = performance.now(); this.scale = 1; this.ema = 16;
      // each print: its place on the cord, its size, its texture and its own little physics
      let x = 0;
      const GAP = 0.3;
      this.P = items.map((it, i) => {
        const ar = it.ar || 0.8, hgt = ar >= 1 ? 0.86 : 1.0, wid = hgt * ar;
        if (i) x += GAP + wid / 2; const at = x; x += wid / 2;
        const p = { ...it, i, w: wid, h: hgt, at, dev: i === 0 ? 0 : 0, seen: 0, th: 0, thv: 0, ph: 0, phv: 0, ps: 0, psv: 0, lift: 0, seed: Math.random() * 50, tex: null, has: 0 };
        if (it.img) this.load(p);
        return p;
      });
      // the centre of each print along the cord, from the first edge
      this.span = x;
      this.size();
      this.ro = new ResizeObserver(() => this.size());
      this.ro.observe(canvas);
    }
    prog(vs, fs) {
      const gl = this.gl, mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn("[darkroom]", gl.getShaderInfoLog(x)); return null; } return x; };
      const a = mk(gl.VERTEX_SHADER, vs), b = mk(gl.FRAGMENT_SHADER, fs);
      if (!a || !b) return null;
      const p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b);
      gl.bindAttribLocation(p, 0, "aUv"); gl.bindAttribLocation(p, 0, "aP"); gl.bindAttribLocation(p, 0, "p"); gl.bindAttribLocation(p, 1, "aN");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn("[darkroom]", gl.getProgramInfoLog(p)); return null; }
      p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i), name = info.name.replace(/\[0\]$/, ""); p.u[name] = gl.getUniformLocation(p, info.name); }
      return p;
    }
    geo() {
      const gl = this.gl;
      // a fullscreen triangle strip
      this.vQuad = gl.createVertexArray(); gl.bindVertexArray(this.vQuad);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      // the paper grid
      const GX = 22, GY = 28, uv = [], idx = [];
      for (let j = 0; j <= GY; j++) for (let i = 0; i <= GX; i++) uv.push(i / GX, j / GY);
      for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { const a = j * (GX + 1) + i, b = a + 1, c = a + GX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      this.vGrid = gl.createVertexArray(); gl.bindVertexArray(this.vGrid);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      this.nGrid = idx.length;
      // a unit box with normals (the peg)
      const F = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], P = [], N = [];
      for (const n of F) {
        const u = n[0] ? [0, 1, 0] : [1, 0, 0], w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
        const q = (s, t) => [0.5 * (n[0] + s * u[0] + t * w[0]), 0.5 * (n[1] + s * u[1] + t * w[1]), 0.5 * (n[2] + s * u[2] + t * w[2])];
        for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { P.push(...q(s, t)); N.push(...n); }
      }
      this.vBox = gl.createVertexArray(); gl.bindVertexArray(this.vBox);
      const bp = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bp); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      const bn = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bn); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(N), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      // the cord, rebuilt every frame as a thin ribbon
      this.vLine = gl.createVertexArray(); gl.bindVertexArray(this.vLine);
      this.bLine = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.bLine); gl.bufferData(gl.ARRAY_BUFFER, 4 * 6 * 2 * 161, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      this.lineData = new Float32Array(6 * 2 * 161);
      gl.bindVertexArray(null);
    }
    load(p) {
      const im = new Image();
      im.crossOrigin = "anonymous"; im.decoding = "async";
      im.onload = () => {
        const gl = this.gl, t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const af = gl.getExtension("EXT_texture_filter_anisotropic"); if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, 4);
        p.tex = t; p.has = 1;
        if (!this.active) this.draw(performance.now());
        if (this.onLoad) this.onLoad(p.i);
      };
      im.src = p.img;
    }
    size() {
      const gl = this.gl, c = this.c, r = c.getBoundingClientRect();
      const cw = c.clientWidth || r.width, ch = c.clientHeight || r.height;
      if (!cw || !ch) return;
      const dpr = Math.min(window.devicePixelRatio || 1, cw < 700 ? 1.5 : 1.6) * this.scale;
      const W = Math.max(2, Math.round(cw * dpr)), H = Math.max(2, Math.round(ch * dpr));
      this.cw = cw; this.ch = ch; this.aspect = cw / ch;
      if (W === this.W && H === this.H) return;
      this.W = c.width = W; this.H = c.height = H;
      // the scene is drawn into a texture with mipmaps: the finish reads it blurred at the edges and for the bloom
      if (this.fbo) { gl.deleteFramebuffer(this.fbo); gl.deleteTexture(this.ftex); gl.deleteRenderbuffer(this.fdep); }
      this.ftex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.ftex);
      const levels = Math.floor(Math.log2(Math.max(W, H))) + 1;
      gl.texStorage2D(gl.TEXTURE_2D, levels, this.hf ? gl.RGBA16F : gl.RGBA8, W, H);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.fdep = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.fdep); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
      this.fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.ftex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.fdep);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.dirty = true;
      if (!this.active) this.draw(performance.now());
    }

    // ---------- the room's geometry ----------
    // print sizes in world units grow on narrow screens, so a phone still sees one print large
    get k() { return this.aspect < 0.9 ? Math.min(1.05, 0.5 + this.aspect * 0.62) : 1; }
    cordY(x) { return ROOM.lineY * (this.aspect < 0.9 ? 0.9 : 1) + ROOM.sag * x * x; }
    cordZ(x) { return -ROOM.depth * x * x; }
    // the cord's offset that puts print i (fractional) in the middle
    offsetFor(p) {
      const P = this.P, i = Math.max(0, Math.min(P.length - 1, Math.floor(p))), j = Math.min(P.length - 1, i + 1), f = Math.max(0, Math.min(1, p - i));
      return (P[i].at + (P[j].at - P[i].at) * f) * this.k;
    }
    // ---------- input ----------
    setProgress(p) { this.p = p; }
    pointer(x, y) { this.mx = x; this.my = y; } // -1..1, y up
    // which print is under the screen point (client px relative to the canvas); -1 for none
    hit(px, py) {
      if (!this.VP) return -1;
      const ndc = [(px / this.cw) * 2 - 1, 1 - (py / this.ch) * 2], IV = M.inv(this.VP);
      const a = M.xf(IV, [ndc[0], ndc[1], -1]), b = M.xf(IV, [ndc[0], ndc[1], 1]);
      let best = -1, bz = -Infinity;
      for (const p of this.P) {
        if (!p.M) continue;
        const I = M.inv(p.M), la = M.xf(I, a), lb = M.xf(I, b), t = -la[2] / (lb[2] - la[2]);
        if (t < 0 || t > 1) continue;
        const qx = la[0] + t * (lb[0] - la[0]), qy = la[1] + t * (lb[1] - la[1]);
        if (Math.abs(qx) <= p.w * p.k / 2 && qy <= 0 && qy >= -p.h * p.k) { const z = M.xf(p.M, [0, 0, 0])[2]; if (z > bz) { bz = z; best = p.i; } }
      }
      return best;
    }
    // where print i is on screen, in client px: for the case study to open from it
    rectOf(i) {
      const p = this.P[i];
      if (!p || !p.M || !this.VP) return null;
      const w = (p.w * p.k) / 2, h = p.h * p.k, pts = [[-w, 0, 0], [w, 0, 0], [-w, -h, 0], [w, -h, 0]].map((q) => M.xf(this.VP, M.xf(p.M, q)));
      const xs = pts.map((q) => (q[0] * 0.5 + 0.5) * this.cw), ys = pts.map((q) => (0.5 - q[1] * 0.5) * this.ch);
      return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
    }

    // ---------- time ----------
    tick(now) {
      if (!this.ok || !this.active) return;
      if (now - this.last < 12) return; // never more than 60 frames a second, also on 120 Hz screens
      this.step(now);
      this.draw(now);
    }
    still(dev) {
      // one frame, for the page seen from afar: the first print already developed, everything at rest
      if (!this.ok) return;
      if (dev && this.P[0]) this.P[0].dev = 1;
      this.draw(performance.now());
    }
    step(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - (this.last || now - 16)) / 1000));
      const fdt = now - (this.last || now - 16);
      this.ema += (fdt - this.ema) * 0.05;
      this.last = now;
      const R = this.reduce;
      // the cord follows the scroll with a little weight, so it never jumps
      this.pv += (this.p - this.pv) * (R ? 1 : 1 - Math.exp(-dt * 9));
      const off = this.offsetFor(this.pv), v = (off - this.off) / dt;
      this.a += ((v - this.v) / dt - this.a) * (1 - Math.exp(-dt * 18));
      this.v = v; this.off = off;
      // the pointer moves the eye a little, slowly
      this.cmx += (this.mx - this.cmx) * (1 - Math.exp(-dt * 2.5)); this.cmy += (this.my - this.cmy) * (1 - Math.exp(-dt * 2.5));
      this.fade += (1 - this.fade) * (1 - Math.exp(-dt * 2.2));
      const t = (now - this.t0) / 1000, A = Math.max(-14, Math.min(14, this.a)), V = Math.max(-6, Math.min(6, this.v));
      for (const p of this.P) {
        if (R) { p.th = p.ph = 0; p.ps = this.hover === p.i ? 0.05 : 0; }
        else {
          // swing in the plane of the wall: a pendulum pushed by the cord's acceleration
          const w1 = 4.3 / Math.sqrt(p.h), z1 = 0.09;
          p.thv += (-w1 * w1 * p.th - 2 * z1 * w1 * p.thv + A * 0.75) * dt; p.th += p.thv * dt;
          p.th = Math.max(-0.4, Math.min(0.4, p.th));
          // towards and away from you: the air of the room
          const w2 = 3.4, z2 = 0.16, breeze = Math.sin(t * 0.7 + p.seed) * 0.6 + Math.sin(t * 1.9 + p.seed * 2.3) * 0.4;
          p.phv += (-w2 * w2 * p.ph - 2 * z2 * w2 * p.phv + breeze * 0.25 + Math.abs(A) * 0.12) * dt; p.ph += p.phv * dt;
          // turning on the peg: moving through the air turns the sheet; hovering turns it to you
          const w3 = 2.6, z3 = 0.2, want = this.hover === p.i ? (this.cmx - this.screenX(p)) * 0.35 : 0;
          p.psv += (-w3 * w3 * (p.ps - want) - 2 * z3 * w3 * p.psv - V * 0.9) * dt; p.ps += p.psv * dt;
          p.ps = Math.max(-1.1, Math.min(1.1, p.ps));
        }
        p.lift += ((this.hover === p.i ? 1 : 0) - p.lift) * (1 - Math.exp(-dt * 6));
        // developing: under the lamp it comes up in a couple of seconds; away from it the colour fades and the black and white stays
        const d = Math.abs(p.i - this.pv);
        if (d < 0.32) { p.dev = Math.min(1, p.dev + dt * (R ? 9 : 0.5 * (1.15 - d))); p.seen = 1; }
        else if (p.seen) p.dev += (0.6 - p.dev) * (1 - Math.exp(-dt * (p.dev > 0.6 ? 0.45 : 2)));
      }
    }
    screenX(p) { return p.sx || 0; }

    draw(now) {
      const gl = this.gl;
      if (!gl || !this.W) return;
      if (gl.isContextLost && gl.isContextLost()) return;
      const t = (now - this.t0) / 1000, k = this.k;
      const proj = M.persp(ROOM.fov, this.aspect, 0.1, 30);
      const ex = this.cmx * 0.07, ey = this.cmy * 0.045;
      const eye = [ex, ey, ROOM.camZ];
      const view = M.look(eye, [ex * 0.25, ey * 0.25, 0], [0, 1, 0]);
      const VP = (this.VP = M.mul(proj, view));
      // the prints' places
      const PI = [], PS = [];
      for (const p of this.P) {
        p.k = Math.min(k, (this.aspect * 2 * 0.84) / p.w);
        const x = p.at * k - this.off, y = this.cordY(x), z = this.cordZ(x);
        const yaw = Math.atan(-2 * ROOM.depth * x);
        p.M = M.mul(M.T(x, y - ROOM.drop * k, z + p.lift * 0.06), M.mul(M.Y(yaw + p.ps), M.mul(M.X(p.ph), M.Z(p.th))));
        p.Mpeg = M.mul(M.T(x, y, z + p.lift * 0.06), M.mul(M.Y(yaw + p.ps * 0.6), M.mul(M.Z(p.th * 0.85), M.S(0.034 * k, 0.15 * k, 0.03 * k))));
        p.vis = Math.abs(x) < this.aspect * 1.6 + p.w;
        const s = M.xf(VP, [x, y, z]); p.sx = s[0];
        if (p.vis && PI.length < 8) { PI.push(...M.inv(M.mul(p.M, M.S(p.k, p.k, 1)))); PS.push(p.w / 2, p.h); }
      }
      const lampDir = (() => { const d = ROOM.lampAt.map((v, i) => v - ROOM.lamp[i]), l = Math.hypot(...d); return d.map((v) => v / l); })();
      const lights = (pr) => {
        gl.uniform3fv(pr.u.uEye, eye); gl.uniform3fv(pr.u.uLamp, ROOM.lamp); gl.uniform3fv(pr.u.uLampDir, lampDir);
        gl.uniform3fv(pr.u.uLampCol, [1.75, 1.68, 1.56]); gl.uniform2fv(pr.u.uCone, ROOM.cone);
        gl.uniform3fv(pr.u.uSafe, ROOM.safe); gl.uniform3fv(pr.u.uSafeCol, [0.36, 0.028, 0.014]); gl.uniform3fv(pr.u.uAmb, [0.012, 0.008, 0.008]);
      };
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, this.W, this.H);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      // the wall
      let pr = this.pWall; gl.useProgram(pr); lights(pr);
      gl.uniformMatrix4fv(pr.u.uIVP, false, M.inv(VP));
      gl.uniform1f(pr.u.uWallZ, ROOM.wallZ); gl.uniform1f(pr.u.uLampR, ROOM.lampR); gl.uniform1f(pr.u.uSafeR, ROOM.safeR);
      gl.uniform1f(pr.u.uLineY, this.cordY(0)); gl.uniform1f(pr.u.uSag, ROOM.sag); gl.uniform1f(pr.u.uDepth, ROOM.depth); gl.uniform1f(pr.u.uDrop, ROOM.drop);
      if (PI.length) { gl.uniformMatrix4fv(pr.u.uPI, false, new Float32Array(PI)); gl.uniform2fv(pr.u.uPS, new Float32Array(PS)); }
      gl.uniform1i(pr.u.uPN, PI.length / 16);
      gl.bindVertexArray(this.vQuad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT);
      // the cord
      pr = this.pSolid; gl.useProgram(pr); lights(pr);
      gl.uniformMatrix4fv(pr.u.uVP, false, VP); gl.uniformMatrix4fv(pr.u.uM, false, M.T(0, 0, 0)); gl.uniform1f(pr.u.uKind, 1);
      const L = this.lineData, X = this.aspect * 1.7 + 0.6, th = 0.0032;
      for (let i = 0; i <= 160; i++) {
        const x = -X + (2 * X * i) / 160, y = this.cordY(x), z = this.cordZ(x), o = i * 12;
        L[o] = x; L[o + 1] = y + th; L[o + 2] = z; L[o + 3] = 0; L[o + 4] = 0.6; L[o + 5] = 0.8;
        L[o + 6] = x; L[o + 7] = y - th; L[o + 8] = z; L[o + 9] = 0; L[o + 10] = -0.3; L[o + 11] = 0.95;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bLine); gl.bufferSubData(gl.ARRAY_BUFFER, 0, L);
      gl.bindVertexArray(this.vLine); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 322);
      // the pegs
      gl.bindVertexArray(this.vBox); gl.uniform1f(pr.u.uKind, 0);
      for (const p of this.P) if (p.vis) { gl.uniformMatrix4fv(pr.u.uM, false, p.Mpeg); gl.drawArrays(gl.TRIANGLES, 0, 36); }
      // the prints
      pr = this.pPrint; gl.useProgram(pr); lights(pr);
      gl.uniformMatrix4fv(pr.u.uVP, false, VP); gl.uniform1f(pr.u.uT, t); gl.uniform1i(pr.u.uTex, 0); gl.activeTexture(gl.TEXTURE0);
      gl.bindVertexArray(this.vGrid);
      for (const p of this.P) {
        if (!p.vis) continue;
        gl.uniformMatrix4fv(pr.u.uM, false, p.M);
        gl.uniform2f(pr.u.uSize, p.w * p.k, p.h * p.k);
        const wave = Math.min(1, Math.abs(p.psv) * 0.5 + Math.abs(p.thv) * 0.4);
        gl.uniform4f(pr.u.uBend, 0.8 + 0.2 * Math.sin(p.seed), 0.6 + 0.4 * Math.cos(p.seed * 1.7), wave, t * 5 + p.seed);
        const b = 0.05 / Math.max(p.w, p.h);
        gl.uniform2f(pr.u.uBorder, b * Math.max(p.w, p.h) / p.w, b * Math.max(p.w, p.h) / p.h);
        gl.uniform1f(pr.u.uDev, p.dev); gl.uniform1f(pr.u.uHas, p.has); gl.uniform1f(pr.u.uSeed, p.seed); gl.uniform1f(pr.u.uLift, p.lift);
        gl.bindTexture(gl.TEXTURE_2D, p.tex || null);
        gl.drawElements(gl.TRIANGLES, this.nGrid, gl.UNSIGNED_SHORT, 0);
      }
      gl.disable(gl.DEPTH_TEST);
      // the finish
      gl.bindTexture(gl.TEXTURE_2D, this.ftex); gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.W, this.H);
      pr = this.pPost; gl.useProgram(pr);
      gl.uniform1i(pr.u.uScene, 0); gl.uniform2f(pr.u.uRes, this.W, this.H); gl.uniform1f(pr.u.uT, t);
      gl.uniform1f(pr.u.uGrain, 0.05); gl.uniform1f(pr.u.uBloom, 0.7); gl.uniform1f(pr.u.uSoft, this.cw < 700 ? 1.2 : 2.2); gl.uniform1f(pr.u.uVig, 0.7);
      gl.uniform1f(pr.u.uFade, this.reduce ? 1 : this.fade);
      gl.bindVertexArray(this.vQuad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }
  }
  window.Darkroom = Darkroom;
})();
