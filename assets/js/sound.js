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
    on: false, want: false, ctx: null, last: 0, buf: {}, sprites: null, st: { rain: 1, wind: 0, gust: 0, night: 0, storm: 0, hour: 7, zoom: 0, page: 0, muffle: 0, finger: 0, fx: 0 },
    // the mix, layer by layer (?tune shows a slider for each)
    mix: { master: 0.34, outside: 1, glass: 0.55, drops: 0.5, thunder: 0.85, life: 1, space: 1, finger: 0.8, fingerV: 2, voice: 1, room: 0.2 },
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
      this.comp = comp;
      this.pane = ctx.createBiquadFilter(); this.pane.type = "lowpass"; this.pane.Q.value = 0.5; this.pane.frequency.value = 16000;
      this.outside = g(this.mix.outside); this.duck = g(1);
      this.outside.connect(this.duck).connect(this.pane).connect(comp);
      this.near = ctx.createBiquadFilter(); this.near.type = "lowpass"; this.near.Q.value = 0.5; this.near.frequency.value = 18000;
      this.glass = g(this.mix.glass); this.glass.connect(this.near).connect(comp);
      this.drops = g(this.mix.drops); this.drops.connect(this.near);
      this.thunderBus = g(this.mix.thunder); this.thunderBus.connect(this.duck);
      // the life outside, which changes with the hour: morning birds, a blackbird at dusk, the night
      this.life = g(this.mix.life); this.life.connect(this.duck);
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
      // v2: the modelled fingertip (finger-worklet.js); v1 above stays as a choice in ?tune
      try {
        await ctx.audioWorklet.addModule("/assets/js/finger-worklet.js");
        this.fingerNode = new AudioWorkletNode(ctx, "finger", { numberOfInputs: 0, outputChannelCount: [2] });
        this.fingerOut = g(this.mix.finger); this.fingerNode.connect(this.fingerOut).connect(this.near);
        this.squeaks = 0; this.fingerNode.port.onmessage = (e) => { if (e.data.squeak) this.squeaks++; };
      } catch (e) { this.fingerNode = null; }
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
        const dur = b.duration, len = Math.min(dur - 0.5, 30 + Math.random() * 14), X = Math.min(6, len / 2 - 0.05), off = Math.random() * Math.max(0, dur - len - 0.25);
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
      for (const n of ["bed-mid", "glass-soft", "bed-light", "bed-heavy", "glass-hard", "drops", "thunder", "night", "birds", "crickets", "blackbird"]) {
        await this.load(n);
        try {
        if (n.startsWith("bed")) this.bed(n, this.outside).play(ctx.currentTime + 0.05);
        if (n.startsWith("glass")) this.bed(n, this.glass).play(ctx.currentTime + 0.05);
        if (n === "night" || n === "birds" || n === "crickets") this.bed(n, this.life).play(ctx.currentTime + 0.05);
        } catch (e) { console.warn("[so]", n, e.message); }
        this.apply(true);
      }
      try { this.sprites = await (await fetch(BASE + "sprites.json")).json(); } catch (e) {}
      this.spaceBuild(); this.cardBuild(); this.apply(true);
    },
    // turned on and off by the visitor; it fades, never cuts
    async set(v) {
      this.want = v; this.save(v); this.starting = v; this.ui();
      if (v) {
        if (!(await this.build().catch(() => false))) { this.want = this.starting = false; this.ui(); return; }
        await this.ctx.resume();
        if (!this.want) return;
        this.on = true; this.starting = false; this.ui();
        // chosen on the loading screen: it waits, silent, and rises with the scene
        if (document.getElementById("loader")) { this.held = true; return; }
        const g = this.master.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(this.mix.master, t + 3);
      } else if (this.ctx) {
        this.on = this.starting = this.held = false; this.ui();
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
    // the scene appears: the sound chosen on the loading screen comes up with it, slowly
    enter() {
      if (!this.held || !this.on) return;
      this.held = false;
      const g = this.master.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(this.mix.master, t + 4.5);
    },
    ui() {
      const on = this.on || this.starting;
      for (const b of document.querySelectorAll("[data-sound]")) {
        const label = on ? b.dataset.on : b.dataset.off, r = b.querySelector(".btn__roll");
        if (r) { r.textContent = label; r.dataset.text = label; }
        b.setAttribute("aria-pressed", on ? "true" : "false");
      }
    },
    // the scene, a few times a second: everything moves with long, gentle time constants
    update(st, now) {
      if (!this.on || now - this.last < 50) return;
      this.last = now;
      Object.assign(this.st, st);
      this.apply();
      this.blackbird(now);
      this.spaceGlint(now);
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
      const f = clamp(s.finger, 0, 1.5) * (1 - m), v2 = this.fingerNode && this.mix.fingerV === 2;
      this.fingerGain.gain.setTargetAtTime(v2 ? 0 : 0.42 * Math.pow(f, 0.8) * this.mix.finger, t, 0.03);
      if (this.fingerOut) this.fingerOut.gain.setTargetAtTime(v2 ? this.mix.finger * (1 - m) : 0, t, 0.05);
      this.fingerBand.frequency.setTargetAtTime(1600 + 1800 * clamp(f), t, 0.05);
      this.fingerPan.pan.setTargetAtTime(clamp(s.fx, -1, 1) * 0.7, t, 0.05);
      // the hour: each layer of life rises and falls slowly around its time; rain and storms hush them
      const h = ((s.hour % 24) + 24) % 24, ss = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
      const dawn = ss(5.2, 7, h) * (1 - ss(8.5, 11, h)), nightW = h >= 12 ? ss(20.6, 22.6, h) : 1 - ss(4.6, 6.2, h);
      const hush = (1 - surge * 0.85) * lerp(1, 0.55, clamp(r - 1));
      const set = (n, v) => { const B = this.beds[n]; if (B) B.out.gain.setTargetAtTime(v, t, first ? 0.05 : 3); };
      set("birds", dawn * hush * 0.9);
      set("night", nightW * 0.85);
      set("crickets", nightW * hush * clamp(1.3 - r) * 0.8);
      this.duskW = ss(18, 19.2, h) * (1 - ss(20.8, 21.8, h)) * hush + dawn * 0.25 * hush;
      this.life.gain.setTargetAtTime(this.mix.life * lerp(1, 0.4, m), t, 0.3);
      // the overview: space comes in as the window goes far away (and stays faint behind a page)
      this.spaceLevel = ss(0.12, 0.9, s.zoom || 0) * (s.page ? 0.25 : 1);
      if (this.sp) this.sp.out.gain.setTargetAtTime(this.spaceLevel * this.mix.space * this.sp.norm, t, 1.2);
    },
    // a blackbird at dusk: a phrase now and then, somewhere out there, never twice in the same place
    blackbird(now) {
      if (!this.sprites || !this.sprites.blackbird || !this.buf.blackbird || !(this.duskW > 0.05)) return;
      if (now < (this.bbNext || 0)) return;
      this.bbNext = now + (5 + Math.random() * 11) * 1000;
      if (Math.random() > this.duskW) return;
      const ctx = this.ctx, list = this.sprites.blackbird, [off, dur] = list[(Math.random() * list.length) | 0];
      const s = ctx.createBufferSource(), gn = ctx.createGain(), pan = ctx.createStereoPanner();
      s.buffer = this.buf.blackbird; s.playbackRate.value = 0.96 + Math.random() * 0.08;
      gn.gain.value = (0.18 + Math.random() * 0.25) * this.duskW; pan.pan.value = Math.random() * 1.6 - 0.8;
      s.connect(gn).connect(pan).connect(this.life);
      s.start(ctx.currentTime + 0.05, off, dur);
    },
    // the fingertip, every frame: speed, how fast it changes, turns, where it is
    fingerMove(v, x, turn, now) {
      if (!this.on || !this.fingerNode) return;
      const dt = Math.max(0.008, (now - (this.fmT || now - 16)) / 1000), a = (v - (this.fmV || 0)) / dt / 8;
      this.fmT = now; this.fmV = v;
      if (v < 0.001 && !this.fmMoving) return;
      this.fmMoving = v >= 0.001;
      this.fingerNode.port.postMessage({ v, a: Math.max(-1, Math.min(1, a)), turn: turn > 0.5 ? 1 : 0, x });
    },
    touch(down, x) { if (this.on && this.fingerNode) this.fingerNode.port.postMessage(down ? { down: 1, x } : { up: 1 }); },
    wet(size) { if (this.on && this.fingerNode) this.fingerNode.port.postMessage({ wet: size }); },
    // ---------- the overview: a quiet room in space ----------
    // Generative, never the same: a slow chord progression (Dmaj9, Bm11, Gmaj9, Aadd9) where each chord blooms over
    // seconds and dissolves into the next, its voices drifting a hair out of tune and back; a breath of dark air
    // whose colour and level wander on their own; and sparkles, tiny soft notes of the current chord in the high
    // octaves, whose density rises and falls like a slow tide. Now and then a high glass note, or the "chorus" of
    // Earth's magnetosphere (plasma waves recorded by NASA's Van Allen probes sound like rising bird-like whistles).
    // All in a long, clear hall. Nothing in it holds still, so nothing in it hums.
    SPACE_RMS: 0.0285,
    CHORDS: [
      [293.66, 369.99, 440, 659.25],          // Dmaj9 (D F# A E)
      [246.94, 293.66, 369.99, 440, 659.25],  // Bm11 (B D F# A E)
      [196, 246.94, 293.66, 440, 739.99],     // Gmaj9 (G B D A F#)
      [220, 329.63, 440, 493.88, 554.37],     // Aadd9 (A E A B C#)
    ],
    spaceBuild() {
      if (this.sp) return this.sp;
      const ctx = this.ctx, g = (v = 0) => { const n = ctx.createGain(); n.gain.value = v; return n; };
      const out = g(0), dry = g(0.45), wet = g(1);
      const sr = ctx.sampleRate, len = Math.round(sr * 6.5), ir = ctx.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        let lp = 0;
        for (let i = 0; i < len; i++) { const t = i / sr, k = 0.22 + 0.5 * Math.exp(-t * 0.7); lp += (Math.random() * 2 - 1 - lp) * k; d[i] = lp * Math.exp(-t * 0.78) * clamp(t / 0.06); }
      }
      const hall = ctx.createConvolver(); hall.buffer = ir;
      const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 6000; tone.Q.value = 0.5;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 120; hp.Q.value = 0.6;
      const bus = g(1);
      bus.connect(dry).connect(tone); bus.connect(hall).connect(wet).connect(tone);
      tone.connect(hp).connect(out).connect(this.comp);
      // a slow loudness keeper: a generative piece swells and thins by chance, so its level is measured and
      // gently held steady (seconds, never pumping), keeping the overview on the same scale as the window
      const meter = ctx.createAnalyser(); meter.fftSize = 2048; hp.connect(meter);
      // dark air: noise through a band that wanders, its level breathing on a random walk
      const nb = ctx.createBuffer(2, sr * 4, sr);
      for (let c = 0; c < 2; c++) { const d = nb.getChannelData(c); let p = 0; for (let i = 0; i < d.length; i++) { p = p * 0.9 + (Math.random() * 2 - 1) * 0.1; d[i] = p * 2.2; } }
      const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
      const band = ctx.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 700; band.Q.value = 0.8;
      const air = g(0.02); ns.connect(band).connect(air).connect(bus); ns.start();
      return (this.sp = { out, bus, band, air, meter, buf: new Float32Array(2048), rms: 0.02, norm: 1, chord: 0, nextChord: 0, nextSpark: 0, nextGlint: 0, tide: 0.5, tideT: 0.5, airT: 0 });
    },
    // one voice of a chord: a sine with a whisper of its octave, blooming in, drifting, dissolving out
    pad(f, at, hold, amp, pan) {
      const ctx = this.ctx, S = this.sp, o = ctx.createOscillator(), o8 = ctx.createOscillator(), e = ctx.createGain(), p = ctx.createStereoPanner(), o8g = ctx.createGain();
      o.type = o8.type = "sine"; o.frequency.value = f; o8.frequency.value = f * 2; o8g.gain.value = 0.1;
      // a slow drift of tuning: never two identical moments
      o.detune.setValueAtTime((Math.random() - 0.5) * 6, at); o.detune.linearRampToValueAtTime((Math.random() - 0.5) * 9, at + hold);
      const rise = 5 + Math.random() * 4, fall = 7 + Math.random() * 5;
      e.gain.setValueAtTime(0, at); e.gain.linearRampToValueAtTime(amp, at + rise); e.gain.setValueAtTime(amp, at + hold); e.gain.linearRampToValueAtTime(0, at + hold + fall);
      p.pan.value = pan;
      o.connect(e); o8.connect(o8g).connect(e); e.connect(p).connect(S.bus);
      o.start(at); o8.start(at); o.stop(at + hold + fall + 0.2); o8.stop(at + hold + fall + 0.2);
    },
    // the overview's life, a few times a second: chords, sparkles, air, glints
    spaceGlint(now) {
      const S = this.sp; if (!S) return;
      const ctx = this.ctx, t = ctx.currentTime, live = this.spaceLevel > 0.05;
      if (live) {
        S.meter.getFloatTimeDomainData(S.buf);
        let e = 0; for (let i = 0; i < S.buf.length; i += 2) e += S.buf[i] * S.buf[i];
        S.rms += (Math.sqrt(e / (S.buf.length / 2)) - S.rms) * 0.02;
        S.norm = clamp(this.SPACE_RMS / Math.max(1e-4, S.rms), 0.5, 3);
      }
      // the next chord blooms while the last one dissolves
      if (now >= S.nextChord && live) {
        const hold = 16 + Math.random() * 10, ch = this.CHORDS[S.chord % this.CHORDS.length];
        S.chord += Math.random() < 0.8 ? 1 : 2;
        ch.forEach((f, i) => this.pad(f, t + i * (0.4 + Math.random() * 0.9), hold, [0.03, 0.026, 0.022, 0.016, 0.012][i] || 0.012, (i % 2 ? 1 : -1) * (0.15 + Math.random() * 0.4)));
        S.nextChord = now + (hold + 2) * 1000;
      }
      // the air breathes: its colour and level wander
      if (now >= S.airT) {
        S.airT = now + 2500 + Math.random() * 3000;
        S.band.frequency.setTargetAtTime(380 + Math.random() * 900, t, 2.5);
        S.air.gain.setTargetAtTime(0.012 + Math.random() * 0.02, t, 3);
      }
      // the sparkles follow a slow tide: some moments glitter, some are nearly still
      if (Math.random() < 0.01) S.tideT = Math.random();
      S.tide += (S.tideT - S.tide) * 0.01;
      if (now >= S.nextSpark && live) {
        S.nextSpark = now + 180 + (1 - S.tide) * 1600 + Math.random() * 700;
        const ch = this.CHORDS[(S.chord + this.CHORDS.length - 1) % this.CHORDS.length], f = ch[(Math.random() * ch.length) | 0] * (Math.random() < 0.6 ? 4 : 2);
        const o = ctx.createOscillator(), e = ctx.createGain(), p = ctx.createStereoPanner(), d = 0.6 + Math.random() * 1.6;
        o.type = "sine"; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 10;
        e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime((0.0025 + Math.random() * 0.004) * (0.5 + S.tide), t + 0.02 + Math.random() * 0.15); e.gain.setTargetAtTime(0, t + 0.2, d / 3);
        p.pan.value = Math.random() * 1.8 - 0.9;
        o.connect(e).connect(p).connect(S.bus); o.start(t); o.stop(t + d + 1.5);
      }
      // now and then, something from further away
      if (now >= S.nextGlint && live) {
        S.nextGlint = now + 9000 + Math.random() * 14000;
        if (Math.random() < 0.5) {
          const f = [1174.66, 1318.51, 1479.98, 1760][(Math.random() * 4) | 0];
          [1, 2.01].forEach((r, k) => {
            const o = ctx.createOscillator(), e = ctx.createGain(), p = ctx.createStereoPanner();
            o.type = "sine"; o.frequency.value = f * r;
            e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(k ? 0.002 : 0.01, t + 0.01); e.gain.setTargetAtTime(0, t + 0.02, k ? 0.5 : 1.7);
            p.pan.value = Math.random() * 1.4 - 0.7;
            o.connect(e).connect(p).connect(S.bus); o.start(t); o.stop(t + 8);
          });
        } else {
          const n = 2 + ((Math.random() * 3) | 0), pan = Math.random() * 1.4 - 0.7;
          for (let i = 0; i < n; i++) {
            const at = t + i * (0.22 + Math.random() * 0.25), f0 = 650 + Math.random() * 300, d = 0.28 + Math.random() * 0.2;
            const o = ctx.createOscillator(), e = ctx.createGain(), p = ctx.createStereoPanner();
            o.type = "sine"; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f0 * (1.8 + Math.random() * 0.6), at + d);
            e.gain.setValueAtTime(0, at); e.gain.linearRampToValueAtTime(0.005 + Math.random() * 0.003, at + d * 0.3); e.gain.linearRampToValueAtTime(0, at + d);
            p.pan.value = pan + (Math.random() - 0.5) * 0.3;
            o.connect(e).connect(p).connect(S.bus); o.start(at); o.stop(at + d + 0.05);
          }
        }
      }
    },
    // ---------- the cards: each one a note, like a singing bowl ----------
    // Touching a card strikes its note (a pentatonic scale, so any two cards sound well together): a soft mallet
    // on a bowl, its partials fading at their own pace. Turning the card makes the bowl sing (as a rim does when
    // rubbed): the faster it turns, the more it sings, with a slight shimmer, placed in 3D where the card is.
    // Letting go leaves a soft lower note.
    NOTES: { home: 587.33, work: 739.99, about: 880, services: 987.77, contact: 1174.66 },
    cardBuild() {
      if (this.cd) return this.cd;
      const ctx = this.ctx, g = (v = 0) => { const n = ctx.createGain(); n.gain.value = v; return n; };
      const p = ctx.createPanner(); p.panningModel = "HRTF"; p.distanceModel = "inverse"; p.refDistance = 1; p.rolloffFactor = 0.4;
      const sing = ctx.createOscillator(), shim = ctx.createOscillator(), singG = g(0), vib = ctx.createOscillator(), vibG = g(2);
      sing.type = "sine"; shim.type = "sine"; sing.frequency.value = 587.33; shim.frequency.value = 587.33 * 2.76;
      vib.frequency.value = 4.6; vib.connect(vibG); vibG.connect(sing.frequency);
      sing.connect(singG); shim.connect(g(0.08)).connect(singG); singG.connect(p);
      const out = g(1); p.connect(out).connect(this.comp);
      if (this.sp) out.connect(this.sp.bus);
      [sing, shim, vib].forEach((o) => o.start());
      return (this.cd = { p, sing, shim, singG, out, w: 0, f: 587.33 });
    },
    strike(f, amp, at) {
      const ctx = this.ctx, C = this.cd, t = at || ctx.currentTime;
      // a bowl's partials (not harmonic), each fading at its own pace
      [[1, 1, 3.2], [2.0, 0.28, 2], [2.76, 0.16, 1.3], [5.4, 0.05, 0.6]].forEach(([r, a, dec]) => {
        const o = ctx.createOscillator(), e = ctx.createGain();
        o.type = "sine"; o.frequency.value = f * r * (1 + (Math.random() - 0.5) * 0.002);
        e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(amp * a, t + 0.012); e.gain.setTargetAtTime(0, t + 0.02, dec / 3.5);
        o.connect(e).connect(C.p); o.start(t); o.stop(t + dec * 2.2);
      });
    },
    cardEnter(id) {
      if (!this.on) return;
      const C = this.cardBuild(), t = this.ctx.currentTime, f = this.NOTES[id] || 587.33;
      C.f = f; C.on = true; C.w = 0;
      C.sing.frequency.setValueAtTime(f, t); C.shim.frequency.setValueAtTime(f * 2.76, t);
      C.singG.gain.cancelScheduledValues(t); C.singG.gain.setTargetAtTime(0.004 * this.mix.space, t, 0.3);
      this.strike(f, 0.022 * this.mix.space);
    },
    cardMove(w, x, y, rx, ry) {
      const C = this.cd; if (!this.on || !C || !C.on) return;
      const t = this.ctx.currentTime, s = clamp(w / 40);
      C.w += (s - C.w) * 0.12;
      const px = clamp(x, -1, 1) * 1.4 + ry * 0.03, py = clamp(y, -1, 1) * 0.8 - rx * 0.03, pz = -1.2;
      if (C.p.positionX) { C.p.positionX.setTargetAtTime(px, t, 0.06); C.p.positionY.setTargetAtTime(py, t, 0.06); C.p.positionZ.setTargetAtTime(pz, t, 0.06); } else C.p.setPosition(px, py, pz);
      // the bowl sings as the card turns, and its pitch leans a hair with the tilt
      C.singG.gain.setTargetAtTime((0.004 + 0.016 * Math.pow(C.w, 0.7)) * this.mix.space, t, 0.12);
      C.sing.frequency.setTargetAtTime(C.f * (1 + (ry / 8) * 0.004), t, 0.1);
    },
    cardLeave() {
      const C = this.cd; if (!C || !this.on || !C.on) return;
      const t = this.ctx.currentTime;
      C.on = false;
      C.singG.gain.setTargetAtTime(0, t, 0.35);
      this.strike(C.f * 0.75, 0.008 * this.mix.space, t + 0.03);
    },
    // a label writing itself in: soft keys, quicker than the voice's
    typeKeys(n, dur) {
      if (!this.on || !this.ctx) return;
      const ctx = this.ctx, at = ctx.currentTime + 0.01;
      if (!this.keyBuf) this.keys(" ", 0.01, at);
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.35) continue;
        const s = ctx.createBufferSource(), gn = ctx.createGain();
        s.buffer = this.keyBuf; s.playbackRate.value = 0.95 + Math.random() * 0.4;
        gn.gain.value = 0.06 * this.mix.voice * (0.6 + Math.random() * 0.6);
        s.connect(gn); gn.connect(this.comp); if (this.sp) gn.connect(this.sp.bus);
        s.start(at + (i / n) * dur + Math.random() * 0.006);
      }
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
    // ---------- the voice: a little robot that speaks each line in its own made-up language ----------
    // One soft synthesised voice played like an instrument: a sine with a touch of FM (the robot), a triangle for
    // body, two vowel formants, and a breath of air. A small prosody planner turns each line into a melody:
    // words become one to three notes (not one per letter), a gentle fall runs across each sentence, the important
    // words carry accents, the ending says what kind of sentence it is (a question rises, a statement settles,
    // an exclamation jumps), and the mood sets register, range, tempo, breath and wobble. Sometimes it goes "oh!",
    // sighs, grumbles, or laughs at its own joke. Never the same twice.
    vox() {
      if (this.vx) return this.vx;
      const ctx = this.ctx, g = (v = 0) => { const n = ctx.createGain(); n.gain.value = v; return n; };
      const pitch = ctx.createConstantSource(); pitch.offset.value = 440;
      const car = ctx.createOscillator(), body = ctx.createOscillator(), mod = ctx.createOscillator(), vib = ctx.createOscillator();
      car.type = "sine"; body.type = "triangle"; mod.type = "sine"; vib.type = "sine";
      car.frequency.value = 0; body.frequency.value = 0; mod.frequency.value = 0; vib.frequency.value = 6.2;
      pitch.connect(car.frequency); pitch.connect(body.frequency);
      const x2 = g(2); pitch.connect(x2).connect(mod.frequency);
      const dev = g(0), idx = g(0.3); pitch.connect(idx).connect(dev.gain);
      mod.connect(dev); dev.connect(car.frequency);
      const wob = g(3); vib.connect(wob); wob.connect(car.frequency); wob.connect(body.frequency);
      const bodyG = g(0.16), sum = g(1);
      car.connect(sum); body.connect(bodyG).connect(sum);
      const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), dry = g(0.45), fg1 = g(0.9), fg2 = g(0.55);
      f1.type = f2.type = "bandpass"; f1.Q.value = 3.5; f2.Q.value = 5; f1.frequency.value = 700; f2.frequency.value = 1500;
      const soft = ctx.createBiquadFilter(); soft.type = "lowpass"; soft.frequency.value = 5200; soft.Q.value = 0.5;
      const env = g(0), pan = ctx.createStereoPanner(), out = g(1);
      sum.connect(dry).connect(soft); sum.connect(f1).connect(fg1).connect(soft); sum.connect(f2).connect(fg2).connect(soft);
      soft.connect(env).connect(pan).connect(out);
      // breath: soft air through a band, with its own envelope (an intake before a sentence, a sigh, a laugh)
      const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
      const air = ctx.createBiquadFilter(); air.type = "bandpass"; air.frequency.value = 2200; air.Q.value = 0.8;
      const breath = g(0); ns.connect(air).connect(breath).connect(pan);
      out.connect(this.near); const send = g(0.5); out.connect(send).connect(this.room);
      [pitch, car, body, mod, vib, ns].forEach((o) => o.start());
      return (this.vx = { pitch, env, f1, f2, pan, wob, out, idx, soft, breath, air });
    },
    // how the line feels: register (Hz), range, tempo, legato, wobble, brightness, breath
    mood(text) {
      const t = text.toLowerCase();
      const M = {
        calm: { base: 420, range: 1, legato: 0.75, wob: 3, bright: 1 },
        happy: { base: 500, range: 1.45, legato: 0.6, wob: 4, bright: 1.25 },
        curious: { base: 455, range: 1.2, legato: 0.7, wob: 3, bright: 1.1 },
        sad: { base: 340, range: 0.6, legato: 0.95, wob: 2, bright: 0.7 },
        playful: { base: 480, range: 1.6, legato: 0.55, wob: 11, bright: 1.2 },
        grumpy: { base: 300, range: 0.55, legato: 0.5, wob: 1.5, bright: 0.8 },
        oops: { base: 410, range: 1.1, legato: 0.7, wob: 3, bright: 0.9 },
      };
      let k = "calm";
      if (/(quina educació|qué educación|charming|rude|groller|grosero|modals|modales|manners)/.test(t)) k = "grumpy";
      else if (/(ho sento|lo siento|sorry|llàstima|lástima|what a pity|trist|triste|\bsad\b|no puc|no puedo|can’t|cannot)/.test(t)) k = "sad";
      else if (/(relliscat|resbalado|tripped|necessita un ordinador|necesita un ordenador|needs a computer)/.test(t)) k = "oops";
      else if (/(\bha\b|haha|jaja|acudit|chiste|joke|broma|\bxd\b|riure|reír|laugh)/.test(t) || /\?\s+\S.{6,}[.!]\s*$/.test(t)) k = "playful";
      else if (/[!¡]/.test(t) && !/\?\s*$/.test(t)) k = "happy";
      else if (/\?\s*$/.test(t)) k = "curious";
      return { k, ...M[k] };
    },
    voice(text, dur) {
      if (!this.on || !text) return;
      this.stopThinking();
      const ctx = this.ctx, V = this.vox(), len = text.length, R = Math.random, st = (s) => Math.pow(2, s / 12);
      dur = dur || Math.min(2.8, 0.034 * len + 0.25);
      const mood = this.mood(text), lower = text.toLowerCase();
      // this utterance's own register: never exactly the last one
      const base = mood.base * st((R() - 0.5) * 2), range = mood.range * (0.85 + R() * 0.3);
      let now = ctx.currentTime + 0.03;
      this.keys(text, dur, now);
      this.duck.gain.cancelScheduledValues(now);
      this.duck.gain.setTargetAtTime(0.72, now, 0.08); this.duck.gain.setTargetAtTime(1, now + dur + 0.9, 0.5);
      const el = document.querySelector(".voice"), r = el && el.getBoundingClientRect();
      V.pan.pan.setTargetAtTime(r ? clamp(((r.left + r.width / 2) / innerWidth) * 2 - 1, -1, 1) * 0.5 : 0, now, 0.05);
      V.wob.gain.setTargetAtTime(mood.wob, now, 0.05);
      V.out.gain.setTargetAtTime(this.mix.voice, now, 0.02);
      V.idx.gain.setTargetAtTime(0.22 + 0.12 * mood.bright, now, 0.05);
      V.soft.frequency.setTargetAtTime(3800 + 2200 * mood.bright, now, 0.05);
      const P = V.pitch.offset, E = V.env.gain, B = V.breath.gain;
      P.cancelScheduledValues(now); E.cancelScheduledValues(now); B.cancelScheduledValues(now);
      E.setValueAtTime(0, now); B.setValueAtTime(0, now);
      const FORM = { a: [800, 1250], e: [520, 1850], i: [330, 2250], o: [520, 950], u: [360, 820] };
      const note = (t, d, f, vow, amp, glide = 1, gl = 0.5) => {
        const [F1, F2] = FORM[vow] || FORM.a, sh = 0.94 + R() * 0.12;
        P.setTargetAtTime(f, t, 0.011);
        if (glide !== 1) P.setTargetAtTime(f * glide, t + d * gl, d * 0.45);
        V.f1.frequency.setTargetAtTime(F1 * sh, t, 0.012); V.f2.frequency.setTargetAtTime(F2 * sh, t, 0.012);
        E.setTargetAtTime(amp, t, 0.008); E.setTargetAtTime(amp * 0.6, t + Math.min(0.035, d * 0.4), 0.035); E.setTargetAtTime(0, t + d, 0.02);
      };
      const puff = (t, d, a, f = 2200) => { V.air.frequency.setTargetAtTime(f, t, 0.01); B.setTargetAtTime(a, t, d * 0.25); B.setTargetAtTime(0, t + d * 0.6, d * 0.3); };
      // interjections, now and then, as a person would
      let lead = 0;
      if (mood.k === "sad" && R() < 0.6) { puff(now, 0.45, 0.05, 1500); lead = 0.32; }
      else if (mood.k === "grumpy" && R() < 0.7) { note(now, 0.09, base * st(-2), "u", 0.17, st(-3)); puff(now + 0.05, 0.12, 0.05, 1200); lead = 0.2; }
      else if (mood.k === "oops") { note(now, 0.11, base * st(4), "u", 0.17); note(now + 0.15, 0.17, base * st(-1), "o", 0.15, st(-2)); lead = 0.42; }
      else if (/\b(wow|ostres|vaja|vaya|oh|uau|guau)\b/.test(lower) || (mood.k === "happy" && R() < 0.35)) { note(now, 0.14, base * st(3), "o", 0.18, st(5), 0.3); lead = 0.22; }
      else if (R() < 0.35) puff(now, 0.16, 0.025); // a small intake of breath
      now += lead;
      // plan: sentences, words, notes
      const VOW = "aeiouyàáèéíïìòóúü", vowOf = (c) => ({ à: "a", á: "a", è: "e", é: "e", í: "i", ï: "i", ì: "i", ò: "o", ó: "o", ú: "u", ü: "u", y: "i" })[c] || c;
      const small = new Set(["a", "i", "o", "y", "e", "u", "el", "la", "els", "les", "un", "una", "de", "del", "en", "és", "es", "et", "em", "me", "te", "the", "an", "of", "to", "is", "it", "in", "on", "and", "lo", "los", "que", "què", "per", "por", "amb", "con", "my", "mi", "tu", "teu", "your", "si"]);
      const sents = [];
      const re = /([^.!?…]+)([.!?…]+|$)/g;
      let m;
      while ((m = re.exec(text)) && m[0]) {
        const words = [], wre = /[\p{L}\p{N}’']+|,/gu;
        let w;
        while ((w = wre.exec(m[1]))) {
          if (w[0] === ",") { if (words.length) words[words.length - 1].comma = true; continue; }
          const s = w[0].toLowerCase(), syl = s.match(new RegExp(`[^${VOW}]*[${VOW}]+`, "g")) || [s];
          words.push({ at: m.index + w.index, len: w[0].length, syl: syl.map((x) => vowOf((x.match(new RegExp(`[${VOW}]`)) || ["a"])[0])), small: small.has(s) });
        }
        if (words.length) sents.push({ words, mark: (m[2] || "").slice(0, 1), q: /^(qu|com|on|quan|què|qué|cómo|dónde|cuándo|what|how|why|where|when|who)/.test(m[1].trim().toLowerCase()) });
        if (re.lastIndex >= text.length) break;
      }
      const T = (at) => now + (at / len) * dur * 0.94;
      let last = now;
      sents.forEach((S, si) => {
        const W = S.words, content = W.filter((x) => !x.small), nuc = content.length ? content[content.length - 1] : W[W.length - 1];
        // a small intake between sentences, sometimes
        if (si && R() < 0.4) puff(T(W[0].at) - 0.08, 0.12, 0.02);
        W.forEach((w, wi) => {
          const isLast = wi === W.length - 1;
          if (w.small && !isLast && R() < 0.65) return; // little words melt into their neighbours
          const pos = W.length > 1 ? wi / (W.length - 1) : 1, isNuc = w === nuc;
          const accent = isNuc ? 3.2 : !w.small && w.len > 4 && R() < 0.55 ? 1.6 + R() * 1.4 : 0;
          // one to three notes per word, merged by legato
          const n = Math.max(1, Math.min(3, Math.round(w.syl.length * (0.5 + R() * 0.45))));
          const t0 = T(w.at), t1 = T(w.at + w.len + 1);
          for (let k = 0; k < n; k++) {
            let t = t0 + ((t1 - t0) * k) / n;
            if (t < last + 0.04) t = last + 0.04;
            let d = ((t1 - t0) / n) * mood.legato * (0.85 + R() * 0.3);
            const final = isLast && k === n - 1;
            if (final) d *= 1.7; // the last syllable of a sentence lingers
            d = Math.max(0.05, Math.min(0.26, d));
            let semi = (2 - pos * 3.2) * range + (k === 0 ? accent * range : -accent * 0.3) + (R() - 0.5) * 1.2;
            let glide = st((R() - 0.5) * 1.4), gl = 0.5;
            if (final) {
              if (S.mark === "?") { semi += S.q ? 2 : 4; glide = st(S.q ? 4 : 6); gl = 0.25; }
              else if (S.mark === "!") { semi += 3; glide = st(-4); gl = 0.35; }
              else if (S.mark === "…") { semi -= 1; glide = st(-3); }
              else { semi -= 2.5; glide = st(-3); }
            }
            if (w.comma && k === n - 1) { semi += 1.5; glide = st(1); }
            const amp = (0.15 + (accent ? 0.05 : 0) + (final && S.mark === "!" ? 0.03 : 0)) * (0.9 + R() * 0.2) * (final && S.mark === "…" ? 0.6 : 1);
            note(t, d, base * st(semi), w.syl[Math.min(w.syl.length - 1, Math.floor((k / n) * w.syl.length))], amp, glide, gl);
            last = t + d * 0.6;
          }
        });
      });
      // and a laugh at its own joke, now and then
      if (mood.k === "playful" && R() < 0.8) {
        let t = Math.max(last + 0.12, now + dur * 0.96);
        const n = 2 + ((R() * 3) | 0), f0 = base * st(4 + R() * 2);
        for (let i = 0; i < n; i++) { note(t, 0.06, f0 * st(-i * (1 + R())), "e", 0.14 - i * 0.015, st(-1)); puff(t, 0.07, 0.035, 2600); t += 0.085 + R() * 0.03; }
      } else if (mood.k === "happy" && R() < 0.2) {
        const t = Math.max(last + 0.1, now + dur * 0.96);
        note(t, 0.06, base * st(5), "e", 0.12, st(-1)); note(t + 0.09, 0.06, base * st(3), "e", 0.1);
      }
    },
    // soft keys under the voice: a muted click and a hint of body, like a good keyboard in another room
    keys(text, dur, at) {
      const ctx = this.ctx;
      if (!this.keyBuf) {
        const sr = ctx.sampleRate, b = (this.keyBuf = ctx.createBuffer(1, Math.round(sr * 0.04), sr)), d = b.getChannelData(0);
        let lp = 0;
        for (let i = 0; i < d.length; i++) { const t = i / sr; lp += (Math.random() * 2 - 1 - lp) * 0.45; d[i] = lp * Math.exp(-t / 0.0025) * 0.9 + Math.sin(2 * Math.PI * 1150 * t) * Math.exp(-t / 0.007) * 0.35; }
      }
      const len = text.length;
      for (let i = 0; i < len; i++) {
        if (text[i] === " " || Math.random() < 0.45) continue;
        const s = ctx.createBufferSource(), gn = ctx.createGain(), t = at + (i / len) * dur * 0.95 + Math.random() * 0.012;
        s.buffer = this.keyBuf; s.playbackRate.value = 0.8 + Math.random() * 0.35;
        gn.gain.value = 0.09 * this.mix.voice * (0.6 + Math.random() * 0.6);
        s.connect(gn); gn.connect(this.near); gn.connect(this.room);
        s.start(t);
      }
    },
    // thinking: closed-mouth murmurs while the dots breathe, never the same twice, until it speaks
    think() {
      if (!this.on) return;
      clearTimeout(this.thinkT);
      this.thinking = performance.now();
      const ctx = this.ctx, V = this.vox(), P = V.pitch.offset, E = V.env.gain;
      const murmur = () => {
        if (!this.thinking || performance.now() - this.thinking > 20000 || !this.on) return;
        const now = ctx.currentTime + 0.02;
        P.cancelScheduledValues(now); E.cancelScheduledValues(now);
        V.f1.frequency.setTargetAtTime(320, now, 0.01); V.f2.frequency.setTargetAtTime(780, now, 0.01);
        V.wob.gain.setTargetAtTime(2.5, now, 0.05); V.out.gain.setTargetAtTime(this.mix.voice, now, 0.02);
        // a few shapes of "hm": a short pair, a slow rise, a tiny questioning lilt
        const shapes = [[[0, 400, 0.13, 1.05], [0.19, 440, 0.105, 1.04]], [[0, 380, 0.115, 1.18]], [[0, 430, 0.1, 0.97], [0.15, 470, 0.085, 1.08], [0.28, 420, 0.075, 0.95]]];
        const sh = shapes[(Math.random() * shapes.length) | 0];
        sh.forEach(([dt, f, a, glide]) => {
          P.setTargetAtTime(f, now + dt, 0.015); P.setTargetAtTime(f * glide, now + dt + 0.04, 0.06);
          E.setTargetAtTime(a, now + dt, 0.014); E.setTargetAtTime(0, now + dt + 0.13, 0.035);
        });
        this.thinkT = setTimeout(murmur, 1300 + Math.random() * 900);
      };
      murmur();
    },
    stopThinking() { this.thinking = 0; clearTimeout(this.thinkT); },
  };
  // a visitor who turned the sound on last time gets it back with their first touch (browsers need one)
  // (a press on the switch itself is left to the switch)
  if (S.pref()) {
    const arm = (e) => {
      removeEventListener("pointerdown", arm, true); removeEventListener("keydown", arm, true);
      if (e.target && e.target.closest && e.target.closest("[data-sound]")) return;
      if (!S.on && !S.starting) S.set(true);
    };
    addEventListener("pointerdown", arm, true); addEventListener("keydown", arm, true);
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-sound]"); if (b) { e.preventDefault(); S.set(!(S.on || S.starting)); } });
  addEventListener("DOMContentLoaded", () => S.ui());
  window.Sound = S;
})();
