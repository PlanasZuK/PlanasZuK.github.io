/* shared.js — everyone who is on the site at the same moment, together.
   Visitors are put in small rooms (up to four). Messages go through two free public MQTT brokers at once (EMQX and
   HiveMQ, over secure websockets), so it works from any home, office or phone network, with no server of ours, no
   accounts, nothing stored, and without anyone seeing anyone else's address. Whatever arrives twice (once from each
   broker) is taken once. Only small things travel: where a pointer is, a name, a few words, a sign, a knock. */
const LIB = "https://cdn.jsdelivr.net/npm/mqtt@5.16.0/dist/mqtt.esm.js";
const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt"];
// tests never meet real visitors
const BASE = "polplanas.com/glass/v3/" + (/[?&]testb/.test(location.search) ? "test/" : "");
const MAX = 4, HEARTBEAT = 3000, GONE = 10000;
const TYPES = new Set(["h", "q", "f", "n", "e", "m", "k", "b", "c"]);

export async function share(on = {}) {
  const mqtt = (await import(LIB)).default;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => (b % 36).toString(36)).join("");
  let room = 1, seq = 0;
  const peers = new Map();          // id → last time heard
  const seen = new Map();           // id → highest seq taken, so a message that came through both brokers counts once
  const topic = () => BASE + "r" + room;
  const clients = BROKERS.map((url) => mqtt.connect(url, {
    clientId: "pp_" + id + "_" + Math.random().toString(36).slice(2, 6), clean: true, connectTimeout: 7000, reconnectPeriod: 4000, keepalive: 30,
    will: { topic: BASE + "r1", payload: JSON.stringify({ i: id, t: "q" }), qos: 0, retain: false },
  }));
  const send = (t, d, to) => {
    const msg = JSON.stringify({ i: id, s: ++seq, t, d, to });
    for (const c of clients) if (c.connected) c.publish(topic(), msg, { qos: 0 });
  };
  const handlers = { f: "pointer", n: "name", e: "emoji", m: "chat", k: "knock", b: "breath", c: "clock" };
  const take = (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.i !== "string" || m.i === id || m.i.length > 24 || !TYPES.has(m.t)) return;
    if (m.to && m.to !== id) return;
    if (typeof m.s === "number") { const last = seen.get(m.i) || 0; if (m.s <= last && m.t !== "q") return; seen.set(m.i, m.s); }
    if (m.t === "q") { if (peers.delete(m.i) && on.leave) on.leave(m.i); return; }
    const isNew = !peers.has(m.i);
    if (isNew && peers.size >= MAX + 2) return;
    peers.set(m.i, Date.now());
    if (isNew) { if (on.join) on.join(m.i); send("h", null, m.i); }
    if (m.d && typeof m.d === "object" && (("x" in m.d && !Number.isFinite(m.d.x)) || ("y" in m.d && !Number.isFinite(m.d.y)))) return;
    const h = handlers[m.t];
    if (h && on[h] && m.d && typeof m.d === "object") on[h](m.i, m.d);
    else if (h && on[h] && m.t === "n") on[h](m.i, String(m.d || "").slice(0, 18));
  };
  for (const c of clients) {
    c.on("message", (t, p) => { if (t === topic()) take(p.toString()); });
    c.on("connect", () => { c.subscribe(topic()); send("h", null); });
    c.on("error", () => {});
  }
  // wait until at least one broker answers
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("no broker answered")), 12000);
    for (const c of clients) c.on("connect", () => { clearTimeout(t); res(); });
  });
  // the first room with space: listen a moment; if four are already there, the next one
  for (let k = 0; k < 12; k++) {
    await new Promise((r) => setTimeout(r, 1800));
    if (peers.size < MAX) break;
    for (const c of clients) if (c.connected) c.unsubscribe(topic());
    for (const p of [...peers.keys()]) { peers.delete(p); if (on.leave) on.leave(p); }
    room++;
    for (const c of clients) if (c.connected) c.subscribe(topic());
    send("h", null);
  }
  // still here: a heartbeat; and whoever has gone quiet has left
  const beat = setInterval(() => {
    send("h", null);
    const now = Date.now();
    for (const [p, t] of peers) if (now - t > GONE) { peers.delete(p); if (on.leave) on.leave(p); }
  }, HEARTBEAT);
  addEventListener("pagehide", () => { send("q", null); });
  let last = 0, queued = null, timer = 0, wasDown = 0;
  const flush = () => { timer = 0; if (queued) { send("f", queued); queued = null; last = performance.now(); } };
  return {
    id,
    get room() { return room; },
    get count() { return peers.size; },
    // where my pointer is: at most twenty times a second, always at once when it presses or lifts
    pointer(msg) {
      if (!peers.size) return;
      const now = performance.now();
      if (msg.d !== wasDown || now - last > 50) { wasDown = msg.d; last = now; queued = null; send("f", msg); }
      else { queued = msg; if (!timer) timer = setTimeout(flush, 52); }
    },
    name(v, target) { if (peers.size) send("n", String(v || "").slice(0, 18), target); },
    emoji(d) { if (peers.size) send("e", d); },
    chat(d) { if (peers.size) send("m", d); },
    knock(d) { if (peers.size) send("k", d); },
    breath(d) { if (peers.size) send("b", d); },
    clock(d, target) { if (peers.size) send("c", d, target); },
    leave() { send("q", null); clearInterval(beat); for (const c of clients) c.end(true); },
  };
}
