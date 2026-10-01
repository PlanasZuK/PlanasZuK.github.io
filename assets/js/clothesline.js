/* clothesline.js — the work, hung out to dry in the sun.
   Outside the window of the landing: the same meadow, now from below, looking up at the sky. A cord runs
   across it on two pulleys; scrolling pulls it, and the prints pegged to it travel along, catching the wind.
   It is built the way the landing is: a real photograph is the world (the sky, drifting, deep out of focus),
   and everything in front of it is drawn and simulated live:
   · each print is a sheet of photo paper (a mass-spring sheet, stiff like card) held by two wooden pegs; the
     wind pushes on every part of it by how it faces the wind, gusts travel down the line from one print to the
     next, and moving the cord drags them through the air
   · the cord is a twisted cotton rope that bounces when pulled; the pegs are traced per pixel, wood and steel
   · the paper is lit by the sun and the sky: glossy where the image is, so the clouds slide across it as it
     turns; thin enough that the bright sky shows through it; the pegs throw their shadows on it
   · the print that reaches the middle develops, from blank paper to black and white to colour
   · then the camera: motion blur from the real motion of every pixel, depth of field, bloom, filmic tone,
     grain, as on the landing. WebGL2, no dependencies. */
(() => {
  // ---------- matrices (column-major, like GL) ----------
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
    S(k) { return [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1]; },
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
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  // smooth 1D value noise, for the wind
  const NZ = Array.from({ length: 256 }, () => rnd() * 2 - 1);
  const noise = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return NZ[i & 255] * (1 - u) + NZ[(i + 1) & 255] * u; };

  // ---------- the world. One unit is 18 cm: a portrait print is one unit tall ----------
  const W0 = {
    fov: 27 * Math.PI / 180, camZ: 4.25,
    lineY: 0.66, sag: 0.05, depth: 0.1,            // the cord: height at the middle, how it rises and recedes towards the sides
    rope: 0.0105,                                    // rope radius (4 mm)
    pegDrop: 0.075,                                  // the pegs grip the paper this far under the cord
    sun: (() => { const v = [-0.42, 0.62, 0.66], l = Math.hypot(...v); return v.map((x) => x / l); })(),
    sunCol: [1.95, 1.84, 1.64], skyUp: [0.34, 0.44, 0.58], skyDown: [0.2, 0.24, 0.19],
    g: 54,                                           // gravity in units/s²
  };

  // ---------- shaders ----------
  const COMMON = `
uniform vec3 uSun, uSunCol, uSkyUp, uSkyDown, uEye; uniform sampler2D uSky; uniform vec2 uSkyFit; uniform vec2 uSkyOff; uniform float uSkyOk;
vec3 toLin(vec3 c) { return pow(c, vec3(2.2)); }
// the sky photograph, as seen in a direction (for reflections) or behind a point on screen
vec3 skyAt(vec2 suv, float lod) { return uSkyOk > .5 ? textureLod(uSky, suv * uSkyFit + (1. - uSkyFit) * .5 + uSkyOff, lod).rgb : mix(uSkyDown, uSkyUp, suv.y); }
vec3 skyDir(vec3 d, float lod) { return skyAt(clamp(vec2(.5 + d.x * .42, .5 + d.y * .5), 0., 1.), lod); }
float h12(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + 1.), f.x), f.y); }
// what every lit surface gets: the sun (diffuse and a highlight), the sky above, the meadow's bounce below, and the sky reflected
vec3 light(vec3 P, vec3 N, vec3 alb, float rough, float gloss, float sh) {
  vec3 V = normalize(uEye - P);
  if (dot(N, V) < 0.) N = -N;
  float nl = max(dot(N, uSun), 0.), nv = max(dot(N, V), 0.);
  vec3 H = normalize(uSun + V);
  float a = rough * rough, d = max(dot(N, H), 0.), D = a * a / (3.1416 * pow(d * d * (a * a - 1.) + 1., 2.));
  float F = .04 + .96 * pow(1. - nv, 5.);
  vec3 col = alb * uSunCol * nl * sh + uSunCol * D * F * nl * sh * gloss * .25;
  col += alb * mix(uSkyDown, uSkyUp, N.y * .5 + .5);
  col += skyDir(reflect(-V, N), 2. + rough * 6.) * F * gloss;
  return col;
}
`;
  const ENC = `
uniform mat4 uVP, uPVP; uniform float uEnc;
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1;
in vec4 vCur, vPrev;
void put(vec3 col, float depth) {
  vec2 v = vCur.xy / vCur.w - vPrev.xy / vPrev.w;
  o0 = vec4(col * uEnc, 1.);
  o1 = vec4(clamp(v * 4. + .5, 0., 1.), clamp(depth / 10., 0., 1.), 1.);
}`;

  // the sky: the photograph, drifting, deep out of focus
  const QUAD = `#version 300 es
in vec2 p; out vec2 vUv; void main() { vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
  // a wide gaussian, one direction at a time, used once on the sky photograph
  const GAUSS_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uDir; uniform float uLin;
void main() {
  vec3 s = vec3(0.); float n = 0.;
  for (int i = -24; i <= 24; i++) { float w = exp(-float(i * i) / 220.); vec3 c = texture(uSrc, vUv + uDir * float(i)).rgb; s += (uLin > .5 ? pow(c, vec3(2.2)) : c) * w; n += w; }
  o = vec4(s / n, 1.);
}`;
  const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 o0; layout(location = 1) out vec4 o1;
uniform float uT, uEnc, uBlur; uniform vec2 uPar, uPPar, uRes;
${COMMON}
void main() {
  vec2 uv = vUv + uPar;
  // the clouds drift and slowly change shape (two offset layers of the same photograph, crossfaded)
  float t = uT * .004;
  vec2 w = vec2(n2(uv * 2.3 + uT * .02), n2(uv * 2.3 - uT * .017 + 7.)) - .5;
  vec3 c = skyAt(uv + vec2(t, 0.) + w * .014, 0.);
  o0 = vec4(c * 1.04 * uEnc, 1.);
  vec2 v = (uPar - uPPar) * 2.;
  o1 = vec4(clamp(v * 4. + .5, 0., 1.), 1., 0.);
}`;

  // the paper: positions come from the simulation every frame
  const PAPER_VS = `#version 300 es
in vec3 aP; in vec3 aQ; in vec3 aN; in vec2 aUv;
uniform mat4 uVP, uPVP;
out vec3 vP; out vec3 vN; out vec2 vUv; out vec4 vCur, vPrev; out vec4 vScr;
void main() { vP = aP; vN = aN; vUv = aUv; vCur = uVP * vec4(aP, 1.); vPrev = uPVP * vec4(aQ, 1.); vScr = vCur; gl_Position = vCur; }`;
  const PAPER_FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec2 vUv; in vec4 vScr;
uniform sampler2D uTex; uniform float uDev, uHas, uSeed; uniform vec2 uBorder; uniform vec4 uPeg0, uPeg1; uniform vec3 uFocus;
${COMMON}
${ENC}
// the shadow a peg throws on the sheet: a soft capsule, offset away from the sun
float pegShadow(vec4 pg) {
  vec2 off = -uSun.xy / max(uSun.z, .2) * .035;
  vec2 a = pg.xy + off, b = pg.zw + off, pa = vP.xy - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.), d = length(pa - ba * h);
  return smoothstep(.018, .042, d);
}
void main() {
  vec3 paper = vec3(.86, .855, .83);
  vec2 iuv = (vUv - uBorder) / (1. - 2. * uBorder);
  float inImg = step(0., iuv.x) * step(iuv.x, 1.) * step(0., iuv.y) * step(iuv.y, 1.);
  vec3 alb = paper; float rough = .62, gloss = .12, dens = 0.;
  bool front = gl_FrontFacing;
  if (front && inImg > .5 && uHas > .5) {
    vec3 c = toLin(texture(uTex, vec2(iuv.x, 1. - iuv.y)).rgb);
    float lum = dot(c, vec3(.2126, .7152, .0722)), D = 1. - pow(lum, 1. / 2.2);
    // developing: the shadows come first, then the greys, a little unevenly over the sheet; then the colour
    float k = uDev / .62 + (n2(iuv * 3.1 + uSeed) - .5) * .22;
    float e = smoothstep(0., 1., k * 1.6 - (1. - D) * .9);
    vec3 grey = paper * pow(1. - D * e, 2.2);
    alb = mix(grey, c * paper * 1.1, smoothstep(.62, 1., uDev));
    rough = .2; gloss = .9; dens = D * e;
  } else if (!front) { alb = paper * .96; }
  // drying paper is never quite flat: a faint cockle in the surface
  vec3 N = normalize(vN + vec3(n2(vUv * 9. + uSeed) - .5, n2(vUv * 9. - uSeed) - .5, 0.) * .05);
  float sh = pegShadow(uPeg0) * pegShadow(uPeg1);
  vec3 col = light(vP, N, alb, rough, gloss, sh);
  // thin paper against a bright sky: the light comes through it, less where the image is dark
  vec2 suv = vScr.xy / vScr.w * .5 + .5;
  float back = max(dot(-normalize(vN) * (front ? 1. : -1.), uSun), 0.);
  col += (skyAt(suv, 4.) * .16 + uSunCol * back * .22) * paper * (1. - dens * .85);
  put(col, vScr.w);
}`;

  // the rope: a ribbon facing the camera, shaded as a twisted cylinder
  const ROPE_VS = `#version 300 es
in vec3 aP; in vec3 aQ; in vec3 aN; in vec2 aUv;
uniform mat4 uVP, uPVP;
out vec3 vP; out vec3 vN; out vec2 vUv; out vec4 vCur, vPrev;
void main() { vP = aP; vN = aN; vUv = aUv; vCur = uVP * vec4(aP, 1.); vPrev = uPVP * vec4(aQ, 1.); gl_Position = vCur; }`;
  const ROPE_FS = `#version 300 es
precision highp float;
in vec3 vP; in vec3 vN; in vec2 vUv;
${COMMON}
${ENC}
void main() {
  // vUv.x: along the rope (units), vUv.y: across, -1..1; vN carries the side vector
  float a = vUv.y, b = sqrt(max(0., 1. - a * a));
  vec3 V = normalize(uEye - vP), S = normalize(vN), N = normalize(S * a + V * b);
  // three strands twisted together, and the fuzz of cotton
  float tw = fract(vUv.x * 52. + a * .55);
  float groove = smoothstep(.0, .18, tw) * smoothstep(1., .82, tw);
  vec3 alb = vec3(.5, .47, .41) * (.55 + .45 * groove) * (.9 + .2 * n2(vUv * vec2(400., 3.)));
  vec3 col = light(vP, N, alb, .85, .05, 1.) * (.6 + .4 * b);
  put(col, length(uEye - vP));
}`;

  // the pegs: traced per pixel inside a box, beech wood and a steel spring
  const PEG_VS = `#version 300 es
in vec3 aP;
uniform mat4 uVP, uPVP, uM, uPM; uniform vec3 uHalf;
out vec3 vO; out vec4 vCur, vPrev;
void main() { vec3 o = aP * 2. * uHalf; vO = o; vCur = uVP * uM * vec4(o, 1.); vPrev = uPVP * uPM * vec4(o, 1.); gl_Position = vCur; }`;
  const PEG_FS = `#version 300 es
precision highp float;
in vec3 vO;
uniform mat4 uM; uniform vec3 uCamO, uHalf; uniform float uSeed;
${COMMON}
${ENC}
float sdRB(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r; }
float mat = 0.;
float map(vec3 p) {
  // two legs side by side, a little slimmer towards the tip, with the notch where the cord sits
  float wy = mix(.016, .026, smoothstep(-.17, -.03, p.y)) - .004 * smoothstep(.09, .18, p.y);
  float tz = .0118 - .005 * smoothstep(-.08, -.18, p.y);
  vec3 q = vec3(p.x * (.026 / wy), p.y, p.z);
  vec3 b = vec3(.026, .175, tz);
  float legs = min(sdRB(q - vec3(0., 0., .0135), b, .0055), sdRB(q - vec3(0., 0., -.0135), b, .0055)) * .62;
  legs = max(legs, -(length(p.yz - vec2(-.06, 0.)) - .0118));
  // the steel spring wound round both legs
  float spring = max(abs(length(p.yz - vec2(.03, 0.)) - .0262) - .0028, abs(p.x) - .02);
  mat = spring < legs ? 1. : 0.;
  return min(legs, spring);
}
void main() {
  vec3 ro = uCamO, rd = normalize(vO - uCamO);
  // into the box, then along the ray to the surface
  vec3 inv = 1. / rd, t0 = (-uHalf - ro) * inv, t1 = (uHalf - ro) * inv, tn = min(t0, t1), tf = max(t0, t1);
  float t = max(max(tn.x, tn.y), tn.z), te = min(min(tf.x, tf.y), tf.z);
  if (te < t) discard;
  bool hit = false;
  for (int i = 0; i < 64; i++) { float d = map(ro + rd * t); if (d < .0003) { hit = true; break; } t += d; if (t > te) break; }
  if (!hit) discard;
  vec3 p = ro + rd * t;
  float m = mat;
  vec2 e = vec2(.0006, 0.);
  vec3 n = normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
  vec3 wp = (uM * vec4(p, 1.)).xyz, wn = normalize(mat3(uM) * n);
  vec3 alb; float rough, gloss;
  if (m > .5) { float coil = .6 + .4 * sin(p.x * 900.); alb = vec3(.55, .56, .58) * coil; rough = .3; gloss = 1.; }
  else {
    float g = smoothstep(.2, .9, sin(p.y * 180. + n2(p.xy * vec2(30., 5.) + uSeed) * 7.) * .5 + .5);
    vec3 w0 = mix(vec3(.56, .45, .34), vec3(.5, .47, .42), fract(uSeed * .37)), w1 = w0 * vec3(1.18, 1.14, 1.1);
    alb = toLin(mix(w0, w1, g * .45 + .25 * n2(p.yz * 300.) + .2 * n2(p.xy * vec2(9., 2.) + uSeed)));
    alb *= .82 + .18 * smoothstep(.17, .12, abs(p.y));                // the ends darker, handled and weathered
    rough = .7; gloss = .08;
  }
  // a touch of occlusion where the legs meet
  float ao = (.5 + .5 * smoothstep(0., .004, abs(p.z) - .0015)) * (.75 + .25 * smoothstep(-.09, -.03, p.y));
  vec3 col = light(wp, wn, alb, rough, gloss, 1.) * ao;
  vec4 cp = uVP * vec4(wp, 1.);
  gl_FragDepth = cp.z / cp.w * .5 + .5;
  put(col, length(uEye - wp));
}`;

  // the camera, 1: motion blur, from how far each pixel moved since the last frame
  const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uCol, uVel; uniform vec2 uRes; uniform float uShutter;
void main() {
  vec2 v = (texture(uVel, vUv).xy - .5) / 4. * .5 * uShutter;     // ndc → uv, half a frame of shutter
  float len = length(v * uRes);
  if (len > 40.) v *= 40. / len;
  vec4 c = texture(uCol, vUv);
  if (len < .5) { o = c; return; }
  vec3 s = c.rgb; float n = 1.;
  for (int i = 1; i <= 7; i++) { float k = float(i) / 7. - .5; s += texture(uCol, vUv + v * k).rgb; n += 1.; }
  o = vec4(s / n, 1.);
}`;
  // the camera, 2: depth of field, bloom, the film
  const FINAL_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uCol, uVel; uniform vec2 uRes; uniform float uT, uFocus, uAperture, uEnc, uGrain, uBloom, uVig, uFade, uSat;
float h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 filmic(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
float coc(vec2 uv) { vec4 v = texture(uVel, uv); if (v.w < .5) return 0.; float z = v.z * 10.; return clamp(abs(1. - uFocus / max(z, .1)) * uAperture, 0., 14.); }
void main() {
  vec2 uv = vUv, px = 1. / uRes;
  float r = coc(uv);
  vec3 col = texture(uCol, uv).rgb;
  if (r > .6) {
    // a gather over a disc: each sample counts as far as its own blur reaches this pixel
    vec3 s = col; float n = 1.;
    for (int i = 0; i < 20; i++) {
      float a = float(i) * 2.39996, d = sqrt((float(i) + .5) / 20.);
      vec2 q = uv + vec2(cos(a), sin(a)) * d * r * px;
      float rq = coc(q), w = smoothstep(d * r - 1., d * r, max(rq, r * .5));
      s += texture(uCol, q).rgb * w; n += w;
    }
    col = s / n;
  }
  col /= uEnc;
  vec3 bl = max(textureLod(uCol, uv, 3.).rgb / uEnc - .85, 0.) * .45 + max(textureLod(uCol, uv, 5.).rgb / uEnc - .6, 0.) * .35;
  col += bl * uBloom;
  float l = dot(col, vec3(.2126, .7152, .0722));
  col = mix(vec3(l), col, uSat);
  col *= 1. - .32 * smoothstep(.55, 1.05, uv.y);
  col = filmic(col * 1.08);
  vec2 c = uv - .5;
  col *= 1. - uVig * pow(length(c * vec2(1.05, 1.)), 2.4);
  col = pow(col, vec3(1. / 2.2));
  col += (h(gl_FragCoord.xy * .71 + fract(uT * 6.3) * 97.) - .5) * uGrain;
  o = vec4(col * uFade, 1.);
}`;

  // ---------- a sheet of photo paper: a grid of masses held together like card ----------
  const NX = 9, NY = 11, UP = 3, FX = (NX - 1) * UP + 1, FY = (NY - 1) * UP + 1;
  class Sheet {
    constructor(w, h) {
      this.w = w; this.h = h; this.n = NX * NY;
      this.x = new Float32Array(this.n * 3); this.o = new Float32Array(this.n * 3);
      this.dx = w / (NX - 1); this.dy = h / (NY - 1);
      const C = [];
      const add = (a, b, s) => { const ax = a * 3, bx = b * 3; C.push(a, b, s); };
      const id = (i, j) => j * NX + i;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        if (i < NX - 1) add(id(i, j), id(i + 1, j), 1);
        if (j < NY - 1) add(id(i, j), id(i, j + 1), 1);
        if (i < NX - 1 && j < NY - 1) { add(id(i, j), id(i + 1, j + 1), 0.9); add(id(i + 1, j), id(i, j + 1), 0.9); }
        // card resists bending: springs that skip a node, and a few that skip two
        if (i < NX - 2) add(id(i, j), id(i + 2, j), 0.6);
        if (j < NY - 2) add(id(i, j), id(i, j + 2), 0.42);
        if (i < NX - 3 && j % 2 === 0) add(id(i, j), id(i + 3, j), 0.3);
      }
      this.c = new Float32Array(C.length / 3 * 4);
      for (let k = 0, q = 0; k < C.length; k += 3, q += 4) { this.c[q] = C[k]; this.c[q + 1] = C[k + 1]; this.c[q + 2] = C[k + 2]; }
      this.pins = [1, NX - 2];
      this.f = new Float32Array(FX * FY * 3); this.fp = new Float32Array(FX * FY * 3); this.fn = new Float32Array(FX * FY * 3);
      this.tmp = new Float32Array(FX * NY * 3);
    }
    place(px, py, pz) {
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = (j * NX + i) * 3; this.x[k] = px - this.w / 2 + i * this.dx; this.x[k + 1] = py - j * this.dy; this.x[k + 2] = pz; }
      this.o.set(this.x);
      for (let k = 0; k < this.c.length; k += 4) { const a = this.c[k] * 3, b = this.c[k + 1] * 3; this.c[k + 3] = Math.hypot(this.x[a] - this.x[b], this.x[a + 1] - this.x[b + 1], this.x[a + 2] - this.x[b + 2]); }
    }
    // one step: inertia, gravity, the wind on every face of the sheet, then the paper holding together
    step(dt, pinA, pinB, wind, lift) {
      const x = this.x, o = this.o, n = this.n, g = W0.g, dt2 = dt * dt;
      this.t = (this.t || Math.random() * 100) + dt;
      // the wind: pressure on each cell, by how squarely it faces the moving air
      const F = this.F || (this.F = new Float32Array(n * 3)); F.fill(0);
      for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const a = (j * NX + i) * 3, b = a + 3, c = a + NX * 3, d = c + 3;
        const ux = x[d] - x[a], uy = x[d + 1] - x[a + 1], uz = x[d + 2] - x[a + 2], vx = x[c] - x[b], vy = x[c + 1] - x[b + 1], vz = x[c + 2] - x[b + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const area = Math.hypot(nx, ny, nz) * 0.5 || 1e-6; nx /= area * 2; ny /= area * 2; nz /= area * 2;
        // the air relative to this bit of paper
        const vxp = (x[a] - o[a] + x[d] - o[d]) / (2 * dt), vyp = (x[a + 1] - o[a + 1] + x[d + 1] - o[d + 1]) / (2 * dt), vzp = (x[a + 2] - o[a + 2] + x[d + 2] - o[d + 2]) / (2 * dt);
        const tb = 1 + 0.7 * noise(x[a] * 4.1 + x[a + 1] * 2.3 + this.t * 3.1) + 0.35 * noise(x[a + 1] * 7.3 - this.t * 5.7);
        const rx = wind[0] * tb - vxp, ry = wind[1] * tb - vyp, rz = wind[2] * tb - vzp, vn = rx * nx + ry * ny + rz * nz;
        const p = 0.45 * vn * Math.abs(vn) + 1.3 * vn, f = p / 4;
        for (const q of [a, b, c, d]) { F[q] += nx * f; F[q + 1] += ny * f; F[q + 2] += nz * f; }
      }
      for (let k = 0; k < n * 3; k += 3) {
        const j = Math.floor(k / 3 / NX), lz = lift * Math.pow(j / (NY - 1), 1.5) * 22;
        for (let c = 0; c < 3; c++) {
          const v = (x[k + c] - o[k + c]) * 0.994, acc = F[k + c] + (c === 1 ? -g : c === 2 ? lz : 0);
          o[k + c] = x[k + c]; x[k + c] += v + acc * dt2;
        }
      }
      const C = this.c, pin = (i, P) => { const a = i * 3, b = (NX + i) * 3; x[a] = P[0]; x[a + 1] = P[1]; x[a + 2] = P[2]; x[b] = P[0]; x[b + 1] = P[1] - this.dy; x[b + 2] = P[2]; };
      for (let it = 0; it < 9; it++) {
        for (let k = 0; k < C.length; k += 4) {
          const a = C[k] * 3, b = C[k + 1] * 3, s = C[k + 2], r = C[k + 3];
          const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2], l = Math.hypot(dx, dy, dz) || 1e-6;
          const m = ((l - r) / l) * 0.5 * s;
          x[a] += dx * m; x[a + 1] += dy * m; x[a + 2] += dz * m; x[b] -= dx * m; x[b + 1] -= dy * m; x[b + 2] -= dz * m;
        }
        pin(this.pins[0], pinA); pin(this.pins[1], pinB);
      }
    }
    // the drawn sheet: the grid smoothed with Catmull-Rom, three times finer, with normals
    refine() {
      const x = this.x, T = this.tmp, f = this.f, fn = this.fn;
      this.fp.set(f);
      const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
      const at = (arr, w, i, j, c, ni) => { const ii = Math.max(0, Math.min(ni - 1, i)); let v = arr[(j * w + ii) * 3 + c]; if (i < 0) v = 2 * arr[(j * w) * 3 + c] - arr[(j * w + 1) * 3 + c]; if (i >= ni) v = 2 * arr[(j * w + ni - 1) * 3 + c] - arr[(j * w + ni - 2) * 3 + c]; return v; };
      for (let j = 0; j < NY; j++) for (let fi = 0; fi < FX; fi++) {
        const i = Math.min(NX - 2, Math.floor(fi / UP)), t = fi / UP - i;
        for (let c = 0; c < 3; c++) T[(j * FX + fi) * 3 + c] = cr(at(x, NX, i - 1, j, c, NX), at(x, NX, i, j, c, NX), at(x, NX, i + 1, j, c, NX), at(x, NX, i + 2, j, c, NX), t);
      }
      const atY = (j, fi, c) => { if (j < 0) return 2 * T[fi * 3 + c] - T[(FX + fi) * 3 + c]; if (j >= NY) return 2 * T[((NY - 1) * FX + fi) * 3 + c] - T[((NY - 2) * FX + fi) * 3 + c]; return T[(j * FX + fi) * 3 + c]; };
      for (let fj = 0; fj < FY; fj++) {
        const j = Math.min(NY - 2, Math.floor(fj / UP)), t = fj / UP - j;
        for (let fi = 0; fi < FX; fi++) for (let c = 0; c < 3; c++) f[(fj * FX + fi) * 3 + c] = cr(atY(j - 1, fi, c), atY(j, fi, c), atY(j + 1, fi, c), atY(j + 2, fi, c), t);
      }
      for (let fj = 0; fj < FY; fj++) for (let fi = 0; fi < FX; fi++) {
        const L = Math.max(0, fi - 1), R = Math.min(FX - 1, fi + 1), U = Math.max(0, fj - 1), D = Math.min(FY - 1, fj + 1);
        const a = (fj * FX + R) * 3, b = (fj * FX + L) * 3, c = (U * FX + fi) * 3, d = (D * FX + fi) * 3;
        const ux = f[a] - f[b], uy = f[a + 1] - f[b + 1], uz = f[a + 2] - f[b + 2], vx = f[c] - f[d], vy = f[c + 1] - f[d + 1], vz = f[c + 2] - f[d + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
        const k = (fj * FX + fi) * 3; fn[k] = nx / l; fn[k + 1] = ny / l; fn[k + 2] = nz / l;
      }
      if (!this.refined) { this.fp.set(f); this.refined = true; }
    }
  }

  class Clothesline {
    static get supported() { try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; } }
    constructor(canvas, items, opts = {}) {
      this.c = canvas; this.items = items; this.reduce = !!opts.reduce;
      const gl = (this.gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" }));
      if (!gl) return;
      this.hf = !!gl.getExtension("EXT_color_buffer_float") && !!gl.getExtension("OES_texture_float_linear");
      this.enc = this.hf ? 1 : 0.5;
      this.pSky = this.prog(QUAD, SKY_FS); this.pPaper = this.prog(PAPER_VS, PAPER_FS); this.pRope = this.prog(ROPE_VS, ROPE_FS);
      this.pPeg = this.prog(PEG_VS, PEG_FS); this.pGauss = this.prog(QUAD, GAUSS_FS); this.pBlur = this.prog(QUAD, BLUR_FS); this.pFinal = this.prog(QUAD, FINAL_FS);
      if (![this.pSky, this.pPaper, this.pRope, this.pPeg, this.pBlur, this.pFinal].every(Boolean)) return;
      this.ok = true;
      this.geo();
      this.p = 0; this.pv = 0; this.off = 0; this.v = 0; this.a = 0; this.last = 0; this.acc = 0;
      this.mx = 0; this.my = 0; this.cmx = 0; this.cmy = 0; this.hover = -1; this.fade = 1;
      this.active = false; this.t0 = performance.now(); this.scale = 1; this.ema = 16; this.slow = 0;
      this.wind = { v: 0, gust: 0, next: 4, t: 0 };
      // the cord's own bounce: a vibrating string sampled across the view, up-down and to-and-fro
      this.RN = 120; this.ry = new Float32Array(this.RN); this.rvy = new Float32Array(this.RN); this.rz = new Float32Array(this.RN); this.rvz = new Float32Array(this.RN);
      let x = 0; const GAP = 0.36;
      this.P = items.map((it, i) => {
        const ar = it.ar || 0.8, hgt = ar >= 1 ? 0.8 : 1.0, wid = hgt * ar;
        if (i) x += GAP + wid / 2; const at = x; x += wid / 2;
        const p = { ...it, i, w: wid, h: hgt, at, dev: 0, seen: 0, lift: 0, seed: rnd() * 50, tex: null, has: 0, sheet: new Sheet(wid, hgt) };
        p.vao = this.sheetVAO(p);
        if (it.img) this.load(p);
        return p;
      });
      this.sky = null;
      if (opts.sky) this.loadSky(opts.sky);
      this.size();
      this.layoutSheets(true);
      this.ro = new ResizeObserver(() => { this.size(); });
      this.ro.observe(canvas);
    }
    prog(vs, fs) {
      const gl = this.gl, mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn("[clothesline]", gl.getShaderInfoLog(x)); return null; } return x; };
      const a = mk(gl.VERTEX_SHADER, vs), b = mk(gl.FRAGMENT_SHADER, fs);
      if (!a || !b) return null;
      const p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b);
      ["p", "aP"].forEach((n) => gl.bindAttribLocation(p, 0, n)); gl.bindAttribLocation(p, 1, "aQ"); gl.bindAttribLocation(p, 2, "aN"); gl.bindAttribLocation(p, 3, "aUv");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn("[clothesline]", gl.getProgramInfoLog(p)); return null; }
      p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); p.u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name); }
      return p;
    }
    geo() {
      const gl = this.gl;
      this.vQuad = gl.createVertexArray(); gl.bindVertexArray(this.vQuad);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      // the sheet's fine grid: shared indices and texture coordinates
      const idx = [], uv = [];
      for (let j = 0; j < FY; j++) for (let i = 0; i < FX; i++) uv.push(i / (FX - 1), j / (FY - 1));
      for (let j = 0; j < FY - 1; j++) for (let i = 0; i < FX - 1; i++) { const a = j * FX + i, b = a + 1, c = a + FX, d = c + 1; idx.push(a, c, b, b, c, d); }
      this.iSheet = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iSheet); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
      this.nSheet = idx.length;
      this.uvSheet = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.uvSheet); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
      // a unit cube (the pegs' bounding box)
      const P = [];
      const F = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
      for (const n of F) {
        const u = n[0] ? [0, 1, 0] : [1, 0, 0], w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
        const q = (s, t) => [0.5 * (n[0] + s * u[0] + t * w[0]), 0.5 * (n[1] + s * u[1] + t * w[1]), 0.5 * (n[2] + s * u[2] + t * w[2])];
        for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) P.push(...q(s, t));
      }
      this.vBox = gl.createVertexArray(); gl.bindVertexArray(this.vBox);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      // the rope ribbon: position, previous position, side vector, (along, across)
      this.RS = 220;
      this.ropeData = new Float32Array((this.RS + 1) * 2 * 11);
      this.vRope = gl.createVertexArray(); gl.bindVertexArray(this.vRope);
      this.bRope = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.bRope); gl.bufferData(gl.ARRAY_BUFFER, this.ropeData.byteLength, gl.DYNAMIC_DRAW);
      [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 2, 36]].forEach(([l, n, o]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 44, o); });
      gl.bindVertexArray(null);
    }
    sheetVAO(p) {
      const gl = this.gl, vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      p.buf = gl.createBuffer(); p.data = new Float32Array(FX * FY * 9);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.buf); gl.bufferData(gl.ARRAY_BUFFER, p.data.byteLength, gl.DYNAMIC_DRAW);
      [[0, 0], [1, 12], [2, 24]].forEach(([l, o]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 36, o); });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvSheet); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iSheet);
      gl.bindVertexArray(null);
      return vao;
    }
    tex(im, mips = true) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      if (mips) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const af = gl.getExtension("EXT_texture_filter_anisotropic"); if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, 4);
      return t;
    }
    load(p) {
      const im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async";
      im.onload = () => { p.tex = this.tex(im); p.has = 1; if (!this.active) this.draw(performance.now()); };
      im.src = p.img;
    }
    loadSky(src) {
      const im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async";
      im.onload = () => { this.skyAR = im.naturalWidth / im.naturalHeight; this.sky = this.blurSky(this.tex(im)); if (!this.active) this.draw(performance.now()); if (this.onReady) this.onReady(); };
      im.src = src;
    }
    // the sky, out of focus: two passes of a wide gaussian at a modest size, kept with its mipmaps for the reflections
    blurSky(src) {
      const gl = this.gl, W = 1280, H = Math.round(W / (this.skyAR || 1.5)), F = this.hf ? gl.RGBA16F : gl.RGBA8;
      const a = this.target(F, W, H), b = this.target(F, W, H, Math.floor(Math.log2(W)) + 1);
      gl.bindTexture(gl.TEXTURE_2D, b); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
      const fb = gl.createFramebuffer(), pr = this.pGauss;
      gl.useProgram(pr); gl.bindVertexArray(this.vQuad); gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST); gl.uniform1i(pr.u.uSrc, 0); gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, a, 0);
      gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform2f(pr.u.uDir, 1.5 / W, 0); gl.uniform1f(pr.u.uLin, 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, b, 0);
      gl.bindTexture(gl.TEXTURE_2D, a); gl.uniform2f(pr.u.uDir, 0, 1.5 / H); gl.uniform1f(pr.u.uLin, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(a); gl.deleteTexture(src);
      gl.bindTexture(gl.TEXTURE_2D, b); gl.generateMipmap(gl.TEXTURE_2D);
      return b;
    }
    target(fmt, W, H, levels = 1) {
      const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, levels, fmt, W, H);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, levels > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    size() {
      const gl = this.gl, c = this.c;
      const cw = c.clientWidth, ch = c.clientHeight;
      if (!cw || !ch) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * this.scale;
      const W = Math.max(2, Math.round(cw * dpr)), H = Math.max(2, Math.round(ch * dpr));
      const was = this.aspect;
      this.cw = cw; this.ch = ch; this.aspect = cw / ch;
      if (W === this.W && H === this.H) return;
      this.W = c.width = W; this.H = c.height = H;
      for (const k of ["tCol", "tVel", "tBlur"]) if (this[k]) gl.deleteTexture(this[k]);
      if (this.rDep) gl.deleteRenderbuffer(this.rDep);
      for (const k of ["fScene", "fBlur"]) if (this[k]) gl.deleteFramebuffer(this[k]);
      const CF = this.hf ? gl.RGBA16F : gl.RGBA8, levels = Math.floor(Math.log2(Math.max(W, H))) + 1;
      this.tCol = this.target(CF, W, H); this.tVel = this.target(gl.RGBA8, W, H); this.tBlur = this.target(CF, W, H, Math.min(levels, 7));
      this.rDep = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, this.rDep); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
      this.fScene = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fScene);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tCol, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.tVel, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.rDep);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      this.fBlur = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fBlur);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tBlur, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!was || Math.abs(was - this.aspect) > 0.01) this.layoutSheets(true);
      if (!this.active) this.draw(performance.now());
    }

    // ---------- the cord ----------
    get k() { return this.aspect < 0.9 ? Math.min(1.05, 0.5 + this.aspect * 0.62) : 1; }
    span() { return this.aspect * 1.75 + 0.8; }
    cordY(x) { return W0.lineY * (this.aspect < 0.9 ? 0.86 : 1) + W0.sag * x * x + this.bounce(this.ry, x); }
    cordZ(x) { return -W0.depth * x * x + this.bounce(this.rz, x); }
    bounce(arr, x) { const X = this.span(), f = ((x + X) / (2 * X)) * (this.RN - 1); if (f <= 0 || f >= this.RN - 1) return 0; const i = Math.floor(f), t = f - i; return arr[i] * (1 - t) + arr[i + 1] * t; }
    offsetFor(p) {
      const P = this.P, i = Math.max(0, Math.min(P.length - 1, Math.floor(p))), j = Math.min(P.length - 1, i + 1), f = Math.max(0, Math.min(1, p - i));
      return (P[i].at + (P[j].at - P[i].at) * f) * this.k;
    }
    // where the two pegs of a print grip it, in the world
    pins(p) {
      const k = Math.min(this.k, (this.aspect * 2 * 0.84) / p.w), cx = p.at * this.k - this.off;
      const s = p.sheet, ax = cx - s.w / 2 + s.dx * s.pins[0], bx = cx - s.w / 2 + s.dx * s.pins[1];
      const dr = W0.pegDrop * (p.k || 1);
      return [[ax, this.cordY(ax) - dr, this.cordZ(ax)], [bx, this.cordY(bx) - dr, this.cordZ(bx)]];
    }
    layoutSheets(force) {
      if (!this.aspect || !this.P) return;
      for (const p of this.P) {
        const k = Math.min(this.k, (this.aspect * 2 * 0.84) / p.w);
        if (!force && p.k === k) continue;
        // a new size of screen: the sheet is cut again at its new scale and hung straight
        p.k = k; p.sheet = new Sheet(p.w * k, p.h * k);
        const [A] = this.pins(p), cx = p.at * this.k - this.off;
        p.sheet.place(cx, A[1], A[2]);
        p.sheet.refined = false;
        for (let i = 0; i < 90; i++) this.simulate(p, 1 / 120, true);
      }
    }
    simulate(p, dt, calm) {
      const [A, B] = this.pins(p), w = this.wind, cx = p.at * this.k - this.off, t = this.tw || 0;
      // the gust travels down the line: each print feels it a moment after the one upwind of it
      const local = calm ? 0 : (0.55 + 0.45 * noise(cx * 0.9 - t * 1.3 + p.seed)) * (w.v + w.gust * (0.6 + 0.4 * noise(cx * 0.5 - t * 2.1)));
      const wind = [this.reduce ? 0 : (local * 2.6 - this.v * 0.75), this.reduce ? 0 : local * 0.6, this.reduce ? 0 : local * 5.2 + 0.6];
      p.sheet.step(dt, A, B, wind, this.hover === p.i ? 1 : 0);
    }

    // ---------- input ----------
    setProgress(p) { this.p = p; }
    pointer(x, y) { this.mx = x; this.my = y; }
    hit(px, py) {
      if (!this.VP) return -1;
      const ndc = [(px / this.cw) * 2 - 1, 1 - (py / this.ch) * 2];
      let best = -1, bd = Infinity;
      for (const p of this.P) {
        const r = this.rectOf(p.i); if (!r) continue;
        if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) { const d = Math.abs((r.left + r.right) / 2 - px); if (d < bd) { bd = d; best = p.i; } }
      }
      return best;
    }
    rectOf(i) {
      const p = this.P[i];
      if (!p || !this.VP || !p.sheet.refined) return null;
      const f = p.sheet.f; let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      for (let k = 0; k < f.length; k += 3 * 7) {
        const q = M.xf(this.VP, [f[k], f[k + 1], f[k + 2]]), x = (q[0] * 0.5 + 0.5) * this.cw, y = (0.5 - q[1] * 0.5) * this.ch;
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
      }
      return { left: l, top: t, right: r, bottom: b };
    }

    // ---------- time ----------
    tick(now) {
      if (!this.ok || !this.active) return;
      if (now - this.last < 12) return; // at most sixty frames a second, also on 120 Hz screens
      this.step(now);
      this.draw(now);
    }
    still(dev) { if (!this.ok) return; if (dev && this.P[0]) this.P[0].dev = 1; this.draw(performance.now()); }
    step(now) {
      const fdt = now - (this.last || now - 16), dt = Math.min(0.05, Math.max(0.001, fdt / 1000));
      this.last = now;
      // a machine that cannot keep up gets a lighter frame, quietly
      this.ema += (fdt - this.ema) * 0.05;
      if (this.ema > 24 && this.scale > 0.6) { if (++this.slow > 90) { this.slow = 0; this.scale = Math.max(0.6, this.scale * 0.85); this.W = 0; this.size(); } } else this.slow = 0;
      const R = this.reduce;
      this.pv += (this.p - this.pv) * (R ? 1 : 1 - Math.exp(-dt * 8));
      const off = this.offsetFor(this.pv), v = (off - this.off) / dt;
      this.a += ((v - this.v) / dt - this.a) * (1 - Math.exp(-dt * 14));
      this.v = v; this.off = off;
      this.cmx += (this.mx - this.cmx) * (1 - Math.exp(-dt * 2)); this.cmy += (this.my - this.cmy) * (1 - Math.exp(-dt * 2));
      this.fade += (1 - this.fade) * (1 - Math.exp(-dt * 1.6));
      // the wind: a restless breeze with gusts now and then, like on the landing
      const w = this.wind; w.t += dt; this.tw = (this.tw || 0) + dt;
      w.v = 0.55 + 0.35 * noise(this.tw * 0.23) + 0.2 * noise(this.tw * 0.9 + 4);
      if (w.t > w.next) { w.t = 0; w.next = 7 + rnd() * 14; w.peak = 1 + rnd() * 1.4; w.gt = 0; }
      if (w.peak) { w.gt += dt; const g = w.gt < 1.2 ? w.gt / 1.2 : Math.exp(-(w.gt - 1.2) * 0.9); w.gust = w.peak * g; if (w.gt > 6) w.peak = 0; } else w.gust *= 0.98;
      // the cord bounces: pulling it shakes it, the gusts sway it
      const RN = this.RN, X = this.span(), h = (2 * X) / (RN - 1), c2 = 900, kick = R ? 0 : Math.max(-30, Math.min(30, this.a)) * 0.0016;
      for (let s = 0; s < 2; s++) {
        const d = dt / 2;
        for (let i = 1; i < RN - 1; i++) {
          const ly = (this.ry[i - 1] - 2 * this.ry[i] + this.ry[i + 1]) / (h * h), lz = (this.rz[i - 1] - 2 * this.rz[i] + this.rz[i + 1]) / (h * h);
          const env = Math.sin((i / (RN - 1)) * Math.PI);
          this.rvy[i] += (c2 * ly * 0.004 - this.rvy[i] * 3.2 - this.ry[i] * 40 + kick * env * 30 * Math.sin(i * 0.7 + this.tw * 9)) * d;
          this.rvz[i] += (c2 * lz * 0.004 - this.rvz[i] * 2.4 - this.rz[i] * 30 + (R ? 0 : (w.v * 0.3 + w.gust) * env * 0.35 * (0.6 + 0.4 * noise(i * 0.08 - this.tw)))) * d;
        }
        for (let i = 1; i < RN - 1; i++) { this.ry[i] += this.rvy[i] * d; this.rz[i] += this.rvz[i] * d; }
      }
      // the paper: two substeps a frame
      for (const p of this.P) {
        const cx = p.at * this.k - this.off, near = Math.abs(cx) < this.aspect * 2.2 + 1;
        p.lift += ((this.hover === p.i ? 1 : 0) - p.lift) * (1 - Math.exp(-dt * 5));
        if (near) { const n = dt > 0.025 ? 3 : 2; for (let s = 0; s < n; s++) this.simulate(p, dt / n); }
        else { const [A] = this.pins(p); p.sheet.place(cx, A[1], A[2]); p.sheet.refined = false; }
        // developing: in the middle it comes up in a couple of seconds; away from it the colour fades, the black and white stays
        const d = Math.abs(p.i - this.pv);
        if (d < 0.32) { p.dev = Math.min(1, p.dev + dt * (R ? 9 : 0.5 * (1.15 - d))); p.seen = 1; }
        else if (p.seen) p.dev += (0.62 - p.dev) * (1 - Math.exp(-dt * (p.dev > 0.62 ? 0.4 : 2)));
      }
    }

    draw(now) {
      const gl = this.gl;
      if (!gl || !this.W || (gl.isContextLost && gl.isContextLost())) return;
      const t = (now - this.t0) / 1000;
      const proj = M.persp(W0.fov, this.aspect, 0.1, 40);
      // the camera: held by hand, a breath of movement, and the pointer leaning it a little
      const hx = this.reduce ? 0 : Math.sin(t * 0.37) * 0.006 + Math.sin(t * 0.91 + 1) * 0.003, hy = this.reduce ? 0 : Math.sin(t * 0.29 + 2) * 0.005 + Math.sin(t * 1.13) * 0.002;
      const ex = this.cmx * 0.08 + hx, ey = this.cmy * 0.05 + hy;
      const eye = [ex, ey + 0.02, W0.camZ];
      const VP = M.mul(proj, M.look(eye, [ex * 0.2, ey * 0.2 + 0.05, 0], [Math.sin(t * 0.21) * 0.004, 1, 0]));
      const PVP = this.VP || VP; this.VP = VP;
      const par = [this.cmx * 0.012 + hx * 0.4, this.cmy * 0.008 + hy * 0.4], ppar = this.par || par; this.par = par;
      const common = (pr) => {
        gl.uniform3fv(pr.u.uSun, W0.sun); gl.uniform3fv(pr.u.uSunCol, W0.sunCol); gl.uniform3fv(pr.u.uSkyUp, W0.skyUp); gl.uniform3fv(pr.u.uSkyDown, W0.skyDown);
        gl.uniform3fv(pr.u.uEye, eye); gl.uniform1f(pr.u.uSkyOk, this.sky ? 1 : 0);
        const ar = this.skyAR || 1.5, s = ar > this.aspect ? [this.aspect / ar, 1] : [1, ar / this.aspect];
        gl.uniform2f(pr.u.uSkyFit, s[0] * 0.86, s[1] * 0.86); gl.uniform2f(pr.u.uSkyOff, 0, 0.04);
        gl.uniform1i(pr.u.uSky, 1);
        if (pr.u.uVP) gl.uniformMatrix4fv(pr.u.uVP, false, VP);
        if (pr.u.uPVP) gl.uniformMatrix4fv(pr.u.uPVP, false, PVP);
        if (pr.u.uEnc) gl.uniform1f(pr.u.uEnc, this.enc);
      };
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.sky);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fScene); gl.viewport(0, 0, this.W, this.H);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      // the sky
      let pr = this.pSky; gl.useProgram(pr); common(pr);
      gl.uniform1f(pr.u.uT, t); gl.uniform2fv(pr.u.uPar, par); gl.uniform2fv(pr.u.uPPar, ppar); gl.uniform2f(pr.u.uRes, this.W, this.H); gl.uniform1f(pr.u.uBlur, 0.022);
      gl.bindVertexArray(this.vQuad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT);
      // the rope
      pr = this.pRope; gl.useProgram(pr); common(pr);
      const RS = this.RS, X = this.span(), D = this.ropeData, prevRope = this.ropePrev || null;
      let along = 0, lx = 0, ly = 0, lz = 0;
      for (let i = 0; i <= RS; i++) {
        const x = -X + (2 * X * i) / RS, y = this.cordY(x), z = this.cordZ(x);
        if (i) along += Math.hypot(x - lx, y - ly, z - lz);
        lx = x; ly = y; lz = z;
        // the side vector: across the rope, facing the camera
        const tx = 1, ty = 2 * W0.sag * x, tz = -2 * W0.depth * x, vx = eye[0] - x, vy = eye[1] - y, vz = eye[2] - z;
        let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx; const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl;
        // the rope slides along itself as it is pulled: its twist travels with it
        const s = along + this.off;
        for (let e = 0; e < 2; e++) {
          const a = e ? -1 : 1, o = (i * 2 + e) * 11, r = W0.rope;
          D[o] = x + sx * r * a; D[o + 1] = y + sy * r * a; D[o + 2] = z + sz * r * a;
          const q = prevRope ? prevRope : null;
          D[o + 3] = q ? q[o] : D[o]; D[o + 4] = q ? q[o + 1] : D[o + 1]; D[o + 5] = q ? q[o + 2] : D[o + 2];
          D[o + 6] = sx; D[o + 7] = sy; D[o + 8] = sz; D[o + 9] = s; D[o + 10] = a;
        }
      }
      // the previous frame's rope moved along with the cord, so the blur follows the twist
      this.ropePrev = this.ropePrev || new Float32Array(D.length);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bRope); gl.bufferSubData(gl.ARRAY_BUFFER, 0, D);
      gl.bindVertexArray(this.vRope); gl.drawArrays(gl.TRIANGLE_STRIP, 0, (RS + 1) * 2);
      this.ropePrev.set(D);
      // the prints
      pr = this.pPaper; gl.useProgram(pr); common(pr); gl.uniform1i(pr.u.uTex, 0);
      const pegs = [];
      for (const p of this.P) {
        const cx = p.at * this.k - this.off;
        if (Math.abs(cx) > this.aspect * 1.75 + p.w) continue;
        const s = p.sheet; s.refine();
        const d = p.data, f = s.f, fp = s.fp, fn = s.fn;
        for (let v = 0, n = FX * FY; v < n; v++) { const a = v * 3, o = v * 9; d[o] = f[a]; d[o + 1] = f[a + 1]; d[o + 2] = f[a + 2]; d[o + 3] = fp[a]; d[o + 4] = fp[a + 1]; d[o + 5] = fp[a + 2]; d[o + 6] = fn[a]; d[o + 7] = fn[a + 1]; d[o + 8] = fn[a + 2]; }
        gl.bindBuffer(gl.ARRAY_BUFFER, p.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d);
        // the two pegs: where they stand, and the line of their shadow on the paper
        const [A, B] = this.pins(p), pg = [];
        for (const [P0, col] of [[A, s.pins[0]], [B, s.pins[1]]]) {
          const top = s.x.subarray(col * 3, col * 3 + 3), below = s.x.subarray((2 * NX + col) * 3, (2 * NX + col) * 3 + 3);
          const tilt = Math.atan2(below[2] - top[2], top[1] - below[1]) * 0.8;
          const slope = Math.atan(2 * W0.sag * P0[0]) * 0.5, yaw = Math.atan(-2 * W0.depth * P0[0]);
          const kk = p.k || 1, C = [P0[0], P0[1] + (W0.pegDrop + 0.06) * kk, P0[2]];
          const Mw = M.mul(M.T(...C), M.mul(M.Y(yaw), M.mul(M.X(-tilt), M.mul(M.Z(slope), M.S(kk)))));
          pegs.push({ M: Mw, key: p.i * 2 + pg.length / 4, seed: p.seed + pg.length });
          pg.push(C[0], C[1] + 0.12 * kk, C[0], C[1] - 0.17 * kk);
        }
        gl.uniform4fv(pr.u.uPeg0, pg.slice(0, 4)); gl.uniform4fv(pr.u.uPeg1, pg.slice(4, 8));
        const b = 0.045 / Math.max(p.w, p.h);
        gl.uniform2f(pr.u.uBorder, (b * Math.max(p.w, p.h)) / p.w, (b * Math.max(p.w, p.h)) / p.h);
        gl.uniform1f(pr.u.uDev, p.dev); gl.uniform1f(pr.u.uHas, p.has); gl.uniform1f(pr.u.uSeed, p.seed);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, p.tex || null);
        gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, this.nSheet, gl.UNSIGNED_SHORT, 0);
      }
      // the pegs
      pr = this.pPeg; gl.useProgram(pr); common(pr);
      const half = [0.034, 0.185, 0.032]; gl.uniform3fv(pr.u.uHalf, half);
      gl.bindVertexArray(this.vBox);
      this.pegPrev = this.pegPrev || {};
      for (const g of pegs) {
        gl.uniformMatrix4fv(pr.u.uM, false, g.M); gl.uniformMatrix4fv(pr.u.uPM, false, this.pegPrev[g.key] || g.M);
        gl.uniform3fv(pr.u.uCamO, M.xf(M.inv(g.M), eye)); gl.uniform1f(pr.u.uSeed, g.seed);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
        this.pegPrev[g.key] = g.M;
      }
      gl.disable(gl.DEPTH_TEST);
      // motion blur
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fBlur);
      pr = this.pBlur; gl.useProgram(pr);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tCol); gl.uniform1i(pr.u.uCol, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tVel); gl.uniform1i(pr.u.uVel, 1);
      gl.uniform2f(pr.u.uRes, this.W, this.H); gl.uniform1f(pr.u.uShutter, this.reduce ? 0 : 1);
      gl.bindVertexArray(this.vQuad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tBlur); gl.generateMipmap(gl.TEXTURE_2D);
      // depth of field and the film
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.W, this.H);
      pr = this.pFinal; gl.useProgram(pr);
      gl.uniform1i(pr.u.uCol, 0); gl.uniform1i(pr.u.uVel, 1);
      gl.uniform2f(pr.u.uRes, this.W, this.H); gl.uniform1f(pr.u.uT, t);
      gl.uniform1f(pr.u.uFocus, Math.hypot(eye[0], eye[1] - W0.lineY * 0.3, eye[2])); gl.uniform1f(pr.u.uAperture, (this.H / 900) * 70);
      gl.uniform1f(pr.u.uEnc, this.enc); gl.uniform1f(pr.u.uGrain, 0.055); gl.uniform1f(pr.u.uBloom, 0.8); gl.uniform1f(pr.u.uVig, 0.55); gl.uniform1f(pr.u.uSat, 1.06);
      gl.uniform1f(pr.u.uFade, this.reduce ? 1 : this.fade);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }
  }
  window.Clothesline = Clothesline;
})();
