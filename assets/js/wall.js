/* wall.js — the work, taped to the window.
   The same frosted glass as the landing, dry today, looking out at a sky where the clouds drift and birds pass.
   On the inside of the glass, prints of every project are stuck in a calm, even grid with strips of tape, as far
   as you can go in any direction (the prints repeat, never next to themselves).
   · a click on the glass wipes the frost, like on the landing; a click on a print opens it
   · the wheel button (or Space held down) and a finger move along the wall; the glass travels with it
   · the prints are photographic paper: a white border, a fine tooth, a gloss that catches the light of the room
     as you move, lit from behind by the sky; held at the top, they lift a little from the glass under your hand
   · the tape is real: four strips cut out of a photograph, here, in the browser. Its outline gives each piece its
     torn ends, its creases catch the light, and what is under it shows through it, a little milky
   A print opens where it is: the tape lets go, it comes off the glass towards you, and the project is told beside
   it, with its other photographs and its website. Nothing leaves the scene. */
(() => {
  const clamp = (a, b, x) => Math.max(a, Math.min(b, x));
  const hash = (i, j, k = 0) => { let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const crop = (u, w, h) => `${u}?w=${w}&h=${h}&q=80&auto=format&fit=crop`;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  // ---------- materials made once, in the browser ----------
  const Mat = {
    tapes: [],
    // the tooth of photographic paper: a fine, irregular grain, tiling
    grain: (() => {
      try {
        const S = 160, c = document.createElement("canvas"); c.width = c.height = S;
        const x = c.getContext("2d"), im = x.createImageData(S, S);
        for (let i = 0; i < S * S; i++) { const v = 128 + (Math.random() - 0.5) * 70 + (Math.random() < 0.02 ? -40 : 0); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
        x.putImageData(im, 0, 0);
        return c.toDataURL("image/png");
      } catch (e) { return ""; }
    })(),
    // four strips in a photograph of black tape on white paper: each one's outline, and its creases
    tape(src) {
      return new Promise((done) => {
        const im = new Image(); im.crossOrigin = "anonymous";
        im.onload = () => {
          try {
            const W = 1400, H = Math.round((W * im.naturalHeight) / im.naturalWidth);
            const c = document.createElement("canvas"); c.width = W; c.height = H;
            const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H);
            const D = x.getImageData(0, 0, W, H).data, L = new Float32Array(W * H);
            for (let i = 0; i < W * H; i++) L[i] = (D[i * 4] * 0.3 + D[i * 4 + 1] * 0.59 + D[i * 4 + 2] * 0.11) / 255;
            const rows = []; let on = -1;
            for (let j = 0; j < H; j++) {
              let n = 0; for (let i = 0; i < W; i += 2) if (L[j * W + i] < 0.35) n++;
              const dark = n > W * 0.06;
              if (dark && on < 0) on = j; if (!dark && on >= 0) { if (j - on > 30) rows.push([on, j]); on = -1; }
            }
            for (const [a, b] of rows) {
              let l = W, r = 0;
              for (let j = a; j < b; j++) for (let i = 0; i < W; i++) if (L[j * W + i] < 0.35) { if (i < l) l = i; if (i > r) r = i; }
              const pad = 3, pw = r - l + pad * 2, ph = b - a + pad * 2;
              const mk = () => { const o = document.createElement("canvas"); o.width = pw; o.height = ph; return o; };
              const shape = mk(), crease = mk(), sx = shape.getContext("2d"), cx = crease.getContext("2d");
              const sd = sx.createImageData(pw, ph), cd = cx.createImageData(pw, ph);
              for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
                const X = l - pad + i, Y = a - pad + j, k = (j * pw + i) * 4;
                if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
                const v = L[Y * W + X], inside = clamp(0, 1, (0.6 - v) / 0.32);
                sd.data[k] = sd.data[k + 1] = sd.data[k + 2] = 255; sd.data[k + 3] = Math.round(255 * inside);
                // creases: where the dark tape catches light in the photograph, and the shadow beside each fold
                const hi = clamp(0, 1, (v - 0.07) / 0.2), lo = clamp(0, 1, (0.045 - v) / 0.04);
                cd.data[k] = cd.data[k + 1] = cd.data[k + 2] = hi > lo ? 255 : 60;
                cd.data[k + 3] = Math.round(255 * inside * Math.min(1, Math.max(hi * 1.4, lo * 0.5)));
              }
              sx.putImageData(sd, 0, 0); cx.putImageData(cd, 0, 0);
              // kept small: a strip is never drawn wider than a few hundred pixels, and big masks are slow to paint
              const small = (c) => { const k = Math.min(1, 380 / pw), o = document.createElement("canvas"); o.width = Math.round(pw * k); o.height = Math.round(ph * k); o.getContext("2d").drawImage(c, 0, 0, o.width, o.height); return o.toDataURL("image/png"); };
              Mat.tapes.push({ shape: small(shape), crease: small(crease), ar: pw / ph });
            }
          } catch (e) {}
          done(Mat.tapes.length);
        };
        im.onerror = () => done(0);
        im.src = src + "?w=1400&q=88&auto=format";
      });
    },
  };

  class Wall {
    constructor(sec, o) {
      this.sec = sec; this.o = o;
      this.items = JSON.parse(sec.querySelector(".wall__data").textContent);
      this.grid = sec.querySelector(".wall__grid"); this.case = sec.querySelector(".wall__case");
      this.label = sec.querySelector(".wall__label"); this.base = this.label.textContent;
      this.tip = sec.querySelector(".wall__tip");
      sec.style.setProperty("--grain", Mat.grain ? `url(${Mat.grain})` : "none");
      // every photograph of every project; the grid walks through them so that no print sits next to its own project
      this.pics = [];
      for (let k = 0; k < 4; k++) this.items.forEach((p, i) => this.pics.push({ p: i, k }));
      this.ox = 0; this.oy = 0; this.vx = 0; this.vy = 0; this.nodes = new Map(); this.free = []; this.mx = 0.5; this.my = 0.4;
      this.active = false; this.frame = 0;
      const c = sec.querySelector(".wall__glass");
      // the landing's glass, dry and much more frosted, over a sky that lives
      this.rain = new Rain(c, { img: sec.dataset.sky, mask: "", sky: true, rig: true, dry: true, reduce: o.reduce,
        params: { fog: 1, frostBlur: 5.2, refog: 0.024, rate: 0, inflow: 0 } });
      if (this.rain.dead) this.rain = null; else { this.rain.set("expo", 1); this.rain.set("rain", 0); }
      Mat.tape(sec.dataset.tape).then(() => { for (const n of this.nodes.values()) this.tape(n); });
      this.size();
      addEventListener("resize", () => this.size());
      this.input();
    }
    size() {
      const W = innerWidth, small = W < 700;
      this.cw = small ? W * 0.74 : clamp(340, W * 0.25, 470); this.ch = this.cw * 1.18;
      this.pw = this.cw * (small ? 0.74 : 0.6); this.ph = this.pw * 1.25;
      if (!this.placed) { this.ox = (W - this.cw) / 2; this.oy = (innerHeight - this.ch) / 2 - this.ch * 0.06; this.placed = true; }
      this.layout(true);
    }
    // from screen to wall and back, in cells: so another visitor's cursor lands on the same print here
    toWorld(cx, cy) { return [(cx - this.ox) / this.cw, (cy - this.oy) / this.ch]; }
    toScreen(wx, wy) { return [wx * this.cw + this.ox, wy * this.ch + this.oy]; }
    cell(i, j) {
      const n = this.pics.length, pick = this.pics[(((i * 7 + j * 13) % n) + n) % n], p = this.items[pick.p];
      const x = i * this.cw + (this.cw - this.pw) / 2, y = j * this.ch + (this.ch - this.ph) / 2;
      // taped by hand: never quite straight, never by much
      return { i, j, p: pick.p, k: pick.k, slug: p.slug, name: p.name, x, y, w: this.pw, h: this.ph, rot: (hash(i, j, 6) - 0.5) * 2.4, seed: hash(i, j, 8) };
    }
    node(c, old) {
      const el = old || this.free.pop() || Object.assign(document.createElement("figure"), { className: "pin" });
      if (!el.firstChild) el.innerHTML = `<span class="pin__lift"><span class="pin__paper"><span class="pin__img"><img alt="" decoding="async" draggable="false"></span><span class="pin__sheen"></span></span><i class="tape"><i class="tape__crease"></i></i></span>`;
      const p = this.items[c.p], img = el.querySelector("img"), W = Math.round((c.w * 2) / 20) * 20, src = crop(p.images[c.k], W, Math.round(W * 1.25));
      if (img.dataset.src !== src) { img.dataset.src = src; el.classList.remove("is-in"); img.onload = () => el.classList.add("is-in"); img.src = src; if (img.complete && img.naturalWidth) el.classList.add("is-in"); }
      Object.assign(el.style, { left: c.x + "px", top: c.y + "px", width: c.w + "px", height: c.h + "px" });
      el.style.setProperty("--rot", c.rot.toFixed(2) + "deg");
      el.dataset.slug = c.slug; el.dataset.k = c.k; el.c = c;
      this.tape(el);
      if (!el.parentNode) this.grid.appendChild(el);
      return el;
    }
    // one strip across the top edge, half on the paper, half on the glass
    tape(el) {
      const c = el.c; if (!c) return;
      const t = el.querySelector(".tape"), T = Mat.tapes, piece = T.length ? T[Math.floor(hash(c.i, c.j, 20) * T.length)] : null;
      const w = c.w * (0.38 + c.seed * 0.1), h = Math.max(piece ? w / piece.ar : w * 0.3, c.w * 0.11);
      Object.assign(t.style, { width: w + "px", height: h + "px", left: c.w / 2 - w / 2 + (c.seed - 0.5) * c.w * 0.12 + "px", top: -h * 0.48 + "px" });
      t.style.setProperty("--tr", ((c.seed - 0.5) * 9 - c.rot * 0.5).toFixed(1) + "deg");
      t.style.setProperty("--flip", hash(c.i, c.j, 31) < 0.5 ? -1 : 1);
      if (piece) { t.style.setProperty("--shape", `url(${piece.shape})`); t.querySelector(".tape__crease").style.backgroundImage = `url(${piece.crease})`; t.classList.remove("tape--plain"); }
      else t.classList.add("tape--plain");
    }
    // only the cells around the view exist; the rest of the endless wall is only arithmetic. The ones just outside
    // the screen are prepared ahead, a few per frame, so a print is always ready before it comes into view
    // where the prints are, for the glass (in its 0..1, y up): sent when the wall moves
    feed() {
      if (!this.rain) return;
      const W = innerWidth, H = innerHeight, A = this.rectA || (this.rectA = new Float32Array(160));
      let n = 0;
      for (const el of this.nodes.values()) {
        const c = el.c; if (!c || n >= 40 || el.style.visibility === "hidden") continue;
        const x = c.x + this.ox, y = c.y + this.oy;
        if (x > W || x + c.w < 0 || y > H || y + c.h < 0) continue;
        A[n * 4] = (x + c.w / 2) / W; A[n * 4 + 1] = 1 - (y + c.h / 2) / H; A[n * 4 + 2] = c.w / 2 / H * 0.98; A[n * 4 + 3] = c.h / 2 / H * 0.98; n++;
      }
      this.rain.rects(A, n);
    }
    layout(force) {
      const W = innerWidth, H = innerHeight, i0 = Math.floor(-this.ox / this.cw) - 1, j0 = Math.floor(-this.oy / this.ch) - 1;
      const i1 = i0 + Math.ceil(W / this.cw) + 2, j1 = j0 + Math.ceil(H / this.ch) + 2, keep = new Set(), todo = [];
      const cx = (-this.ox + W / 2) / this.cw, cy = (-this.oy + H / 2) / this.ch;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const key = i + "," + j; keep.add(key);
        if (force || !this.nodes.has(key)) todo.push([Math.hypot(i + 0.5 - cx, j + 0.5 - cy), i, j, key]);
      }
      todo.sort((a, b) => a[0] - b[0]);
      const budget = force ? todo.length : 4;
      for (let n = 0; n < Math.min(budget, todo.length); n++) { const [, i, j, key] = todo[n]; this.nodes.set(key, this.node(this.cell(i, j), this.nodes.get(key))); }
      for (const [key, el] of this.nodes) if (!keep.has(key)) { this.recycle(el); this.nodes.delete(key); }
      this.grid.style.transform = "translate3d(" + this.ox.toFixed(1) + "px, " + this.oy.toFixed(1) + "px, 0)";
      if (todo.length > budget && !this.lyRaf) this.lyRaf = requestAnimationFrame(() => { this.lyRaf = 0; this.layout(); });
      this.feed();
    }
    recycle(el) { el.remove(); el.classList.remove("is-in", "is-hover"); el.style.visibility = ""; this.free.push(el); }
    // the wall moves at once; the glass under it (frost, drops) is carried along once a frame, however many events
    move(dx, dy) {
      if (!dx && !dy) return;
      this.ox += dx; this.oy += dy;
      this.grid.style.transform = 'translate3d(' + this.ox.toFixed(1) + 'px, ' + this.oy.toFixed(1) + 'px, 0)';
      this.pdx = (this.pdx || 0) + dx; this.pdy = (this.pdy || 0) + dy;
      if (!this.mvRaf) this.mvRaf = requestAnimationFrame(() => { this.mvRaf = 0; if (this.rain) this.rain.pan(this.pdx, this.pdy); this.pdx = this.pdy = 0; this.layout(); this.moved = true; });
    }
    nudge(dx, dy) { this.vx += dx * 0.12; this.vy += dy * 0.12; }
    key(k) {
      if (this.openSlug) { if (k === "ArrowRight") this.step(1); if (k === "ArrowLeft") this.step(-1); return; }
      const s = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[k];
      if (s) { this.vx += s[0] * this.cw * 0.13; this.vy += s[1] * this.ch * 0.13; }
    }
    // ---------- the hand ----------
    input() {
      const sec = this.sec, touch = this.o.touch;
      let pan = null, wipe = null, space = false, hold = null;
      const typing = (e) => e.target.closest && e.target.closest("input, textarea");
      addEventListener("keydown", (e) => { if (e.code === "Space" && this.active && !this.openSlug && !typing(e)) { e.preventDefault(); space = true; sec.classList.add("is-space"); } });
      addEventListener("keyup", (e) => { if (e.code === "Space") { space = false; sec.classList.remove("is-space"); } });
      // the wheel button would start the browser's own autoscroll
      sec.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
      sec.addEventListener("auxclick", (e) => { if (e.button === 1) e.preventDefault(); });
      sec.addEventListener("pointerdown", (e) => {
        if (!this.active || this.openSlug || e.target.closest(".wall__case, a, button")) return;
        const startPan = () => { this.panning = true; pan = { lx: e.clientX, ly: e.clientY, t: performance.now() }; this.vx = this.vy = 0; sec.classList.add("is-pan"); this.hover(null); };
        if (e.pointerType === "mouse") {
          if (e.button === 1 || (e.button === 0 && space)) { e.preventDefault(); startPan(); }
          else if (e.button === 0) {
            // a click: on the glass it wipes; on a print, if the hand does not move, it opens
            wipe = { x: e.clientX, y: e.clientY, moved: 0, el: e.target.closest(".pin") };
            if (this.rain) this.rain.down(e.clientX, e.clientY);
            this.tip.classList.add("is-down");
          } else return;
        } else {
          // a finger moves the wall; resting it a moment, then dragging, wipes the glass
          startPan(); pan.el = e.target.closest(".pin"); pan.moved = 0;
          clearTimeout(hold);
          hold = setTimeout(() => { if (pan && pan.moved < 8 && this.rain) { this.rain.down(pan.lx, pan.ly); wipe = { x: pan.lx, y: pan.ly, moved: 99, el: null }; pan = null; sec.classList.remove("is-pan"); } }, 260);
        }
        sec.setPointerCapture(e.pointerId);
      });
      sec.addEventListener("pointermove", (e) => {
        this.mx = e.clientX / innerWidth; this.my = e.clientY / innerHeight;
        // the pointer is followed once a frame, however many events the mouse sends
        if (e.pointerType === "mouse") { this.pt = { x: e.clientX, y: e.clientY, over: !this.openSlug && !e.target.closest(".wall__case, .bar"), target: e.target }; if (!this.ptRaf) this.ptRaf = requestAnimationFrame(() => this.follow()); }
        if (pan) {
          const dx = e.clientX - pan.lx, dy = e.clientY - pan.ly, now = performance.now(), dt = Math.max(1, now - pan.t);
          if (pan.moved !== undefined) pan.moved += Math.abs(dx) + Math.abs(dy);
          this.move(dx, dy);
          this.vx = (dx / dt) * 16; this.vy = (dy / dt) * 16;
          pan.lx = e.clientX; pan.ly = e.clientY; pan.t = now;
          return;
        }
        if (wipe) {
          wipe.moved += Math.hypot(e.clientX - wipe.x, e.clientY - wipe.y); wipe.x = e.clientX; wipe.y = e.clientY;
          if (this.rain) this.rain.move(e.clientX, e.clientY);
          if (wipe.moved > 6) this.hover(null);
          return;
        }
        if (this.rain) this.rain.move(e.clientX, e.clientY);
      });
      const end = () => {
        clearTimeout(hold);
        if (pan) {
          const p = pan; pan = null; this.panning = false; sec.classList.remove("is-pan");
          if (performance.now() - p.t > 90) this.vx = this.vy = 0;
          if (p.el && p.moved !== undefined && p.moved < 8) { this.vx = this.vy = 0; this.opened = performance.now(); this.open(p.el.dataset.slug, p.el, +p.el.dataset.k); }
        }
        if (wipe) {
          const w = wipe; wipe = null;
          if (this.rain) this.rain.up();
          this.tip.classList.remove("is-down");
          if (w.el && w.moved <= 6) { this.opened = performance.now(); this.open(w.el.dataset.slug, w.el, +w.el.dataset.k); }
        }
      };
      sec.addEventListener("pointerup", end); sec.addEventListener("pointercancel", end);
      sec.addEventListener("pointerleave", () => { this.hover(null); this.tip.classList.remove("is-on"); });
      sec.addEventListener("click", (e) => {
        const b = e.target.closest("[data-wall]");
        if (!b) { if (this.openSlug && performance.now() - (this.opened || 0) > 400 && !e.target.closest(".wall__info, .wall__big")) this.close(); return; }
        e.preventDefault();
        const a = b.dataset.wall;
        if (a === "close") this.close();
        else if (a === "prev") this.step(-1);
        else if (a === "next") this.step(1);
        else if (a === "pic") this.show(+b.dataset.k);
      });
    }
    get pressing() { return !!(this.rain && this.rain.finger); }
    hover(el) {
      if (el === this.hov) return;
      if (this.hov) { this.hov.classList.remove("is-hover"); this.hov.style.removeProperty("--tx"); this.hov.style.removeProperty("--ty"); }
      this.hov = el;
      if (el) { el.classList.add("is-hover"); this.o.cursor.show(this.o.lang === "ca" ? "Obre" : this.o.lang === "es" ? "Abrir" : "Open"); this.say(el.c); }
      else { this.o.cursor.hide(); this.say(null); }
    }
    // the light of the room on the glossy prints: one soft reflection that slides across them as the hand moves,
    // and the print under the hand leans towards it, from its tape
    // once a frame: the ring under the hand, which print it is over, and that print's gloss and lean (its place
    // is known from the grid, so nothing is measured)
    follow() {
      this.ptRaf = 0;
      const p = this.pt; if (!p) return;
      this.tip.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      if (this.tipOn !== p.over) { this.tip.classList.toggle("is-on", p.over); this.tipOn = p.over; }
      if (this.openSlug || this.o.touch || this.panning) return;
      const el = p.target && p.target.closest ? p.target.closest(".pin") : null;
      this.hover(el);
      if (!el || !el.c) return;
      const c = el.c, u = (p.x - (c.x + this.ox)) / c.w, v = (p.y - (c.y + this.oy)) / c.h;
      el.style.setProperty("--gx", (u * 100).toFixed(1) + "%"); el.style.setProperty("--gy", (v * 100).toFixed(1) + "%");
      el.style.setProperty("--tx", clamp(-1, 1, u - 0.5).toFixed(3)); el.style.setProperty("--ty", clamp(-1, 1, v).toFixed(3));
    }
    say(c) {
      const t = c ? `${c.name} — ${this.items[c.p].kind}, ${this.items[c.p].place}` : this.base;
      if (this.label.textContent !== t) this.label.textContent = t;
    }
    tick(now, rate) {
      this.active = rate >= 1;
      if (!rate) { if (this.rain) this.rain.active = false; return; }
      if (this.active && !this.openSlug && (Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05)) { this.move(this.vx, this.vy); this.vx *= 0.93; this.vy *= 0.93; }
      if (!this.rain) return;
      this.rain.active = true;
      if (rate < 1 && this.frame++ % 4) return;
      this.rain.tick(now);
    }
    // arriving: the prints are put up one by one from the middle outwards
    enter() {
      this.active = true;
      if (this.rain) this.rain.resize(true);
      this.layout(true);
      if (this.o.reduce) return;
      const cx = innerWidth / 2, cy = innerHeight / 2;
      for (const el of this.nodes.values()) {
        const r = el.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
        const lift = el.querySelector(".pin__lift"), tape = el.querySelector(".tape");
        gsap.fromTo(lift, { y: -26, rotationX: 24, opacity: 0 }, { y: 0, rotationX: 0, opacity: 1, duration: 1.2, ease: "expo.out", delay: 0.15 + d / 2400, clearProps: "transform,opacity" });
        gsap.fromTo(tape, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out", delay: 0.45 + d / 2400, clearProps: "scale" });
      }
    }
    leave() { this.active = false; this.hover(null); this.tip.classList.remove("is-on"); if (this.openSlug) this.close(false, true); }

    // ---------- a project, opened on the wall ----------
    // A press, the tape lets go (one end lifts and pulls away), the print comes off the glass and swings towards you,
    // hanging for a moment from where the tape held it, while the wall behind goes out of focus. Its story arrives
    // beside it, line by line. Closing does the same backwards, and the tape presses it back onto the glass.
    open(slug, from, k = 0) {
      const i = this.items.findIndex((p) => p.slug === slug);
      if (i < 0) return;
      const p = this.items[i], R = this.o.reduce;
      if (!from) from = [...this.nodes.values()].filter((n) => n.dataset.slug === slug).sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.hypot(ra.left - innerWidth / 2, ra.top - innerHeight / 2) - Math.hypot(rb.left - innerWidth / 2, rb.top - innerHeight / 2); })[0] || null;
      this.openSlug = slug; this.openI = i; this.pic = from ? k : 0;
      this.hover(null); this.tip.classList.remove("is-on");
      this.case.hidden = false;
      this.case.innerHTML = this.caseHTML(p);
      const big = this.case.querySelector(".wall__big"), info = this.case.querySelector(".wall__info");
      this.show(this.pic, true);
      this.o.onOpen(slug); this.o.onPick(slug);
      const sound = this.o.sound();
      const to = big.getBoundingClientRect();
      this.reveal(info, R ? 0 : from ? 0.55 : 0.2);
      if (from && !R) {
        const paper = from.querySelector(".pin__paper"), fr = paper.getBoundingClientRect(), tape = from.querySelector(".tape");
        this.from = from;
        gsap.set(big, { x: fr.left + fr.width / 2 - (to.left + to.width / 2), y: fr.top - to.top + (fr.height - to.height) / 2, scale: fr.width / to.width, rotation: from.c ? from.c.rot : 0, rotationX: 0, opacity: 0, transformOrigin: "50% 0%" });
        gsap.timeline()
          .to(paper, { scale: 0.985, duration: 0.1, ease: "power2.out" })
          .to(paper, { scale: 1, duration: 0.3, ease: "power2.out" })
          .to(tape, { rotation: "-=16", scaleX: 0.5, x: -6, y: -4, opacity: 0, duration: 0.34, ease: "power2.in", transformOrigin: "0% 50%" }, 0.06)
          .add(() => { if (sound && sound.on && sound.breath) sound.breath(0, 0.35); }, 0.06)
          .add(() => { from.style.visibility = "hidden"; gsap.set(big, { opacity: 1 }); this.sec.classList.add("is-open"); }, 0.32)
          .to(big, { x: 0, y: 0, scale: 1, rotation: 0, duration: 1.15, ease: "expo.inOut" }, 0.32)
          .to(big, { keyframes: [{ rotationX: -11, duration: 0.5, ease: "sine.out" }, { rotationX: 3, duration: 0.45, ease: "sine.inOut" }, { rotationX: 0, duration: 0.5, ease: "sine.out" }] }, 0.32);
      } else { this.sec.classList.add("is-open"); gsap.fromTo(big, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: R ? 0 : 0.9, ease: "expo.out" }); }
      this.case.querySelector("[data-wall=close]").focus({ preventScroll: true, focusVisible: false });
    }
    // the story, line by line, each rising out of its own mask
    reveal(info, delay) {
      const parts = [...info.querySelectorAll(".wall__top, .wall__name, .wall__meta, .wall__line, .wall__thumbs, .wall__cols > div, .wall__goal, .wall__steps")];
      parts.forEach((el) => { if (!el.parentNode.classList.contains("rv")) { const w = document.createElement("div"); w.className = "rv"; el.parentNode.insertBefore(w, el); w.appendChild(el); } });
      if (!delay && this.o.reduce) return;
      gsap.fromTo(parts, { yPercent: 105 }, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.055, delay });
    }
    close(notify = true, instant = false) {
      if (!this.openSlug) return;
      const big = this.case.querySelector(".wall__big"), info = this.case.querySelector(".wall__info"), from = this.from && this.from.isConnected ? this.from : null, R = this.o.reduce || instant;
      const done = () => {
        this.case.hidden = true; this.case.innerHTML = "";
        if (from) {
          from.style.visibility = "";
          const t = from.querySelector(".tape"), paper = from.querySelector(".pin__paper");
          if (R) gsap.set(t, { clearProps: "transform,opacity" });
          else gsap.timeline().fromTo(t, { rotation: (from.c.seed - 0.5) * 9 - 16, scaleX: 0.5, x: -6, y: -4, opacity: 0 }, { rotation: (from.c.seed - 0.5) * 9 - from.c.rot * 0.5, scaleX: 1, x: 0, y: 0, opacity: 1, duration: 0.42, ease: "power3.out", transformOrigin: "0% 50%", clearProps: "transform,opacity" })
            .fromTo(paper, { scale: 0.99 }, { scale: 1, duration: 0.4, ease: "power2.out", clearProps: "transform" }, 0.2);
        }
        this.from = null;
      };
      this.openSlug = null;
      if (from && big && !R) {
        const fr = from.querySelector(".pin__paper").getBoundingClientRect(), to = big.getBoundingClientRect();
        gsap.to(info.querySelectorAll(".rv > *"), { yPercent: 105, duration: 0.45, ease: "power3.in", stagger: 0.02 });
        gsap.timeline({ onComplete: done })
          .to(big, { x: "+=" + (fr.left + fr.width / 2 - (to.left + to.width / 2)), y: "+=" + (fr.top - to.top + (fr.height - to.height) / 2), scale: fr.width / to.width, rotation: from.c.rot, duration: 0.95, ease: "expo.inOut" }, 0.1)
          .to(big, { keyframes: [{ rotationX: 9, duration: 0.45, ease: "sine.out" }, { rotationX: 0, duration: 0.5, ease: "sine.in" }] }, 0.1)
          .add(() => this.sec.classList.remove("is-open"), 0.35);
      } else { this.sec.classList.remove("is-open"); if (!R) gsap.to(this.case, { opacity: 0, duration: 0.4, onComplete: () => { gsap.set(this.case, { opacity: 1 }); done(); } }); else done(); }
      if (notify) this.o.onClose();
    }
    // the next or the previous project: this one slides away, the next one comes in from the other side
    step(d) {
      const n = this.items.length, i = (this.openI + d + n) % n, p = this.items[i], R = this.o.reduce;
      const big = this.case.querySelector(".wall__big"), info = this.case.querySelector(".wall__info");
      if (this.from) this.from.style.visibility = "";
      this.from = [...this.nodes.values()].filter((el) => el.dataset.slug === p.slug).sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.hypot(ra.left - innerWidth / 2, ra.top - innerHeight / 2) - Math.hypot(rb.left - innerWidth / 2, rb.top - innerHeight / 2); })[0] || null;
      const swap = () => {
        this.openSlug = p.slug; this.openI = i; this.pic = 0;
        info.innerHTML = this.caseHTML(p).split('<div class="wall__info" data-lenis-prevent>')[1].replace(/<\/div><\/div>\s*$/, "");
        this.show(0, true);
        if (this.from) this.from.style.visibility = "hidden";
        this.o.onPick(p.slug);
        if (R) return;
        gsap.fromTo(big, { x: 60 * d, opacity: 0, rotation: 1.5 * d }, { x: 0, opacity: 1, rotation: 0, duration: 0.9, ease: "expo.out" });
        this.reveal(info, 0.05);
      };
      if (R) { swap(); return; }
      gsap.to(info.querySelectorAll(".rv > *"), { yPercent: -105, duration: 0.35, ease: "power3.in", stagger: 0.015 });
      gsap.to(big, { x: -60 * d, opacity: 0, rotation: -1.5 * d, duration: 0.38, ease: "power3.in", onComplete: swap });
    }
    show(k, first) {
      const p = this.items[this.openI], big = this.case.querySelector(".wall__big"), paper = big.querySelector(".pin__img");
      this.pic = k;
      const ar = k === 4 ? 1.6 : 0.8;
      big.style.setProperty("--ar", ar);
      if (k === 4) paper.innerHTML = this.screen(p);
      else { const W = 1400, src = crop(p.images[k], W, Math.round(W / ar)); paper.innerHTML = `<img alt="${esc(p.name)}" src="${src}" decoding="async" draggable="false">`; }
      const t = big.querySelector(".tape"), T = Mat.tapes, piece = T[this.openI % Math.max(1, T.length)];
      if (piece) { t.style.setProperty("--shape", `url(${piece.shape})`); t.querySelector(".tape__crease").style.backgroundImage = `url(${piece.crease})`; t.classList.remove("tape--plain"); } else t.classList.add("tape--plain");
      this.case.querySelectorAll("[data-wall=pic]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.k === k)));
      if (!first && !this.o.reduce) gsap.fromTo(paper, { opacity: 0.25 }, { opacity: 1, duration: 0.6, ease: "power2.out" });
    }
    screen(p) {
      const f = p.face;
      return `<div class="scr" style="--sf:'${f.font}';--sw:${f.weight};--ss:${f.style};--sc:${f.case};--st:${f.track};--si:${f.ink}">
        <img class="scr__img" src="${crop(p.images[0], 1800, 1125)}" alt="" decoding="async">
        <div class="scr__nav"><span class="scr__logo">${esc(p.name)}</span><span class="scr__links">${p.mock.nav.map((n) => `<span>${esc(n)}</span>`).join("")}</span><span class="scr__btn">${esc(p.mock.button)}</span></div>
        <p class="scr__line">${esc(p.mock.line)}</p><span class="scr__big">${esc(p.name)}</span></div>`;
    }
    caseHTML(p) {
      const L = this.o.labels || (this.o.labels = JSON.parse(this.sec.dataset.labels));
      const thumbs = [0, 1, 2, 3].map((k) => `<button class="wall__thumb" type="button" data-wall="pic" data-k="${k}" aria-label="${esc(p.name)} ${k + 1}"><img src="${crop(p.images[k], 200, 250)}" alt="" draggable="false"></button>`).join("")
        + `<button class="wall__thumb wall__thumb--web" type="button" data-wall="pic" data-k="4"><span class="mono">${esc(L.screen)}</span></button>`;
      return `<div class="wall__big"><span class="pin__paper"><span class="pin__img"></span><span class="pin__sheen"></span></span><i class="tape"><i class="tape__crease"></i></i></div>
      <div class="wall__case-in"><div class="wall__info" data-lenis-prevent>
        <div class="wall__top mono"><span>${esc(L.note)}</span><button class="btn btn--bar" type="button" data-wall="close"><span class="btn__fill" aria-hidden="true"></span><span class="btn__label"><span class="btn__roll" data-text="${esc(L.close)}">${esc(L.close)}</span></span></button></div>
        <h2 class="wall__name">${esc(p.name)}</h2>
        <p class="mono wall__meta"><span>${esc(p.kind)}</span><span>${esc(p.place)}</span><span>${esc(p.scope)}</span></p>
        <p class="wall__line">${esc(p.line)}</p>
        <div class="wall__thumbs">${thumbs}</div>
        <div class="wall__cols"><div><h3 class="mono">${esc(L.need)}</h3><p>${esc(p.need)}</p></div><div><h3 class="mono">${esc(L.idea)}</h3><p>${esc(p.idea)}</p></div></div>
        <div class="wall__goal"><h3 class="mono">${esc(L.goal)}</h3><p>${esc(p.goal)}</p></div>
        <div class="wall__steps mono"><button type="button" data-wall="prev">${esc(L.prev)}</button><button type="button" data-wall="next">${esc(L.next)}</button></div>
      </div></div>`;
    }
  }
  window.Wall = Wall;
})();
