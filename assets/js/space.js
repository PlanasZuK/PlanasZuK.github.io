/* space.js — the dark space behind the overview, drawn on the graphics card.
   Greys only. Two very soft lights drift across it and a faint cloud breathes through it, so it is never still;
   every pixel is dithered with fresh noise each frame, so even such a dark gradient never shows a single band,
   and the finest grain sits on top. It draws only while the overview is in view, at a calm thirty frames a second. */
(() => {
  const c = document.querySelector(".space canvas");
  if (!c) return;
  const gl = c.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) return;
  const VS = "attribute vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }";
  const FS = `precision highp float;
uniform vec2 uRes; uniform float uT;
float h3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h3(vec3(i, 1.)), h3(vec3(i + vec2(1, 0), 1.)), f.x), mix(h3(vec3(i + vec2(0, 1), 1.)), h3(vec3(i + 1., 1.)), f.x), f.y);
}
void main() {
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float t = uT * .018;
  // two soft lights, wandering on their own slow orbits
  vec2 a = vec2(-.55 + .28 * sin(t * 1.1), .32 + .2 * cos(t * .83));
  vec2 b = vec2(.62 + .22 * cos(t * .71), -.38 + .24 * sin(t * 1.27));
  float v = .0145;
  v += .030 * exp(-dot(p - a, p - a) * 1.5) + .020 * exp(-dot(p - b, p - b) * 1.9);
  // a faint cloud breathing through the dark
  float n = n2(p * 1.2 + vec2(t * .7, -t * .45)) * .6 + n2(p * 2.6 - vec2(t * .35, t * .6)) * .4;
  v += .009 * smoothstep(.2, .9, n);
  // fresh triangular dither every frame (no bands, ever) and the finest grain
  float g = h3(vec3(gl_FragCoord.xy, fract(uT * 3.7) * 311.)) + h3(vec3(gl_FragCoord.yx + 19.7, fract(uT * 2.3) * 173.)) - 1.;
  v += g * (2.2 / 255.);
  gl_FragColor = vec4(vec3(v), 1.);
}`;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(pr, 0, "p"); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(pr, "uRes"), uT = gl.getUniformLocation(pr, "uT");
  const size = () => { const d = Math.min(devicePixelRatio || 1, 1.5); c.width = Math.round(innerWidth * d); c.height = Math.round(innerHeight * d); gl.viewport(0, 0, c.width, c.height); gl.uniform2f(uRes, c.width, c.height); };
  size(); addEventListener("resize", size);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, t0 = performance.now();
  let last = 0;
  const draw = (now) => {
    requestAnimationFrame(draw);
    // only while the overview is in view, at thirty frames a second
    const k = window.__zk || 0; // set by the camera, without asking the browser to recompute styles
    if (k < 0.001 || document.hidden || now - last < 33) return;
    last = now;
    gl.uniform1f(uT, reduce ? 40 : (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  requestAnimationFrame(draw);
})();
