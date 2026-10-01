/* sound.js — the window's sound: off until the visitor turns it on, and then entirely generated from the scene
   (see sound-worklet.js). This side listens to the page and tells the audio thread what is happening:
   how hard it rains, the wind and its gusts, the hour, the storm, the camera, the fingertip, each drop that
   lands, each lightning flash (its thunder arrives later, as far as the strike was), the voice typing.
   A generated room (a convolution reverb from decaying noise) gives the drips and the thunder their space. */
(() => {
  const KEY = "pp-sound";
  const S = {
    on: false, ctx: null, node: null, gain: null, last: 0, want: false,
    // the mix, layer by layer; ?tune shows sliders for each
    mix: { master: 0.9, room: 0.55, bed: 1, patter: 1, drips: 1, taps: 1, wind: 1, finger: 1, thunder: 1, keys: 1, ui: 1, whoosh: 1 },
    setMix(k, v) {
      this.mix[k] = v;
      if (!this.ctx) return;
      if (k === "room") this.wet.gain.value = v;
      else if (k === "master") { if (this.on) this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
      else this.node.port.postMessage({ mix: { [k]: v } });
    },
    pref() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } },
    save(v) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) {} },
    async build() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !window.AudioWorkletNode) return false;
      // ambient: it mixes with the visitor's own music instead of stopping it (where the browser supports it)
      try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
      const ctx = new AC({ latencyHint: "interactive" });
      await ctx.audioWorklet.addModule("/assets/js/sound-worklet.js");
      const node = new AudioWorkletNode(ctx, "window-sound", { numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [2, 2] });
      // the room: two seconds of decaying, darkening noise, different in each ear
      const len = Math.round(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        let lp = 0;
        for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate, k = 0.25 + 0.7 * Math.exp(-t * 1.6); lp += (Math.random() * 2 - 1 - lp) * k; d[i] = lp * Math.exp(-t * 2.6) * (t < 0.012 ? t / 0.012 : 1); }
      }
      const room = ctx.createConvolver(); room.normalize = true; room.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = this.mix.room;
      const gain = ctx.createGain(); gain.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.4;
      node.connect(comp, 0); node.connect(room, 1); room.connect(wet).connect(comp);
      comp.connect(gain).connect(ctx.destination);
      Object.assign(this, { ctx, node, gain, wet });
      const { master: _m, room: _r, ...layers } = this.mix;
      node.port.postMessage({ mix: layers });
      document.addEventListener("visibilitychange", () => { if (!this.on) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
      return true;
    },
    // turned on and off by the visitor; it fades, never cuts
    async set(v) {
      this.want = v; this.save(v);
      this.ui();
      if (v) {
        if (!(await this.build().catch(() => false))) { this.want = false; this.ui(); return; }
        await this.ctx.resume();
        this.on = true;
        const g = this.gain.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(this.mix.master, t + 1.8);
      } else if (this.ctx) {
        this.on = false;
        const g = this.gain.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.6);
        setTimeout(() => { if (!this.want) this.ctx.suspend(); }, 700);
      }
    },
    ui() {
      for (const b of document.querySelectorAll("[data-sound]")) {
        const label = this.want ? b.dataset.on : b.dataset.off, r = b.querySelector(".btn__roll");
        if (r) { r.textContent = label; r.dataset.text = label; }
        b.setAttribute("aria-pressed", this.want ? "true" : "false");
      }
    },
    post(m) { if (this.on && this.node) this.node.port.postMessage(m); },
    // the scene, about thirty times a second
    update(st, now) {
      if (!this.on || now - this.last < 33) return;
      this.last = now;
      this.post({ set: st });
    },
    tap(x, s) { this.post({ tap: { x, s } }); },
    tick(x, k) { this.post({ tick: { x, k } }); },
    press(kind) { this.post({ ui: kind }); },
    // a flash: the thunder follows after as many seconds as the strike is far
    thunder(dist) { if (!this.on) return; setTimeout(() => this.post({ thunder: dist }), 300 + dist * 3800); },
    // the voice types: a soft key every few letters, beside the label
    voice(len) {
      if (!this.on) return;
      const el = document.querySelector(".voice"), r = el && el.getBoundingClientRect(), x = r ? ((r.left + r.width / 2) / innerWidth) * 2 - 1 : 0;
      const dur = Math.min(1.4, 0.022 * len + 0.2), n = Math.max(2, Math.round(len / 3.2));
      for (let i = 0; i < n; i++) setTimeout(() => this.tick(x * 0.6, 0.94 + Math.random() * 0.12), (i / n) * dur * 1000 + Math.random() * 30);
    },
  };
  // a visitor who turned the sound on last time gets it back with their first touch (browsers need one)
  if (S.pref()) {
    S.want = true;
    const arm = () => { removeEventListener("pointerdown", arm, true); removeEventListener("keydown", arm, true); S.set(true); };
    addEventListener("pointerdown", arm, true); addEventListener("keydown", arm, true);
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-sound]"); if (b) { e.preventDefault(); S.set(!S.want); } });
  // the buttons answer the hand, very quietly
  document.addEventListener("pointerover", (e) => { const b = e.target.closest(".btn, [data-go], .vcard__main"); if (b && !b.contains(e.relatedTarget)) S.press("hover"); });
  document.addEventListener("pointerdown", (e) => { if (e.target.closest(".btn, [data-go], .vcard__main")) S.press("press"); });
  addEventListener("DOMContentLoaded", () => S.ui());
  window.Sound = S;
})();
