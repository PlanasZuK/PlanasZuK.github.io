/* sound.js — the window's sound, built from real recordings (Joseph Sardin, BigSoundBank, CC0) and mixed live.
   The way game audio does it: steady beds that never loop audibly, detail as randomised one-shots, every layer
   driven by the scene, and a mix with headroom where nothing fights anything else.
   · Outside: rain recorded in stereo (ORTF) through a Neumann pair, heard through the pane. Three intensities,
     crossfaded by how hard it rains; each bed plays as two copies that crossfade into each other, so it never
     repeats on cue.
   · On the glass: rain recorded from inside, against a windscreen. A soft layer, and a hard one for gusts and storms.
   · Single drops: when a drop lands on the window you see, sometimes, you hear it: a real drop, re-pitched by its
     size, placed in 3D on the pane (HRTF, for headphones) with a little of the room around it.
   · Thunder: real, low-passed by the glass and by distance, arriving after each flash as late as it is far.
   · The camera pulling back takes you away from the window: the world muffles. Pages quiet it. Night softens it.
   · The voice types with soft keys and the outside dips a touch while it speaks, so nothing masks anything.
   Off until the visitor turns it on; the recordings are fetched only then. */
(() => {
  const KEY = "pp-sound";
  const BASE = "/assets/sound/";
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const S = {
    on: false, want: false, ctx: null, last: 0, buf: {}, sprites: null, st: { rain: 1, wind: 0, gust: 0, night: 0, storm: 0, muffle: 0, finger: 0, fx: 0 },
    // the mix, layer by layer (?tune shows a slider for each)
    mix: { master: 0.34, outside: 1, glass: 0.55, drops: 0.5, thunder: 0.85, finger: 0.3, keys: 0.22, room: 0.2 },
    pref() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } },
    save(v) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} },
    // Opus where the browser decodes it, AAC otherwise
    async load(name) {
      if (this.buf[name]) return this.buf[name];
      for (const ext of this.ext === "m4a" ? ["m4a"] : ["webm", "m4a"]) {
        try {
          const r = await fetch(BASE + name + "." + ext);
          if (!r.ok) continue;
          const b = await this.ctx.decodeAudioData(await r.arrayBuffer());
          this.ext = ext;
          return (this.buf[name] = b);
        } catch (e) { if (ext === "webm") this.ext = "m4a"; }
      }
      return null;
    },
    async build() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      // ambient: it mixes with the visitor's own music instead of stopping it, where the browser supports it
      try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
      const ctx = (this.ctx = new AC({ latencyHint: "playback" }));
      const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
      // the chain: outside (beds, thunder) through a pane that can close in; the glass layers and drops on our side
      this.master = g(0);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 2; comp.attack.value = 0.03; comp.release.value = 0.6;
      comp.connect(this.master).connect(ctx.destination);
      this.pane = ctx.createBiquadFilter(); this.pane.type = "lowpass"; this.pane.Q.value = 0.5; this.pane.frequency.value = 16000;
      this.outside = g(this.mix.outside); this.duck = g(1);
      this.outside.connect(this.duck).connect(this.pane).connect(comp);
      this.near = ctx.createBiquadFilter(); this.near.type = "lowpass"; this.near.Q.value = 0.5; this.near.frequency.value = 18000;
      this.glass = g(this.mix.glass); this.glass.connect(this.near).connect(comp);
      this.drops = g(this.mix.drops); this.drops.connect(this.near);
      this.thunderBus = g(this.mix.thunder); this.thunderBus.connect(this.duck);
      // a small room: early reflections and a short tail, for the drops and the keys only
      const len = Math.round(ctx.sampleRate * 0.45), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (const [t, a] of [[0.007, 0.5], [0.013, 0.35], [0.019, 0.3], [0.027, 0.22], [0.034, 0.18]]) d[Math.round((t + c * 0.0013) * ctx.sampleRate)] += a * (Math.random() < 0.5 ? -1 : 1);
        let lp = 0;
        for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate; lp += (Math.random() * 2 - 1 - lp) * 0.35; d[i] += lp * 0.25 * Math.exp(-t / 0.07) * clamp((t - 0.02) / 0.02); }
      }
      this.room = ctx.createConvolver(); this.room.buffer = ir; this.roomGain = g(this.mix.room);
      this.room.connect(this.roomGain).connect(this.near);
      // the listener sits in the room, facing the window
      const L = ctx.listener;
      if (L.forwardZ) { L.forwardX.value = 0; L.forwardY.value = 0; L.forwardZ.value = -1; L.upY.value = 1; } else if (L.setOrientation) L.setOrientation(0, 0, -1, 0, 1, 0);
      // the fingertip on fogged glass: a soft brush that follows the speed of the hand
      const nb = ctx.createBuffer(2, ctx.sampleRate * 2, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = nb.getChannelData(c); let b = 0; for (let i = 0; i < d.length; i++) { b = b * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = b; } }
      const fs = ctx.createBufferSource(); fs.buffer = nb; fs.loop = true;
      const fb = ctx.createBiquadFilter(); fb.type = "bandpass"; fb.frequency.value = 2200; fb.Q.value = 0.6;
      this.fingerBand = fb; this.fingerGain = g(0); this.fingerPan = ctx.createStereoPanner();
      fs.connect(fb).connect(this.fingerGain).connect(this.fingerPan).connect(this.near); fs.start();
      document.addEventListener("visibilitychange", () => { if (!this.on) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
      this.beds = {}; this.voices = [];
      this.tokens = 1; this.lastTap = 0; this.lastBoom = -99; this.lastThunder = -1;
      this.boot();
      return true;
    },
    // a bed that never repeats on cue: copies of the recording, each from a random point, crossfading into the next
    bed(name, bus) {
      const ctx = this.ctx, out = ctx.createGain(); out.gain.value = 0; out.connect(bus);
      const B = { out, name, next: 0, timer: null };
      const up = Float32Array.from({ length: 64 }, (_, i) => Math.sin(((i / 63) * Math.PI) / 2)), down = up.slice().reverse();
      const play = (when) => {
        const b = this.buf[name]; if (!b || !this.ctx) return;
        const X = 6, dur = b.duration, len = Math.min(dur - 1, 30 + Math.random() * 14), off = Math.random() * Math.max(0, dur - len - 0.5);
        const s = ctx.createBufferSource(), e = ctx.createGain();
        s.buffer = b; s.connect(e).connect(out);
        // equal-power fades: two crossfading copies always sum to the same level
        e.gain.setValueAtTime(0, when); e.gain.setValueCurveAtTime(up, when, X);
        e.gain.setValueCurveAtTime(down, when + len - X, X);
        s.start(when, off, len); s.stop(when + len + 0.1);
        B.next = when + len - X;
        clearTimeout(B.timer);
        B.timer = setTimeout(() => play(B.next), Math.max(0, (B.next - ctx.currentTime - 2) * 1000));
      };
      B.play = play;
      this.beds[name] = B;
      return B;
    },
    async boot() {
      const ctx = this.ctx;
      // the middle intensity first, so the window sounds at once; the rest follows
      for (const n of ["bed-mid", "glass-soft", "bed-light", "bed-heavy", "glass-hard", "drops", "thunder"]) {
        await this.load(n);
        if (n.startsWith("bed")) this.bed(n, this.outside).play(ctx.currentTime + 0.05);
        if (n.startsWith("glass")) this.bed(n, this.glass).play(ctx.currentTime + 0.05);
        this.apply(true);
      }
      try { this.sprites = await (await fetch(BASE + "sprites.json")).json(); } catch (e) {}
    },
    // turned on and off by the visitor; it fades, never cuts
    async set(v) {
      this.want = v; this.save(v); this.ui();
      if (v) {
        if (!(await this.build().catch(() => false))) { this.want = false; this.ui(); return; }
        await this.ctx.resume();
        this.on = true;
        const g = this.master.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(this.mix.master, t + 3);
      } else if (this.ctx) {
        this.on = false;
        const g = this.master.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.8);
        setTimeout(() => { if (!this.want) this.ctx.suspend(); }, 900);
      }
    },
    setMix(k, v) {
      this.mix[k] = v;
      if (!this.ctx) return;
      const t = this.ctx.currentTime, node = { drops: this.drops, thunder: this.thunderBus, room: this.roomGain }[k];
      if (node) node.gain.setTargetAtTime(v, t, 0.1);
      if (k === "master" && this.on) this.master.gain.setTargetAtTime(v, t, 0.1);
      this.apply();
    },
    ui() {
      for (const b of document.querySelectorAll("[data-sound]")) {
        const label = this.want ? b.dataset.on : b.dataset.off, r = b.querySelector(".btn__roll");
        if (r) { r.textContent = label; r.dataset.text = label; }
        b.setAttribute("aria-pressed", this.want ? "true" : "false");
      }
    },
    // the scene, a few times a second: everything moves with long, gentle time constants
    update(st, now) {
      if (!this.on || now - this.last < 50) return;
      this.last = now;
      Object.assign(this.st, st);
      this.apply();
    },
    apply(first) {
      if (!this.ctx) return;
      const s = this.st, t = this.ctx.currentTime, k = first ? 0.05 : 0.6;
      const r = clamp(s.rain, 0, 2), surge = clamp(s.gust * 0.5 + s.storm * 0.6);
      // three intensities crossfaded by how hard it rains (equal power), the whole outside by the amount of rain
      const pos = clamp(r * 0.75 + surge * 0.35, 0, 1.6), wts = [clamp(1 - Math.abs(pos - 0.2) / 0.6), clamp(1 - Math.abs(pos - 0.75) / 0.55), clamp(1 - Math.abs(pos - 1.35) / 0.6)];
      const sum = Math.hypot(...wts) || 1, level = clamp(Math.pow(r, 0.6)) * lerp(1, 0.7, s.night);
      ["bed-light", "bed-mid", "bed-heavy"].forEach((n, i) => { const B = this.beds[n]; if (B) B.out.gain.setTargetAtTime((wts[i] / sum) * level, t, k * 2); });
      const gs = this.beds["glass-soft"], gh = this.beds["glass-hard"];
      if (gs) gs.out.gain.setTargetAtTime(level * lerp(0.9, 0.5, surge), t, k);
      if (gh) gh.out.gain.setTargetAtTime(level * surge * 0.9, t, k);
      // stepping back from the window, or onto a page: the world closes in and quiets
      const m = clamp(s.muffle);
      this.pane.frequency.setTargetAtTime(lerp(16000, 700, Math.pow(m, 0.6)) * lerp(1, 0.6, s.night), t, 0.25);
      this.near.frequency.setTargetAtTime(lerp(18000, 900, Math.pow(m, 0.6)), t, 0.25);
      this.outside.gain.setTargetAtTime(this.mix.outside * lerp(1, 0.4, m), t, 0.3);
      this.glass.gain.setTargetAtTime(this.mix.glass * lerp(1, 0.3, m), t, 0.3);
      // the fingertip
      const f = clamp(s.finger, 0, 1.5) * (1 - m);
      this.fingerGain.gain.setTargetAtTime(0.05 * Math.pow(f, 0.9) * this.mix.finger, t, 0.04);
      this.fingerBand.frequency.setTargetAtTime(1600 + 1800 * clamp(f), t, 0.05);
      this.fingerPan.pan.setTargetAtTime(clamp(s.fx, -1, 1) * 0.7, t, 0.05);
    },
    // a drop lands on the pane: some of them are heard, placed where they hit
    tap(x, size) {
      if (!this.on || !this.sprites || !this.buf.drops || this.st.muffle > 0.5) return;
      const ctx = this.ctx, now = ctx.currentTime;
      // a budget of single drops per second, larger in gusts: individual hits, never a wash
      this.tokens = Math.min(3, this.tokens + (now - this.lastTap) * (0.9 + this.st.gust * 2.5));
      this.lastTap = now;
      if (this.tokens < 1 || Math.random() > 0.35 + size * 0.6) return;
      this.tokens -= 1;
      this.voices = this.voices.filter((v) => v.end > now);
      if (this.voices.length >= 10) { const v = this.voices.shift(); try { v.s.stop(); } catch (e) {} }
      const [off, dur] = this.sprites.drops[(Math.random() * this.sprites.drops.length) | 0];
      const s = ctx.createBufferSource(), gn = ctx.createGain(), p = ctx.createPanner();
      s.buffer = this.buf.drops;
      // bigger drops are lower and fuller; every one a little different
      s.playbackRate.value = Math.pow(2, (Math.random() * 5 - 2.5 - size * 3 + 2) / 12);
      gn.gain.value = (0.25 + 0.75 * clamp(size)) * Math.pow(10, (Math.random() * 6 - 4) / 20);
      p.panningModel = "HRTF"; p.distanceModel = "inverse"; p.refDistance = 1; p.rolloffFactor = 0.6;
      const px = clamp(x, -1, 1) * 1.3, py = Math.random() * 0.8 - 0.3, pz = -0.8;
      if (p.positionX) { p.positionX.value = px; p.positionY.value = py; p.positionZ.value = pz; } else p.setPosition(px, py, pz);
      s.connect(gn).connect(p); p.connect(this.drops); p.connect(this.room);
      s.start(now, off, dur);
      this.voices.push({ s, end: now + dur / s.playbackRate.value });
    },
    // a flash: the thunder follows after as many seconds as the strike is far, never two on top of each other
    thunder(dist) {
      if (!this.on) return;
      setTimeout(() => this.boom(dist), 400 + dist * 4200);
    },
    boom(dist) {
      if (!this.on || !this.sprites || !this.buf.thunder) return;
      const ctx = this.ctx, now = ctx.currentTime;
      if (now - this.lastBoom < 14) return;
      this.lastBoom = now;
      const list = this.sprites.thunder;
      let i = (Math.random() * list.length) | 0; if (i === this.lastThunder) i = (i + 1) % list.length; this.lastThunder = i;
      const [off, dur] = list[i], s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), gn = ctx.createGain(), pan = ctx.createStereoPanner();
      s.buffer = this.buf.thunder;
      lp.type = "lowpass"; lp.frequency.value = lerp(900, 240, clamp(dist)); lp.Q.value = 0.5;
      gn.gain.value = lerp(1, 0.4, clamp(dist)); pan.pan.value = Math.random() * 1.2 - 0.6;
      s.connect(lp).connect(gn).connect(pan).connect(this.thunderBus);
      s.start(now, off, dur);
    },
    // the voice types: a soft key every few letters, and the world steps back a touch while it speaks
    voice(len) {
      if (!this.on) return;
      const ctx = this.ctx, now = ctx.currentTime, dur = Math.min(1.4, 0.022 * len + 0.2), n = Math.max(2, Math.round(len / 3.5));
      this.duck.gain.cancelScheduledValues(now);
      this.duck.gain.setTargetAtTime(0.8, now, 0.08); this.duck.gain.setTargetAtTime(1, now + dur + 0.6, 0.5);
      if (!this.keyBuf) {
        const b = (this.keyBuf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.03), ctx.sampleRate)), d = b.getChannelData(0);
        let lp = 0;
        for (let i = 0; i < d.length; i++) { const t = i / ctx.sampleRate; lp += (Math.random() * 2 - 1 - lp) * 0.3; d[i] = lp * Math.exp(-t / 0.004); }
      }
      for (let i = 0; i < n; i++) {
        const s = ctx.createBufferSource(), gn = ctx.createGain();
        s.buffer = this.keyBuf; s.playbackRate.value = 0.85 + Math.random() * 0.3;
        gn.gain.value = 0.35 * this.mix.keys * (0.7 + Math.random() * 0.5);
        s.connect(gn); gn.connect(this.near); gn.connect(this.room);
        s.start(now + (i / n) * dur + Math.random() * 0.03);
      }
    },
  };
  // a visitor who turned the sound on last time gets it back with their first touch (browsers need one)
  if (S.pref()) {
    S.want = true;
    const arm = () => { removeEventListener("pointerdown", arm, true); removeEventListener("keydown", arm, true); S.set(true); };
    addEventListener("pointerdown", arm, true); addEventListener("keydown", arm, true);
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-sound]"); if (b) { e.preventDefault(); S.set(!S.want); } });
  addEventListener("DOMContentLoaded", () => S.ui());
  window.Sound = S;
})();
