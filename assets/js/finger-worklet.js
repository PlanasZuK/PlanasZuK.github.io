/* finger-worklet.js — a wet fingertip on fogged glass, modelled sample by sample.
   What the ear hears in real life, and what this does:
   · the skin rubbing: a soft broadband hiss whose colour and level follow the speed, roughened by the ridges of
     the fingerprint and the uneven fog (a slow random texture, so no two strokes sound alike)
   · stick-slip: skin on wet glass grips and lets go. Slow drags, starting, braking and turning make it catch:
     a short, slightly irregular squeak whose pitch follows the speed, ringing faintly in the pane's own modes
   · water: each drop the finger crosses gives a tiny wet tick; touching down and lifting off, a soft "tup"
   Everything is quiet, rounded and a little imperfect on purpose. Inputs arrive ~60 times a second. */
const TAU = Math.PI * 2;
let seed = 99173;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
const white = () => rnd() * 2 - 1;
class BQ {
  constructor() { this.b0 = 1; this.b1 = this.b2 = this.a1 = this.a2 = 0; this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(type, f, q) {
    const w = (TAU * Math.min(f, sampleRate * 0.45)) / sampleRate, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2;
    if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a; this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
    return this;
  }
  run(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
class Finger extends AudioWorkletProcessor {
  constructor() {
    super();
    this.model = 3; this.v = 0; this.vT = 0; this.a = 0; this.turn = 0; this.contact = 0; this.x = 0; this.level = 1;
    this.tex = 0.5; this.texT = 0.5; this.texN = 0; this.press = 0.6; this.pressT = 0.6;
    this.rubA = new BQ(); this.rubB = new BQ(); this.rubHP = new BQ().set("hp", 260, 0.7); this.air = new BQ();
    this.sq = null; this.sqCool = 0; this.modeA = new BQ(); this.modeB = new BQ(); this.sqLP = new BQ().set("lp", 3200, 0.6);
    this.ev = []; this.b = 0; this.lp = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.v !== undefined) { this.vT = m.v; this.a = m.a || 0; this.turn = m.turn || 0; this.x = m.x || 0; }
      if (m.level !== undefined) this.level = m.level;
      if (m.down) { this.contact = 1; this.thud(1); this.sqCool = 0; this.touch3(); }
      if (m.up) { this.contact = 0; this.thud(0.45); }
      if (m.wet) this.wet(m.wet);
      if (m.model) this.model = m.model;
    };
  }
  thud(a) { this.ev.push({ k: "thud", n: 0, len: Math.round(sampleRate * 0.05), a: a * (0.8 + rnd() * 0.4), f: 150 + rnd() * 60, lp: 0 }); }
  wet(s) { if (this.ev.length < 12) this.ev.push({ k: "wet", n: 0, len: Math.round(sampleRate * 0.03), a: 0.25 + Math.min(1, s) * 0.75, f: 1500 + rnd() * 1400, bp: new BQ().set("bp", 1600 + rnd() * 1800, 1.4) }); }
  // ---------- v3: modelled on a real recording of a wet fingertip dragged across window glass ----------
  // What the recording shows, and what this does:
  // · the sound is almost all tone: a near-sine (2nd harmonic −22 dB, 3rd −25 dB, the rest below −40), low,
  //   between 150 and 650 Hz, with almost no broadband rub and nothing above ~2 kHz
  // · the pitch does not glide: it locks onto a few preferred frequencies (the finger and pane resonating
  //   together, here ~150, 190, 234, 293, 360, 422, 516, 650 Hz), holds one for 30–100 ms, then hops
  // · a slow drag gives separate squeaks of 160–360 ms (rise 30–80 ms, a longer 130–280 ms tail); a steady
  //   drag at medium speed keeps one long, hopping squeal going
  // · the hand trembles: a 4–6 Hz swell in level, and a hair of pitch wobble
  // Each touch gets its own slightly different set of modes, as a different finger or pane would.
  touch3() {
    const k = 0.95 + rnd() * 0.1;
    this.modes = [150, 190, 234, 293, 360, 422, 516, 650].map((f) => f * k * (0.98 + rnd() * 0.04));
  }
  process3(L, R, n, sr, v) {
    const s3 = this.s3 || (this.s3 = { on: 0, env: 0, dwell: 0, hold: 0, mode: 2, f: 234, fT: 234, ph: 0, ph2: 0, ph3: 0, trem: 0, tremF: 5, tremP: 0, jit: 0, amp: 0.1, lp: 0, rise: 0.05, fall: 0.2 });
    if (!this.modes) this.touch3();
    const M = this.modes;
    // speed chooses the register: slow, low and intermittent; steady, higher and continuous
    const reg = Math.max(0, Math.min(M.length - 1, Math.round(2 + Math.min(1.2, v) * 4.6 + (this.press - 0.7) * 2)));
    s3.dwell -= n / sr;
    if (!this.contact || v < 0.015) { s3.on = 0; }
    else if (s3.dwell <= 0) {
      if (s3.on) {
        // a squeak ends: soon at a slow drag, rarely while the finger keeps a steady pace
        s3.on = 0; s3.dwell = v < 0.25 ? 0.06 + rnd() * 0.35 : 0.02 + rnd() * 0.09;
      } else {
        const want = 0.35 + Math.min(0.55, v * 0.9) + Math.min(1, Math.abs(this.a)) * 0.2 + this.turn * 0.5;
        if (rnd() < Math.min(0.97, want * (0.6 + 0.4 * this.press))) {
          s3.on = 1; this.turn = 0;
          s3.dwell = v < 0.25 ? 0.16 + rnd() * 0.2 : 0.3 + rnd() * 1.2;
          s3.rise = 0.03 + rnd() * 0.05; s3.fall = 0.13 + rnd() * 0.15;
          s3.mode = Math.max(0, Math.min(M.length - 1, reg + Math.round((rnd() - 0.5) * 2)));
          s3.amp = 0.11 + rnd() * 0.07; s3.hold = 0.03 + rnd() * 0.07;
          this.port.postMessage({ squeak: 1 });
        } else s3.dwell = 0.03 + rnd() * 0.12;
      }
    }
    // while it sings, it hops between neighbouring modes, drifting with the speed
    if (s3.on) {
      s3.hold -= n / sr;
      if (s3.hold <= 0) {
        s3.hold = 0.03 + rnd() * 0.07;
        const toward = Math.sign(reg - s3.mode), step = rnd() < 0.55 ? toward : rnd() < 0.5 ? -1 : 1;
        if (rnd() < 0.6) s3.mode = Math.max(0, Math.min(M.length - 1, s3.mode + step));
      }
      s3.fT = M[s3.mode];
    }
    if ((s3.tremP += n / sr) > 0.6) { s3.tremP = 0; s3.tremF = 4 + rnd() * 2; }
    const pl = Math.cos(((this.x + 1) / 4) * Math.PI), pr = Math.sin(((this.x + 1) / 4) * Math.PI);
    const up = 1 - Math.exp(-1 / (sr * s3.rise)), down = 1 - Math.exp(-1 / (sr * s3.fall)), hop = 1 - Math.exp(-1 / (sr * 0.006));
    for (let i = 0; i < n; i++) {
      s3.env += ((s3.on ? 1 : 0) - s3.env) * (s3.on ? up : down);
      let s = 0;
      if (s3.env > 1e-4) {
        s3.f += (s3.fT - s3.f) * hop;                       // a quick snap to the next mode, not a slide
        s3.jit += (white() * 0.004 - s3.jit) * 0.002;        // a hair of instability in the grip
        s3.trem += s3.tremF / sr; if (s3.trem > 1) s3.trem -= 1;
        const f = s3.f * (1 + s3.jit), am = 0.78 + 0.22 * Math.sin(s3.trem * TAU);
        s3.ph += f / sr; s3.ph2 += (2 * f) / sr; s3.ph3 += (3 * f) / sr;
        s3.ph -= s3.ph | 0; s3.ph2 -= s3.ph2 | 0; s3.ph3 -= s3.ph3 | 0;
        const tone = Math.sin(s3.ph * TAU) + 0.08 * Math.sin(s3.ph2 * TAU) + 0.06 * Math.sin(s3.ph3 * TAU) + 0.012 * Math.sin(s3.ph2 * 2 * TAU);
        // and the faintest wet breath under it, low-passed, as the recording has
        // the grip is never perfectly clean: a little roughness rides on the tone, more when pressing harder
        s3.lp += (white() - s3.lp) * 0.1;
        const rough = 1 + s3.lp * 0.35 * this.press;
        s = (tone * rough + s3.lp * 0.12) * s3.env * am * s3.amp * this.press;
      }
      // touch, lift and drops crossed, as before
      for (const e of this.ev) {
        const t = e.n / sr;
        if (e.k === "thud") { e.lp += (white() - e.lp) * 0.08; s += (Math.sin(TAU * e.f * t) * 0.6 + e.lp * 0.8) * Math.exp(-t / 0.012) * e.a * 0.12; }
        else s += (e.bp.run(white()) * Math.exp(-t / 0.004) * 0.6 + Math.sin(TAU * (e.f * 0.45 + 2500 * t) * t) * Math.exp(-t / 0.008) * 0.25) * e.a * 0.08;
        e.n++;
      }
      s *= this.level;
      L[i] = s * pl; R[i] = s * pr;
    }
    if (this.ev.length) this.ev = this.ev.filter((e) => e.n < e.len);
    return true;
  }
  process(_, outs) {
    const L = outs[0][0], R = outs[0][1] || outs[0][0], n = L.length, sr = sampleRate;
    // the hand: speed follows smoothly, a little behind, like a real finger
    this.v += (this.vT - this.v) * (1 - Math.exp(-n / (sr * 0.03)));
    const v = Math.min(1.6, this.v) * this.contact;
    if (this.model === 3) {
      if ((this.texN -= n) <= 0) { this.texN = sr * (0.03 + rnd() * 0.09); this.texT = 0.2 + rnd() * 0.8; }
      this.tex += (this.texT - this.tex) * 0.08;
      if (rnd() < 0.01) this.pressT = 0.5 + rnd() * 0.5;
      this.press += (this.pressT - this.press) * 0.02;
      return this.process3(L, R, n, sr, v);
    }
    // the texture under the finger wanders: fingerprint ridges, thicker and thinner fog, pressure shifting
    if ((this.texN -= n) <= 0) { this.texN = sr * (0.03 + rnd() * 0.09); this.texT = 0.2 + rnd() * 0.8; }
    this.tex += (this.texT - this.tex) * 0.08;
    if (rnd() < 0.01) this.pressT = 0.4 + rnd() * 0.6;
    this.press += (this.pressT - this.press) * 0.02;
    // the colour of the rub moves with speed and texture
    const fc = 650 + 1500 * Math.min(1, v) * (0.75 + 0.5 * this.tex);
    this.rubA.set("bp", fc, 0.7); this.rubB.set("bp", fc * 2.3, 1.1); this.air.set("bp", 5200 + 2000 * this.tex, 0.9);
    const rubAmp = 0.15 * Math.pow(v, 0.55) * (0.55 + 0.7 * this.tex) * this.press, airAmp = 0.05 * Math.pow(v, 1.2);
    // stick-slip: the skin grips the wet glass and lets go hundreds of times a second: that is the squeak.
    // It chatters on and off by itself while the finger moves; it catches more when slow, starting, braking or
    // turning, and the faster the finger goes, the higher and shorter it sings
    const sq = this.sqs || (this.sqs = { on: 0, dwell: 0, env: 0, f: 700, fT: 700, ph: 0, j: 0, flut: 0, amp: 0.1 });
    const slow = v > 0.02 ? Math.max(0, 1 - Math.abs(v - 0.3) / 0.5) : 0;
    sq.dwell -= n / sr;
    if (!this.contact || v < 0.02) sq.on = 0;
    else if (sq.dwell <= 0) {
      if (sq.on) { sq.on = 0; sq.dwell = 0.03 + rnd() * rnd() * (0.6 - Math.min(0.45, v * 0.3)); }
      else {
        const want = (0.25 + 0.75 * slow) * (0.6 + 0.4 * this.press) + Math.min(1, Math.abs(this.a)) * 0.4 + this.turn * 0.6;
        if (rnd() < Math.min(0.95, want)) {
          sq.on = 1; sq.dwell = 0.05 + rnd() * (0.35 - Math.min(0.25, v * 0.15));
          sq.amp = 0.095 + rnd() * 0.1; this.turn = 0;
          this.modeA.set("bp", 1250 + rnd() * 450, 6); this.modeB.set("bp", 2600 + rnd() * 700, 8);
          this.port.postMessage({ squeak: 1 });
        } else sq.dwell = 0.02 + rnd() * 0.12;
      }
    }
    sq.fT = (480 + 950 * Math.min(1.2, v)) * (0.85 + this.press * 0.3) * (0.92 + this.tex * 0.16);
    const pl = Math.cos(((this.x + 1) / 4) * Math.PI), pr = Math.sin(((this.x + 1) / 4) * Math.PI);
    for (let i = 0; i < n; i++) {
      let s = 0;
      if (rubAmp > 1e-5) {
        // slightly pink noise, two bands, a breath of air on top
        this.b = this.b * 0.55 + white() * 0.45;
        const r = this.rubHP.run(this.rubA.run(this.b) + this.rubB.run(this.b) * 0.45);
        s += r * rubAmp * (0.85 + 0.3 * Math.sin(i * 0.0007 + this.tex * 9)) + this.air.run(white()) * airAmp;
      }
      // the squeak: a relaxation oscillation (slow grip, sudden slip), its pitch wandering, fluttering a little
      sq.env += ((sq.on ? 1 : 0) - sq.env) * (sq.on ? 0.004 : 0.0018);
      if (sq.env > 0.001) {
        sq.f += (sq.fT - sq.f) * 0.0008;
        sq.j += (white() * 0.06 - sq.j) * 0.004;
        sq.flut += (white() - sq.flut) * 0.02;
        sq.ph += (sq.f * (1 + sq.j)) / sr;
        if (sq.ph >= 1) sq.ph -= 1;
        const saw = 1 - 2 * sq.ph * sq.ph; // the grip builds slowly, the slip is sudden
        const raw = this.sqLP.run(saw) * 0.55 + this.modeA.run(saw) * 0.8 + this.modeB.run(saw) * 0.45;
        s += raw * sq.env * sq.amp * this.press * (0.85 + 0.15 * sq.flut);
      }
      for (const e of this.ev) {
        const t = e.n / sr;
        if (e.k === "thud") { e.lp += (white() - e.lp) * 0.08; s += (Math.sin(TAU * e.f * t) * 0.6 + e.lp * 0.8) * Math.exp(-t / 0.012) * e.a * 0.12; }
        else s += (e.bp.run(white()) * Math.exp(-t / 0.004) + Math.sin(TAU * (e.f + 9000 * t) * t) * Math.exp(-t / 0.008) * 0.25) * e.a * 0.1;
        e.n++;
      }
      s *= this.level;
      L[i] = s * pl; R[i] = s * pr;
    }
    if (this.ev.length) this.ev = this.ev.filter((e) => e.n < e.len);
    return true;
  }
}
registerProcessor("finger", Finger);
