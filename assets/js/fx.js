/* fx.js — one small WebGL image effect used across the site.
   Pictures are printed as a 1-bit ordered dither in ink and paper; a soft lens around the pointer
   (or a global "clean" amount) develops them back into the full-colour photograph.
   Transitions between pictures dissolve through value noise. No dependencies. */
(() => {
  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const FRAG = `
precision highp float;
uniform sampler2D uA, uB;
uniform vec2 uRes, uSizeA, uSizeB, uMouse;
uniform float uMix, uPix, uClean, uLens, uTime, uContrast, uGrain, uColor, uZoom;
uniform vec3 uInk, uPaper;

vec2 cover(vec2 uv, vec2 img) {
  float rs = uRes.x / uRes.y, ri = img.x / max(img.y, 1.);
  vec2 s = rs > ri ? vec2(1., ri / rs) : vec2(rs / ri, 1.);
  return (uv - .5) * s / uZoom + .5;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a) { return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(.5 * a) * .25 + bayer2(a); }
float lum(vec3 c) { return dot(c, vec3(.299, .587, .114)); }

vec3 pick(vec2 uv, float t, float n) {
  float d = sin(uMix * 3.14159);
  vec2 ua = cover(uv + (n - .5) * .05 * d, uSizeA);
  vec2 ub = cover(uv - (n - .5) * .05 * d, uSizeB);
  return mix(texture2D(uA, ua).rgb, texture2D(uB, ub).rgb, t);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / uRes;
  float n = noise(uv * 5. + uTime * .03);
  float t = smoothstep(n - .18, n + .18, uMix * 1.36 - .18);

  // the dithered print, sampled on a coarse cell grid
  vec2 cell = (floor(px / uPix) + .5) * uPix / uRes;
  float l = lum(pick(cell, t, n));
  l = clamp((l - .5) * uContrast + .5, 0., 1.);
  float bit = step(bayer8(px / uPix), l);
  vec3 print = mix(uInk, uPaper, bit);

  // the photograph itself, full resolution
  vec3 photo = pick(uv, t, n);
  vec3 grey = vec3(lum(photo));
  photo = mix(grey, photo, uColor);

  float lens = uLens > 0. ? 1. - smoothstep(uLens * .35, uLens, distance(px, uMouse)) : 0.;
  float k = clamp(uClean + lens, 0., 1.);
  vec3 col = mix(print, photo, k);
  col += (hash(px + fract(uTime) * 91.) - .5) * uGrain;
  gl_FragColor = vec4(col, 1.);
}`;

  const loaders = new Map();
  const loadImage = (src) => {
    if (!loaders.has(src)) loaders.set(src, new Promise((res, rej) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.decoding = "async";
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    }));
    return loaders.get(src);
  };

  const all = new Set();

  class FX {
    constructor(canvas, opts = {}) {
      this.c = canvas;
      this.o = Object.assign({ srcs: [], pix: 3, clean: 0, lens: 0, contrast: 1.25, grain: 0.035, color: 1, zoom: 1, ink: [0.043, 0.043, 0.043], paper: [0.925, 0.922, 0.914], dpr: 1.5 }, opts);
      const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
      if (!gl) { this.dead = true; return; }
      this.gl = gl;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(pr);
      gl.useProgram(pr);
      this.pr = pr;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      for (const k of ["uA", "uB", "uRes", "uSizeA", "uSizeB", "uMouse", "uMix", "uPix", "uClean", "uLens", "uTime", "uContrast", "uGrain", "uColor", "uZoom", "uInk", "uPaper"]) this.u[k] = gl.getUniformLocation(pr, k);
      gl.uniform1i(this.u.uA, 0);
      gl.uniform1i(this.u.uB, 1);
      this.tex = [this.makeTex(), this.makeTex()];
      this.size = [[1, 1], [1, 1]];
      this.state = { mix: 0, clean: this.o.clean, lens: this.o.lens, pix: this.o.pix, zoom: this.o.zoom, color: this.o.color };
      this.mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
      this.index = -1;
      this.visible = true;
      this.ready = false;
      this.t0 = performance.now();
      this.resize();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
      this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { rootMargin: "100px" });
      this.io.observe(canvas);
      all.add(this);
      if (this.o.srcs.length) this.show(0, 0);
    }
    makeTex() {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 20, 255]));
      for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
      return t;
    }
    upload(slot, im) {
      const gl = this.gl;
      gl.activeTexture(slot ? gl.TEXTURE1 : gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[slot]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      this.size[slot] = [im.naturalWidth, im.naturalHeight];
    }
    // show picture i; the current one becomes A, the new one B, and uMix runs 0 → 1
    async show(i, dur = 1.2) {
      if (this.dead || i === this.index) return;
      const src = this.o.srcs[i];
      if (!src) return;
      const token = (this.token = {});
      let im;
      try { im = await loadImage(src); } catch (e) { return; }
      if (token !== this.token || this.dead) return;
      if (this.index < 0 || !dur) {
        this.upload(0, im); this.upload(1, im); this.state.mix = 0;
      } else {
        // whatever is on screen now (the last picture shown) becomes A
        if (this.lastB) this.upload(0, this.lastB);
        this.upload(1, im);
        this.state.mix = 0;
        if (window.gsap) gsap.to(this.state, { mix: 1, duration: dur, ease: "power2.inOut", overwrite: true });
        else this.state.mix = 1;
      }
      this.lastB = im;
      this.index = i;
      this.ready = true;
      this.c.classList.add("is-ready");
    }
    set(k, v) { this.state[k] = v; }
    pointer(clientX, clientY) {
      const r = this.c.getBoundingClientRect();
      this.mouse.tx = ((clientX - r.left) / r.width) * this.w;
      this.mouse.ty = (1 - (clientY - r.top) / r.height) * this.h;
      if (this.mouse.x < -9000) { this.mouse.x = this.mouse.tx; this.mouse.y = this.mouse.ty; }
    }
    leave() { this.mouse.tx = this.mouse.ty = -9999; }
    resize() {
      if (this.dead) return;
      const r = this.c.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, this.o.dpr);
      this.w = Math.max(2, Math.round(r.width * d));
      this.h = Math.max(2, Math.round(r.height * d));
      this.d = d;
      this.c.width = this.w; this.c.height = this.h;
      this.gl.viewport(0, 0, this.w, this.h);
    }
    render(now) {
      if (this.dead || !this.visible || !this.ready || !this.w) return;
      const gl = this.gl, s = this.state, u = this.u, m = this.mouse;
      if (m.tx < -9000) { m.x += (-9999 - m.x) * 0.02; } else { m.x += (m.tx - m.x) * 0.14; m.y += (m.ty - m.y) * 0.14; }
      gl.uniform2f(u.uRes, this.w, this.h);
      gl.uniform2f(u.uSizeA, this.size[0][0], this.size[0][1]);
      gl.uniform2f(u.uSizeB, this.size[1][0], this.size[1][1]);
      gl.uniform2f(u.uMouse, m.tx < -9000 ? -9999 : m.x, m.tx < -9000 ? -9999 : m.y);
      gl.uniform1f(u.uMix, s.mix);
      gl.uniform1f(u.uPix, Math.max(1, s.pix * this.d));
      gl.uniform1f(u.uClean, s.clean);
      gl.uniform1f(u.uLens, s.lens * this.d);
      gl.uniform1f(u.uTime, (now - this.t0) / 1000);
      gl.uniform1f(u.uContrast, this.o.contrast);
      gl.uniform1f(u.uGrain, this.o.grain);
      gl.uniform1f(u.uColor, s.color);
      gl.uniform1f(u.uZoom, s.zoom);
      gl.uniform3fv(u.uInk, this.o.ink);
      gl.uniform3fv(u.uPaper, this.o.paper);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    destroy() {
      if (this.dead) return;
      this.dead = true;
      all.delete(this);
      this.ro.disconnect(); this.io.disconnect();
      const ext = this.gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    }
  }
  FX.tick = (now = performance.now()) => all.forEach((f) => f.render(now));
  FX.supported = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl")); } catch (e) { return false; } })();
  window.FX = FX;
})();
