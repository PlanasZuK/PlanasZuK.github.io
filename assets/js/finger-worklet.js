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
    this.v = 0; this.vT = 0; this.a = 0; this.turn = 0; this.contact = 0; this.x = 0; this.level = 1;
    this.tex = 0.5; this.texT = 0.5; this.texN = 0; this.press = 0.6; this.pressT = 0.6;
    this.rubA = new BQ(); this.rubB = new BQ(); this.rubHP = new BQ().set("hp", 260, 0.7); this.air = new BQ();
    this.sq = null; this.sqCool = 0; this.modeA = new BQ(); this.modeB = new BQ(); this.sqLP = new BQ().set("lp", 4200, 0.6);
    this.ev = []; this.b = 0; this.lp = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.v !== undefined) { this.vT = m.v; this.a = m.a || 0; this.turn = m.turn || 0; this.x = m.x || 0; }
      if (m.level !== undefined) this.level = m.level;
      if (m.down) { this.contact = 1; this.thud(1); this.sqCool = 0; }
      if (m.up) { this.contact = 0; this.thud(0.45); }
      if (m.wet) this.wet(m.wet);
    };
  }
  thud(a) { this.ev.push({ k: "thud", n: 0, len: Math.round(sampleRate * 0.05), a: a * (0.8 + rnd() * 0.4), f: 150 + rnd() * 60, lp: 0 }); }
  wet(s) { if (this.ev.length < 12) this.ev.push({ k: "wet", n: 0, len: Math.round(sampleRate * 0.03), a: 0.25 + Math.min(1, s) * 0.75, f: 1500 + rnd() * 1400, bp: new BQ().set("bp", 1600 + rnd() * 1800, 1.4) }); }
  process(_, outs) {
    const L = outs[0][0], R = outs[0][1] || outs[0][0], n = L.length, sr = sampleRate;
    // the hand: speed follows smoothly, a little behind, like a real finger
    this.v += (this.vT - this.v) * (1 - Math.exp(-n / (sr * 0.03)));
    const v = Math.min(1.6, this.v) * this.contact;
    // the texture under the finger wanders: fingerprint ridges, thicker and thinner fog, pressure shifting
    if ((this.texN -= n) <= 0) { this.texN = sr * (0.03 + rnd() * 0.09); this.texT = 0.2 + rnd() * 0.8; }
    this.tex += (this.texT - this.tex) * 0.08;
    if (rnd() < 0.01) this.pressT = 0.4 + rnd() * 0.6;
    this.press += (this.pressT - this.press) * 0.02;
    // the colour of the rub moves with speed and texture
    const fc = 650 + 1500 * Math.min(1, v) * (0.75 + 0.5 * this.tex);
    this.rubA.set("bp", fc, 0.7); this.rubB.set("bp", fc * 2.3, 1.1); this.air.set("bp", 5200 + 2000 * this.tex, 0.9);
    const rubAmp = 0.3 * Math.pow(v, 0.5) * (0.55 + 0.7 * this.tex) * this.press, airAmp = 0.05 * Math.pow(v, 1.2);
    // stick-slip: catching is likelier when slow, when starting or braking, and when turning
    const slow = v > 0.03 && v < 0.55 ? 1 - Math.abs(v - 0.22) / 0.33 : 0;
    const chance = (0.004 + 0.05 * Math.max(0, slow) + 0.06 * Math.min(1, Math.abs(this.a)) + 0.12 * this.turn) * this.press * (n / 128);
    this.sqCool -= n;
    if (!this.sq && this.contact && v > 0.02 && this.sqCool <= 0 && rnd() < chance) {
      const len = Math.round(sr * (0.04 + rnd() * rnd() * 0.22));
      this.sq = { n: 0, len, f: 240 + 760 * Math.min(1, v) * (0.8 + rnd() * 0.4), ph: 0, j: 0, a: 0.05 + rnd() * 0.06 };
      this.modeA.set("bp", 1150 + rnd() * 500, 5); this.modeB.set("bp", 2500 + rnd() * 700, 7);
      this.turn = 0; this.sqCool = sr * (0.08 + rnd() * 0.25);
    }
    const pl = Math.cos(((this.x + 1) / 4) * Math.PI), pr = Math.sin(((this.x + 1) / 4) * Math.PI);
    for (let i = 0; i < n; i++) {
      let s = 0;
      if (rubAmp > 1e-5) {
        // slightly pink noise, two bands, a breath of air on top
        this.b = this.b * 0.55 + white() * 0.45;
        const r = this.rubHP.run(this.rubA.run(this.b) + this.rubB.run(this.b) * 0.45);
        s += r * rubAmp * (0.85 + 0.3 * Math.sin(i * 0.0007 + this.tex * 9)) + this.air.run(white()) * airAmp;
      }
      const q = this.sq;
      if (q) {
        // the grip lets go in irregular slips: a rough pulse train, its period jittering
        q.j += (white() * 0.04 - q.j) * 0.01;
        q.ph += (q.f * (1 + q.j)) / sr;
        if (q.ph >= 1) q.ph -= 1;
        const t = q.n / q.len, env = Math.min(1, q.n / (sr * 0.006)) * Math.pow(1 - t, 1.6);
        const pulse = (q.ph < 0.18 ? 1 - q.ph / 0.18 : 0) - 0.18 + white() * 0.15;
        const ring = this.modeA.run(pulse) + this.modeB.run(pulse) * 0.6;
        s += this.sqLP.run(ring) * q.a * env * this.press * 2.2;
        if (++q.n >= q.len) this.sq = null;
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
