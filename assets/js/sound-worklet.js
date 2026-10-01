/* sound-worklet.js — the window's sound, synthesised live on the audio thread. No recordings: every layer
   is generated from the scene, so it never loops and always answers what is on screen.
   · outside: rain on the garden, heard through the glass (pink noise, darker at night, muffled when you step back)
   · the patter: thousands of tiny impacts on the sill and the leaves, each a filtered grain at its own place
   · gutter drips: bubbles that ring as they burst (the Minnaert resonance, rising in pitch as it closes)
   · the glass: every drop that lands on the window you see taps it, at its place, with the pane's own modes
   · wind that follows the gusts you see, with a faint whistle at the frame when they are strong
   · thunder, far or near, rolling for seconds
   · a wet fingertip on fogged glass, and the voice's soft keys
   Positional sounds are placed binaurally: a time difference between the ears, a level difference,
   and the far ear's head shadow (a gentle low-pass). Output 0 is dry, output 1 feeds the room. */

const TAU = Math.PI * 2;

// a fast, decent white noise
let seed = 22222;
const white = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296) * 2 - 1; };

// RBJ biquads, direct form I
class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(type, f, q, sr) {
    const w = (TAU * Math.min(f, sr * 0.45)) / sr, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2;
    if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; } // band-pass, 0 dB peak
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
// pink noise (Paul Kellet's refined filter)
class Pink {
  constructor() { this.b = [0, 0, 0, 0, 0, 0, 0]; }
  run() {
    const w = white(), b = this.b;
    b[0] = 0.99886 * b[0] + w * 0.0555179; b[1] = 0.99332 * b[1] + w * 0.0750759; b[2] = 0.969 * b[2] + w * 0.153852;
    b[3] = 0.8665 * b[3] + w * 0.3104856; b[4] = 0.55 * b[4] + w * 0.5329522; b[5] = -0.7616 * b[5] - w * 0.016898;
    const o = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362; b[6] = w * 0.115926;
    return o * 0.11;
  }
}
const lerp = (a, b, t) => a + (b - a) * t;

