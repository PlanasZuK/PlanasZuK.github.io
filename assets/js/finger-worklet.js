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
    this.model = 2; this.v = 0; this.vT = 0; this.a = 0; this.turn = 0; this.contact = 0; this.x = 0; this.level = 1;
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
  wet(s) {
    const now = currentTime;
    if (now - (this.lastWet || 0) < 0.25 || rnd() < 0.5 || this.ev.length > 4) return;
    this.lastWet = now;
    this.ev.push({ k: "wet", n: 0, len: Math.round(sampleRate * 0.03), a: (0.25 + Math.min(1, s) * 0.75) * 0.35, f: 900 + rnd() * 500, bp: new BQ().set("bp", 700 + rnd() * 500, 1.2) });
  }
  // ---------- v4: a wet fingertip on window glass, from the physics and a real recording ----------
  // Why it squeaks: on clean wet glass the skin grips (no oil, a thin water film), builds up shear, and slips,
  // hundreds of times a second (stick-slip). The ridges of the fingerprint (~0.5 mm apart) set the rhythm, so the
  // pitch follows the speed of the finger: 0.1–0.3 m/s gives the 200–600 Hz measured in the recording, and a
  // finger going back and forth draws pitch arcs that fall away at every turn.
  // What the recording measures, and what this does:
  // · clean stretches (40–180 ms): an almost pure tone (2nd harmonic −24 dB, 3rd −33, 4th −40)
  // · rough stretches in between: the grip slipping irregularly, a low, dull rumble (250–500 Hz), ~4 dB quieter
  // · starting to move: a short rough catch before it sings; stopping or turning: the pitch sinks and it fades
  // · no fixed notes: the pitch glides continuously with the hand, with a hair of cycle-to-cycle jitter
  touch3() { this.p3 = 0.85 + rnd() * 0.3; } // each touch presses a little differently
  process3(L, R, n, sr, v) {
    const s = this.s4 || (this.s4 = { body: new BQ(), body2: new BQ(), rl1: new BQ(), rl2: new BQ(), sh: 1, shT: 1, fz: new BQ(), voiced: 0, dwell: 0, wv: 0, wr: 0, gate: 0, f: 260, ph: 0, ph2: 0, ph3: 0, ph4: 0, jit: 0, wander: 0, moving: 0, slip: 0, nextSlip: 0, bp: new BQ(), lp: new BQ(), rumble: new BQ(), wl: 0 });
    const press = (this.p3 || 1) * (0.75 + 0.5 * this.press);
    // the pitch the speed asks for: continuous, a touch higher when pressing harder
    const fT = (200 + 420 * Math.min(1.2, v)) * (0.92 + 0.16 * press);
    // is the finger sliding? a squeak needs some speed; starting from rest it first catches roughly
    const sliding = this.contact && v > 0.035;
    if (sliding && !s.moving) { s.moving = 1; s.voiced = 0; s.dwell = 0.05 + rnd() * 0.04; }
    if (!sliding) s.moving = 0;
    s.dwell -= n / sr;
    if (s.moving && s.dwell <= 0) {
      // clean and rough stretches alternate; moderate speed and pressure keep it singing longer
      const pv = Math.min(0.72, 0.38 + 0.32 * Math.min(1, v * 2) * press);
      s.voiced = rnd() < pv ? 1 : 0;
      s.dwell = s.voiced ? 0.04 + rnd() * 0.12 : 0.03 + rnd() * 0.08;
      s.shT = 0.75 + rnd() * 0.5;
    }
    // loudness: arrives with the slide, barely depends on speed once singing
    const gateT = sliding ? Math.min(1, (v - 0.035) / 0.08) * (0.7 + 0.3 * Math.min(1, v)) : 0;
    s.rumble.set("bp", 230 + 150 * Math.min(1, v), 1.1); s.body.set("lp", 280, 0.7); s.body2.set("hp", 90, 0.7); s.rl1.set("lp", 650, 0.7); s.rl2.set("lp", 650, 0.7); s.lp.set("lp", 2200, 0.7); s.fz.set("bp", s.f, 2.5);
    const pl = Math.cos(((this.x + 1) / 4) * Math.PI), pr = Math.sin(((this.x + 1) / 4) * Math.PI);
    const kG = 1 - Math.exp(-1 / (sr * 0.025)), kV = 1 - Math.exp(-1 / (sr * 0.012)), kF = 1 - Math.exp(-1 / (sr * 0.02));
    for (let i = 0; i < n; i++) {
      s.gate += (gateT - s.gate) * kG;
      s.wv += ((s.moving && s.voiced ? 1 : 0) - s.wv) * kV;
      s.wr += ((s.moving && !s.voiced ? 1 : 0) - s.wr) * kV;
      let out = 0;
      if (s.gate > 1e-4) {
        s.f += (fT - s.f) * kF;
        s.jit += (white() * 0.035 - s.jit) * 0.03;            // cycle-to-cycle jitter of the grip (the real one is never steady)
        s.wander += (white() * 0.08 - s.wander) * 0.0006;     // and a slow drift of pressure
        s.sh += (s.shT * (0.85 + 0.3 * rnd()) - s.sh) * 0.002; // and of loudness
        const f = s.f * (1 + s.jit + s.wander);
        // clean: the near-pure tone, as measured
        if (s.wv > 1e-4) {
          s.ph += f / sr; s.ph2 += (2 * f) / sr; s.ph3 += (3 * f) / sr; s.ph4 += (4 * f) / sr;
          s.ph -= s.ph | 0; s.ph2 -= s.ph2 | 0; s.ph3 -= s.ph3 | 0; s.ph4 -= s.ph4 | 0;
          const tone = Math.sin(s.ph * TAU) + 0.063 * Math.sin(s.ph2 * TAU) + 0.022 * Math.sin(s.ph3 * TAU) + 0.01 * Math.sin(s.ph4 * TAU);
          // the fuzz around the tone: friction noise riding on the same pitch
          out += (tone + s.fz.run(white()) * 0.75) * s.wv * s.sh;
        }
        // rough: irregular slips at about the same rate, ringing low and dull
        if (s.wr > 1e-4) {
          if (--s.nextSlip <= 0) { s.nextSlip = (sr / f) * (0.55 + rnd() * 0.9); s.slip = 0.6 + rnd() * 0.8; }
          const imp = s.slip; s.slip *= 0.6;
          s.wl += (white() - s.wl) * 0.15;
          // only low and dull, as measured: two gentle low-passes keep the slips from clicking
          out += s.rl2.run(s.rl1.run(s.rumble.run(imp * 2.2 + s.wl * 0.35) * 2.4)) * s.wr * 0.95;
        }
        // the pane's low body under the pressing finger, there all the time it slides
        out += s.body2.run(s.body.run(white())) * 3.2;
        // and the faint hiss of skin on wet glass, high and soft
        s.hs = (s.hs || 0) * 0.3 + white() * 0.7; out += s.hs * 0.035 * (0.5 + 0.5 * s.sh);
        out = s.lp.run(out) * s.gate * 0.13 * press;
      }
      // touch, lift and drops crossed
      for (const e of this.ev) {
        const t = e.n / sr;
        if (e.k === "thud") { e.lp += (white() - e.lp) * 0.08; out += (Math.sin(TAU * e.f * t) * 0.6 + e.lp * 0.8) * Math.exp(-t / 0.012) * e.a * 0.12; }
        else out += (e.bp.run(white()) * Math.exp(-t / 0.004) * 0.5) * e.a * 0.07;
        e.n++;
      }
      out *= this.level;
      L[i] = out * pl; R[i] = out * pr;
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
