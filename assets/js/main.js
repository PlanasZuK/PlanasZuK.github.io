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
  // one clock for every scene: it starts at the visitor's own hour and then the day goes by on its own, a whole day in
  // a few minutes, so whoever stays a while sees the light change everywhere (landing, work, every page to come)
  const CLOCK = { h: 10.5, last: 0, run: true, minutes: 6, born: Date.now() };
  if (/[?&]hour=(\d+(\.\d+)?)/.test(location.search)) CLOCK.h = +location.search.match(/[?&]hour=(\d+(\.\d+)?)/)[1];
  function render() {
    const e = Z.v, c = boards[Z.center];
    cam.s = 1 + (L.s0 - 1) * e;
    cam.x = -c._x + (L.ov.x + c._x) * e;
    cam.y = -c._y + (L.ov.y + c._y) * e;
    world.style.transform = `translate3d(${cam.x.toFixed(2)}px,${cam.y.toFixed(2)}px,0) scale(${cam.s.toFixed(5)})`;
    const k = e.toFixed(3), kg = sstep(0.3, 0.75, e).toFixed(3);
    if (k !== CAMV.k) { CAMV.k = k; CAMV.space.forEach((x) => (x.style.opacity = k)); CAMV.edge.forEach((x) => (x.style.opacity = k)); }
    if (kg !== CAMV.kg) { CAMV.kg = kg; CAMV.fade.forEach((x) => (x.style.opacity = kg)); }
    window.__zk = e;
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
  // the few things that fade with the camera
  const CAMV = { k: "", kg: "", space: $$(".space canvas"), edge: $$(".board__edge"), fade: $$(".board__label, .board__soon, .ghost") };
  const zto = (v, dur, ease) => new Promise((res) => {
    if (Z.tw) Z.tw.kill();
    Z.tw = gsap.to(Z, { v, duration: reduce ? 0 : dur, ease, onUpdate: render, onComplete: () => { Z.t = Z.v; Z.tw = null; render(); res(); } });
  });

  /* ---------------- state ---------------- */
  let presence = null;
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
    if (page.dataset.page === "work" && wall) requestAnimationFrame(() => wall.leave());
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
    if (busy || (target !== "overview" && isLocked(target))) return;
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

  /* ---------------- the pull: wheel and touch move the camera directly ----------------
     Down always goes on: from a page (or the landing) the camera pulls back to see every page; from there, the next
     page. Up goes back the same way. Nobody is ever stuck. */
  let pullAcc = 0, wheelGap = 0, atOverview = 0, goOK = false;
  const ORDER = ["home", "work", "about", "services", "contact"];
  const nextPage = (from) => { for (let i = 1; i <= ORDER.length; i++) { const id = ORDER[(ORDER.indexOf(from) + i) % ORDER.length]; if (!isLocked(id)) return id; } return "home"; };
  const pageEnd = () => window.scrollY + innerHeight >= d.documentElement.scrollHeight - 2;
  function pull(dy, fresh) {
    if (busy || caseOpen || Z.tw) return;
    if (mode === "page") {
      // a page hands over to the camera at its end (down) or at its top (up)
      const atTop = window.scrollY <= 1;
      if ((dy > 0 && !pageEnd()) || (dy < 0 && !atTop) || performance.now() - topSince < 350) { pullAcc = 0; return; }
      pullAcc += Math.abs(dy);
      if (pullAcc < 90) return;
      const from = current;
      closePage();
      Z.center = from; Z.v = 0; Z.t = clamp((pullAcc - 90) / L.ZR);
      pullAcc = 0;
      setMode("overview");
      return;
    }
    // every page in view: a fresh push down flies on to the next page
    if (Z.v >= 0.999 && Z.t >= 0.999 && dy > 0) {
      if (fresh) goOK = performance.now() - atOverview > 450;
      if (!goOK) return;
      pullAcc += dy;
      if (pullAcc > 120) { pullAcc = 0; go(nextPage(current)); }
      return;
    }
    // and up, from every page in view, goes back to the page you came from
    if (Z.v >= 0.999 && dy < 0 && current !== 'home' && Z.center === 'home') { if (fresh) go(current); return; }
    pullAcc = 0;
    const prev = Z.t;
    Z.t = clamp(Z.t + dy / L.ZR);
    if (Z.t < 0.002) Z.t = 0; else if (Z.t > 0.998) Z.t = 1;
    if (reduce && Z.t !== prev) Z.t = Z.t > prev ? 1 : 0;
  }
  // the camera follows the pull with a little inertia; when it rests at either end, it arrives
  function follow() {
    const now = performance.now(), dt = Math.min(0.1, (now - (CLOCK.last || now)) / 1000);
    CLOCK.last = now;
    if (CLOCK.run && !reduce) CLOCK.h = (CLOCK.h + (dt * 24) / (CLOCK.minutes * 60)) % 24;
    light(CLOCK.h);
    if (Z.v >= 0.999 && !atOverview) atOverview = now; else if (Z.v < 0.999) atOverview = 0;
    if (Z.tw || busy) return;
    const dz = Z.t - Z.v;
    if (Math.abs(dz) > 0.0004) { Z.v += dz * (reduce ? 1 : 0.13); render(); }
    else if (Z.v !== Z.t) { Z.v = Z.t; render(); }
    else if (Z.v === 0 && mode !== "page" && (Z.center !== "home" || current !== "home")) arrive(Z.center);
    else if (Z.v === 1 && Z.center !== "home") { Z.center = "home"; render(); }
  }
  const norm = (e) => (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY);
  let lastWheel = 0;
  addEventListener("wheel", (e) => {
    const now = performance.now(), fresh = now - lastWheel > 260 || wheelGap;
    wheelGap = 0; lastWheel = now;
    // on the work wall, sideways scrolling moves along the wall
    if (mode === "page" && current === "work" && wall && !caseOpen && Math.abs(e.deltaX) > Math.abs(e.deltaY)) { wall.nudge(-e.deltaX, 0); return; }
    pull(norm(e), fresh);
  }, { passive: true });
  let ty = null;
  addEventListener("touchstart", (e) => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (ty === null) return;
    const y = e.touches[0].clientY, dy = (ty - y) * 1.2;
    ty = y;
    if (hero.wiping && hero.wiping()) return;
    if (mode === "page" && current === "work") return; // on the wall a finger moves the wall
    pull(dy, true);
  }, { passive: true });
  addEventListener("touchend", () => { ty = null; }, { passive: true });
  addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea")) return;
    if (e.key === "Escape") { if (caseOpen) closeCase(); else if (mode === "page") go("overview"); else if (mode === "overview") go(current); return; }
    if (mode === "page" && current === "work" && wall && !caseOpen && /^Arrow/.test(e.key)) { e.preventDefault(); wall.key(e.key); return; }
    if (mode === "focus" && ["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go("overview"); }
    else if (mode === "overview" && !busy && ["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(current); }
    else if (mode === "overview" && !busy && ["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(nextPage(current)); }
    else if (mode === "page" && current === "work" && !caseOpen && e.key === "PageDown") { e.preventDefault(); go("overview"); }
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
      const hour = (to) => { let d = ((to - CLOCK.h + 36) % 24) - 12; gsap.to(CLOCK, { h: "+=" + d, duration: reduce ? 0 : 3.5, ease: "sine.inOut", onComplete: () => (CLOCK.h = (CLOCK.h + 24) % 24) }); };
      if (k === "day") { hour(12); gsap.timeline().to(rain.state, { sun: 1, duration: 3, ease: "sine.inOut" }).to(rain.state, { sun: 0, duration: 5, ease: "sine.inOut" }, "+=12"); }
      if (k === "night") hour(23);
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
      onInk: () => {},
      onIgnore: () => {},
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
        if (at !== undefined) CLOCK.h = { 0: 7, 0.2: 12, 0.62: 19, 1: 23.5 }[at] ?? CLOCK.h;
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
      if (voice && mode === "focus" && !wrote) { lastHint = performance.now(); const H = { ca: ["Hola", "Escriu al vidre amb el dit: qui hi hagi a l’altra banda ho veurà."], es: ["Hola", "Escribe en el cristal con el dedo: quien esté al otro lado lo verá."], en: ["Hi", "Write on the glass with your finger: whoever is on the other side will see it."] }[LANG] || ["Hi", ""];
        if (!(presence && presence.count())) voice.say(presence && presence.name ? `${H[0]}, ${presence.name}. ${H[1]}` : H[1], 7); }
    });
    return { rain, day, slope, voice, greet, hour: () => hourNow, wiping: () => wiping, KEYS, lerp, ink, el, live };
  })();

  // the hour → a place on the landing's light curve (07:00 … 24:00 … 07:00)
  const dOf = (h) => { const K = hero.KEYS; if (!K) return 0; let x = h < 7 ? h + 24 : h; for (let i = 0; i < K.length - 1; i++) if (x >= K[i].h && x <= K[i + 1].h) return K[i].at + ((x - K[i].h) / (K[i + 1].h - K[i].h)) * (K[i + 1].at - K[i].at); return 0; };
  function light(h) {
    const d = dOf(h);
    if (hero.day) hero.day(d);
    // the other windows get the same light as the landing's
    if (wall && wall.rain && hero.rain) { const a = hero.rain.state, b = wall.rain.state; b.night = a.night; b.storm = a.storm; b.sun = a.sun; Object.assign(b.grade, a.grade); b.grade.tint = a.grade.tint.slice(); b.grade.lift = a.grade.lift.slice(); b.grade.glow = a.grade.glow.slice(); }
    // only when it really changes: a custom property on the root makes the browser recheck every element
    const nt = (hero.rain ? hero.rain.state.night : 0).toFixed(2), br = (hero.rain ? Math.min(1, hero.rain.state.grade.bright / 0.86) : 1).toFixed(2);
    if (wall && (nt !== light.nt || br !== light.br)) { light.nt = nt; light.br = br; wall.sec.style.setProperty("--night", nt); wall.sec.style.setProperty("--lit", br); }
  }

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

  /* ---------------- work: prints taped to the window, a wall without end ---------------- */
  const wall = (() => {
    const sec = $(".wall");
    if (!sec || !window.Wall || !window.Rain || !Rain.supported) { if (sec) sec.classList.add("no-gl"); return null; }
    const w = new Wall(sec, { reduce, touch, lang: LANG, cursor, sound: () => window.Sound,
      onOpen: (slug) => { caseOpen = slug; html.setAttribute("data-case-open", ""); if (TITLES.cases && TITLES.cases[slug]) d.title = TITLES.cases[slug]; },
      onClose: () => { caseOpen = null; html.removeAttribute("data-case-open"); if (TITLES[current]) d.title = TITLES[current]; if (location.pathname !== pathOf("work")) history.pushState({}, "", pathOf("work")); },
      onPick: (slug) => { if (location.pathname !== pathOf("work", slug)) history.pushState({}, "", pathOf("work", slug)); } });
    if (/[?&]test(&|$)/.test(location.search)) window.__wall = w;
    return w;
  })();

  /* ---------------- the other side of the glass ----------------
     Whoever else is on the site at this moment is behind the same window. You see them through the frost: a pointer
     and their name, a hand's shadow when it comes close, a fingertip where it touches. What they write on the glass
     clears it for you too (mirrored, as through a real pane on the landing). They can knock (a double click), and
     you feel the glass ring; they can send a few words (Enter) or a face (Shift), which arrive behind the glass, in
     their own voice: you will see that something is there, but to read it you have to wipe the frost away.
     Hold a finger still on the glass and you breathe on it, the frost comes back and you can write again. Touch the
     same spot as them, at the same time, and the glass warms between your two fingers. */
  presence = (() => {
    const T = {
      ca: { someone: "Algú", join: (n) => `${n} és a l’altra banda del vidre.`, leave: (n) => `${n} se n’ha anat.`, knock: (n) => `${n} truca al vidre!`, wrote: (n) => `${n} t’ha escrit alguna cosa. Desentela el vidre per llegir-ho.`, alone: "Ara mateix no hi ha ningú a l’altra banda.", ph: "Escriu-li i prem Enter", toc: "toc toc", hint: "Doble clic per trucar. Shift per una cara. Enter per escriure-li." },
      es: { someone: "Alguien", join: (n) => `${n} está al otro lado del cristal.`, leave: (n) => `${n} se ha ido.`, knock: (n) => `¡${n} llama al cristal!`, wrote: (n) => `${n} te ha escrito algo. Desempaña el cristal para leerlo.`, alone: "Ahora mismo no hay nadie al otro lado.", ph: "Escríbele y pulsa Enter", toc: "toc toc", hint: "Doble clic para llamar. Shift para una cara. Enter para escribirle." },
      en: { someone: "Someone", join: (n) => `${n} is on the other side of the glass.`, leave: (n) => `${n} has gone.`, knock: (n) => `${n} is knocking!`, wrote: (n) => `${n} wrote you something. Wipe the glass to read it.`, alone: "Nobody is on the other side right now.", ph: "Write to them, press Enter", toc: "knock knock", hint: "Double click to knock. Shift for a face. Enter to write." },
    }[LANG] || {};
    // six small signs, solid, cut clean like the rest of the interface (Phosphor Icons, fill, MIT licence)
    const ICON = {"wave":"M219.31,98.46A88,88,0,1,1,67.08,186.77h0L26.15,115.88a16,16,0,0,1,27.69-16L72.4,132a8,8,0,0,0,13.86-8L47,56A16,16,0,0,1,74.69,40L114,108a8,8,0,1,0,13.85-8l-30-52a16,16,0,0,1,27.71-16L166,102.12A48.25,48.25,0,0,0,152,136a47.59,47.59,0,0,0,9.6,28.8,8,8,0,1,0,12.79-9.61A32,32,0,0,1,181,110.26a8,8,0,0,0,2.17-10.43L171.71,80a16,16,0,0,1,27.71-16l19.89,34.46Zm-29.37-57A43.74,43.74,0,0,1,216.74,62l.33.57a8,8,0,0,0,13.86-8L230.6,54a59.64,59.64,0,0,0-36.54-28,8,8,0,0,0-4.12,15.46ZM79.58,225.72A103.58,103.58,0,0,1,53.93,196a8,8,0,0,0-13.86,8,119.56,119.56,0,0,0,29.6,34.28,8,8,0,0,0,9.91-12.56Z","heart":"M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z","smile":"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM92,96a12,12,0,1,1-12,12A12,12,0,0,1,92,96Zm82.92,60c-10.29,17.79-27.39,28-46.92,28s-36.63-10.2-46.92-28a8,8,0,1,1,13.84-8c7.47,12.91,19.21,20,33.08,20s25.61-7.1,33.08-20a8,8,0,1,1,13.84,8ZM164,120a12,12,0,1,1,12-12A12,12,0,0,1,164,120Z","thumbs":"M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32Z","fire":"M143.38,17.85a8,8,0,0,0-12.63,3.41l-22,60.41L84.59,58.26a8,8,0,0,0-11.93.89C51,87.53,40,116.08,40,144a88,88,0,0,0,176,0C216,84.55,165.21,36,143.38,17.85Zm40.51,135.49a57.6,57.6,0,0,1-46.56,46.55A7.65,7.65,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68Z","spark":"M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z"};
    const EMO = Object.keys(ICON);
    const svg = (k) => `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
    const P2D = Object.fromEntries(EMO.map((k) => [k, new Path2D(ICON[k])]));
    const others = new Map();
    let share = null, me = { x: innerWidth / 2, y: innerHeight / 2, has: false }, myName = "", toldWrote = false, toldHint = false;
    try { myName = (localStorage.getItem("pp-name") || "").slice(0, 18); } catch (e) {}
    const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
    // a voice of one's own: higher or lower, rounder or thinner, steadier or shakier
    const voiceOf = (id, x = 0) => { const a = hash(id + "a"), b = hash(id + "b"), c = hash(id + "c"); return { key: id, pitch: -6 + a * 11, form: 0.86 + b * 0.3, wob: 0.6 + c * 1.1, range: 0.8 + a * 0.45, fm: 0.7 + c * 0.7, x }; };
    // a word from the glass: the voice's bubble on the landing, a quiet line elsewhere
    const notice = d.createElement("p"); notice.className = "notice"; notice.setAttribute("aria-live", "polite"); d.body.appendChild(notice);
    const tell = (text, hold = 5) => {
      notice.textContent = text; notice.classList.add("is-on");
      if (window.Sound && Sound.on) Sound.voice(text, Math.min(2.4, 0.03 * text.length + 0.2));
      clearTimeout(notice._t); notice._t = setTimeout(() => notice.classList.remove("is-on"), hold * 1000);
    };
    // only the windows are shared: the landing and the work
    const place = () => (busy ? null : mode === "page" && current === "work" && !caseOpen ? "work" : mode === "focus" && Z.center === "home" ? "home" : null);
    const glassOf = (p) => (p === "home" ? hero.rain : p === "work" && wall ? wall.rain : null);
    const enc = (cx, cy) => {
      const p = place(), o = { p };
      if (p === "work" && wall) { const w = wall.toWorld(cx, cy); o.x = +w[0].toFixed(4); o.y = +w[1].toFixed(4); }
      else { o.x = +(cx / innerWidth).toFixed(4); o.y = +(cy / innerHeight).toFixed(4); }
      return o;
    };
    // their point, on my screen; the landing is seen from the other side, so it is mirrored
    const dec = (m) => {
      const p = place();
      if (!m || !m.p || m.p !== p) return null;
      if (p === "home") return { x: (1 - m.x) * innerWidth, y: m.y * innerHeight };
      if (p === "work" && wall) { const s = wall.toScreen(m.x, m.y); return { x: s[0], y: s[1] }; }
      return null;
    };
    const nameOf = (o) => o.name || (others.size > 1 ? `${T.someone} ${o.slot + 1}` : T.someone);
    const get = (id) => {
      if (others.has(id)) return others.get(id);
      const used = new Set([...others.values()].map((o) => o.slot)), slot = [0, 1, 2, 3, 4, 5].find((i) => !used.has(i));
      const o = { id, slot, name: "", m: null, x: -999, y: -999, tx: -999, ty: -999, seen: 0, last: performance.now(), voice: voiceOf(id), say: null, fx: [] };
      others.set(id, o);
      return o;
    };

    // the pane beside a pointer: where it starts (from the tip of the pointer) and how wide its words may run
    const BUB = { x: 20, y: -6, max: 280 };
    // ---- the layer behind the glass: drawn here, in 2D, and handed to the glass, which frosts it like the world ----
    const pc = d.createElement("canvas"), px = pc.getContext("2d");
    let PS = 1, dirty = false, wasDrawn = false;
    const sizeLayer = () => { PS = Math.min(1, 1100 / innerWidth); pc.width = Math.round(innerWidth * PS); pc.height = Math.round(innerHeight * PS); };
    sizeLayer(); addEventListener("resize", sizeLayer);
    const font = (w, s, f) => `${w} ${s * PS}px ${f}`;
    const wrap = (text, max) => {
      const words = text.split(" "), lines = []; let line = "";
      for (const w of words) { const t = line ? line + " " + w : w; if (px.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }
      if (line) lines.push(line);
      return lines.slice(0, 5);
    };
    function draw(now) {
      const p = place(), g = glassOf(p);
      const any = g && [...others.values()].some((o) => o.seen > 0.01);
      if (!any) { if (wasDrawn) { px.clearRect(0, 0, pc.width, pc.height); for (const r of [hero.rain, wall && wall.rain]) if (r) r.layer(pc); wasDrawn = false; } return; }
      px.clearRect(0, 0, pc.width, pc.height);
      for (const o of others.values()) {
        if (o.seen < 0.01) continue;
        const x = o.x * PS, y = o.y * PS, a = o.seen;
        px.save(); px.globalAlpha = a;
        // the shape of the person, a soft darkness the frost turns into a shadow that moves
        const gr = px.createRadialGradient(x, y + 30 * PS, 0, x, y + 30 * PS, 120 * PS);
        gr.addColorStop(0, "rgba(10,12,14,0.55)"); gr.addColorStop(0.55, "rgba(10,12,14,0.25)"); gr.addColorStop(1, "rgba(10,12,14,0)");
        px.fillStyle = gr; px.fillRect(x - 120 * PS, y - 90 * PS, 240 * PS, 240 * PS);
        // the pointer, the same shape as anyone's, seen through the pane
        px.translate(x, y);
        const k = 1.25 * PS * (o.m && o.m.d ? 0.86 : 1);
        px.beginPath(); px.moveTo(0, 0); px.lineTo(0, 17 * k); px.lineTo(4.2 * k, 13 * k); px.lineTo(7.4 * k, 20 * k); px.lineTo(10.2 * k, 18.8 * k); px.lineTo(7.1 * k, 12 * k); px.lineTo(12.4 * k, 12 * k); px.closePath();
        px.fillStyle = "rgba(250,250,247,0.96)"; px.strokeStyle = "rgba(18,20,22,0.85)"; px.lineWidth = 1.3 * PS; px.lineJoin = "round"; px.fill(); px.stroke();
        const nm = nameOf(o).toUpperCase(), talking = o.say && now - o.say.at < o.say.hold;
        if (!talking) {
          px.font = font(500, 11.5, "'Chivo Mono', monospace");
          const tw = px.measureText(nm).width + 14 * PS;
          px.fillStyle = "rgba(12,16,13,0.66)"; px.fillRect(14 * PS, 20 * PS, tw, 20 * PS);
          px.fillStyle = "rgba(244,245,239,0.95)"; px.textBaseline = "middle"; px.fillText(nm, 21 * PS, 30.5 * PS);
        } else {
          // the pane (the same as the one on the sender's side: same place, same size, same type)
          const s = o.say, fade = Math.min(1, (s.hold - (now - s.at)) / 800), bx = BUB.x * PS, by = BUB.y * PS, padX = 12 * PS, padT = 9 * PS, padB = 10 * PS;
          px.font = font(500, 15, "'Inter Tight', sans-serif");
          const lines = s.icon ? [] : wrap(s.text, BUB.max * PS), lh = 19.5 * PS, whoH = 18 * PS;
          px.font = font(500, 10.5, "'Chivo Mono', monospace"); const ww = px.measureText(nm).width;
          px.font = font(500, 15, "'Inter Tight', sans-serif");
          const tw = s.icon ? 30 * PS : Math.max(...lines.map((l) => px.measureText(l).width)), bw = Math.max(ww, tw) + padX * 2, bh = padT + whoH + (s.icon ? 30 * PS : lines.length * lh) + padB;
          px.globalAlpha = a * fade;
          px.fillStyle = "rgba(12,16,13,0.66)"; px.fillRect(bx, by, bw, bh);
          px.strokeStyle = "rgba(244,245,239,0.16)"; px.lineWidth = 1 * PS; px.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
          px.textBaseline = "top";
          px.font = font(500, 10.5, "'Chivo Mono', monospace"); px.fillStyle = "rgba(244,245,239,0.6)"; px.fillText(nm, bx + padX, by + padT + 1 * PS);
          if (s.icon) {
            const k = Math.min(1, (now - s.at) / 300), e = 1 - Math.pow(1 - k, 4), sz = 30 * PS * (0.7 + 0.3 * e);
            px.save(); px.translate(bx + padX + 15 * PS, by + padT + whoH + 15 * PS); px.scale(sz / 256, sz / 256); px.translate(-128, -128);
            px.fillStyle = "rgba(244,245,239,0.98)"; px.fill(P2D[s.icon]); px.restore();
          } else {
            const shown = Math.ceil(Math.min(1, (now - s.at) / (s.dur * 1000)) * s.text.length);
            px.font = font(500, 15, "'Inter Tight', sans-serif"); px.fillStyle = "rgba(244,245,239,0.98)";
            let left = shown;
            lines.forEach((l, i) => { const part = l.slice(0, Math.max(0, left)); left -= l.length + 1; px.fillText(part, bx + padX, by + padT + whoH + i * lh); });
          }
        }
        px.restore();
        // faces and knocks, where they were sent
        o.fx = o.fx.filter((f) => now - f.at < f.life);
        for (const f of o.fx) {
          const e = (now - f.at) / f.life, ex = f.x * PS, ey = (f.y - e * f.rise) * PS;
          px.save(); px.globalAlpha = Math.min(1, e * 6) * (1 - Math.pow(e, 3)); px.textAlign = "center"; px.textBaseline = "middle";
          if (f.kind === "emoji") { px.font = font(400, 46 * (0.6 + Math.min(1, e * 5) * 0.4), "system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'"); px.fillText(f.e, ex, ey); }
          else { px.font = font(800, 30, "'Archivo', sans-serif"); px.fillStyle = "rgba(250,250,247,0.95)"; px.fillText(T.toc.toUpperCase(), ex + Math.sin(e * 40) * 3 * (1 - e) * PS, ey); }
          px.restore();
        }
      }
      g.layer(pc); wasDrawn = true;
    }

    // ---- what happens on my side when they do something ----
    // a knock you can see: the glass shivers, a spray of frost flies off where it was hit, and (when it is theirs) the word
    function knockFx(x, y, word) {
      if (reduce) return;
      const box = d.createElement("div"); box.className = "knock"; box.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      box.innerHTML = (word ? `<b>${T.toc}</b>` : "") + "<s></s>" + Array.from({ length: 9 }, () => "<i></i>").join("");
      d.body.appendChild(box);
      const tl = gsap.timeline({ onComplete: () => box.remove() });
      box.querySelectorAll("i").forEach((i, n) => {
        const a = (n / 9) * 360 + (Math.random() - 0.5) * 16, r0 = 16 + Math.random() * 6, r1 = 46 + Math.random() * 26, len = 10 + Math.random() * 12;
        tl.fromTo(i, { rotation: a, x: Math.cos((a * Math.PI) / 180) * r0, y: Math.sin((a * Math.PI) / 180) * r0, scaleX: len / 18, opacity: 1 },
          { x: Math.cos((a * Math.PI) / 180) * r1, y: Math.sin((a * Math.PI) / 180) * r1, scaleX: 0.15, opacity: 0, duration: 0.55, ease: "expo.out" }, 0);
      });
      tl.fromTo(box.querySelector("s"), { scale: 0.4, opacity: 1 }, { scale: 4.2, opacity: 0, duration: 0.7, ease: "expo.out" }, 0);
      const b = box.querySelector("b");
      if (b) tl.fromTo(b, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "expo.out" }, 0).to(b, { opacity: 0, duration: 0.5, ease: "power2.in" }, 1.1);
    }
    // glass shivers: a few stiff, quick, small movements that die at once (never a wobble)
    const shiver = (el, k = 1) => {
      if (reduce) return;
      const a = 2.2 * k;
      gsap.killTweensOf(el, "x,y");
      gsap.timeline().to(el, { x: -a, y: a * 0.35, duration: 0.03, ease: "none" }).to(el, { x: a * 0.8, y: -a * 0.25, duration: 0.03, ease: "none" })
        .to(el, { x: -a * 0.5, y: a * 0.15, duration: 0.035, ease: "none" }).to(el, { x: a * 0.25, y: 0, duration: 0.04, ease: "none" }).to(el, { x: 0, y: 0, duration: 0.05, ease: "power1.out" });
    };
    function knockHere(p, sx, sy, k = 1, word) {
      const g = glassOf(p); if (!g) return;
      knockFx(sx * innerWidth, sy * innerHeight, word);
      g.knock(sx, sy, k);
      shiver(g.c.closest(".hero, .wall") || g.c, k);
      if (window.Sound) Sound.knock(sx * 2 - 1, k);
    }
    const connect = () => import("/assets/js/shared.js?v=" + ((($('script[src*="main.js"]') || {}).src || "").split("v=")[1] || "")).then((m) => m.share({
      join(id) {
        get(id);
        if (myName && share) share.name(myName, id);
        if (share) share.clock({ h: CLOCK.h, born: CLOCK.born }, id);
        sendNow();
        gsap.delayedCall(1.4, () => { const o = others.get(id); if (o && !o.told) { o.told = true; tell(T.join(nameOf(o)), 5); if (!toldHint) { toldHint = true; gsap.delayedCall(6, () => others.size && tell(T.hint, 6)); } } });
      },
      leave(id) { const o = others.get(id); if (!o) return; o.gone = true; tell(T.leave(nameOf(o)), 4); },
      name(id, n) { get(id).name = n.replace(/[<>]/g, "").trim(); },
      // the hour of the window: the one who has been here longest keeps it; the others glide to it
      clock(id, c) {
        if (!c || typeof c.h !== "number" || typeof c.born !== "number" || c.born >= CLOCK.born) return;
        CLOCK.born = c.born;
        const dh = ((c.h - CLOCK.h + 36) % 24) - 12;
        if (Math.abs(dh) < 0.05) return;
        gsap.to(CLOCK, { h: "+=" + dh, duration: reduce ? 0 : 2.5, ease: "sine.inOut", onComplete: () => (CLOCK.h = (CLOCK.h + 24) % 24) });
      },
      pointer(id, m) {
        const o = get(id), prev = o.m; o.m = m; o.last = performance.now();
        // their fingertip on the glass we share clears the frost here too
        const g = glassOf(place());
        if (g && m.d) { const a = dec(m), b = prev && prev.d && prev.p === m.p ? dec(prev) : a; if (a && b) g.wipe(b.x / innerWidth, b.y / innerHeight, a.x / innerWidth, a.y / innerHeight); }
      },
      breath(id, m) { const a = dec(m), g = glassOf(place()); if (a && g) { g.breathe(a.x / innerWidth, a.y / innerHeight, 0.06); } },
      emoji(id, m) { this.chat(id, { ...m, r: m.e }); },
      chat(id, m) {
        const o = get(id), icon = ICON[m.r] ? m.r : null, t = icon ? "" : String(m.t || "").slice(0, 140), dur = Math.min(2.8, 0.034 * t.length + 0.25), a = dec(m);
        if (!t && !icon) return;
        o.say = { text: t, icon, at: performance.now(), dur, hold: icon ? 9000 : Math.max(14000, t.length * 220) };
        if (icon) { if (window.Sound && Sound.on && Sound.typeKeys) Sound.typeKeys(2, 0.1); return; }
        if (window.Sound && Sound.on) Sound.voice(t, dur, { ...o.voice, x: a ? (a.x / innerWidth) * 2 - 1 : 0 });
        if (!toldWrote && a) { toldWrote = true; gsap.delayedCall(dur + 0.6, () => tell(T.wrote(nameOf(o)), 6)); }
      },
      knock(id, m) {
        const o = get(id), a = dec(m); if (!a) return;
        knockHere(m.p, a.x / innerWidth, a.y / innerHeight, 0.9, true);
        if (!o.knockTold || performance.now() - o.knockTold > 20000) { o.knockTold = performance.now(); tell(T.knock(nameOf(o)), 3.5); }
      },
    })).then((s) => { share = s; if (myName) s.name(myName); sendNow(); if (/[?&]test\b/.test(location.search)) window.__share = { s, others }; }).catch((e) => console.info("[glass] alone today:", e && e.message));
    if (!/[?&]solo\b/.test(location.search) && "RTCPeerConnection" in window) connect();

    // ---- telling them what I do ----
    const pressing = () => { const g = glassOf(place()); return g && g.finger ? 1 : 0; };
    const sendNow = () => { if (!share || !share.count || !me.has) return; share.pointer({ ...enc(me.x, me.y), d: pressing() }); };
    let still = { x: 0, y: 0, t: 0, sent: 0 };
    addEventListener("pointermove", (e) => { me.x = e.clientX; me.y = e.clientY; me.has = true; if (Math.hypot(e.clientX - still.x, e.clientY - still.y) > 4) { still.x = e.clientX; still.y = e.clientY; still.t = performance.now(); } sendNow(); }, { passive: true });
    addEventListener("pointerdown", (e) => { me.x = still.x = e.clientX; me.y = still.y = e.clientY; still.t = performance.now(); me.has = true; requestAnimationFrame(sendNow); }, { passive: true });
    addEventListener("pointerup", () => requestAnimationFrame(sendNow), { passive: true });
    setInterval(sendNow, 2000);
    setInterval(() => { if (share && share.count) share.clock({ h: CLOCK.h, born: CLOCK.born }); }, 8000);
    let breathing = 0;
    gsap.ticker.add(() => {
      const now = performance.now(), p = place(), g = glassOf(p);
      // a finger held still on the glass breathes on it
      if (g && g.finger && now - still.t > 650) {
        g.breathe(me.x / innerWidth, me.y / innerHeight, 0.05);
        if (!breathing && window.Sound) Sound.breath((me.x / innerWidth) * 2 - 1);
        breathing = breathing ? breathing : now;
        if (now - breathing > 1000 && window.Sound) { Sound.breath((me.x / innerWidth) * 2 - 1, 0.8); breathing = now; }
        if (share && share.count && now - still.sent > 140) { still.sent = now; share.breath(enc(me.x, me.y)); }
      } else breathing = 0;
      if (!others.size) return;
      for (const [id, o] of others) {
        const pos = o.gone || now - o.last > 30000 ? null : dec(o.m);
        o.seen += ((pos ? 1 : 0) - o.seen) * 0.1;
        if (pos) { if (o.tx < -900) { o.x = pos.x; o.y = pos.y; } o.tx = pos.x; o.ty = pos.y; }
        o.x += (o.tx - o.x) * 0.28; o.y += (o.ty - o.y) * 0.28;
        if (g && o.slot < 4) g.peer(o.slot, o.x / innerWidth, o.y / innerHeight, o.m && o.m.d ? 1 : 0, pos ? o.seen : 0);
        // the same spot, at the same time, from both sides
        if (pos && g && g.finger && o.m && o.m.d && Math.hypot(o.x - me.x, o.y - me.y) < 46 && now - (o.touched || 0) > 6000) {
          o.touched = now; g.warm(me.x / innerWidth, me.y / innerHeight); if (window.Sound) Sound.chime((me.x / innerWidth) * 2 - 1);
        }
        if (o.gone && o.seen < 0.01) { if (g && o.slot < 4) g.peer(o.slot, 0, 0, 0, 0); others.delete(id); }
      }
      for (const r of [hero.rain, wall && wall.rain]) if (r && r !== g) for (let i = 0; i < 4; i++) r.peer(i, 0, 0, 0, 0);
      draw(now);
    });

    // ---- knocking: a double click on the glass, or two quick taps ----
    let lastKnock = 0;
    const knockAt = (cx, cy) => { const p = place(); if (!glassOf(p) || performance.now() - lastKnock < 400) return; lastKnock = performance.now(); knockHere(p, cx / innerWidth, cy / innerHeight); if (share) share.knock(enc(cx, cy)); };
    // two quick presses in the same place, with a mouse or a finger
    let tap = { t: 0, x: 0, y: 0 };
    d.addEventListener("pointerdown", (e) => {
      if (e.button || !e.target.closest(".hero, .wall") || e.target.closest(".pin, .wall__case, a, button")) return;
      const now = performance.now();
      if (now - tap.t < 340 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 26) { knockAt(e.clientX, e.clientY); tap.t = 0; }
      else tap = { t: now, x: e.clientX, y: e.clientY };
    }, true);

    // ---- Shift: a few faces around the pointer; move towards one and let go ----
    const typing = (e) => e.target.closest && e.target.closest("input, textarea, select, [contenteditable]");
    const ring = d.createElement("div"); ring.className = "emo"; ring.setAttribute("aria-hidden", "true");
    ring.innerHTML = `<div class="emo__row">${EMO.map((k) => `<button type="button" tabindex="-1" data-e="${k}">${svg(k)}</button>`).join("")}</div>`;
    d.body.appendChild(ring);
    const tiles = [...ring.querySelectorAll("button")];
    let ringOn = false, pick = null, rx = 0, ry = 0, chatOn = false;
    // my own words and signs: a bubble that follows my pointer, on my side of the glass, clear
    const mine = d.createElement("p"); mine.className = "voice mine"; d.body.appendChild(mine);
    const showMine = (html, text) => {
      const who = (myName || T.someone).toUpperCase().replace(/[<>&]/g, "");
      mine.innerHTML = `<span class="mine__who">${who}</span><span class="mine__t">${html}</span>`; mine.classList.add("is-on"); mine.classList.toggle("is-icon", !text); html.classList.add("is-saying");
      const body = mine.querySelector(".mine__t");
      const n = text ? text.length : 0, dur = Math.min(2.8, 0.034 * n + 0.25);
      // only the typing and the hiding are replaced, never the movement that keeps the bubble at the pointer
      if (mine._type) mine._type.kill(); if (mine._hide) mine._hide.kill();
      if (text) { const oo = { n: 0 }; mine._type = gsap.to(oo, { n, duration: dur, ease: "none", onUpdate: () => (body.textContent = text.slice(0, Math.round(oo.n))) }); }
      else gsap.fromTo(body.firstChild, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "expo.out" });
      // long enough to be read: a few seconds, more for a longer line
      mine._hide = gsap.delayedCall(text ? dur + Math.min(14, 5 + n / 9) : 5, () => { mine.classList.remove("is-on"); html.classList.remove("is-saying"); });
      return dur;
    };
    const sendFace = (k) => {
      const x = me.has ? me.x : innerWidth / 2, y = me.has ? me.y : innerHeight / 2;
      showMine(svg(k), "");
      if (window.Sound && Sound.on && Sound.typeKeys) Sound.typeKeys(2, 0.1);
      if (share) share.chat({ ...enc(x, y), r: k });
    };
    const setPick = (b) => { if (b === pick) return; pick = b; tiles.forEach((t) => t.classList.toggle("is-pick", t === b)); if (b && window.Sound && Sound.on && Sound.typeKeys) Sound.typeKeys(1, 0.03); };
    addEventListener("keydown", (e) => {
      if (e.key !== "Shift" || e.repeat || typing(e) || ringOn || chatOn || !place()) return;
      ringOn = true; setPick(null); rx = me.has ? me.x : innerWidth / 2; ry = me.has ? me.y : innerHeight / 2;
      ring.style.transform = `translate3d(${Math.max(150, Math.min(innerWidth - 150, rx))}px, ${Math.max(90, ry)}px, 0)`;
      ring.classList.add("is-on");
      if (!reduce) gsap.fromTo(tiles, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "expo.out", stagger: 0.025, overwrite: true });
    });
    addEventListener("keyup", (e) => {
      if (e.key !== "Shift" || !ringOn) return;
      ringOn = false; ring.classList.remove("is-on");
      if (pick) sendFace(pick.dataset.e);
      setPick(null);
    });
    // sliding sideways picks a sign; let go of Shift to send it (or click it)
    addEventListener("pointermove", (e) => {
      if (!ringOn) return;
      const r = ring.firstChild.getBoundingClientRect();
      if (e.clientY < r.top - 40 || e.clientY > r.bottom + 70 || e.clientX < r.left - 30 || e.clientX > r.right + 30) { setPick(null); return; }
      const i = Math.max(0, Math.min(tiles.length - 1, Math.floor(((e.clientX - r.left) / r.width) * tiles.length)));
      setPick(Math.abs(e.clientX - rx) > 8 || e.clientY < ry - 8 ? tiles[i] : null);
    }, { passive: true });
    ring.addEventListener("pointerdown", (e) => { const b = e.target.closest("button"); if (b) { e.preventDefault(); sendFace(b.dataset.e); ringOn = false; ring.classList.remove("is-on"); setPick(null); } });

    // ---- Enter: a few words, said in my own voice; they arrive behind the frost on the other side ----
    const box = d.createElement("form"); box.className = "chat";
    box.innerHTML = `<div class="chat__emo">${EMO.map((k) => `<button type="button" data-e="${k}" aria-label="${k}">${svg(k)}</button>`).join("")}</div><input class="chat__in" maxlength="140" autocomplete="off" enterkeyhint="send" placeholder="${T.ph}" aria-label="${T.ph}">`;
    d.body.appendChild(box);
    const input = box.querySelector("input");
    const openChat = () => {
      if (!place()) return;
      if (!share || !share.count) { tell(T.alone, 3); return; }
      chatOn = true; box.classList.add("is-on");
      const x = me.has ? me.x : innerWidth / 2, y = me.has ? me.y : innerHeight * 0.7;
      box.style.transform = `translate3d(${Math.min(innerWidth - 310, Math.max(12, x + 18))}px, ${Math.min(innerHeight - 110, Math.max(70, y + 18))}px, 0)`;
      input.value = ""; input.focus({ preventScroll: true });
    };
    const closeChat = () => { chatOn = false; box.classList.remove("is-on"); input.blur(); };
    addEventListener("keydown", (e) => {
      if (chatOn || typing(e) || e.metaKey || e.ctrlKey || e.altKey || d.getElementById("loader")) return;
      if (e.key === "Enter" || e.key === "/") { e.preventDefault(); openChat(); }
    });
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); closeChat(); } });
    box.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = input.value.replace(/\s+/g, " ").trim().slice(0, 140);
      closeChat();
      if (!t) return;
      const x = me.has ? me.x : innerWidth / 2, y = me.has ? me.y : innerHeight / 2, dur = Math.min(2.8, 0.034 * t.length + 0.25);
      if (share) share.chat({ ...enc(x, y), t });
      const d2 = showMine("", t);
      if (window.Sound && Sound.on) Sound.voice(t, d2, voiceOf(share ? share.id : "me", (x / innerWidth) * 2 - 1));
    });
    const mx = gsap.quickTo(mine, "x", { duration: 0.35, ease: "power3" }), my = gsap.quickTo(mine, "y", { duration: 0.35, ease: "power3" });
    gsap.set(mine, { x: innerWidth / 2, y: innerHeight / 2 });
    addEventListener("pointermove", (e) => { if (!mine.classList.contains("is-on") && !chatOn) { gsap.set(mine, { x: Math.min(e.clientX + BUB.x, innerWidth - 320), y: e.clientY + BUB.y }); return; } mx(Math.min(e.clientX + BUB.x, innerWidth - 320)); my(e.clientY + BUB.y); }, { passive: true });
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-e]"); if (b) { e.preventDefault(); closeChat(); sendFace(b.dataset.e); } });
    input.addEventListener("blur", () => setTimeout(() => { if (chatOn && d.activeElement !== input) closeChat(); }, 150));
    // on a phone: a small button to write, only when someone is on the other side
    const btn = d.createElement("button"); btn.type = "button"; btn.className = "chatbtn mono"; btn.textContent = T.ph.split(/[ ,]/)[0]; d.body.appendChild(btn);
    btn.addEventListener("click", openChat);
    setInterval(() => btn.classList.toggle("is-on", !!(share && share.count && place())), 1000);
    return {
      count: () => others.size,
      setName(n) { myName = (n || "").replace(/[<>]/g, "").trim().slice(0, 18); try { localStorage.setItem("pp-name", myName); } catch (e) {} if (share && myName) share.name(myName); },
      get name() { return myName; },
    };
  })();

  const PAGE = {
    work: {
      init() { if (wall) wall.enter(); },
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

  /* ---------------- a project opens on the wall itself ---------------- */
  function openCase(slug, push = true) {
    if (!wall) return;
    wall.open(slug);
    if (push && location.pathname !== pathOf("work", slug)) history.pushState({}, "", pathOf("work", slug));
  }
  function closeCase(push = true) {
    if (!wall || !caseOpen) return;
    wall.close(push);
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
        if (ni && presence) presence.setName(ni.value);
        const enter = () => { if (window.Sound) Sound.enter(); };
        gsap.timeline({ onComplete: () => { el.remove(); enter(); done(true); } })
          .to(st, { shown: 1, duration: 0.45, ease: "power2.out", onUpdate: put })
          .to([trace, pct, $(".loader__sound", el), nf], { opacity: 0, duration: 0.5, ease: "power1.out" }, 0.15)
          .add(() => { if (introTl) introTl.play(); enter(); }, 0.5)
          .to(el, { backgroundColor: "rgba(5, 6, 5, 0)", duration: reduce ? 0 : 1.3, ease: "power2.inOut" }, 0.5)
          .set($(".loader__logo", el), { opacity: 0 });
      };
      // your name opens the door: the button wakes when there is one, and Enter (or the button) goes in
      const nf = $(".loader__name", el), ni = $(".loader__input", el), go = $(".loader__go", el);
      let named = false;
      const valid = () => ni.value.replace(/\s+/g, " ").trim().length >= 2;
      try { ni.value = localStorage.getItem("pp-name") || ""; } catch (e) {}
      const sync = () => { go.disabled = !valid(); };
      sync();
      ni.addEventListener("input", sync);
      nf.addEventListener("submit", (e) => { e.preventDefault(); if (!valid()) { ni.focus(); gsap.fromTo(ni, { x: -6 }, { x: 0, duration: 0.4, ease: "power3.out" }); return; } named = true; if (presence) presence.setName(ni.value); ni.blur(); go.disabled = true; });
      gsap.delayedCall(reduce ? 0 : 1.2, () => { el.classList.add("is-asking"); if (!touch) ni.focus({ preventScroll: true }); });
      const tick = () => {
        const now = performance.now(), v = hero.voice, b = v && v.brain;
        const scene = hero.rain ? (hero.rain.ready ? 1 : 0) : 1;
        const mind = !b || b.off || b.ready ? (b && !b.ready && !b.off && b.status === "checking" ? 0 : 1) : 0.05 + b.progress * 0.88;
        // progress only ever moves forward, even when a new file starts and the raw percentage dips
        st.peak = Math.max(st.peak, Math.min(1, 0.12 * scene + 0.88 * mind));
        st.shown += (st.peak - st.shown) * (reduce ? 1 : 0.06);
        put();
        const n = Math.floor(st.shown * 100);
        const pb = pct.querySelector("b"); if (pb.textContent !== n + "%") { pb.textContent = n + "%"; el.setAttribute("aria-valuenow", n); }
        const ready = (st.peak >= 1 && st.shown > 0.985) || now - t0 > 15000;
        if (ready && !el.classList.contains("is-ready")) el.classList.add("is-ready");
        if (ready && named && now - t0 > (reduce ? 300 : 1800)) finish();
      };
      gsap.ticker.add(tick);
    });
  }

  if (/[?&]test\b/.test(location.search)) window.__pp = { Z, CLOCK, boards, cam, L, get mode() { return mode; }, get busy() { return busy; } };

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
    // seen from afar the wall breathes slowly, and not at all while the camera is moving
    if (wall) wall.tick(now, mode === "page" && current === "work" ? 1 : mode === "overview" && Z.v >= 0.999 && !Z.tw && !busy ? 0.25 : 0);
    // the sound follows the scene: rain, wind, hour, storm, the camera pulling back, the fingertip
    if (window.Sound && Sound.on && hero.rain) {
      const r = hero.rain, s = r.state;
      const fr = mode === "page" && current === "work" && wall && wall.rain ? wall.rain : r;
      Sound.fingerMove(fr.finger ? fr.fspeed || 0 : 0, fr.finger ? fr.finger.x * 2 - 1 : 0, fr.fturn || 0, now);
      if (r.fturn > 0.5) r.fturn = 0.49;
      const onWall = mode === "page" && current === "work" && wall && wall.rain;
      if (onWall) Sound.update({ rain: 0, wind: wall.rain.wind.v, gust: wall.rain.wind.gust, night: s.night, storm: 0, hour: hero.hour ? hero.hour() : 12, zoom: 0, page: 0, day: 1, muffle: 0.42, finger: wall.rain.finger ? wall.rain.fspeed || 0 : 0, fx: wall.rain.finger ? wall.rain.finger.x * 2 - 1 : 0 }, now);
      else Sound.update({ day: 0, rain: s.rain * (1 - s.sun) * (1 + s.storm * 0.8), wind: r.wind.v, gust: r.wind.gust, night: s.night, storm: s.storm, hour: hero.hour ? hero.hour() : 12, zoom: Z.v, page: mode === "page" ? 1 : 0, muffle: mode === "page" ? 1 : Math.min(1, Z.v * 1.2), finger: r.finger ? r.fspeed || 0 : 0, fx: r.finger ? r.finger.x * 2 - 1 : 0 }, now);
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
      if (mode === "page") ScrollTrigger.refresh();
    }, 120);
  });

  console.log("%cPol Planas", "font: 800 20px sans-serif", "\nDesigned and built by hand. pol@polplanas.com");
})();
