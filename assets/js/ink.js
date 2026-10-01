/* ink.js — read what people write on the fogged glass.
   Strokes are kept while the finger is down; a moment after the last one, they go to Google's handwriting
   recogniser (the engine behind its handwriting keyboards: any hand, any style, many languages). Its guesses
   are matched loosely against the few words this site understands, so a hurried "wrk" still means "work".
   Only the drawn strokes are sent, and only when someone writes. */
(() => {
  const WORDS = {
    work: ["work", "works", "projects", "portfolio", "feina", "treball", "treballs", "projectes", "trabajo", "trabajos", "proyectos"],
    about: ["about", "aboutme", "who", "quisoc", "sobre", "sobremi", "quien", "quiensoy"],
    services: ["services", "service", "serveis", "servei", "servicios", "servicio"],
    contact: ["contact", "email", "mail", "contacte", "contacto", "escriume", "escribeme"],
    hi: ["hello", "hola", "hey", "bondia", "buenas", "holi"],
    price: ["price", "prices", "preu", "preus", "precio", "precios", "cost", "quantcosta", "cuantocuesta"],
    home: ["home", "inici", "inicio", "planas"],
    sun: ["sun", "sol", "sunny"],
    rain: ["rain", "pluja", "lluvia", "storm", "tempesta", "tormenta"],
  };
  const lev = (a, b) => {
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  };
  const clean = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  function match(candidates) {
    let best = null;
    candidates.slice(0, 8).forEach((raw, rank) => {
      const c = clean(raw);
      if (c.length < 2) return;
      for (const [target, list] of Object.entries(WORDS)) for (const w of list) {
        const dist = lev(c, w), allow = w.length <= 3 ? 0 : w.length <= 5 ? 1 : 2;
        if (dist > allow) continue;
        const score = dist * 2 + rank * 0.5 + (w.length <= 3 ? 1 : 0);
        if (!best || score < best.score) best = { target, word: raw, score };
      }
    });
    return best;
  }
  // the shape of what the finger did, to tell writing and drawing from simply playing with the glass
  function shape(ink) {
    let L = 0, rev = 0, longest = 0, maxDur = 0;
    for (const [xs, ys, ts] of ink) {
      let sl = 0, px = xs[0], py = ys[0], dx0 = 0, dy0 = 0;
      for (let i = 1; i < xs.length; i++) {
        const dx = xs[i] - px, dy = ys[i] - py, d = Math.hypot(dx, dy);
        if (d < 6) continue; // look at the path every few pixels, not at the jitter
        sl += d;
        if (dx0 || dy0) { const c = (dx * dx0 + dy * dy0) / (d * Math.hypot(dx0, dy0)); if (c < -0.5) rev++; }
        dx0 = dx; dy0 = dy; px = xs[i]; py = ys[i];
      }
      L += sl; longest = Math.max(longest, sl); maxDur = Math.max(maxDur, (ts[ts.length - 1] - ts[0]) / 1000);
    }
    const xs = ink.flatMap((s) => s[0]), ys = ink.flatMap((s) => s[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), diag = Math.hypot(w, h) || 1;
    const area = (w * h) / (innerWidth * innerHeight), density = L / diag;
    // scrubbing back and forth, long sweeps across the pane, or circling one spot: the hand is playing
    const wipe = area > 0.42 || density > 11 || (rev >= 6 && density > 6) || (maxDur > 4 && density > 5) || (ink.length === 1 && longest > Math.max(innerWidth, innerHeight) * 0.9);
    return { strokes: ink.length, area: +area.toFixed(3), density: +density.toFixed(2), rev, maxDur: +maxDur.toFixed(2), wipe };
  }
  class Ink {
    constructor({ lang = "en", onInk, onReading, delay = 1900 }) {
      this.lang = lang; this.onInk = onInk; this.onReading = onReading; this.delay = delay;
      this.strokes = []; this.cur = null; this.timer = null; this.t0 = 0; this.busy = false;
    }
    down(x, y) {
      clearTimeout(this.timer);
      if (!this.strokes.length) this.t0 = performance.now();
      this.cur = [[], [], []];
      this.strokes.push(this.cur);
      this.add(x, y);
    }
    move(x, y) { if (this.cur) this.add(x, y); }
    add(x, y) { const c = this.cur; c[0].push(Math.round(x)); c[1].push(Math.round(y)); c[2].push(Math.round(performance.now() - this.t0)); }
    up() {
      if (!this.cur) return;
      // a single dab or a big wipe is not writing
      if (this.cur[0].length < 3) this.strokes.pop();
      this.cur = null;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.read(), this.delay);
    }
    async read() {
      const ink = this.strokes;
      this.strokes = [];
      if (!ink.length || this.busy) return;
      const xs = ink.flatMap((s) => s[0]), ys = ink.flatMap((s) => s[1]);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      if (w < 24 || h > innerHeight * 0.92) return;
      const f = shape(ink);
      // plainly playing with the glass: nothing to read, no need to ask anyone
      if (f.wipe && (f.area > 0.55 || f.density > 16)) { if (this.onIgnore) this.onIgnore(f); return; }
      this.busy = true;
      // the same strokes go to two of Google's recognisers at once: handwriting, and drawings (the AutoDraw one)
      const ask = async (app, language, extra = {}) => {
        try {
          const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
          const r = await fetch(`https://inputtools.google.com/request?ime=handwriting&app=${app}${app === "autodraw" ? "&dbg=1" : ""}&cs=1&oe=UTF-8`, {
            method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...extra, requests: [{ writing_guide: { writing_area_width: Math.round(w + 40), writing_area_height: Math.round(h + 40) }, ink, language, max_num_results: 10 }] }),
          });
          clearTimeout(t);
          const j = await r.json();
          if (j[0] !== "SUCCESS") return [];
          // the drawing recogniser also says how far each guess is from the strokes (lower is surer)
          const dbg = j[1][0][3] && /SCORESINKS: (\[.*?\]\])/.exec(j[1][0][3].debug_info || "");
          if (app === "autodraw") { try { if (dbg) return JSON.parse(dbg[1]).map(([l, s]) => ({ l, s })); } catch (e) {} return j[1][0][1].map((l, i) => ({ l, s: 2.5 + i })); }
          return j[1][0][1];
        } catch (e) { return []; }
      };
      try {
        const lang = { ca: "ca", es: "es" }[this.lang] || "en";
        const [text, draw] = await Promise.all([ask("mobilesearch", lang, { options: "enable_pre_space" }), ask("autodraw", "autodraw", { input_type: 0 })]);
        const m = match(text);
        // real writing reads the same way several times ("hi", "Hi", "hin"); a drawing reads as scattered guesses
        const top = clean(text[0] || ""), near = text.slice(1, 5).filter((c) => lev(clean(c), top) <= 1).length;
        const textual = !!m || (top.length >= 2 && near >= 2);
        // a word that looks like a word: not one letter, not the same letter over and over, with a vowel or a digit
        const raw = clean(text[0] || ""), wordy = raw.length >= 2 && raw.length <= 24 && /[aeiouy0-9]/.test(raw) && !/^(.)\1+$/.test(raw);
        if (this.onInk) this.onInk({ text, draw, aspect: w / Math.max(1, h), strokes: ink.length, match: m, textual, wordy, f });
      } finally { this.busy = false; }
    }
  }
  Ink.match = match;
  window.Ink = Ink;
})();