class Window extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = sampleRate;
    this.sr = sr;
    // what the scene says, and the smoothed values that follow it
    // the mix, layer by layer (tunable live with ?tune)
    this.M = { bed: 1, patter: 1, drips: 1, taps: 1, wind: 1, finger: 1, thunder: 1, keys: 1, ui: 1, whoosh: 1 };
    this.T = { rain: 0, wind: 0, gust: 0, night: 0, storm: 0, muffle: 0, finger: 0, fx: 0, whoosh: 0 };
    this.V = { ...this.T };
    this.pinkL = new Pink(); this.pinkR = new Pink();
    this.bedHP = [new Biquad(), new Biquad()]; this.bedLP = [new Biquad(), new Biquad()]; this.bedLP2 = [new Biquad(), new Biquad()];
    this.sizzle = [new Biquad(), new Biquad()];
    this.breath = 0; this.breathT = 0;
    // the patter: three banks of resonant bands per ear, struck by grains
    this.bankF = [1900, 3600, 6800];
    this.bank = [0, 1].map(() => this.bankF.map(() => new Biquad()));
    this.bankIn = [new Float32Array(3), new Float32Array(3)];
    this.bankLP = [new Biquad(), new Biquad()];
    // wind
    this.brown = [0, 0];
    this.windBP = [new Biquad(), new Biquad()]; this.windLP = [new Biquad(), new Biquad()];
    this.whistle = new Biquad(); this.whistleF = 900; this.whistleT = 0;
    // fingertip
    this.fingerBP = new Biquad(); this.fingerHP = new Biquad(); this.squeak = [new Biquad(), new Biquad()];
    this.sqPhase = 0; this.sqEnv = 0; this.sqF = 600;
    // camera whoosh
    this.whooshBP = [new Biquad(), new Biquad()];
    // voices placed in space: taps, drips, ticks
    this.voices = [];
    // thunder voices
    this.thunder = [];
    this.thLP = [new Biquad(), new Biquad()];
    // binaural accumulators: a short future, so each ear can hear a voice a fraction of a millisecond apart
    this.N = 512; this.acc = [new Float32Array(512), new Float32Array(512)]; this.sendAcc = [new Float32Array(512), new Float32Array(512)]; this.pos = 0;
    this.dripT = 0.5;
    this.lim = 1;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.set) Object.assign(this.T, m.set);
      if (m.mix) Object.assign(this.M, m.mix);
      if (m.tap) this.tap(m.tap.x, m.tap.s);
      if (m.tick) this.tick(m.tick.x, m.tick.k || 1);
      if (m.ui) this.ui(m.ui);
      if (m.thunder !== undefined) this.boom(m.thunder);
    };
    this.block = 0;
  }
  // where a sound is: x from -1 (left) to 1 (right), straight ahead at the window
  place(x) {
    const p = (Math.max(-1, Math.min(1, x)) + 1) / 2, th = (p - 0.5) * Math.PI * 0.75;
    const itd = Math.round(Math.abs(Math.sin(th)) * 0.00066 * this.sr);
    // the far ear: quieter, later, and in the head's shadow
    const shadow = Math.exp((-TAU * lerp(18000, 2600, Math.abs(Math.sin(th)))) / this.sr);
    return { gl: Math.cos((p * Math.PI) / 2) * 1.2, gr: Math.sin((p * Math.PI) / 2) * 1.2, dl: x > 0 ? itd : 0, dr: x < 0 ? itd : 0, kl: x > 0 ? shadow : 0, kr: x < 0 ? shadow : 0, sl: 0, sr: 0 };
  }
  // a drop landing on the pane: a tiny click that rings in three of the glass's modes
  tap(x, s) {
    if (this.voices.length > 40) this.voices.shift();
    const f = lerp(4200, 1700, Math.min(1, s)) * (0.9 + Math.random() * 0.2), sr = this.sr;
    const modes = [1, 1.59, 2.41].map((r, i) => {
      const w = (TAU * f * r) / sr, d = Math.exp(-1 / (sr * lerp(0.016, 0.006, i / 2) * (0.7 + s * 0.6)));
      return { c: 2 * d * Math.cos(w), d2: d * d, y1: 0, y2: 0, a: [1, 0.55, 0.3][i] };
    });
    this.voices.push({ kind: "tap", P: this.place(x), modes, n: 0, len: Math.round(sr * 0.06), amp: 0.06 * Math.pow(0.25 + s, 1.25) * this.M.taps, ex: 3, send: 0.12 });
  }
  // a water bubble closing: a sine whose pitch rises as it dies away
  drip(x, f0, amp) {
    if (this.voices.length > 40) this.voices.shift();
    const dur = lerp(0.05, 0.11, Math.random());
    this.voices.push({ kind: "drip", P: this.place(x), ph: 0, f0, rise: 1.2 + Math.random() * 1.6, n: 0, len: Math.round(this.sr * dur), dur, amp: amp * this.M.drips, send: 0.45 });
  }
  // the voice's keys: soft, short, a little different every time
  tick(x, k) {
    if (this.voices.length > 40) this.voices.shift();
    const sr = this.sr, f = 2300 * (0.88 + Math.random() * 0.24) * k, w = (TAU * f) / sr, d = Math.exp(-1 / (sr * 0.006));
    this.voices.push({ kind: "tap", P: this.place(x), modes: [{ c: 2 * d * Math.cos(w), d2: d * d, y1: 0, y2: 0, a: 1 }, { c: 2 * d * Math.cos(w * 2.7), d2: d * d * 0.98, y1: 0, y2: 0, a: 0.25 }], n: 0, len: Math.round(sr * 0.04), amp: 0.022 * (0.8 + Math.random() * 0.4) * this.M.keys, ex: 2, send: 0.05 });
  }
  ui(kind) {
    const sr = this.sr, f = kind === "press" ? 1500 : 2900, w = (TAU * f) / sr, d = Math.exp(-1 / (sr * (kind === "press" ? 0.012 : 0.005)));
    if (this.voices.length > 40) this.voices.shift();
    this.voices.push({ kind: "tap", P: this.place(0), modes: [{ c: 2 * d * Math.cos(w), d2: d * d, y1: 0, y2: 0, a: 1 }], n: 0, len: Math.round(sr * 0.05), amp: (kind === "press" ? 0.03 : 0.012) * this.M.ui, ex: 2, send: 0.04 });
  }
  // thunder: a crack if it is close, then a roll of several bursts over many seconds, low-passed by distance
  boom(dist) {
    if (this.thunder.length > 3) this.thunder.shift();
    const sr = this.sr, bursts = [];
    let t = dist < 0.35 ? 0 : 0.05 + Math.random() * 0.2;
    const n = 3 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) { bursts.push({ t, a: (i === 0 ? 1 : 0.35 + Math.random() * 0.65) * (1 - i * 0.08), at: 0.04 + Math.random() * 0.25, dec: 0.8 + Math.random() * 2.2 }); t += 0.3 + Math.random() * 1.4; }
    this.thunder.push({ n: 0, len: Math.round(sr * (t + 5)), bursts, dist, crack: dist < 0.35, b: [0, 0], amp: lerp(0.55, 0.22, dist) * this.M.thunder });
    this.thLP.forEach((f) => f.set("lp", lerp(1100, 170, dist), 0.6, sr));
  }
  process(_, outs) {
    const out = outs[0], send = outs[1], L = out[0], R = out[1] || out[0], SL = send[0], SR = send[1] || send[0];
    const n = L.length, sr = this.sr, T = this.T, V = this.V;
    // follow the scene smoothly (about a fifth of a second)
    const k = 1 - Math.exp(-n / (sr * 0.2));
    for (const key in T) V[key] += (T[key] - V[key]) * k;
    const rain = Math.max(0, V.rain), night = V.night, muffle = Math.min(1, Math.max(0, V.muffle)), storm = V.storm;
    const g = Math.min(2.5, Math.abs(V.wind) * 0.6 + V.gust), finger = Math.min(1.5, V.finger), whoosh = Math.min(1, V.whoosh);
    // every few blocks, retune the filters that move
    if (this.block++ % 4 === 0) {
      const fc = lerp(2900, 1500, night) * lerp(1, 0.28, muffle) * (1 + storm * 0.25);
      for (let c = 0; c < 2; c++) {
        this.bedHP[c].set("hp", 110, 0.7, sr); this.bedLP[c].set("lp", fc, 0.6, sr); this.bedLP2[c].set("lp", fc * 1.6, 0.6, sr);
        this.sizzle[c].set("bp", 6200 + c * 500, 0.8, sr);
        this.bankF.forEach((f, i) => this.bank[c][i].set("bp", f * (c ? 1.07 : 1), 2.2, sr));
        this.bankLP[c].set("lp", lerp(9000, 2400, muffle), 0.7, sr);
        this.windBP[c].set("bp", 220 + 650 * g + c * 40, 0.75, sr); this.windLP[c].set("lp", lerp(1900, 700, muffle), 0.7, sr);
        this.whooshBP[c].set("bp", 280 + 1800 * whoosh + c * 90, 1.1, sr);
      }
      this.whistleT -= (4 * n) / sr;
      if (this.whistleT <= 0) { this.whistleT = 1.5 + Math.random() * 3; this.whistleF = 760 + Math.random() * 520; }
      this.whistle.set("bp", this.whistleF * (1 + g * 0.08), 14, sr);
      this.fingerBP.set("bp", 2600 + 2400 * Math.min(1, finger), 0.9, sr); this.fingerHP.set("hp", 900, 0.7, sr);
      this.sqF = 380 + 900 * Math.min(1, finger) + (Math.random() - 0.5) * 60;
      this.squeak[0].set("bp", 1850, 7, sr); this.squeak[1].set("bp", 3150, 9, sr);
    }
    // gutter drips, now and then, somewhere in the garden
    this.dripT -= n / sr;
    if (this.dripT <= 0) {
      this.dripT = (0.4 + Math.random() * 1.8) / (0.3 + rain);
      if (rain > 0.05) this.drip(Math.random() * 1.8 - 0.9, 900 + Math.random() * 2600, 0.02 * (0.5 + Math.random()) * (1 - muffle * 0.8));
    }
    // the squeak of a fingertip comes and goes by itself, as the skin sticks and slips
    if (finger > 0.08 && Math.random() < 0.02) this.sqEnv = Math.min(1, this.sqEnv + 0.6 + Math.random() * 0.4);
    const M = this.M, grainRate = (90 + 520 * rain * (1 + storm)) / sr, bedAmp = 0.38 * Math.pow(rain, 0.7) * (1 - night * 0.25) * lerp(1, 0.55, muffle) * M.bed;
    const sizzleAmp = 0.05 * rain * (1 - muffle) * (1 - night * 0.3) * M.bed, windAmp = 0.35 * Math.pow(0.12 + g * 0.5, 1.6) * (1 + storm * 0.4) * lerp(1, 0.6, muffle) * M.wind;
    const whistleAmp = 0.06 * Math.max(0, g - 0.7) * (1 - muffle) * M.wind, wb = Math.max(-1, Math.min(1, V.wind * 0.5));
    const fingerAmp = 0.11 * Math.pow(Math.min(1, finger), 0.8) * M.finger, fx = V.fx, fpl = Math.cos(((fx + 1) / 4) * Math.PI), fpr = Math.sin(((fx + 1) / 4) * Math.PI);
    const whooshAmp = 0.22 * Math.pow(whoosh, 1.4) * M.whoosh, patAmp = (0.8 + rain * 0.5) * M.patter;
    const A = this.acc, S = this.sendAcc, N = this.N;
    for (let i = 0; i < n; i++) {
      // the slow breathing of a real downpour
      if (--this.breathT <= 0) { this.breathT = sr * (0.3 + Math.random() * 0.8); this.breathTo = 0.85 + Math.random() * 0.3; }
      this.breath += ((this.breathTo || 1) - this.breath) * 0.00005;
      let l = 0, r = 0, sl = 0, sr2 = 0;
      // outside, through the glass
      const pl = this.pinkL.run(), pr = this.pinkR.run();
      l += this.bedLP2[0].run(this.bedLP[0].run(this.bedHP[0].run(pl))) * bedAmp * this.breath;
      r += this.bedLP2[1].run(this.bedLP[1].run(this.bedHP[1].run(pr))) * bedAmp * (2 - this.breath);
      const wn = white();
      l += this.sizzle[0].run(wn) * sizzleAmp; r += this.sizzle[1].run(white()) * sizzleAmp;
      // the patter: grains strike the banks at random places and strengths
      if (Math.random() < grainRate) {
        const a = -Math.log(1 - Math.random() * 0.999) * 0.05, b = (Math.random() * 3) | 0, p = Math.random();
        this.bankIn[0][b] += a * Math.cos((p * Math.PI) / 2); this.bankIn[1][b] += a * Math.sin((p * Math.PI) / 2);
      }
      for (let c = 0; c < 2; c++) {
        let s = 0;
        for (let b = 0; b < 3; b++) { s += this.bank[c][b].run(this.bankIn[c][b]) * [1, 0.7, 0.45][b]; this.bankIn[c][b] = 0; }
        s = this.bankLP[c].run(s) * patAmp;
        if (c) r += s; else l += s;
      }
      // wind: brown noise through a moving band, leaning to the side it blows from
      this.brown[0] = (this.brown[0] + white() * 0.02) * 0.997; this.brown[1] = (this.brown[1] + white() * 0.02) * 0.997;
      const w0 = this.windLP[0].run(this.windBP[0].run(this.brown[0] * 6)) * windAmp, w1 = this.windLP[1].run(this.windBP[1].run(this.brown[1] * 6)) * windAmp;
      l += w0 * (1 - wb * 0.4); r += w1 * (1 + wb * 0.4);
      if (whistleAmp > 0.0005) { const ws = this.whistle.run(wn) * whistleAmp * 3; l += ws * (1 - wb * 0.5); r += ws * (1 + wb * 0.5); }
      // the fingertip: a soft hiss of water and, sometimes, a squeak
      if (fingerAmp > 0.0005 || this.sqEnv > 0.001) {
        const h = this.fingerBP.run(this.fingerHP.run(white())) * fingerAmp;
        this.sqPhase += (this.sqF * (1 + (white() * 0.02))) / sr; if (this.sqPhase > 1) this.sqPhase -= 1;
        const saw = (this.sqPhase * 2 - 1) * this.sqEnv * 0.05 * Math.min(1, finger * 2) * M.finger;
        const q = this.squeak[0].run(saw) + this.squeak[1].run(saw) * 0.6;
        this.sqEnv *= 0.9996;
        l += (h + q) * fpl; r += (h + q) * fpr;
      }
      // the camera pulling back or diving in
      if (whooshAmp > 0.0005) { l += this.whooshBP[0].run(white()) * whooshAmp; r += this.whooshBP[1].run(white()) * whooshAmp; }
      // thunder
      for (const th of this.thunder) {
        const t = th.n / sr;
        let env = 0;
        for (const b of th.bursts) { const e = t - b.t; if (e > 0) env += b.a * (e < b.at ? e / b.at : Math.exp(-(e - b.at) / b.dec)); }
        th.b[0] = (th.b[0] + white() * 0.03) * 0.9985; th.b[1] = (th.b[1] + white() * 0.03) * 0.9985;
        let c0 = th.b[0] * 5, c1 = th.b[1] * 5;
        if (th.crack && t < 0.25) { const ck = Math.exp(-t / 0.05) * 0.6; c0 += white() * ck; c1 += white() * ck; }
        const a = env * th.amp * (1 - muffle * 0.5);
        const t0 = this.thLP[0].run(c0) * a, t1 = this.thLP[1].run(c1) * a;
        l += t0; r += t1; sl += t0 * 0.6; sr2 += t1 * 0.6;
        th.n++;
      }
      // the placed voices, written a little ahead for the far ear
      const at = this.pos;
      for (const v of this.voices) {
        let s = 0;
        if (v.kind === "tap") {
          const x = v.n < v.ex ? white() : 0;
          for (const m of v.modes) { const y = m.c * m.y1 - m.d2 * m.y2 + x * m.a; m.y2 = m.y1; m.y1 = y; s += y; }
          s *= v.amp;
        } else {
          const t = v.n / sr, e = Math.exp(-t / (v.dur * 0.3));
          v.ph += (v.f0 * (1 + v.rise * (t / v.dur))) / sr;
          s = Math.sin(v.ph * TAU) * e * v.amp * Math.min(1, v.n / 24);
        }
        const P = v.P;
        let el = s * P.gl, er = s * P.gr;
        if (P.kl) { P.sl = P.sl * P.kl + el * (1 - P.kl); el = P.sl; }
        if (P.kr) { P.sr = P.sr * P.kr + er * (1 - P.kr); er = P.sr; }
        const il = (at + i + P.dl) % N, ir = (at + i + P.dr) % N;
        A[0][il] += el; A[1][ir] += er; S[0][il] += el * v.send; S[1][ir] += er * v.send;
        v.n++;
      }
      const j = (at + i) % N;
      l += A[0][j]; r += A[1][j]; sl += S[0][j]; sr2 += S[1][j];
      A[0][j] = A[1][j] = S[0][j] = S[1][j] = 0;
      // a gentle limiter: nothing on this page is ever loud
      const peak = Math.max(Math.abs(l), Math.abs(r));
      this.lim = peak * this.lim > 0.9 ? 0.9 / peak : Math.min(1, this.lim + 0.00002);
      L[i] = l * this.lim; R[i] = r * this.lim; SL[i] = (sl + (l * 0.08)) * this.lim; SR[i] = (sr2 + (r * 0.08)) * this.lim;
    }
    this.pos = (this.pos + n) % N;
    this.voices = this.voices.filter((v) => v.n < v.len);
    this.thunder = this.thunder.filter((t) => t.n < t.len);
    return true;
  }
}
registerProcessor("window-sound", Window);
