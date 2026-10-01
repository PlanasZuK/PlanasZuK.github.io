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
  class Ink {
    constructor({ lang = "en", onWord, onRead, onReading, delay = 1900 }) {
      this.lang = lang; this.onWord = onWord; this.onRead = onRead; this.onReading = onReading; this.delay = delay;
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
      this.busy = true;
      if (this.onReading) this.onReading();
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
        const lang = { ca: "ca", es: "es" }[this.lang] || "en";
        const r = await fetch("https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8", {
          method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ options: "enable_pre_space", requests: [{ writing_guide: { writing_area_width: innerWidth, writing_area_height: innerHeight }, ink, language: lang, max_num_results: 10 }] }),
        });
        clearTimeout(t);
        const j = await r.json();
        const cands = j[0] === "SUCCESS" ? j[1][0][1] : [];
        const m = match(cands);
        if (m && this.onWord) this.onWord(m.target, m.word, cands);
        else if (this.onRead) this.onRead(cands);
      } catch (e) { if (this.onRead) this.onRead([]); } finally { this.busy = false; }
    }
  }
  Ink.match = match;
  window.Ink = Ink;
})();
