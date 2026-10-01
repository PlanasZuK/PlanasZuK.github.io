/* polplanas.com
   The whole site is one canvas of five pages. Scroll pulls the camera back from the landing until you
   see every page at once; the distance is yours, frame by frame. Pick a page and the camera flies in
   until it becomes the page. Pictures arrive as prints and develop into colour.
   GSAP 3.15 (+ScrollTrigger, SplitText), Lenis 1.3 and one WebGL effect (fx.js), one ticker. */
(() => {
  const d = document, html = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => [...c.querySelectorAll(s)];
  if (!window.gsap || !window.ScrollTrigger) { html.classList.remove("js"); return; }
  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const reduce = html.classList.contains("reduced");
  const touch = matchMedia("(pointer: coarse)").matches;
  const FXOK = !!(window.FX && FX.supported);
  const EO = "expo.out";
  const clamp = gsap.utils.clamp(0, 1);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const canvas = $("#canvas"), world = $("#world"), host = $("#host");
  const boards = Object.fromEntries($$(".board").map((b) => [b.dataset.board, b]));
  const GRID = { work: [1, 0], about: [0, 1], home: [1, 1], services: [2, 1], contact: [1, 2] };
  const LANG = html.lang, BASE = LANG === "en" ? "/" : `/${LANG}/`;
  const TITLES = JSON.parse(d.body.dataset.titles || "{}");
  const view = (id) => $(".board__view", boards[id]);
  // pages still being made: seen from afar, blurred, not open yet
  const isLocked = (id) => !!boards[id] && boards[id].classList.contains("is-locked");

  /* ---------------- smooth scroll (page mode only) ---------------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* ---------------- type that fills its measure ---------------- */
  function fit(el) {
    if (!el.offsetParent && !el.closest(".host")) return;
    const avail = el.clientWidth;
    if (!avail) return;
    // measure the line (or the widest row, for stacked titles) at 100px, then scale to the measure
    const ms = el.dataset.fit === "rows" ? [...el.children] : [el];
    el.style.fontSize = "100px";
    const w = Math.max(...ms.map((m) => { m.style.width = "max-content"; const x = m.offsetWidth; m.style.width = ""; return x; }));
    const max = el.dataset.fitMax ? (+el.dataset.fitMax * innerWidth) / 100 : Infinity;
    el.style.fontSize = Math.min(max, ((100 * avail) / Math.max(w, 1)) * 0.995) + "px";
    el.classList.add("is-fit");
  }
  const fitAll = (root = d) => $$("[data-fit]", root).forEach(fit);

  /* ---------------- the canvas: layout and camera ---------------- */
  const L = {};
  const cam = { x: 0, y: 0, s: 1 };
  function layout() {
    const W = innerWidth, H = innerHeight, small = W < 900, g = Math.round(Math.max(W, H) * (small ? 0.13 : 0.1));
    Object.assign(L, { W, H, g });
    for (const [id, [c, r]] of Object.entries(GRID)) {
      const b = boards[id];
      b._x = c * (W + g); b._y = r * (H + g);
      Object.assign(b.style, { left: b._x + "px", top: b._y + "px", width: W + "px", height: H + "px" });
    }
    const ww = 3 * W + 2 * g, wh = 3 * H + 2 * g;
    const padT = small ? 84 : 110, padB = small ? 60 : 64, padX = small ? 12 : 64;
    const s0 = Math.min((W - 2 * padX) / ww, (H - padT - padB) / wh);
    L.s0 = s0;
    L.ov = { s: s0, x: (W - ww * s0) / 2, y: padT + (H - padT - padB - wh * s0) / 2 };
    L.ZR = touch ? H * 0.75 : 760;
    html.style.setProperty("--s0", s0.toFixed(4));
  }

  // Z.v: 0 = inside the centre page, 1 = every page in view. The centre is the page you leave or enter.
  const Z = { v: 0, t: 0, tw: null, center: "home" };
  // the landing's own clock: scrolling first takes the day from afternoon to night, then pulls the camera back
  // t: where the scroll has put the day (07:00 → 00:00); n: the small hours after midnight, until it is morning again
  const DAY = { v: 0, t: 0, n: 0, nv: 0, run: false, last: 0 };
  const NIGHT = 7 / 17; // 00:00 → 07:00, in the same units as 07:00 → 00:00
  function render() {
    const e = Z.v, c = boards[Z.center];
    cam.s = 1 + (L.s0 - 1) * e;
    cam.x = -c._x + (L.ov.x + c._x) * e;
    cam.y = -c._y + (L.ov.y + c._y) * e;
    world.style.transform = `translate3d(${cam.x.toFixed(2)}px,${cam.y.toFixed(2)}px,0) scale(${cam.s.toFixed(5)})`;
    world.style.setProperty("--k", e.toFixed(3));
    html.style.setProperty("--zk", e.toFixed(3));
    window.__zk = e;
    world.style.setProperty("--kg", sstep(0.3, 0.75, e).toFixed(3));
    const [cc, cr] = GRID[Z.center];
    // the other pages dock into place as the camera pulls back
    for (const [id, [col, row]] of Object.entries(GRID)) {
      if (id === Z.center || reduce) continue;
      const u = 1 - e, f = u * u * (3 - 2 * u), dx = col - cc, dy = row - cr;
      if (f === 0 && boards[id]._f === 0) continue;
      boards[id]._f = f;
      gsap.set(boards[id], { x: dx * L.W * 0.4 * f, y: dy * L.H * 0.4 * f, rotationY: -dx * 24 * f, rotationX: dy * 20 * f });
    }
    if (e < 0.999) settleLifts();
    const m = mode === "page" ? "page" : e > 0.001 ? "overview" : "focus";
    if (m !== mode) setMode(m);
    html.classList.toggle("is-zooming", e > 0.001 && e < 0.999);
  }
  const zto = (v, dur, ease) => new Promise((res) => {
    if (Z.tw) Z.tw.kill();
    Z.tw = gsap.to(Z, { v, duration: reduce ? 0 : dur, ease, onUpdate: render, onComplete: () => { Z.t = Z.v; Z.tw = null; render(); res(); } });
  });

  /* ---------------- state ---------------- */
  let mode = "focus", current = "home", busy = false, pageCtx = null, caseOpen = null, topSince = 0;
  function setMode(m) {
    mode = m;
    if (m !== "page") html.classList.remove("vc-off");
    html.dataset.mode = m;
    syncBar();
    syncInert();
  }
  function setRoute(page) {
    current = page;
    html.dataset.route = page;
    if (TITLES[page]) d.title = TITLES[page];
    const suffix = page === "home" ? "" : `${page}/`;
    $$(".langs a, .direct__langs a").forEach((a) => { const l = a.getAttribute("hreflang"); a.href = (l === "en" ? "/" : `/${l}/`) + suffix; });
  }
  const pathOf = (page, slug) => (page === "home" ? BASE : slug ? `${BASE}work/${slug}/` : `${BASE}${page}/`);
  function parseRoute(p = location.pathname) {
    const rest = p.startsWith(BASE) ? p.slice(BASE.length) : p.replace(/^\//, "");
    const [a, b] = rest.split("/").filter(Boolean);
    if (!a || !GRID[a] || isLocked(a)) return { page: "home" };
    return a === "work" && b ? { page: "work", slug: b } : { page: a };
  }
  const allBtn = $(".bar__all"), allRoll = $(".btn__roll", allBtn);
  function syncBar() {
    const t = mode === "overview" ? allBtn.dataset.close : allBtn.dataset.open;
    if (allRoll.textContent !== t) { allRoll.textContent = t; allRoll.dataset.text = t; }
    allBtn.setAttribute("aria-expanded", String(mode === "overview"));
  }
  // only what you can see can take focus
  function syncInert() {
    for (const [id, b] of Object.entries(boards)) {
      const v = view(id), hit = $(".board__hit", b);
      v.inert = !(mode === "focus" && id === "home");
      hit.tabIndex = mode === "overview" && !isLocked(id) ? 0 : -1;
    }
  }

  /* ---------------- entering and leaving pages ---------------- */
  function openPage(id) {
    const v = view(id), page = v && $(".page", v);
    if (!page) return;
    const y = v.scrollTop;
    host.appendChild(page);
    v.scrollTop = 0;
    setMode("page");
    window.scrollTo(0, y);
    if (lenis) { lenis.resize(); lenis.scrollTo(y, { immediate: true, force: true }); lenis.start(); }
    topSince = performance.now();
    requestAnimationFrame(vcardRoom);
    pageCtx = gsap.context(() => { if (PAGE[id] && PAGE[id].init) PAGE[id].init(page); });
    ScrollTrigger.refresh();
  }
  function closePage() {
    const page = host.firstElementChild;
    if (!page) return;
    const y = window.scrollY;
    if (pageCtx) { pageCtx.kill(); pageCtx = null; }
    ScrollTrigger.getAll().forEach((t) => t.kill());
    preview.hide();
    view(current).appendChild(page);
    if (lenis) lenis.stop();
    mode = "focus";
    window.scrollTo(0, 0);
    view(current).scrollTop = y;
  }
  // while the camera moves, a page you left at its bottom rolls back to its top
  function settle(id) {
    const v = view(id);
    if (v && v.scrollTop) gsap.to(v, { scrollTop: 0, duration: reduce ? 0 : 1.1, ease: "power3.inOut" });
  }
  function arrive(id, push = true, slug = null) {
    Z.v = Z.t = 0; Z.center = id;
    settleLifts();
    for (const b of Object.values(boards)) { b._f = undefined; gsap.set(b, { clearProps: "transform" }); }
    render();
    setRoute(id);
    if (id === "home") { mode = "focus"; setMode("focus"); } else openPage(id);
    if (push && location.pathname !== pathOf(id, slug)) history.pushState({}, "", pathOf(id, slug));
    if (slug) openCase(slug, false);
  }
  function settleLifts() {
    for (const b of Object.values(boards)) if (b._lift) { b._lift = false; gsap.killTweensOf(b, "scale,z,rotationX,rotationY"); gsap.set(b, { scale: 1, z: 0, rotationX: 0, rotationY: 0 }); }
  }
  function unlift() {
    Object.values(boards).filter((b) => gsap.getProperty(b, "scale") !== 1).forEach((b) => gsap.to(b, { scale: 1, z: 0, rotationX: 0, rotationY: 0, x: 0, y: 0, duration: 0.6, ease: "power3.out", overwrite: true }));
  }

  async function go(target, { push = true, slug = null } = {}) {
    if (busy) return;
    if (target === "overview" && mode === "overview") target = current;
    busy = true;
    try { await fly(target, push, slug); }
    finally { html.classList.remove("is-flying"); busy = false; }
  }
  async function fly(target, push, slug) {
    cursor.hide();
    html.classList.remove("bar-hidden");
    if (caseOpen) closeCase(false);
    if (mode === "page") {
      if (target === current) {
        busy = false;
        if (slug) openCase(slug, push);
        else if (lenis) lenis.scrollTo(0, { duration: 1.2 }); else window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const from = current;
      closePage();
      Z.center = from; Z.v = Z.t = 0; render();
      settle(from);
    }
    if (Z.v >= 0.999) unlift();
    html.classList.add("is-flying");
    if (target === "overview") {
      if (DAY.t < 1) gsap.to(DAY, { t: 1, v: 1, duration: reduce ? 0 : 1.1, ease: "power2.inOut" });
      await zto(1, 1.15, "power3.inOut");
      Z.center = "home";
    } else {
      let chained = false;
      if (Z.center !== target) {
        if (Z.v < 0.999) { chained = Z.v < 0.5; await zto(1, chained ? 0.75 : 0.45, chained ? "power2.in" : "power2.out"); }
        Z.center = target;
        render();
      }
      await zto(0, chained ? 1.05 : 1.1, chained ? "power3.out" : "power3.inOut");
      arrive(target, push, slug);
    }
  }

  /* ---------------- the pull: wheel and touch move the camera directly ---------------- */
  let pullAcc = 0;
  function pull(dy) {
    if (busy || caseOpen || Z.tw) return;
    if (mode === "page") {
      if (window.scrollY > 1 || dy >= 0 || performance.now() - topSince < 350) { pullAcc = 0; return; }
      pullAcc -= dy;
      if (pullAcc < 70) return;
      const from = current;
      closePage();
      Z.center = from; Z.v = 0; Z.t = clamp((pullAcc - 70) / L.ZR);
      pullAcc = 0;
      setMode("overview");
      return;
    }
    if (Z.center === "home") {
      if (DAY.n > 0 && dy < 0 && Z.t === 0) { DAY.n = Math.max(0, DAY.n + dy / (L.ZR * (hero.rain ? hero.rain.P.dayLength : 2.4))); return; }
      // one scroll, two stretches: the day goes by first (0 → 1), then the camera pulls back (1 → 2)
      const base = Z.t > 0 ? 1 + Z.t : DAY.t;
      let u = base + dy / (L.ZR * (base < 1 || (dy < 0 && base <= 1) ? (hero.rain ? hero.rain.P.dayLength : 2.4) : 1));
      if (reduce) u = dy > 0 ? (DAY.t < 1 ? 1 : 2) : Z.t > 0 ? 1 : 0;
      u = Math.max(0, Math.min(2, u));
      DAY.t = Math.min(1, u);
      Z.t = Math.max(0, u - 1);
      if (Z.t < 0.002) Z.t = 0; else if (Z.t > 0.998) Z.t = 1;
      if (DAY.t < 0.001) DAY.t = 0; else if (DAY.t > 0.999) DAY.t = 1;
      return;
    }
    const prev = Z.t;
    Z.t = clamp(Z.t - dy / L.ZR);
    if (Z.t < 0.002) Z.t = 0; else if (Z.t > 0.998) Z.t = 1;
    if (reduce && Z.t !== prev) Z.t = Z.t > prev ? 1 : 0;
  }
  // the camera follows the pull with a little inertia; when it rests at either end, it arrives
  function follow() {
    const dd = DAY.t - DAY.v;
    if (Math.abs(dd) > 0.0002) DAY.v += dd * (reduce ? 1 : 0.06); else DAY.v = DAY.t;
    // whenever the pages are in view, it is night on the landing
    if (Z.v > 0.02) { if (DAY.t < 1) DAY.t = 1; DAY.n = 0; }
    // and while someone stays on the landing, time passes on its own: the whole day in a few minutes
    const now = performance.now(), dt = Math.min(0.1, (now - (DAY.last || now)) / 1000);
    DAY.last = now;
    const per = hero.rain ? hero.rain.P.clock : 3;
    if (DAY.run && per > 0 && mode === "focus" && Z.center === "home" && Z.t === 0 && Z.v === 0 && !busy) {
      // real hours at an even pace: 24 of them in `clock` minutes
      const d = DAY.v + DAY.nv, step = (dt * 24) / (per * 60) / (hero.slope ? hero.slope(d) : 17);
      if (DAY.t < 1) { DAY.t = Math.min(1, DAY.t + step); DAY.v = Math.min(DAY.t, DAY.v + step); }
      else if (DAY.v > 0.999) {
        DAY.n += step;
        // morning again: the scroll starts over from here
        if (DAY.n >= NIGHT) DAY.t = DAY.v = DAY.n = DAY.nv = 0;
      }
    }
    DAY.nv += (DAY.n - DAY.nv) * (Math.abs(DAY.n - DAY.nv) > 0.02 ? (reduce ? 1 : 0.06) : 1);
    if (hero.day) hero.day(DAY.v + DAY.nv);
    if (Z.tw || busy) return;
    const dz = Z.t - Z.v;
    if (Math.abs(dz) > 0.0004) { Z.v += dz * (reduce ? 1 : 0.13); render(); }
    else if (Z.v !== Z.t) { Z.v = Z.t; render(); }
    else if (Z.v === 0 && mode !== "page" && (Z.center !== "home" || current !== "home")) arrive(Z.center);
    else if (Z.v === 1 && Z.center !== "home") { Z.center = "home"; render(); }
  }
  const norm = (e) => (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY);
  addEventListener("wheel", (e) => {
    if (mode === "page" && current === "work" && !caseOpen && !busy && rail.wheel(norm(e) + e.deltaX)) return;
    pull(norm(e));
  }, { passive: true });
  let ty = null;
  addEventListener("touchstart", (e) => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (ty === null) return;
    const y = e.touches[0].clientY, dy = (ty - y) * 1.2;
    ty = y;
    if (hero.wiping && hero.wiping()) return;
    pull(dy);
  }, { passive: true });
  addEventListener("touchend", () => { ty = null; }, { passive: true });
  addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea")) return;
    if (e.key === "Escape") { if (caseOpen) closeCase(); else if (mode === "page") go("overview"); else if (mode === "overview") go(current); return; }
    if (mode === "page" && current === "work" && !caseOpen && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { rail.key(e.key === "ArrowRight" ? 1 : -1); return; }
    if (mode === "focus" && ["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go("overview"); }
    else if (mode === "overview" && !busy && ["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(current); }
  });

  /* ---------------- the card steps aside whenever big type needs the corner ---------------- */
  const vcard = $("#vcard");
  function vcardRoom() {
    if (mode !== "page") { html.classList.remove("vc-off"); return; }
    const r = vcard.getBoundingClientRect();
    const hit = $$(".phero__title, .hello, .nextrow, .direct, .endline__txt", host).some((el) => {
      const b = el.getBoundingClientRect();
      return b.bottom > r.top - 8 && b.top < innerHeight && b.right > r.left;
    });
    html.classList.toggle("vc-off", hit);
  }

  /* ---------------- the bar steps aside while reading, returns on the way back ---------------- */
  let lastY = 0;
  addEventListener("scroll", () => {
    const y = window.scrollY;
    vcardRoom();
    if (mode !== "page") { html.classList.remove("bar-hidden"); lastY = 0; return; }
    if (y > 1) topSince = Infinity; else if (topSince === Infinity) topSince = performance.now();
    if (y > 160 && y > lastY + 4) html.classList.add("bar-hidden");
    else if (y < lastY - 4 || y < 160) html.classList.remove("bar-hidden");
    lastY = y;
  }, { passive: true });

  /* ---------------- clicks ---------------- */
  d.addEventListener("click", (e) => {
    const cp = e.target.closest("[data-copy]");
    if (cp) { copy(cp); return; }
    const a = e.target.closest("[data-go], [data-case], [data-close-case]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    if (a.hasAttribute("data-close-case")) { closeCase(); return; }
    if (a.dataset.case) {
      if (mode === "page" && current === "work") openCase(a.dataset.case);
      else go("work", { slug: a.dataset.case });
      return;
    }
    if (a.dataset.need) form.setNeed(a.dataset.need);
    if (isLocked(a.dataset.go)) { const b = boards[a.dataset.go]; if (!reduce) gsap.fromTo(b, { x: -8 }, { x: 0, duration: 0.6, ease: "elastic.out(1, 0.3)" }); return; }
    go(a.dataset.go);
  });
  addEventListener("popstate", () => {
    const r = parseRoute();
    if (caseOpen && !r.slug) closeCase(false);
    if (r.page !== current || mode !== "page" && r.page !== "home" || mode === "overview") go(r.page, { push: false, slug: r.slug });
    else if (r.slug) openCase(r.slug, false);
  });
  function copy(btn) {
    const em = $("em", btn), old = em.textContent;
    const done = () => { em.textContent = btn.dataset.copied; setTimeout(() => (em.textContent = old), 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(btn.dataset.copy).then(done, () => (location.href = "mailto:" + btn.dataset.copy));
    else location.href = "mailto:" + btn.dataset.copy;
  }

  /* ---------------- cursor label and board lift (overview) ---------------- */
  let hovered = null;
  // every frame, how the hovered card is turning: its sound floats with it
  gsap.ticker.add(() => {
    if (!hovered || !window.Sound || !Sound.on) return;
    const rx = gsap.getProperty(hovered, "rotationX"), ry = gsap.getProperty(hovered, "rotationY"), r = hovered.getBoundingClientRect();
    const now = performance.now(), dt = Math.max(0.008, (now - (hovered._t || now - 16)) / 1000);
    const w = Math.hypot(rx - (hovered._rx || rx), ry - (hovered._ry || ry)) / dt;
    hovered._rx = rx; hovered._ry = ry; hovered._t = now;
    Sound.cardMove(w, ((r.left + r.width / 2) / innerWidth) * 2 - 1, 1 - ((r.top + r.height / 2) / innerHeight) * 2, rx, ry);
  });
  const cursor = (() => {
    const el = $(".cursor"), label = $(".cursor__label");
    const x = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3" }), y = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3" });
    addEventListener("pointermove", (e) => { x(e.clientX); y(e.clientY); }, { passive: true });
    let typer = null;
    // the label writes itself in, quickly, like the voice does (with its soft keys when the sound is on)
    const show = (t) => {
      if (typer) typer.kill();
      el.classList.add("is-on");
      if (reduce) { label.textContent = t; return; }
      const o = { n: 0 };
      typer = gsap.to(o, { n: t.length, duration: Math.min(0.42, 0.028 * t.length + 0.06), ease: "none", onUpdate: () => { label.textContent = t.slice(0, Math.ceil(o.n)) || "\u00a0"; } });
      if (window.Sound) Sound.typeKeys(t.length, Math.min(0.42, 0.028 * t.length + 0.06));
    };
    return { show, hide: () => el.classList.remove("is-on") };
  })();
  for (const [id, b] of Object.entries(boards)) {
    const hit = $(".board__hit", b), name = b.dataset.soon || $(".board__label b", b).textContent;
    const still = () => busy || touch || Z.v < 0.999 || Z.tw;
    hit.addEventListener("pointerenter", () => { if (!still()) { cursor.show(name); b._lift = true; hovered = b; if (window.Sound) Sound.cardEnter(id); gsap.to(b, { scale: 1.03, z: 60, duration: 0.8, ease: "power3.out", overwrite: "auto" }); } });
    hit.addEventListener("pointermove", (e) => {
      if (still()) return;
      b._lift = true;
      const r = hit.getBoundingClientRect();
      gsap.to(b, { rotationX: ((e.clientY - r.top) / r.height - 0.5) * -6, rotationY: ((e.clientX - r.left) / r.width - 0.5) * 8, duration: 0.8, ease: "power3.out", overwrite: "auto" });
    });
    hit.addEventListener("pointerleave", () => { cursor.hide(); if (hovered === b) { hovered = null; if (window.Sound) Sound.cardLeave(); } if (!busy && Z.v >= 0.999) gsap.to(b, { scale: 1, z: 0, rotationX: 0, rotationY: 0, duration: 0.8, ease: "power3.out", overwrite: "auto" }); });
  }

  /* ---------------- home: a window on a rainy day ---------------- */
  const hero = (() => {
    const c = $(".hero__rain"), el = $(".hero"), tip = $(".touch");
    if (!c || !window.Rain || !Rain.supported) return {};
    const rain = new Rain(c, { img: c.dataset.img, mask: c.dataset.mask, reduce });
    rain.onLand = (x, s) => { if (window.Sound && Sound.on) Sound.tap(x, s); };
    rain.onTouch = (down, x) => { if (window.Sound) Sound.touch(down, x); };
    rain.onWet = (s) => { if (window.Sound) Sound.wet(s); };
    const live = () => mode !== "page" && !busy;
    const tx = gsap.quickTo(tip, "x", { duration: 0.2, ease: "power3" }), ty = gsap.quickTo(tip, "y", { duration: 0.2, ease: "power3" });
    // a mouse: press and drag to wipe the glass
    // what people write on the glass is read, and can take them somewhere
    let holdLabel = 0;
    const vEl = $(".voice"), voice = window.Voice && vEl ? new Voice(vEl, { lang: LANG, locked: ["work", "about", "services", "contact"].filter(isLocked) }) : null;
    const vx = vEl ? gsap.quickTo(vEl, "x", { duration: 0.35, ease: "power3" }) : () => {}, vy = vEl ? gsap.quickTo(vEl, "y", { duration: 0.35, ease: "power3" }) : () => {};
    if (vEl) gsap.set(vEl, { x: innerWidth * 0.5 - 120, y: innerHeight * 0.62 });
    const EMAIL = ($(".vcard__row[data-copy]") || { dataset: {} }).dataset.copy || "pol@polplanas.com";
    const effect = (k) => {
      if (k === "sun") gsap.timeline().to(rain.state, { sun: 1, duration: 3, ease: "sine.inOut" }).to(rain.state, { sun: 0, duration: 4, ease: "sine.inOut" }, "+=9");
      if (k === "rain") gsap.timeline().to(rain.state, { storm: 1, duration: 2, ease: "sine.inOut" }).to(rain.state, { storm: 0, duration: 5, ease: "sine.inOut" }, "+=10");
      // drawn on the glass: the hour and the sky answer
      const hour = (to) => { DAY.n = DAY.nv = 0; gsap.to(DAY, { t: to, duration: reduce ? 0 : 3.5, ease: "sine.inOut" }); };
      if (k === "day") { hour(0.2); gsap.timeline().to(rain.state, { sun: 1, duration: 3, ease: "sine.inOut" }).to(rain.state, { sun: 0, duration: 5, ease: "sine.inOut" }, "+=12"); }
      if (k === "night") hour(1);
      if (k === "cloud") gsap.timeline().to(rain.state, { storm: 0.45, duration: 3, ease: "sine.inOut" }).to(rain.state, { storm: 0, duration: 6, ease: "sine.inOut" }, "+=20");
      if (k === "storm") { gsap.timeline().to(rain.state, { storm: 1, duration: 2.5, ease: "sine.inOut" }).to(rain.state, { storm: 0, duration: 6, ease: "sine.inOut" }, "+=18"); gsap.delayedCall(2.6, () => { rain.state.flash = 0.9; gsap.to(rain.state, { flash: 0, duration: 1, ease: "power2.out" }); if (window.Sound) Sound.thunder(0.15); }); }
    };
    // every turn of the conversation goes through here
    let played = 0, nudged = 0, hints = 0;
    // quiet moments: when nobody has written for a while, or the hour turns, the voice says something small.
    // Never while someone is writing, never over another line, never too often
    let lastAct = performance.now(), nextIdle = 30000, idleN = 0, lastPeriod = null, idleBusy = false, lastSaid = 0;
    addEventListener("pointerdown", () => { lastAct = performance.now(); nextIdle = 30000; }, true);
    const periodOf = (h) => (h >= 6 && h < 10.5 ? "morning" : h >= 10.5 && h < 14.5 ? "midday" : h >= 14.5 && h < 18.3 ? "afternoon" : h >= 18.3 && h < 20.3 ? "sunset" : h >= 20.3 && h < 22.3 ? "evening" : "night");
    setInterval(async () => {
      if (!voice || idleBusy || mode !== "focus" || busy || !introEnd || document.hidden) return;
      const now = performance.now();
      if (now < introEnd + 8000 || vEl.classList.contains("is-on") || wiping || (ink && (ink.strokes.length || ink.busy))) return;
      const period = periodOf(hourNow), idle = now - lastAct;
      let reason = null;
      // the turns of the day worth a word: morning, sunset, night
      if (period !== lastPeriod) { if (lastPeriod !== null && idle > 6000 && ["morning", "sunset", "night"].includes(period)) reason = "hour"; lastPeriod = period; }
      if (!reason && idle > nextIdle) reason = "idle";
      if (!reason || idleN >= 8 || now - lastSaid < 35000) return;
      idleN++; lastSaid = now; nextIdle = idle + 40000 + Math.random() * 35000; idleBusy = true;
      try {
        const text = await voice.ambient({ period, hour: hourNow, storm: rain.state.storm > 0.5, rain: rain.state.rain * (1 + rain.state.storm), idle });
        if (text && mode === "focus" && !busy && !vEl.classList.contains("is-on") && performance.now() - lastAct > 4000 && !wiping) voice.say(text, Math.min(7, 2.6 + text.length / 22));
      } finally { idleBusy = false; }
    }, 1000);
    const ignored = () => {
      if (!voice || mode !== "focus") return;
      played++;
      const now = performance.now();
      if (played >= 2 && now - nudged > 20000 && !vEl.classList.contains("is-on")) { nudged = now; played = 0; voice.say(voice.nudge(), 5); }
    };
    const handle = async (input) => {
      if (mode !== "focus" || busy || !voice) return;
      const a = await voice.answer(input);
      if (!a || !a.text || mode !== "focus") return;
      const hold = Math.min(9, 2.4 + a.text.length / 22);
      if (a.fx) effect(a.fx);
      if (a.go) { voice.say(a.text, 2.4); gsap.delayedCall(2.4, () => { if (mode === "focus" && !busy) go(a.go); }); return; }
      if (a.mail) { voice.say(a.text, 4); gsap.delayedCall(1.6, () => { location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("polplanas.com")}`; }); return; }
      voice.say(a.text, a.waking ? 30 : hold, a.waking ? "waking" : "");
    };
    const ink = window.Ink ? new Ink({ lang: LANG,
      // only a real attempt to say something gets an answer; playing with the glass is left in peace,
      // with a gentle reminder now and then of what the glass can do
      onInk: (input) => {
        if (window.__pp) (window.__inks = window.__inks || []).push(input);
        if (!voice || !voice.deliberate(input)) return ignored();
        played = 0;
        if (!noBrain && !voice.brain) (window.requestIdleCallback || setTimeout)(() => voice.wake(), { timeout: 4000 });
        voice.typing(20);
        handle(input);
      },
      onIgnore: () => ignored(),
    }) : null;
    let wrote = false, lastHint = 0, introEnd = Infinity;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button || !live() || mode !== "focus") return;
      if (rain.down(e.clientX, e.clientY)) {
        tip.classList.add("is-down");
        if (ink) ink.down(e.clientX, e.clientY);
        if (!wrote) { wrote = true; if (voice) voice.hush(); }
      }
    });
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || !live()) return;
      rain.move(e.clientX, e.clientY);
      if (ink && rain.finger) ink.move(e.clientX, e.clientY);
      const over = mode === "focus" && !!e.target.closest(".hero");
      tip.classList.toggle("is-on", over);
      // until someone writes, the voice keeps inviting them to
      if (over && !wrote && hints < 2 && voice && !vEl.classList.contains("is-on") && performance.now() - lastHint > 9000 && performance.now() > introEnd) { lastHint = performance.now(); hints++; voice.say(voice.step ? voice.nudge() : voice.opener(), 5.5); }
      const d = Math.round(rain.fingerRadius() * 2);
      if (tip._d !== d) { tip._d = d; Object.assign(tip.style, { width: d + "px", height: d + "px", margin: `${-d / 2}px 0 0 ${-d / 2}px` }); }
      tx(e.clientX); ty(e.clientY);
      vx(Math.min(e.clientX + (tip._d || 40) / 2 + 14, innerWidth - 300)); vy(e.clientY - 9);
    }, { passive: true });
    addEventListener("pointerup", () => { if (rain.finger && ink) ink.up(); rain.up(); tip.classList.remove("is-down"); });
    el.addEventListener("pointerleave", () => { rain.up(); tip.classList.remove("is-on", "is-down"); });
    // a finger: rest it on the glass for a moment, then drag; a quick flick still scrolls
    let hold = null, wiping = false;
    el.addEventListener("touchstart", (e) => {
      if (!live() || mode !== "focus") return;
      const t0 = e.touches[0];
      clearTimeout(hold);
      hold = setTimeout(() => { wiping = rain.down(t0.clientX, t0.clientY); if (wiping && ink) ink.down(t0.clientX, t0.clientY); }, 170);
    }, { passive: true });
    el.addEventListener("touchmove", (e) => { const t0 = e.touches[0]; if (wiping) { rain.move(t0.clientX, t0.clientY); if (ink) ink.move(t0.clientX, t0.clientY); } else clearTimeout(hold); }, { passive: true });
    el.addEventListener("touchend", () => { clearTimeout(hold); if (wiping && ink) ink.up(); wiping = false; rain.up(); }, { passive: true });
    // the light: afternoon when you arrive; scrolling brings the sunset, then the night
    const label = $(".hero__sky"), words = label ? JSON.parse(label.dataset.labels) : {};
    // six moments of light, from a cool 7 a.m. to midnight, blended smoothly as you scroll
    const KEYS = [
      { at: 0, h: 7, sat: 0.72, bright: 0.66, contrast: 0.9, tint: [0.93, 0.98, 1.06], lift: [0.03, 0.035, 0.042], glow: [0.07, 0.05, 0.035], night: 0 },
      { at: 0.2, h: 12, sat: 0.9, bright: 0.86, contrast: 1.04, tint: [1, 1, 0.99], lift: [0.012, 0.012, 0.012], glow: [0, 0, 0], night: 0 },
      { at: 0.42, h: 16, sat: 0.92, bright: 0.8, contrast: 1.03, tint: [1.06, 1, 0.9], lift: [0.012, 0.01, 0.006], glow: [0.05, 0.035, 0.012], night: 0 },
      { at: 0.62, h: 19, sat: 0.98, bright: 0.72, contrast: 1.1, tint: [1.24, 0.86, 0.62], lift: [0.02, 0.008, 0], glow: [0.2, 0.08, 0.02], night: 0 },
      { at: 0.81, h: 21, sat: 0.62, bright: 0.36, contrast: 0.96, tint: [0.64, 0.72, 1.02], lift: [0.004, 0.008, 0.022], glow: [0.02, 0.012, 0.035], night: 0.6 },
      { at: 1, h: 24, sat: 0.5, bright: 0.14, contrast: 1, tint: [0.56, 0.68, 1], lift: [0.002, 0.004, 0.011], glow: [0, 0, 0], night: 1 },
      { at: 1 + 5 / 17, h: 29, sat: 0.5, bright: 0.14, contrast: 1, tint: [0.56, 0.68, 1], lift: [0.002, 0.004, 0.011], glow: [0, 0, 0], night: 1 },
      { at: 1 + 6 / 17, h: 30, sat: 0.56, bright: 0.38, contrast: 0.94, tint: [0.86, 0.84, 1.02], lift: [0.014, 0.014, 0.024], glow: [0.06, 0.03, 0.03], night: 0.35 },
    ];
    KEYS.push({ ...KEYS[0], at: 1 + 7 / 17, h: 31 });
    // hours per unit of day progress around d
    const slope = (d) => { let i = 0; while (i < KEYS.length - 2 && d >= KEYS[i + 1].at) i++; return (KEYS[i + 1].h - KEYS[i].h) / (KEYS[i + 1].at - KEYS[i].at); };
    const lerp = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t);
    let lastLabel = "";
    let hourNow = 7;
    const day = (d) => {
      let i = 0;
      while (i < KEYS.length - 2 && d > KEYS[i + 1].at) i++;
      const A = KEYS[i], B = KEYS[i + 1], u = Math.min(1, Math.max(0, (d - A.at) / (B.at - A.at))), t = u * u * (3 - 2 * u);
      hourNow = (A.h + (B.h - A.h) * u) % 24;
      const g = rain.state.grade;
      for (const k of ["sat", "bright", "contrast", "tint", "lift", "glow"]) g[k] = lerp(A[k], B[k], t);
      rain.state.night = lerp(A.night, B.night, t);
      if (!label) return;
      const min = Math.round((A.h + (B.h - A.h) * u) * 60) % 1440, hh = Math.floor(min / 60), text = `${String(hh).padStart(2, "0")}:${String(min % 60).padStart(2, "0")} · ${rain.state.storm > 0.5 ? words.storm : hh < 10 && hh >= 5 ? words.morning : hh < 14 && hh >= 5 ? words.noon : hh < 18 && hh >= 5 ? words.afternoon : hh < 20 && hh >= 5 ? words.sunset : hh < 22 && hh >= 5 ? words.evening : words.night}`;
      if (performance.now() < holdLabel) { lastLabel = ""; return; }
      if (text !== lastLabel) { label.textContent = text; lastLabel = text; }
    };
    day(0);
    // if there is a real storm where the visitor is, it storms here too
    const strike = () => {
      if (rain.state.storm > 0.5 && mode !== "page" && !reduce)
        (window.Sound && Sound.thunder(Math.random() * 0.85 + 0.1), gsap.timeline().to(rain.state, { flash: 0.9, duration: 0.05 })).to(rain.state, { flash: 0.12, duration: 0.09 }).to(rain.state, { flash: 0.7, duration: 0.05 }).to(rain.state, { flash: 0, duration: 0.9, ease: "power2.out" });
      gsap.delayedCall(6 + Math.random() * 14, strike);
    };
    const q = new URLSearchParams(location.search);
    const setStorm = (v) => gsap.to(rain.state, { storm: v, duration: 4, ease: "sine.inOut" });
    if (q.get("sky") === "storm") setStorm(1);
    else if (window.Sky) { const L = Sky.light(new Date()); Sky.weather(L.lat, L.lon).then((w) => w.storm && setStorm(w.storm)); }
    gsap.delayedCall(5, strike);
    // ?tune opens the live settings panel
    if (q.has("tune")) {
      try { const st = JSON.parse(localStorage.getItem("pp-rain-tune-3") || "null"); if (st) Object.assign(rain.P, st); } catch (e) {}
      import("/assets/js/tune.js").then((m) => m.tune(rain, (mode) => {
        const at = typeof mode === "number" ? mode : { dawn: 0, day: 0.2, dusk: 0.62, night: 1 }[mode];
        if (at !== undefined) { DAY.t = DAY.v = at; DAY.n = DAY.nv = 0; }
        if (typeof mode !== "number") setStorm(mode === "storm" ? 1 : 0);
      }));
      window.rain = rain;
    }

    // a hidden one: type "sun" (or "sol") and the rain stops for a while
    let keys = "";
    addEventListener("keydown", (e) => {
      if (mode === "page" || e.key.length !== 1) return;
      keys = (keys + e.key.toLowerCase()).slice(-3);
      if (keys === "sun" || keys.endsWith("sol")) {
        keys = "";
        gsap.timeline().to(rain.state, { sun: 1, duration: 3, ease: "sine.inOut" }).to(rain.state, { sun: 0, duration: 4, ease: "sine.inOut" }, "+=9");
      }
    });
    // the voice says hello once the landing has settled
    // once everything has loaded and settled, the voice says hello
    const greet = () => gsap.delayedCall(reduce ? 0.3 : 1.5, () => {
      introEnd = performance.now();
      DAY.run = true;
      if (voice && mode === "focus" && !wrote) { lastHint = performance.now(); voice.say(voice.opener(), 7.5); }
    });
    // the brain starts waking at once (the loading screen waits for it); ?nobrain skips it, for tests
    const noBrain = /[?&]nobrain\b/.test(location.search);
    // a guard for any machine: if the model makes the window stutter for several seconds, it is let go,
    // and the written lines carry the conversation on
    let heavy = 0;
    setInterval(() => {
      const b = voice && voice.brain, ad = rain && rain.ad;
      if (!b || b.off || !b.w || !ad || document.hidden) { heavy = 0; return; }
      heavy = ad.ema > 40 ? heavy + 1 : 0;
      if (heavy >= 5) { try { b.w.terminate(); } catch (e) {} b.off = true; b.ready = false; b.status = "let go: too heavy for this machine"; console.info("[cervell] let go: the window was stuttering"); }
    }, 1000);
    return { rain, day, slope, voice, greet, hour: () => hourNow, wiping: () => wiping };
  })();

  /* ---------------- the preview that follows the pointer over lists ---------------- */
  const preview = (() => {
    const box = $(".preview"), c = $(".preview__fx");
    const rows = $$(".irow[data-img], .drow[data-img]");
    if (!FXOK || touch || !box || !rows.length) return { hide() {} };
    const srcs = [...new Set(rows.map((r) => r.dataset.img))];
    let fx = null, on = false;
    const x = gsap.quickTo(box, "x", { duration: 0.7, ease: "power3" }), y = gsap.quickTo(box, "y", { duration: 0.7, ease: "power3" });
    let row = null;
    const place = (e, jump) => {
      const w = box.offsetWidth, h = box.offsetHeight;
      // stay clear of the row's text: between the name and the columns on the right
      const avoid = row && $(".irow__c, .drow__text", row);
      const limit = avoid && avoid.offsetParent ? avoid.getBoundingClientRect().left - w - 20 : innerWidth - w - 14;
      const px = Math.max(14, Math.min(e.clientX + 32, limit)), py = Math.max(14, Math.min(e.clientY - h / 2, innerHeight - h - 14));
      if (jump) gsap.set(box, { x: px, y: py }); x(px); y(py);
    };
    rows.forEach((r) => {
      r.addEventListener("pointerenter", (e) => {
        if (mode !== "page") return;
        row = r;
        if (!fx) fx = new FX(c, { srcs, pix: 3, contrast: 1.3, dpr: 1.25 });
        fx.show(srcs.indexOf(r.dataset.img), on ? 0.7 : 0);
        fx.set("clean", 0);
        gsap.to(fx.state, { clean: 1, duration: 1.1, delay: 0.15, ease: "power2.inOut", overwrite: true });
        place(e, !on);
        on = true;
        box.classList.add("is-on");
      });
      r.addEventListener("pointermove", (e) => on && place(e));
      r.addEventListener("pointerleave", (e) => { if (!e.relatedTarget || !e.relatedTarget.closest("[data-img]")) hide(); });
    });
    const hide = () => { on = false; box.classList.remove("is-on"); };
    let lx = 0, ly = 0;
    addEventListener("pointermove", (e) => { lx = e.clientX; ly = e.clientY; }, { passive: true });
    // while the page glides under a still pointer, keep the picture only if the pointer is still on its row
    addEventListener("scroll", () => { if (on && !(d.elementFromPoint(lx, ly) || { closest: () => null }).closest("[data-img]")) hide(); }, { passive: true });
    return { hide };
  })();

  /* ---------------- pictures develop when they come into view ---------------- */
  const tileIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const t = e.target, hi = $(".tile__hi", t);
    const reveal = () => setTimeout(() => t.classList.add("is-on"), (+t.dataset.delay || 0) * 1000);
    if (hi.dataset.src && !hi.getAttribute("src")) { hi.addEventListener("load", reveal, { once: true }); hi.src = hi.dataset.src; }
    else if (hi.complete && hi.naturalWidth) reveal(); else hi.addEventListener("load", reveal, { once: true });
    tileIO.unobserve(t);
  }), { rootMargin: "0px 0px -8% 0px" });
  $$(".strip .tile").forEach((t, i) => (t.dataset.delay = (i * 0.08).toFixed(2)));
  $$(".tile").forEach((t) => tileIO.observe(t));

  /* ---------------- pages ---------------- */
  const words = (el) => el._split || (el._split = SplitText.create(el, { type: "words" }));
  const scrubWords = (el, trigger) => gsap.fromTo(words(el).words, { opacity: 0.14 }, { opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: { trigger: trigger || el, start: "top 75%", end: "bottom 55%", scrub: 0.6 } });
  const lines = (el) => el._lines || (el._lines = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "ln" }));
  // lines are split when they are about to show, so they always break with the real face at the real width
  const riseLines = (el, start = "top 82%") => {
    if (!el) return;
    if (!el._lines) gsap.set(el, { clipPath: "inset(0 0 100% 0)" });
    ScrollTrigger.create({ trigger: el, start, once: true, onEnter: () => {
      if (el._lines) { el._lines.revert(); el._lines = null; }
      gsap.set(el, { clipPath: "none" });
      gsap.from(lines(el).lines, { yPercent: 105, duration: 1.2, ease: EO, stagger: 0.08 });
    } });
  };

  /* ---------------- work: a rail of projects you move with the wheel, a drag or a swipe ---------------- */
  const rail = (() => {
    const el = $(".wk__rail");
    if (!el) return { wheel: () => false, layout() {}, key() {} };
    const items = $$(".wk__item", el), pics = items.map((i) => $(".wk__img img", i));
    const count = $(".wk__count b"), bar = $(".wk__bar");
    let target = 0, driving = false, drag = null, dragged = false;
    const max = () => Math.max(0, el.scrollWidth - el.clientWidth);
    function layout() {
      const cap = ($(".wk__cap", el) || { offsetHeight: 24 }).offsetHeight + 10;
      const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
      el.style.setProperty("--ih", Math.max(140, el.clientHeight - pad - cap) + "px");
      target = el.scrollLeft;
      update();
    }
    function update() {
      const m = max(), p = m ? el.scrollLeft / m : 0, frac = el.scrollWidth ? el.clientWidth / el.scrollWidth : 1;
      bar.style.setProperty("--tw", (frac * 100).toFixed(2) + "%");
      bar.style.setProperty("--tx", ((p * (1 - frac)) / frac * 100).toFixed(2) + "%");
      const n = Math.round(p * (items.length - 1)) + 1;
      if (count.textContent !== String(n).padStart(2, "0")) count.textContent = String(n).padStart(2, "0");
      // each picture drifts a little inside its frame, so the rail has depth
      if (reduce) return;
      const r = el.getBoundingClientRect(), mid = r.left + r.width / 2;
      items.forEach((it, i) => {
        const b = it.getBoundingClientRect(), off = (b.left + b.width / 2 - mid) / r.width;
        pics[i].style.transform = `translateX(${(off * -9).toFixed(2)}%)`;
      });
    }
    el.addEventListener("scroll", () => { if (!driving) target = el.scrollLeft; update(); }, { passive: true });
    // the title above fits itself to the width, so the rail's height is only known after it
    new ResizeObserver(() => layout()).observe(el);
    gsap.ticker.add(() => {
      if (!driving) return;
      const d = target - el.scrollLeft;
      if (Math.abs(d) < 0.5) { el.scrollLeft = target; driving = false; return; }
      el.scrollLeft += d * (reduce ? 1 : 0.1);
    });
    const go = (t) => { target = gsap.utils.clamp(0, max(), t); driving = true; };
    // the wheel moves the rail; at its start, scrolling up hands over to the camera
    const wheel = (dy) => {
      if (dy < 0 && target <= 0.5 && el.scrollLeft <= 1) return false;
      go(target + dy);
      return true;
    };
    const key = (dir) => go(target + dir * (items[0].offsetWidth + 14));
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button) return;
      drag = { x: e.clientX, t: target }; dragged = false;
    });
    addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 5) { dragged = true; el.classList.add("is-drag"); cursor.hide(); }
      if (dragged) go(drag.t - dx * 1.4);
    });
    addEventListener("pointerup", () => { drag = null; el.classList.remove("is-drag"); });
    el.addEventListener("click", (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
    items.forEach((it) => {
      const link = $(".wk__link", it);
      link.addEventListener("pointerenter", () => { if (!touch && mode === "page" && !drag) cursor.show(link.closest(".page").dataset.open || ""); });
      link.addEventListener("pointerleave", () => cursor.hide());
    });
    return { wheel, layout, key };
  })();

  const PAGE = {
    work: {
      init() { rail.layout(); },
    },
    about: {
      init(page) {
        const dev = $(".dev", page), c = $(".dev__fx", page);
        if (FXOK && c && !c._fx) c._fx = new FX(c, { srcs: [c.dataset.src], pix: reduce ? 2 : 16, clean: reduce ? 1 : 0, contrast: 1.2, grain: 0.03 });
        if (reduce) return;
        scrubWords($(".say__text", page), $(".say", page));
        $$(".chip", page).forEach((ch) => gsap.fromTo(ch, { clipPath: "inset(0% 50% 0% 50%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", scrollTrigger: { trigger: ch, start: "top 85%", end: "top 62%", scrub: 0.6 } }));
        // the portrait is printed coarse and develops into the photograph as you read
        if (c && c._fx) {
          const fx = c._fx;
          ScrollTrigger.create({ trigger: dev, start: "top 70%", end: "bottom bottom", scrub: 0.8, onUpdate: (s) => { fx.set("pix", 16 - 14 * sstep(0, 0.7, s.progress)); fx.set("clean", sstep(0.45, 0.95, s.progress)); } });
        }
        $$(".truth__big", page).forEach((el) => riseLines(el));
        riseLines($(".dev__proof", page));
      },
    },
    services: {
      init(page) {
        if (reduce) return;
        scrubWords($(".how__text", page), $(".how", page));
      },
    },
    contact: {
      init(page) {
        form.resize();
        if (reduce) return;
        gsap.from($$(".madlib__text > .mk > span", page), { yPercent: 118, duration: 1.15, ease: EO, stagger: 0.04, scrollTrigger: { trigger: $(".madlib", page), start: "top 78%", once: true } });
      },
    },
  };

  /* ---------------- questions open like drawers ---------------- */
  $$(".qrow__head").forEach((b) => b.addEventListener("click", () => {
    const open = b.getAttribute("aria-expanded") !== "true", body = b.nextElementSibling;
    b.setAttribute("aria-expanded", String(open));
    gsap.to(body, { height: open ? "auto" : 0, duration: reduce ? 0 : 0.7, ease: "power3.inOut", onComplete: () => ScrollTrigger.refresh() });
  }));

  /* ---------------- the business card: tilts toward you, turns over when touched ---------------- */
  (() => {
    const card = $(".bcard");
    if (!card) return;
    const wrap = card.closest(".phero");
    card.addEventListener("click", () => card.classList.toggle("is-flipped"));
    if (touch || reduce) return;
    const rx = gsap.quickTo(card, "rotationX", { duration: 0.9, ease: "power3" }), ry = gsap.quickTo(card, "rotationY", { duration: 0.9, ease: "power3" });
    wrap.addEventListener("pointermove", (e) => {
      if (mode !== "page") return;
      const r = card.getBoundingClientRect();
      rx(gsap.utils.clamp(-1, 1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)) * -12);
      ry(gsap.utils.clamp(-1, 1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)) * 16);
    });
    wrap.addEventListener("pointerleave", () => { rx(0); ry(0); });
  })();

  /* ---------------- case studies ---------------- */
  function openCase(slug, push = true) {
    const art = $(`.case[data-slug="${slug}"]`);
    if (!art) return;
    const wrap = $("#cases");
    if (caseOpen && caseOpen !== art) caseOpen.hidden = true;
    wrap.hidden = false; art.hidden = false; art.scrollTop = 0;
    caseOpen = art;
    html.setAttribute("data-case-open", "");
    preview.hide();
    if (lenis) lenis.stop();
    fitAll(art);
    if (!reduce) gsap.fromTo($(".case__poster", art), { scale: 1.12 }, { scale: 1, duration: 2.2, ease: EO, delay: 0.2 });
    gsap.fromTo(art, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: reduce ? 0 : 1.1, ease: "power4.inOut" });
    if (!reduce) gsap.fromTo($(".case__title", art), { yPercent: 40 }, { yPercent: 0, duration: 1.6, ease: EO, delay: 0.35 });
    $$(".tile", art).forEach((t) => tileIO.observe(t));
    if (TITLES.cases && TITLES.cases[slug]) d.title = TITLES.cases[slug];
    if (push) history.pushState({}, "", pathOf("work", slug));
    $(".case__close", art).focus({ preventScroll: true, focusVisible: false });
  }
  function closeCase(push = true) {
    if (!caseOpen) return;
    const art = caseOpen;
    caseOpen = null;
    html.removeAttribute("data-case-open");
    gsap.to(art, { clipPath: "inset(0% 0% 100% 0%)", duration: reduce ? 0 : 0.8, ease: "power3.inOut", onComplete: () => { art.hidden = true; $("#cases").hidden = true; gsap.set(art, { clearProps: "clipPath" }); } });
    if (lenis && mode === "page") lenis.start();
    if (TITLES[current]) d.title = TITLES[current];
    if (push) history.pushState({}, "", pathOf(current));
  }

  /* ---------------- the sentence form ---------------- */
  const form = (() => {
    const f = $("#form");
    if (!f) return { setNeed() {}, resize() {} };
    const ctx = d.createElement("canvas").getContext("2d");
    const fields = $$("input", f), select = $("select", f);
    const size = (el) => {
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const txt = el.tagName === "SELECT" ? el.options[el.selectedIndex].text : el.value || el.placeholder;
      const fs = parseFloat(cs.fontSize), track = parseFloat(cs.letterSpacing) || 0;
      el.style.width = Math.ceil(ctx.measureText(txt).width + track * txt.length + fs * (el.tagName === "SELECT" ? 1.2 : 0.1)) + "px";
    };
    const resize = () => [...fields, select].forEach(size);
    fields.forEach((i) => i.addEventListener("input", () => { size(i); i.closest(".slot").classList.remove("is-invalid"); $(".madlib__error", f).textContent = ""; }));
    select.addEventListener("change", () => size(select));
    (d.fonts ? d.fonts.ready : Promise.resolve()).then(resize);
    addEventListener("resize", resize);
    const check = () => {
      const bad = [];
      for (const i of fields) {
        const v = i.value.trim();
        const ok = i.type === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) : v.length > 1;
        i.closest(".slot").classList.toggle("is-invalid", !ok);
        i.setAttribute("aria-invalid", String(!ok));
        if (!ok) bad.push(i);
      }
      return bad;
    };
    const done = (title, text) => {
      const box = $(".done", f.parentElement);
      $(".done__title", box).textContent = title;
      $(".done__text", box).textContent = text;
      f.hidden = true; box.hidden = false; box.focus({ preventScroll: true });
      if (!reduce) gsap.from(box.children, { yPercent: 50, clipPath: "inset(0 0 100% 0)", duration: 1.2, ease: EO, stagger: 0.08 });
      ScrollTrigger.refresh();
    };
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const bad = check(), err = $(".madlib__error", f);
      if (bad.length) { err.textContent = f.dataset["err" + bad[0].name[0].toUpperCase() + bad[0].name.slice(1)]; bad[0].focus(); return; }
      const data = Object.fromEntries(new FormData(f));
      data.needLabel = select.options[select.selectedIndex].text;
      data.language = LANG;
      const sentence = [...$(".madlib__text", f).childNodes].map((n) => {
        const inps = n.querySelectorAll ? [...n.querySelectorAll("input, select")] : [];
        if (!inps.length) return n.textContent;
        return [...n.firstElementChild.childNodes].map((c) => {
          const inp = c.querySelector ? c.querySelector("input, select") : null;
          return inp ? (inp.tagName === "SELECT" ? data.needLabel : inp.value.trim()) : c.textContent;
        }).join("");
      }).join("").replace(/\s+/g, " ").trim();
      data.sentence = sentence;
      if (f.dataset.endpoint) {
        const b = $("button[type=submit]", f), roll = $(".btn__roll", b), old = roll.textContent;
        b.disabled = true; roll.textContent = roll.dataset.text = f.dataset.sending;
        try {
          const r = await fetch(f.dataset.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
          if (!r.ok) throw new Error(r.status);
          done(f.dataset.okTitle, f.dataset.okText);
        } catch (x) { err.textContent = f.dataset.errSend; b.disabled = false; roll.textContent = roll.dataset.text = old; }
      } else {
        location.href = `mailto:${f.dataset.email}?subject=${encodeURIComponent(`${f.dataset.subject}: ${data.business}`)}&body=${encodeURIComponent(sentence)}`;
        done(f.dataset.mailtoTitle, f.dataset.mailtoText);
      }
    });
    return { setNeed: (id) => { select.value = id; size(select); }, resize };
  })();

  /* ---------------- home intro: the light comes up behind the glass, the rain starts, then the name ---------------- */
  function intro(logoDone = false, paused = false) {
    const shown = () => gsap.set("[data-intro]", { visibility: "visible" });
    const rain = hero.rain;
    if (reduce) { shown(); if (rain) rain.set("expo", 1); return null; }
    let seen = false;
    try { seen = !!sessionStorage.getItem("pp-seen"); sessionStorage.setItem("pp-seen", "1"); } catch (e) {}
    const k = seen ? 0.6 : 1;
    shown();
    const tl = gsap.timeline({ delay: paused ? 0 : 0.15, paused });
    if (rain) {
      rain.set("rain", 0.2);
      tl.to(rain.state, { expo: 1, duration: 2.6 * k, ease: "power2.out" }, 0)
        .to(rain.state, { rain: 1, duration: 3, ease: "sine.in" }, 0.4 * k);
    }
    // the name is traced as a fine line, then fills from below like water rising behind it
    const trace = $(".hero__trace"), wave = $(".hero__wave");
    if (trace && wave && !logoDone) {
      const len = trace.getTotalLength();
      gsap.set(trace, { opacity: 1, strokeDasharray: len, strokeDashoffset: len });
      gsap.set(wave, { attr: { transform: "translate(0 250)" } });
      const w = { x: 0, y: 250 };
      const put = () => wave.setAttribute("transform", `translate(${w.x.toFixed(1)} ${w.y.toFixed(1)})`);
      tl.to(trace, { strokeDashoffset: 0, duration: 2.1 * k, ease: "power2.inOut" }, 0.8 * k)
        .to(w, { y: -40, duration: 1.7 * k, ease: "power3.inOut", onUpdate: put }, 1.9 * k)
        .to(w, { x: -240, duration: 2.2 * k, ease: "none", onUpdate: put }, 1.9 * k)
        .to(trace, { opacity: 0, duration: 0.9, ease: "power1.out" }, 3.2 * k);
    }
    const at = logoDone ? 0.9 : 2.9 * k;
    const split = SplitText.create(".hero__line", { type: "lines", mask: "lines" });
    tl.from(split.lines, { yPercent: 110, duration: 1.3, ease: EO, stagger: 0.07 }, at)
      .from(".hero__sky", { yPercent: 120, clipPath: "inset(0 0 100% 0)", duration: 1.1, ease: EO }, at - 0.05)
      .from(".bar__all, .bar__sound", { yPercent: -140, duration: 1.2, ease: EO }, at + 0.2)
      .from(".vcard", { yPercent: 130, duration: 1.4, ease: EO }, at + 0.3);
    // whatever happens during the intro, it always ends complete
    tl.eventCallback("onInterrupt", () => tl.progress(1));
    return tl;
  }

  /* ---------------- loading: the logo fills with water as the window and the voice get ready ---------------- */
  function load(introTl) {
    const el = $("#loader");
    if (!el) return Promise.resolve(false);
    return new Promise((done) => {
      const trace = $(".loader__trace", el), fill = $(".loader__fill", el), pct = $(".loader__pct", el), skip = $(".loader__skip", el);
      const len = trace.getTotalLength();
      gsap.set(trace, { strokeDasharray: len, strokeDashoffset: reduce ? 0 : len });
      if (!reduce) gsap.to(trace, { strokeDashoffset: 0, duration: 1.8, ease: "power2.inOut" });
      // the fill runs left to right like a progress bar, with a clean edge
      const st = { shown: 0, peak: 0 }, t0 = performance.now();
      const put = () => fill.setAttribute("width", (20 + st.shown * 770).toFixed(1));
      put();
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        gsap.ticker.remove(tick);
        // the hero logo sits exactly under this one: once the dark lifts, it simply stays
        gsap.set(".hero__title", { visibility: "visible" });
        const enter = () => { if (window.Sound) Sound.enter(); };
        gsap.timeline({ onComplete: () => { el.remove(); enter(); done(true); } })
          .to(st, { shown: 1, duration: 0.45, ease: "power2.out", onUpdate: put })
          .to([trace, pct, skip, $(".loader__sound", el)], { opacity: 0, duration: 0.5, ease: "power1.out" }, 0.15)
          .add(() => { if (introTl) introTl.play(); enter(); }, 0.5)
          .to(el, { backgroundColor: "rgba(5, 6, 5, 0)", duration: reduce ? 0 : 1.3, ease: "power2.inOut" }, 0.5)
          .set($(".loader__logo", el), { opacity: 0 });
      };
      skip.addEventListener("click", finish);
      const tick = () => {
        const now = performance.now(), v = hero.voice, b = v && v.brain;
        const scene = hero.rain ? (hero.rain.ready ? 1 : 0) : 1;
        const mind = !b || b.off || b.ready ? (b && !b.ready && !b.off && b.status === "checking" ? 0 : 1) : 0.05 + b.progress * 0.88;
        // progress only ever moves forward, even when a new file starts and the raw percentage dips
        st.peak = Math.max(st.peak, Math.min(1, 0.12 * scene + 0.88 * mind));
        st.shown += (st.peak - st.shown) * (reduce ? 1 : 0.06);
        put();
        const n = Math.floor(st.shown * 100);
        if (pct.textContent !== n + "%") { pct.textContent = n + "%"; el.setAttribute("aria-valuenow", n); }
        if (now - t0 > 14000) skip.classList.add("is-on");
        if (st.peak >= 1 && st.shown > 0.985 && now - t0 > (reduce ? 300 : 2100)) finish();
      };
      gsap.ticker.add(tick);
    });
  }

  if (/[?&]test\b/.test(location.search)) window.__pp = { Z, DAY, boards, cam, L, get mode() { return mode; }, get busy() { return busy; } };

  /* ---------------- start ---------------- */
  layout();
  const r0 = parseRoute();
  Z.center = r0.page;
  render();
  setRoute(r0.page);
  for (const id of Object.keys(PAGE)) { const p = $(".page", view(id)); if (p && PAGE[id].preview) PAGE[id].preview(p); }
  if (r0.page === "home") setMode("focus");
  html.classList.add("ready");
  gsap.ticker.add(() => {
    follow();
    const now = performance.now();
    if (hero.rain) { hero.rain.active = mode !== "page"; hero.rain.tick(now); }
    if (FXOK) FX.tick(now);
    // the sound follows the scene: rain, wind, hour, storm, the camera pulling back, the fingertip
    if (window.Sound && Sound.on && hero.rain) {
      const r = hero.rain, s = r.state;
      Sound.fingerMove(r.finger ? r.fspeed || 0 : 0, r.finger ? r.finger.x * 2 - 1 : 0, r.fturn || 0, now);
      if (r.fturn > 0.5) r.fturn = 0.49;
      Sound.update({ rain: s.rain * (1 - s.sun) * (1 + s.storm * 0.8), wind: r.wind.v, gust: r.wind.gust, night: s.night, storm: s.storm, hour: hero.hour ? hero.hour() : 12, zoom: Z.v, page: mode === "page" ? 1 : 0, muffle: mode === "page" ? 1 : Math.min(1, Z.v * 1.2), finger: r.finger ? r.fspeed || 0 : 0, fx: r.finger ? r.finger.x * 2 - 1 : 0 }, now);
    }
  });
  const fontsReady = Promise.race([d.fonts ? d.fonts.ready : Promise.resolve(), new Promise((res) => setTimeout(res, 1600))]);
  fontsReady.then(() => {
    // pages split their lines only once the real faces are in
    if (r0.page !== "home") openPage(r0.page);
    fitAll();
    if (r0.page === "home") {
      // with a loading screen, the landing's entrance is set up underneath it, paused, and plays once when it lifts
      if ($("#loader")) { const tl = intro(true, true); load(tl).then(() => { if (!tl) gsap.set("[data-intro]", { visibility: "visible" }); if (hero.greet) hero.greet(); }); }
      else { intro(); if (hero.greet) gsap.delayedCall(3, hero.greet); }
    } else { gsap.set("[data-intro]", { visibility: "visible" }); if (hero.rain) hero.rain.set("expo", 1); }
    if (r0.slug) openCase(r0.slug, false);
    ScrollTrigger.refresh();
  });

  // a face that arrives late re-fits the titles
  if (d.fonts) d.fonts.addEventListener("loadingdone", () => { fitAll(); form.resize(); });

  let rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      layout();
      render();
      fitAll();
      rail.layout();
      if (mode === "page") ScrollTrigger.refresh();
    }, 120);
  });

  console.log("%cPol Planas", "font: 800 20px sans-serif", "\nDesigned and built by hand. pol@polplanas.com");
})();
