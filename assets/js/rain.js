/* rain.js — a window on a rainy day, drawn live.
   A meadow outside, a harebell close to the glass. One wind moves everything: a restless breeze with
   sudden gusts. The plant is rigged like an animated illustration: the stems bend from the root, and
   every bell and bud hangs from its own stalk on a damped spring with its own weight and rhythm, pushed by
   the wind and jerked by the stem, so the top never moves like the bottom. The rain outside leans with
   the wind; every gust throws water at the window and pushes the running drops sideways.
   The glass is vertical: water mostly arrives from above and runs down; a few drops hit it and settle.
   Condensation frosts the glass; press and drag to wipe it with a finger and the flower comes through.
   Every number lives in Rain.defaults and can be tuned live (?tune). WebGL2, no dependencies. */
(() => {
  // ---------- parameters: [value, min, max, step]; the tuning panel is built from this ----------
  const SCHEMA = {
    rain: {
      rate: [8, 0, 60, 1], gustRain: [45, 0, 200, 1], sizeMin: [1.6, 0.3, 6, 0.1], sizeRange: [4.4, 0, 12, 0.1], sizeCurve: [1.8, 0.5, 4, 0.1],
      hold: [7.2, 2, 16, 0.1], maxSize: [13, 4, 24, 0.5], slide: [180, 20, 400, 5], drag: [1.6, 0.2, 6, 0.1], stickSlip: [0.6, 0, 3, 0.05],
      trail: [0.65, 0, 1, 0.05], trailSize: [0.18, 0.05, 0.5, 0.01], inflow: [0.42, 0, 3, 0.01], inflowSize: [8.7, 3, 16, 0.1],
      fadeIn: [1.6, 0.3, 8, 0.1], windPush: [14, 0, 60, 1], cap: [520, 100, 2000, 10], size: [1, 0.4, 2.5, 0.05],
    },
    glass: {
      fog: [1, 0, 1, 0.01], refog: [0.06, 0, 0.2, 0.002], frostBlur: [4.7, 0, 7, 0.1], frostLift: [0.06, 0, 0.3, 0.005], frostGlow: [0.1, 0, 0.4, 0.005],
      frostDesat: [0.3, 0, 1, 0.01], micro: [0.022, 0, 0.1, 0.002], clearBlur: [0.65, 0, 4, 0.05], refract: [0.2, 0, 0.6, 0.01], rim: [0.22, 0, 1, 0.01],
      spec: [1.5, 0, 4, 0.05], specSharp: [50, 5, 300, 1], wipe: [14, 6, 40, 1], grease: [0.2, 0, 1, 0.01],
    },
    wind: {
      breeze: [0.55, 0, 2, 0.01], gustMin: [9, 2, 60, 1], gustMax: [24, 3, 90, 1], gust: [1, 0, 3, 0.05], bend: [0.05, 0, 0.2, 0.001],
      swing: [1, 0, 4, 0.05], flutter: [0.4, 0, 3, 0.05], meadow: [0.004, 0, 0.02, 0.0005], rainLean: [0.22, 0, 1, 0.01], wind: [1, 0, 3, 0.05], plant: [1, 0, 3, 0.05], dayLength: [3.7, 0.8, 6, 0.1], clock: [3, 0, 20, 0.5],
    },
    camera: { zoom: [1, 1, 1.6, 0.01], parallax: [0.25, 0, 4, 0.05], ca: [0.01, 0, 0.01, 0.0002], exposure: [0.98, 0.3, 2, 0.01] },
    post: {
      bloom: [1.09, 0, 2, 0.01], bloomThreshold: [0.24, 0, 1, 0.01], grain: [0.062, 0, 0.15, 0.002], vignette: [0.69, 0, 1, 0.01],
      saturation: [1.1, 0, 2, 0.01], cool: [0.6, 0, 1, 0.01], brightness: [0.85, 0.2, 2, 0.01], contrast: [1, 0.5, 1.6, 0.01], filmic: [1, 0, 1, 0.01],
    },
  };
  const DEFAULTS = {};
  for (const g of Object.values(SCHEMA)) for (const [k, v] of Object.entries(g)) DEFAULTS[k] = v[0];
  const SCENE_U = ["zoom", "meadow", "rainLean", "saturation", "cool", "brightness", "contrast"];
  const GLASS_U = ["fog", "frostBlur", "frostLift", "frostGlow", "frostDesat", "micro", "clearBlur", "refract", "rim", "spec", "specSharp", "grease", "ca", "exposure", "bloom", "bloomThreshold", "grain", "vignette", "filmic"];
  const decl = (list) => list.map((k) => `uniform float k_${k};`).join("\n");

  // ---------- the rig: each part is a capsule (a→b, radius) that turns around a pivot (photo pixels, y down) ----------
  const IMG = [1672, 941];
  const PARTS = [
    { name: "bell top, stalk", a: [700, 230], b: [1060, 330], r: 150, pivot: [1085, 345], f: 0.9, z: 0.24, gain: 1, couple: 0.35, sign: -1 },
    { name: "bell top, bell", a: [690, 220], b: [925, 285], r: 118, pivot: [942, 290], f: 1.6, z: 0.18, gain: 0.7, couple: 0.55, sign: 1 },
    { name: "bud middle", a: [915, 405], b: [1100, 375], r: 60, pivot: [1142, 372], f: 1.3, z: 0.3, gain: 0.8, couple: 0.3, sign: -1 },
    { name: "bell low, stalk", a: [770, 580], b: [1120, 505], r: 150, pivot: [1150, 575], f: 0.8, z: 0.25, gain: 1.1, couple: 0.35, sign: -1 },
    { name: "bell low, bell", a: [780, 580], b: [998, 505], r: 118, pivot: [1012, 500], f: 1.5, z: 0.18, gain: 0.75, couple: 0.55, sign: 1 },
    { name: "bud top left", a: [1000, 70], b: [1040, 320], r: 45, pivot: [1085, 345], f: 1.1, z: 0.22, gain: 1.9, couple: 0.6, sign: -1 },
    { name: "bud top right", a: [1205, 65], b: [1212, 210], r: 42, pivot: [1212, 222], f: 1.4, z: 0.3, gain: 1, couple: 0.4, sign: -1 },
    { name: "bud bottom", a: [1165, 925], b: [1195, 770], r: 40, pivot: [1160, 935], f: 1.7, z: 0.35, gain: 0.8, couple: 0.2, sign: -1 },
  ];
  const ROOT = [1225, 941];
  const toUV = ([x, y]) => [(x / IMG[0]) * (IMG[0] / IMG[1]), 1 - y / IMG[1]]; // aspect space, y up

  const QUAD = `#version 300 es
in vec2 p; out vec2 vUv;
void main() { vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

  const SCENE = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uImg, uMask;
uniform vec2 uRes, uImgSize, uPar, uRoot;
uniform float uTime, uWind, uStem, uSun, uRain, uNight, uStorm, uFlash, uSat, uBright, uContrast;
uniform vec3 uTint, uLift, uGlow;
uniform vec4 uSegA[8], uSegB[8];
uniform float uAng[8];
${decl(SCENE_U)}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec2 cover(vec2 uv, float z) { float rs = uRes.x / uRes.y, ri = uImgSize.x / uImgSize.y; vec2 s = rs > ri ? vec2(1., ri / rs) : vec2(rs / ri, 1.); return (uv - .5) * s / z + .5; }
vec2 turn(vec2 p, vec2 c, float a) { vec2 d = p - c; float s = sin(a), k = cos(a); return c + vec2(k * d.x - s * d.y, s * d.x + k * d.y) - p; }
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float streaks(vec2 uv, float cols, float speed, float seed, float lean) {
  uv.x += uv.y * lean;
  float x = uv.x * cols, id = floor(x), h = hash(vec2(id, seed));
  float y = uv.y * cols * .06 + uTime * speed * (.8 + h * .5) + h * 17.;
  float seg = fract(y), on = step(.66, hash(vec2(id, floor(y) + seed)));
  return on * exp(-pow((fract(x) - .5) * 3.2, 2.)) * smoothstep(0., .1, seg) * smoothstep(.55, .2, seg);
}
void main() {
  vec2 uv = vUv; float t = uTime, asp = uImgSize.x / uImgSize.y;
  vec2 iu = cover(uv, k_zoom);
  vec2 mk = texture(uMask, iu).rg;
  iu += uPar * mix(1., .45, mk.g);
  // the rig, in aspect-true space
  // one smooth, continuous field: nothing is cut out, so no part can tear or vanish while it moves
  vec2 q = vec2(iu.x * asp, iu.y), d = vec2(0.);
  float near = smoothstep(.62, .12, abs(q.x - 1.02));
  d += near * turn(q, uRoot, uStem * pow(clamp(q.y, 0., 1.), 1.35));
  for (int i = 0; i < 8; i++) {
    float w = smoothstep(uSegB[i].z * 1.7, uSegB[i].z * .25, seg(q, uSegA[i].xy, uSegA[i].zw));
    d += w * turn(q, uSegB[i].xy, uAng[i]);
  }
  d.x /= asp;
  // the meadow breathes behind
  vec2 g = vec2(noise(iu * 3. + vec2(t * .22, 0.)), noise(iu * 3. + vec2(3.7, t * .18))) - .5;
  vec2 bg = (g * k_meadow * (.5 + abs(uWind)) + vec2(uWind * k_meadow * .6 * iu.y, 0.)) * (1. - mk.r);
  vec3 col = texture(uImg, iu - d - bg).rgb;
  float m = texture(uMask, iu - d).g;
  // what the lamp can light: only the pale, violet petals, told by their colour, so no outline can glow
  float petal = smoothstep(.0, .09, col.b - col.g) * smoothstep(.25, .5, col.b) * smoothstep(.2, .9, m);

  // the light of the hour: a rainy day is softer and cooler than the sunny photograph
  float L = dot(col, vec3(.3, .59, .11));
  col = mix(vec3(L), col, uSat * k_saturation);
  col = mix(col, col * vec3(.92, .98, 1.02), k_cool);
  col = (col - .4) * uContrast * k_contrast + .4;
  col = max(col, 0.) * uTint * uBright * k_brightness + uLift;
  // a low sun lights the meadow from the side
  col += uGlow * smoothstep(.1, 1., uv.x * .7 + uv.y * .6) * (1. - m * .4);
  // after dark, the lamp in the room only catches the pale petals
  col += vec3(1., .8, .6) * pow(L, 2.) * .4 * petal * uNight;
  col = mix(col, col * vec3(.6, .64, .7), uStorm * .6);
  col = mix(col, col * vec3(1.08, 1., .9) + .02, uSun);
  col += uFlash * vec3(.5, .55, .68);
  o = vec4(col, 1.);
}`;

  const GLASS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uWater, uFog, uGrease;
uniform vec2 uRes;
uniform float uTime, uExpo, uNight, uFlash, uLod;
${decl(GLASS_U)}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// the scene is rendered at the photograph's own resolution, so its levels are shifted to match the screen's
vec3 S(vec2 uv, float lod) { return textureLod(uScene, uv, max(lod + uLod, 0.)).rgb; }
float micro(vec2 px) {
  vec2 c = px / 2.8, i = floor(c), f = fract(c);
  vec2 p = vec2(hash(i), hash(i + 5.1)) * .6 + .2;
  float r = .16 + hash(i + 9.3) * .22;
  return smoothstep(r, r * .3, length(f - p)) * step(.35, hash(i + 2.2));
}
vec3 filmic(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main() {
  vec2 uv = vUv, px = gl_FragCoord.xy, cv = vec2(uv.x, 1. - uv.y); // the 2D canvases arrive unflipped
  vec4 w = texture(uWater, cv);
  w.rgb /= max(w.a, 1e-4); // the water layer is premultiplied; this is what the 2D canvas upload used to undo
  vec2 n = (w.rg - .5) * 2.; n.y = -n.y;
  float th = w.b, a = w.a;
  float f = clamp(texture(uFog, cv).r * (1. - texture(uGrease, cv).r * k_grease), 0., 1.), fa = f * k_fog;
  // each look is only computed where it shows: the clear glass where it is wiped, the frost where it is fogged
  vec3 clear = vec3(0.), frost = vec3(0.);
  if (fa < 1.) {
    vec2 ca = (uv - .5) * k_ca;
    clear = vec3(S(uv + ca, k_clearBlur).r, S(uv, k_clearBlur).g, S(uv - ca, k_clearBlur).b);
  }
  if (fa > 0.) {
    vec2 j = (vec2(hash(px), hash(px + 7.3)) - .5) * .012;
    vec3 far = (S(uv + j, k_frostBlur) + S(uv - j * 1.4, k_frostBlur + .6) + S(uv + j.yx, k_frostBlur - .6)) / 3.;
    float lum = dot(far, vec3(.3, .6, .1));
    frost = mix(far, vec3(lum), k_frostDesat) * .8 + vec3(k_frostLift, k_frostLift * 1.1, k_frostLift * 1.06) * (1. - uNight * .7) + lum * k_frostGlow;
    frost += (micro(px) - .35) * k_micro * (.6 + lum) + (hash(floor(px)) - .5) * .01;
  }
  vec3 col = mix(clear, frost, fa);
  // and the water only where there is a drop
  if (a > 0.) {
    vec2 off = n * (.05 + k_refract * th);
    vec3 dr = vec3(S(uv - off * 1.03, 0.).r, S(uv - off, 0.).g, S(uv - off * .97, 0.).b);
    dr = mix(dr, dr * 1.2 + .02 * (1. - uNight), .4);
    dr *= mix(k_rim, 1., smoothstep(0., .62, th));
    dr += pow(1. - th, 4.) * max(0., -n.y) * .28 * (1. - uNight * .6);
    col = mix(col, dr, a);
    vec3 N = normalize(vec3(n * 1.8, max(th, .08)));
    vec3 lamp = mix(vec3(1.), vec3(1., .78, .52), uNight);
    col += a * lamp * mix(1., .7, uNight) * (pow(max(dot(N, normalize(vec3(-.35, .7, .62))), 0.), k_specSharp) * k_spec + pow(max(dot(N, normalize(vec3(.45, -.5, .74))), 0.), k_specSharp * 2.6) * .28);
  }
  vec3 bl = max(S(uv, 5.5) - k_bloomThreshold, 0.) * k_bloom + max(S(uv, 4.) - (k_bloomThreshold + .12), 0.) * k_bloom * .7;
  col += bl * (1. - f * .5);
  col += mix(vec3(.01), vec3(.035, .022, .01), uNight) * smoothstep(.95, 0., length((uv - vec2(.16, .84)) * vec2(1.2, 1.)));
  col += uFlash * .08;
  col = mix(col * k_exposure * uExpo, filmic(col * k_exposure * uExpo), k_filmic);
  col *= 1. - k_vignette * pow(length((uv - .5) * vec2(1.05, 1.)), 2.4);
  col += (hash(px * .71 + fract(uTime * 6.3) * 97.) - .5) * k_grain;
  o = vec4(col, 1.);
}`;

  // the drops, drawn as the 2D canvas used to draw them: each one a sprite, blended over the others
  // ("source-over", premultiplied), top-left origin, in the water layer's pixels
  const DROPV = `#version 300 es
layout(location = 0) in vec2 p;
layout(location = 1) in vec4 rect;
layout(location = 2) in vec2 extra;
uniform vec2 uSize;
out vec2 vT; out float vA;
void main() {
  vec2 c = p * .5 + .5;
  vT = vec2((extra.y + c.x) / 8., c.y);
  vA = extra.x;
  gl_Position = vec4((rect.xy + c * rect.zw) / uSize * 2. - 1., 0., 1.);
}`;
  const DROPF = `#version 300 es
precision highp float;
in vec2 vT; in float vA; out vec4 o;
uniform sampler2D uSp;
void main() { o = texture(uSp, vT) * vA; }`;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const nz = (x) => { const i = Math.floor(x), f = x - i, h = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return h(i) * (1 - u) + h(i + 1) * u; };

  function sprites(count = 8, S = 96) {
    return Array.from({ length: count }, (_, v) => {
      const c = document.createElement("canvas");
      c.width = c.height = S;
      const x = c.getContext("2d"), im = x.createImageData(S, S), R = S / 2;
      const h = Array.from({ length: 4 }, (_, k) => ({ a: rnd(0.02, 0.07) / (k + 1), p: rnd(0, 6.28), f: k + 2 }));
      const rad = (t) => 0.93 + h.reduce((s, q) => s + q.a * Math.sin(t * q.f + q.p), 0) * (v < 2 ? 0.3 : 1);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const dx = (i + 0.5 - R) / R, dy = (j + 0.5 - R) / R;
        const d = Math.hypot(dx, dy) / rad(Math.atan2(dy, dx)), k = (j * S + i) * 4;
        if (d >= 1) continue;
        const z = Math.pow(1 - d * d, 0.6) * (1 + dy * 0.2);
        im.data[k] = 128 + Math.max(-1, Math.min(1, dx * 0.9)) * 127;
        im.data[k + 1] = 128 + Math.max(-1, Math.min(1, (dy - 0.1) * 0.9)) * 127;
        im.data[k + 2] = Math.min(1, z) * 255;
        im.data[k + 3] = Math.min(1, (1 - d) / 0.06) * 255;
      }
      x.putImageData(im, 0, 0);
      return c;
    });
  }

  class Rain {
    constructor(canvas, o = {}) {
      this.c = canvas;
      this.o = Object.assign({ img: "", mask: "", water: 0.75, fogScale: 0.5, dpr: 1.5, reduce: false }, o);
      this.P = Object.assign({}, DEFAULTS, o.params || {});
      const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
      if (!gl) { this.dead = true; return; }
      this.gl = gl;
      this.pScene = this.program(SCENE, ["uImg", "uMask", "uRes", "uImgSize", "uPar", "uRoot", "uTime", "uWind", "uStem", "uSun", "uRain", "uNight", "uStorm", "uFlash", "uSat", "uBright", "uContrast", "uTint", "uLift", "uGlow", "uSegA", "uSegB", "uAng", ...SCENE_U.map((k) => "k_" + k)]);
      this.pGlass = this.program(GLASS, ["uScene", "uWater", "uFog", "uGrease", "uRes", "uTime", "uExpo", "uNight", "uFlash", "uLod", ...GLASS_U.map((k) => "k_" + k)]);
      this.pDrop = this.program(DROPF, ["uSp", "uSize"], DROPV);
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      // the drops: one small quad each, drawn in a single call
      this.vaoD = gl.createVertexArray();
      gl.bindVertexArray(this.vaoD);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.ib = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 0); gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16); gl.vertexAttribDivisor(2, 1);
      gl.bindVertexArray(null);
      this.inst = new Float32Array(6 * 1024);
      this.T = {};
      for (const k of ["img", "mask", "water", "fog", "grease", "scene", "sp"]) this.T[k] = this.texture(["img", "scene"].includes(k));
      this.fbo = gl.createFramebuffer();
      this.wfbo = gl.createFramebuffer();
      this.imgSize = IMG.slice();
      // the rig in shader space
      this.segA = new Float32Array(32); this.segB = new Float32Array(32); this.ang = new Float32Array(8);
      PARTS.forEach((p, i) => {
        const a = toUV(p.a), b = toUV(p.b), v = toUV(p.pivot);
        this.segA.set([a[0], a[1], b[0], b[1]], i * 4);
        this.segB.set([v[0], v[1], p.r / IMG[1], 1], i * 4);
        p.x = 0; p.v = 0;
      });
      this.root = toUV(ROOT);
      this.stem = { x: 0, v: 0, acc: 0 };
      this.state = { expo: 0, sun: 0, rain: 1, night: 0, storm: 0, flash: 0, grade: { sat: 0.8, bright: 0.8, contrast: 1, tint: [1, 1, 1], lift: [0.01, 0.01, 0.01], glow: [0, 0, 0] } };
      this.wind = { v: 0, gust: 0, next: rnd(5, 10) };
      this.par = { x: 0, y: 0, tx: 0, ty: 0 };
      this.finger = null;
      this.sp = sprites();
      // the drop shapes side by side in one texture, premultiplied like a 2D canvas keeps them
      const atlas = document.createElement("canvas"), S = this.sp[0].width;
      atlas.width = S * this.sp.length; atlas.height = S;
      const ax = atlas.getContext("2d");
      this.sp.forEach((c, i) => ax.drawImage(c, i * S, 0));
      gl.bindTexture(gl.TEXTURE_2D, this.T.sp.t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      // the water layer's size (in its own pixels); it is drawn on the graphics card, never on a 2D canvas
      this.water = { width: 2, height: 2 };
      this.fog = document.createElement("canvas"); this.fx = this.fog.getContext("2d");
      this.grease = document.createElement("canvas"); this.gx = this.grease.getContext("2d");
      this.drops = [];
      this.t0 = this.last = performance.now();
      this.time = 0; this.refogT = 0; this.visible = true; this.active = true; this.greaseDirty = true;
      this.pattern = this.noisePattern();
      this.resize();
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
      this.io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting)); this.io.observe(canvas);
      let n = 0;
      const done = () => { if (++n === 2) { this.ready = true; canvas.classList.add("is-ready"); if (this.onready) this.onready(); } };
      this.load("img", this.o.img, done, true);
      this.load("mask", this.o.mask, done);
    }
    program(frag, names, vert = QUAD) {
      const gl = this.gl;
      const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vert)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(p, 0, "p");
      gl.linkProgram(p);
      const u = {};
      for (const k of names) u[k] = gl.getUniformLocation(p, k);
      return { p, u };
    }
    texture(mips) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([30, 50, 25, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return { t, mips };
    }
    // pictures are flipped once on upload; the 2D canvases that change every frame are not (the shader flips
    // them for free) and refill the texture they already have instead of allocating a new one
    upload(k, src, flip = true) {
      const gl = this.gl, T = this.T[k];
      gl.bindTexture(gl.TEXTURE_2D, T.t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
      if (T.w !== src.width || T.h !== src.height) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); T.w = src.width; T.h = src.height; }
      else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
      if (T.mips) gl.generateMipmap(gl.TEXTURE_2D);
    }
    load(k, src, done, size) {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { if (size) { this.imgSize = [im.naturalWidth, im.naturalHeight]; if (this.W) this.alloc(); } this.upload(k, im); done(); };
      im.onerror = done;
      im.src = src;
    }
    noisePattern() {
      const c = document.createElement("canvas"), S = 192;
      c.width = c.height = S;
      const x = c.getContext("2d"), im = x.createImageData(S, S);
      const g = Array.from({ length: 13 * 13 }, () => Math.random());
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const u = (i / S) * 12, v = (j / S) * 12, a = Math.floor(u), b = Math.floor(v), fu = u - a, fv = v - b;
        const s = (p, q) => g[(q % 12) * 13 + (p % 12)];
        const val = (s(a, b) * (1 - fu) + s(a + 1, b) * fu) * (1 - fv) + (s(a, b + 1) * (1 - fu) + s(a + 1, b + 1) * fu) * fv;
        const k = (j * S + i) * 4;
        im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = Math.round(120 + val * 135);
      }
      x.putImageData(im, 0, 0);
      return this.fx.createPattern(c, "repeat");
    }
    resize(force) {
      if (this.dead) return;
      const W = Math.max(2, this.c.offsetWidth), H = Math.max(2, this.c.offsetHeight);
      if (!force && W === this.W && H === this.H) return;
      this.W = W; this.H = H;
      this.alloc();
      this.ws = W < 700 ? 0.8 : this.o.water;
      this.k = this.ws * Math.max(0.85, Math.min(1.2, Math.min(W, H) / 900));
      this.water.width = Math.round(W * this.ws); this.water.height = Math.round(H * this.ws);
      {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.T.water.t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.water.width, this.water.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.wfbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.T.water.t, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      this.fog.width = this.grease.width = Math.round(W * this.o.fogScale);
      this.fog.height = this.grease.height = Math.round(H * this.o.fogScale);
      this.fx.fillStyle = "#fff"; this.fx.fillRect(0, 0, this.fog.width, this.fog.height);
      this.gx.fillStyle = "#000"; this.gx.fillRect(0, 0, this.grease.width, this.grease.height);
      this.greaseDirty = true;
      this.drops = [];
      this.area = (W * H) / (1440 * 900);
      this.fw = 72; this.fh = 45;
      this.friction = Array.from({ length: this.fw * this.fh }, () => Math.random());
      for (let i = 0; i < 360; i++) this.step(1 / 30, true);
      this.drops.forEach((q) => { q.r = q.g; q.age = 9; });
    }
    // the drawing buffers. The glass is drawn at the screen's resolution (within a pixel budget, and a touch
    // lower only if this computer cannot keep up); the scene behind it at the photograph's own resolution,
    // because drawing a 1672-pixel photo into more pixels than that adds nothing but work.
    alloc() {
      const gl = this.gl, W = this.W, H = this.H;
      let d = Math.min(devicePixelRatio || 1, this.o.dpr) * (this.q || 1);
      if (W * H * d * d > 8.3e6) d = Math.sqrt(8.3e6 / (W * H));
      this.c.width = Math.round(W * d); this.c.height = Math.round(H * d);
      const fit = Math.max(this.c.width / this.imgSize[0], this.c.height / this.imgSize[1]) * (this.P.zoom || 1);
      const s = Math.min(1, 1.15 / fit);
      this.sw = Math.max(2, Math.round(this.c.width * s)); this.sh = Math.max(2, Math.round(this.c.height * s));
      this.lod = Math.log2(this.sw / this.c.width);
      gl.bindTexture(gl.TEXTURE_2D, this.T.scene.t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.sw, this.sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.T.scene.t, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // a computer that cannot keep up gets a slightly lighter glass, step by step, and gets it back when it can;
    // never while the page is loading or the voice's model is thinking on the same graphics card
    adapt(raw, now) {
      const a = this.ad || (this.ad = { ema: 16.7, slow: 0, fast: 0 });
      if (raw > 250 || document.getElementById("loader") || window.__thinking) { a.slow = a.fast = 0; return; }
      a.ema += (raw - a.ema) * 0.05;
      const floor = (devicePixelRatio || 1) >= 1.5 ? 1 / Math.min(devicePixelRatio, this.o.dpr) : 0.75;
      if (a.ema > 24) { a.fast = 0; a.slow += raw; } else if (a.ema < 15) { a.slow = 0; a.fast += raw; } else a.slow = a.fast = 0;
      const q = this.q || 1;
      if (a.slow > 3000 && q > floor + 0.01) { this.q = Math.max(floor, q - 0.12); a.slow = 0; a.ema = 16.7; this.alloc(); }
      else if (a.fast > 8000 && q < 1) { this.q = Math.min(1, q + 0.12); a.fast = 0; this.alloc(); }
    }
    fr(x, y) {
      const i = Math.max(0, Math.min(this.fw - 1, Math.floor((x / this.water.width) * this.fw))), j = Math.max(0, Math.min(this.fh - 1, Math.floor((y / this.water.height) * this.fh)));
      return this.friction[j * this.fw + i];
    }
    drop(x, y, r, grown) {
      return { x, y, r: grown ? r : r * 0.4, g: r, vx: 0, vy: 0, mv: false, s: (Math.random() * this.sp.length) | 0, t: 0, age: grown ? 9 : 0, sx: 1 };
    }
    land(x, y, r, stretch = 1) {
      const P = this.P;
      for (const q of this.near(x, y, r + 14 * this.k)) {
        const dx = q.x - x, dy = q.y - y, R = (q.g + r) * 0.85;
        if (!q.dead && dx * dx + dy * dy < R * R) { q.g = Math.min(Math.sqrt(q.g * q.g + r * r), P.maxSize * this.k); return q; }
      }
      const q = this.drop(x, y, r);
      q.sx = stretch;
      this.drops.push(q); this.grid.add(q);
      const fs = this.fog.width / this.water.width;
      this.fx.fillStyle = "rgba(0,0,0,0.45)"; this.fx.beginPath(); this.fx.arc(x * fs, y * fs, Math.max(0.6, r * 1.5 * fs), 0, 6.283); this.fx.fill();
      return q;
    }
    // the drops near a point. The list is reused (never nested), and so is the grid, so the simulation
    // creates almost nothing new each frame and the browser never has to pause to clean up after it
    near(x, y, rad) {
      const out = this.nb || (this.nb = []), G = this.grid, c = G.cell;
      out.length = 0;
      for (let i = Math.floor((x - rad) / c); i <= Math.floor((x + rad) / c); i++)
        for (let j = Math.floor((y - rad) / c); j <= Math.floor((y + rad) / c); j++) {
          const a = G.map.get(i * 4096 + j);
          if (a) for (let k = 0; k < a.length; k++) out.push(a[k]);
        }
      return out;
    }
    buildGrid() {
      const cell = 16 * this.k;
      let G = this.grid;
      if (!G || G.cell !== cell) {
        const map = new Map();
        G = this.grid = { cell, map, add: (q) => { const key = Math.floor(q.x / cell) * 4096 + Math.floor(q.y / cell); let a = map.get(key); if (!a) map.set(key, (a = [])); a.push(q); } };
      } else for (const a of G.map.values()) a.length = 0;
      for (const q of this.drops) G.add(q);
    }
    down(cx, cy) { const p = this.local(cx, cy); if (!p) return false; this.finger = { x: p.x, y: p.y, still: 0 }; this.wipe(p.x, p.y, p.x, p.y); return true; }
    move(cx, cy) {
      const p = this.local(cx, cy, true), k = this.P.parallax;
      this.par.tx = (p.x - 0.5) * -0.01 * k; this.par.ty = (p.y - 0.5) * 0.007 * k;
      if (!this.finger) return;
      const f = this.finger, x0 = f.x, y0 = f.y;
      f.x = p.x; f.y = p.y; f.still = 0;
      this.wipe(x0, y0, f.x, f.y);
    }
    up() { this.finger = null; }
    local(cx, cy, any) {
      const r = this.c.getBoundingClientRect(), x = (cx - r.left) / r.width, y = (cy - r.top) / r.height;
      return any || (x >= 0 && x <= 1 && y >= 0 && y <= 1) ? { x, y } : null;
    }
    // the fingertip's radius in CSS pixels: the ring on screen is drawn at exactly this size
    fingerRadius() { return this.P.wipe; }
    wipe(x0, y0, x1, y1) {
      const f = this.fx, g = this.gx, fw = this.fog.width, fh = this.fog.height;
      const rad = this.fingerRadius() * this.o.fogScale;
      const dx = (x1 - x0) * fw, dy = (y1 - y0) * fh, len = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(len / (rad * 0.25)));
      const nx = len ? -dy / len : 0, ny = len ? dx / len : 0;
      const ws = this.water.width / fw;
      this.buildGrid();
      for (let i = 1; i <= steps; i++) {
        const x = x0 * fw + (dx * i) / steps, y = y0 * fh + (dy * i) / steps;
        const gr = f.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, "rgba(0,0,0,0.96)"); gr.addColorStop(0.86, "rgba(0,0,0,0.92)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        f.fillStyle = gr; f.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        g.fillStyle = "rgba(255,255,255,0.03)"; g.beginPath(); g.arc(x, y, rad * 0.75, 0, 6.283); g.fill();
        const wx = x * ws, wy = y * ws, wr = rad * ws * 0.9;
        for (const q of this.near(wx, wy, wr + 14 * this.k)) { const ex = q.x - wx, ey = q.y - wy; if (!q.dead && ex * ex + ey * ey < wr * wr) q.dead = true; }
        if (len && Math.random() < 0.6) {
          const side = Math.random() < 0.5 ? -1 : 1, o = wr * rnd(0.92, 1.08);
          const q = this.land(wx + nx * o * side, wy + ny * o * side, rnd(0.8, 2.2) * this.k * 1.33);
          q.age = 1;
        }
      }
      if (len > rad * 0.4) {
        f.lineWidth = 0.6; f.lineCap = "round";
        for (let k = 0; k < 4; k++) {
          const o = rnd(-0.8, 0.8) * rad;
          f.strokeStyle = `rgba(255,255,255,${rnd(0.03, 0.07)})`;
          f.beginPath(); f.moveTo(x0 * fw + nx * o, y0 * fh + ny * o); f.lineTo(x1 * fw + nx * o, y1 * fh + ny * o); f.stroke();
        }
      }
      this.drops = this.drops.filter((q) => !q.dead);
      this.greaseDirty = true;
    }
    set(k, v) { this.state[k] = v; }
    // one wind for the whole scene, and a plant that answers it part by part
    blow(dt) {
      const P = this.P, w = this.wind, t = this.time, st = this.state.storm;
      w.next -= dt;
      if (w.next <= 0) { w.next = rnd(P.gustMin, Math.max(P.gustMin + 1, P.gustMax)) * (1 - st * 0.5); w.g0 = t; w.amp = rnd(0.55, 1.15) * P.gust * (1 + st * 0.6) * (Math.random() < 0.85 ? 1 : -0.6); }
      let gust = 0;
      if (w.g0 !== undefined) {
        const e = t - w.g0;
        gust = (e < 0.7 ? Math.pow(e / 0.7, 1.5) : e < 1.4 ? 1 : Math.exp(-(e - 1.4) / 2.2)) * w.amp;
        gust += Math.sin(e * 5.1) * 0.08 * gust;
      }
      const breeze = ((nz(t * 0.23) - 0.45) * 0.55 + (nz(t * 0.9 + 7) - 0.5) * 0.12) * (P.breeze / 0.55);
      w.v = (breeze + gust) * (1 + st * 0.5) * P.wind;
      w.gust = Math.abs(gust);
      if (this.o.reduce) return;
      // springs: x'' = -(2πf)²(x - target) - 2ζ(2πf)x'
      const spring = (s, f, z, target, h) => { const om = 6.2832 * f, a = -om * om * (s.x - target) - 2 * z * om * s.v; s.v += a * h; s.x += s.v * h; return a; };
      const sub = 3, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        const acc = spring(this.stem, 0.45, 0.55, -w.v * P.bend * P.plant, h);
        this.stem.acc = acc;
        PARTS.forEach((p, k) => {
          const flutter = (nz(t * p.f * 2.3 + k * 9.1) - 0.5) * 0.02 * P.flutter * (0.35 + Math.abs(w.v));
          const target = (p.sign * (w.v * 0.06 * p.gain * P.swing + flutter) - acc * 0.02 * p.couple * P.swing) * P.plant;
          spring(p, p.f, p.z, target, h);
        });
      }
      PARTS.forEach((p, k) => (this.ang[k] = p.x));
    }
    step(dt, pre) {
      const W = this.water.width, H = this.water.height, s = this.state, K = this.k, wind = this.wind, P = this.P;
      this.time += dt;
      this.blow(dt);
      const rain = pre ? 1 : s.rain * (1 - s.sun) * (1 + s.storm * 1.2);
      this.buildGrid();
      const expect = (P.rate + wind.gust * P.gustRain) * this.area * dt * rain;
      let n = Math.floor(expect) + (Math.random() < expect % 1 ? 1 : 0);
      while (n--) {
        const r = (P.sizeMin + Math.pow(Math.random(), P.sizeCurve) * P.sizeRange) * K * P.size;
        this.land(rnd(0, W), rnd(0, H), r, 1 + Math.min(0.5, Math.abs(wind.v) * 0.35));
      }
      if (Math.random() < P.inflow * this.area * dt * rain * (W / 1080)) {
        const q = this.drop(rnd(0, W), -8 * K, P.inflowSize * rnd(0.85, 1.15) * K * P.size, true);
        q.mv = true; q.vy = rnd(10, 30) * K; q.age = 1;
        this.drops.push(q);
      }
      const fsx = this.fog.width / W, fx = this.fx;
      fx.lineCap = "round";
      for (const q of this.drops) {
        if (q.dead) continue;
        q.age += dt;
        q.r += (q.g - q.r) * Math.min(1, dt * 5);
        q.sx += (1 - q.sx) * Math.min(1, dt * 3);
        const hold = P.hold * K * P.size * (0.8 + this.fr(q.x, q.y) * 0.5);
        if (!q.mv && q.g > hold && q.age > 1) q.mv = true;
        if (!q.mv) continue;
        const drive = (q.g - hold * 0.85) / q.g;
        if (drive <= 0 && q.y > 0) { q.vy *= 0.85; if (q.vy < 1.5 * K) { q.mv = false; q.vy = 0; } }
        else q.vy += (P.slide * K * Math.max(drive, 0.2) - q.vy * (P.drag + this.fr(q.x, q.y + 4 * K) * 4.5)) * dt;
        if (Math.random() < dt * P.stickSlip) q.vy *= 0.25;
        const lean = this.fr(q.x - 3 * K, q.y + 4 * K) - this.fr(q.x + 3 * K, q.y + 4 * K);
        q.vx += (lean * 26 * K + wind.v * P.windPush * K - q.vx * 5) * dt;
        const ox = q.x, oy = q.y;
        q.x += q.vx * dt; q.y += Math.max(0, q.vy) * dt;
        const moved = Math.hypot(q.x - ox, q.y - oy);
        if (moved <= 0.01) continue;
        fx.strokeStyle = "rgba(0,0,0,0.2)"; fx.lineWidth = Math.max(0.5, q.r * 1.15 * fsx);
        fx.beginPath(); fx.moveTo(ox * fsx, oy * fsx); fx.lineTo(q.x * fsx, q.y * fsx); fx.stroke();
        q.t += moved;
        if (q.t > q.r * rnd(1, 2.2)) {
          q.t = 0;
          if (Math.random() < P.trail) {
            const tr = q.g * P.trailSize * rnd(0.7, 1.3);
            this.drops.push(this.drop(q.x + rnd(-0.3, 0.3) * q.r, q.y - q.r * rnd(1.1, 1.6), tr, true));
            q.g = Math.sqrt(Math.max(0, q.g * q.g - tr * tr * 0.5));
          }
        }
        for (const p of this.near(q.x, q.y, q.r + 14 * K)) {
          if (p === q || p.dead) continue;
          const ex = p.x - q.x, ey = p.y - q.y, R = (p.r + q.r) * 0.8;
          if (ex * ex + ey * ey < R * R) {
            q.g = Math.min(Math.sqrt(q.g * q.g + p.g * p.g), P.maxSize * K);
            q.vy = Math.max(q.vy, p.vy);
            p.dead = true;
          }
        }
      }
      this.drops = this.drops.filter((q) => !q.dead && q.y - q.r < H + 20 && q.g > 0.3);
      const cap = P.cap * this.area;
      if (this.drops.length > cap) {
        let extra = this.drops.length - cap;
        this.drops = this.drops.filter((q) => (extra > 0 && !q.mv && q.age > 6 && Math.random() < 0.3 ? (extra--, false) : true));
      }
      this.refogT += dt;
      if (this.refogT > 0.2) {
        this.refogT = 0;
        fx.save(); fx.globalAlpha = P.refog * (1 - s.sun); fx.fillStyle = this.pattern; fx.fillRect(0, 0, this.fog.width, this.fog.height); fx.restore();
        if (s.sun > 0.01) { fx.fillStyle = `rgba(0,0,0,${0.08 * s.sun})`; fx.fillRect(0, 0, this.fog.width, this.fog.height); }
      }

    }
    // the water layer: every drop's rectangle, opacity and shape go to the graphics card in one list
    draw() {
      const gl = this.gl, W = this.water.width, H = this.water.height, P = this.P, n = this.drops.length;
      if (this.inst.length < n * 6) this.inst = new Float32Array(Math.ceil((n * 6 * 1.5) / 6) * 6);
      const D = this.inst;
      let i = 0;
      for (const q of this.drops) {
        let x, y, w, h;
        if (q.mv && q.vy > 3) { const st = Math.min(q.vy / (120 * this.k), 0.4); h = q.r * 2 * (1 + st); w = q.r * 1.9; x = q.x - q.r * 0.95; y = q.y - h * 0.62; }
        else { w = q.r * 2 * q.sx; h = (q.r * 2) / Math.sqrt(q.sx); x = q.x - w / 2; y = q.y - h / 2; }
        D[i++] = x; D[i++] = y; D[i++] = w; D[i++] = h; D[i++] = Math.min(1, q.age * P.fadeIn); D[i++] = q.s;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.wfbo);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (n) {
        const U = this.pDrop;
        gl.useProgram(U.p);
        gl.bindVertexArray(this.vaoD);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
        gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, n * 6), gl.STREAM_DRAW);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.T.sp.t); gl.uniform1i(U.u.uSp, 0);
        gl.uniform2f(U.u.uSize, W, H);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
        gl.disable(gl.BLEND);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    tick(now = performance.now()) {
      if (this.dead || !this.ready || !this.visible || !this.active) { this.last = now; return; }
      const raw = now - this.last, dt = Math.min(0.05, raw / 1000);
      this.last = now;
      this.adapt(raw, now);
      if (!this.o.reduce) this.step(dt);
      else if (this.finger) this.step(0);
      this.draw();
      const gl = this.gl, s = this.state, p = this.par, t = (now - this.t0) / 1000, P = this.P;
      p.x += (p.tx - p.x) * 0.03; p.y += (p.ty - p.y) * 0.03;
      this.upload("fog", this.fog, false);
      if (this.greaseDirty) { this.upload("grease", this.grease, false); this.greaseDirty = false; }
      gl.bindVertexArray(this.vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, this.sw, this.sh);
      let U = this.pScene;
      gl.useProgram(U.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.T.img.t); gl.uniform1i(U.u.uImg, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.T.mask.t); gl.uniform1i(U.u.uMask, 1);
      gl.uniform2f(U.u.uRes, this.c.width, this.c.height);
      gl.uniform2f(U.u.uImgSize, this.imgSize[0], this.imgSize[1]);
      gl.uniform2f(U.u.uPar, p.x, p.y);
      gl.uniform2f(U.u.uRoot, this.root[0], this.root[1]);
      gl.uniform4fv(U.u.uSegA, this.segA);
      gl.uniform4fv(U.u.uSegB, this.segB);
      gl.uniform1fv(U.u.uAng, this.ang);
      gl.uniform1f(U.u.uTime, t);
      gl.uniform1f(U.u.uWind, this.o.reduce ? 0 : this.wind.v);
      gl.uniform1f(U.u.uStem, this.stem.x);
      gl.uniform1f(U.u.uSun, s.sun);
      gl.uniform1f(U.u.uRain, s.rain * (1 - s.sun));
      for (const k of ["Night", "Storm", "Flash"]) gl.uniform1f(U.u["u" + k], s[k.toLowerCase()]);
      const G = s.grade;
      gl.uniform1f(U.u.uSat, G.sat); gl.uniform1f(U.u.uBright, G.bright); gl.uniform1f(U.u.uContrast, G.contrast);
      gl.uniform3fv(U.u.uTint, G.tint); gl.uniform3fv(U.u.uLift, G.lift); gl.uniform3fv(U.u.uGlow, G.glow);
      for (const k of SCENE_U) gl.uniform1f(U.u["k_" + k], P[k]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindTexture(gl.TEXTURE_2D, this.T.scene.t);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.c.width, this.c.height);
      U = this.pGlass;
      gl.useProgram(U.p);
      gl.uniform1f(U.u.uLod, this.lod);
      [["uScene", "scene"], ["uWater", "water"], ["uFog", "fog"], ["uGrease", "grease"]].forEach(([u, k], i) => {
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.T[k].t); gl.uniform1i(U.u[u], i);
      });
      gl.uniform2f(U.u.uRes, this.c.width, this.c.height);
      gl.uniform1f(U.u.uTime, t);
      gl.uniform1f(U.u.uExpo, s.expo);
      gl.uniform1f(U.u.uNight, s.night);
      gl.uniform1f(U.u.uFlash, s.flash);
      for (const k of GLASS_U) gl.uniform1f(U.u["k_" + k], P[k]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    destroy() {
      if (this.dead) return;
      this.dead = true; this.ro.disconnect(); this.io.disconnect();
      const e = this.gl.getExtension("WEBGL_lose_context"); if (e) e.loseContext();
    }
  }
  Rain.schema = SCHEMA;
  Rain.defaults = DEFAULTS;
  Rain.supported = (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; } })();
  window.Rain = Rain;
})();
