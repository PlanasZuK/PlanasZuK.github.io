/* shared.js — everyone who is on the site at the same moment, together.
   Visitors are put in small rooms (up to four). Each one sees the others' cursors wherever they are on the
   site (on the landing from the other side of the glass, on a page beside them, from afar over every page),
   can write on the same frosted glass, knock on it, send a small emoji or a few words.
   Browsers talk to each other directly (WebRTC); they find each other through public Nostr relays via Trystero.
   No server of ours, no accounts, nothing is stored: it all lives only while both are here. */
const LIB = "https://cdn.jsdelivr.net/npm/trystero@0.25.4/+esm";
const APP = { appId: "polplanas.com/glass/2" };
const MAX = 4;

export async function share(on = {}) {
  const { joinRoom, selfId } = await import(LIB);
  let room = null, n = 0, A = {};
  const peers = new Set();
  const enter = (k) => {
    room = joinRoom(APP, "window-" + k);
    for (const a of ["f", "n", "e", "m", "k", "b", "c"]) A[a] = room.makeAction(a);
    room.onPeerJoin = (id) => { peers.add(id); if (on.join) on.join(id); };
    room.onPeerLeave = (id) => { peers.delete(id); if (on.leave) on.leave(id); };
    A.f.onMessage = (d, { peerId }) => on.pointer && on.pointer(peerId, d);
    A.n.onMessage = (d, { peerId }) => on.name && on.name(peerId, String(d || "").slice(0, 18));
    A.e.onMessage = (d, { peerId }) => on.emoji && on.emoji(peerId, d);
    A.m.onMessage = (d, { peerId }) => on.chat && on.chat(peerId, { ...d, t: String(d && d.t || "").slice(0, 140) });
    A.k.onMessage = (d, { peerId }) => on.knock && on.knock(peerId, d);
    A.b.onMessage = (d, { peerId }) => on.breath && on.breath(peerId, d);
    A.c.onMessage = (d, { peerId }) => on.clock && on.clock(peerId, d);
  };
  // the first room with space; a full one (four already together) passes you on to the next
  for (n = 1; n <= 12; n++) {
    enter(n);
    await new Promise((r) => setTimeout(r, 3000));
    if (Object.keys(room.getPeers()).length < MAX) break;
    room.leave(); peers.clear();
  }
  let last = 0, queued = null, timer = 0, wasDown = 0;
  const flush = () => { timer = 0; if (queued) { A.f.send(queued); queued = null; last = performance.now(); } };
  return {
    id: selfId,
    room: n,
    get count() { return peers.size; },
    // where my pointer is: at most thirty times a second, always at once when it presses or lifts
    pointer(msg) {
      if (!peers.size) return;
      const now = performance.now();
      if (msg.d !== wasDown || now - last > 33) { wasDown = msg.d; last = now; queued = null; A.f.send(msg); }
      else { queued = msg; if (!timer) timer = setTimeout(flush, 34); }
    },
    name(v, target) { if (peers.size) A.n.send(v, target ? { target } : undefined); },
    emoji(d) { if (peers.size) A.e.send(d); },
    chat(d) { if (peers.size) A.m.send(d); },
    knock(d) { if (peers.size) A.k.send(d); },
    breath(d) { if (peers.size) A.b.send(d); },
    clock(d, target) { if (peers.size) A.c.send(d, target ? { target } : undefined); },
    leave() { if (room) room.leave(); },
  };
}
