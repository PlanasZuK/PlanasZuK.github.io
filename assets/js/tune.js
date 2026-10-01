/* tune.js — the full live panel for the rainy window, in Catalan. Loaded only with ?tune.
   Every change applies at once and is kept in this browser while tuning; "Copiar ajustos" puts the whole
   set on the clipboard as JSON, ready to become the defaults in rain.js. */
export async function tune(rain, sky) {
  const { GUI } = await import("https://cdn.jsdelivr.net/npm/lil-gui@0.20/+esm");
  const KEY = "pp-rain-tune-3";
  const FOLDERS = { rain: "Pluja al vidre", glass: "Vidre i vapor", wind: "Vent i planta", camera: "Càmera", post: "Postprocessat" };
  const LABELS = {
    // pluja
    size: "Mida general de les gotes", rate: "Gotes que piquen (per segon)", gustRain: "Gotes extra en cada ràfega", sizeMin: "Mida mínima", sizeRange: "Variació de mida",
    sizeCurve: "Proporció de gotes petites", hold: "Pes per començar a lliscar", maxSize: "Mida màxima d’una gota", slide: "Velocitat en lliscar", drag: "Fregament del vidre",
    stickSlip: "Aturades mentre llisquen", trail: "Rastre de gotetes", trailSize: "Mida del rastre", inflow: "Aigua que baixa de dalt", inflowSize: "Mida de l’aigua de dalt",
    fadeIn: "Rapidesa en aparèixer", windPush: "Empenta del vent a les gotes", cap: "Gotes màximes al vidre",
    // vidre
    fog: "Vidre entelat", refog: "Rapidesa amb què torna el vapor", frostBlur: "Desenfocament del vapor", frostLift: "Blancor del vapor", frostGlow: "Llum que traspassa el vapor",
    frostDesat: "Pèrdua de color amb el vapor", micro: "Textura de micro-gotes", clearBlur: "Desenfocament amb el vidre net", refract: "Refracció de les gotes", rim: "Vora fosca de les gotes",
    spec: "Reflex de les gotes", specSharp: "Nitidesa del reflex", wipe: "Mida del dit (px)", grease: "Marca que deixa el dit",
    // vent
    wind: "Força general del vent", breeze: "Brisa constant", gustMin: "Ràfegues: temps mínim entre (s)", gustMax: "Ràfegues: temps màxim entre (s)", gust: "Força de les ràfegues",
    plant: "Moviment general de la planta", bend: "Flexió de la tija", swing: "Gronxat de les flors", flutter: "Tremolor de les flors", meadow: "Moviment del prat del fons",
    rainLean: "Inclinació de la pluja de fora", dayLength: "Durada del dia (scroll)", clock: "Minuts per un dia sencer, sol (0 = aturat)",
    // càmera
    zoom: "Zoom (1 = sense ampliar)", parallax: "Profunditat amb el ratolí", ca: "Aberració cromàtica", exposure: "Exposició",
    // postprocessat
    bloom: "Resplendor (bloom)", bloomThreshold: "Llindar de la resplendor", grain: "Gra", vignette: "Vinyeta", saturation: "Color", cool: "To fred del dia de pluja",
    brightness: "Brillantor", contrast: "Contrast", filmic: "Corba de cinema",
  };
  const gui = new GUI({ title: "Finestra — ajustos en directe", width: 340 });
  gui.domElement.style.zIndex = 400;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(rain.P)); } catch (e) {} };
  const rebuild = new Set(["size", "sizeMin", "sizeRange", "sizeCurve", "rate", "cap", "hold"]);
  const day = gui.addFolder("Cel i dia");
  for (const [group, items] of Object.entries(Rain.schema)) {
    const f = gui.addFolder(FOLDERS[group] || group);
    for (const [k, [, min, max, step]] of Object.entries(items)) {
      (k === "dayLength" || k === "clock" ? day : f).add(rain.P, k, min, max, step).name(LABELS[k] || k).onChange(save).onFinishChange(() => { if (rebuild.has(k)) rain.resize(true); });
    }
    f.close();
  }
  const s = { light: "scroll", hour: 0 };
  day.add(s, "hour", 0, 1, 0.005).name("Hora (7:00 → 0:00)").onChange((v) => sky(v));
  day.add(s, "light", { "Amb el scroll": "scroll", "Matí": "dawn", "Migdia": "day", "Capvespre": "dusk", "Nit": "night", "Tempesta": "storm" }).name("Llum").onChange((m) => sky(m));
  day.add(rain.state, "storm", 0, 1, 0.01).name("Tempesta").listen();
  day.close();
  const act = {
    copy: async () => {
      const text = JSON.stringify(rain.P, null, 2);
      try { await navigator.clipboard.writeText(text); btn.name("Copiat ✓"); } catch (e) { prompt("Copia aquests ajustos:", text); }
      setTimeout(() => btn.name("Copiar ajustos"), 1600);
    },
    gust: () => { rain.wind.next = 0; },
    wet: () => rain.resize(true),
    reset: () => { Object.assign(rain.P, Rain.defaults); try { localStorage.removeItem(KEY); } catch (e) {} gui.controllersRecursive().forEach((c) => c.updateDisplay()); rain.resize(true); },
  };
  const btn = gui.add(act, "copy").name("Copiar ajustos");
  gui.add(act, "gust").name("Fer una ràfega ara");
  gui.add(act, "wet").name("Tornar a començar la pluja");
  gui.add(act, "reset").name("Tornar als valors inicials");
}
