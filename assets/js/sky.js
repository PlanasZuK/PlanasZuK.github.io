/* sky.js — the light outside the window is the light where the visitor is.
   The sun's height is worked out from the visitor's clock, the date and a place guessed from their
   time zone (no permission asked, nothing stored). If the weather service says there is a storm
   there right now, the rain outside gets heavier and the sky flashes. It always rains here. */
(() => {
  // a few time zones and a city in each, for the sun; anything else falls back on the clock offset
  const TZ = {
    "Europe/Madrid": [40.4, -3.7], "Atlantic/Canary": [28.1, -15.4], "Europe/Lisbon": [38.7, -9.1], "Europe/London": [51.5, -0.1],
    "Europe/Paris": [48.9, 2.35], "Europe/Andorra": [42.5, 1.5], "Europe/Brussels": [50.8, 4.35], "Europe/Amsterdam": [52.4, 4.9],
    "Europe/Berlin": [52.5, 13.4], "Europe/Rome": [41.9, 12.5], "Europe/Zurich": [47.4, 8.5], "Europe/Vienna": [48.2, 16.4],
    "Europe/Stockholm": [59.3, 18.1], "Europe/Oslo": [59.9, 10.7], "Europe/Copenhagen": [55.7, 12.6], "Europe/Dublin": [53.3, -6.3],
    "Europe/Warsaw": [52.2, 21], "Europe/Athens": [38, 23.7], "Europe/Istanbul": [41, 29], "Africa/Casablanca": [33.6, -7.6],
    "America/New_York": [40.7, -74], "America/Chicago": [41.9, -87.6], "America/Denver": [39.7, -105], "America/Los_Angeles": [34, -118.2],
    "America/Mexico_City": [19.4, -99.1], "America/Bogota": [4.7, -74.1], "America/Lima": [-12, -77], "America/Santiago": [-33.4, -70.6],
    "America/Argentina/Buenos_Aires": [-34.6, -58.4], "America/Buenos_Aires": [-34.6, -58.4], "America/Sao_Paulo": [-23.5, -46.6],
    "America/Toronto": [43.7, -79.4], "Asia/Tokyo": [35.7, 139.7], "Asia/Shanghai": [31.2, 121.5], "Asia/Singapore": [1.35, 103.8],
    "Asia/Dubai": [25.2, 55.3], "Asia/Kolkata": [19, 72.8], "Australia/Sydney": [-33.9, 151.2], "Pacific/Auckland": [-36.8, 174.8],
  };
  const R = Math.PI / 180;
  function place(date = new Date()) {
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    return TZ[tz] || [40, -date.getTimezoneOffset() / 4];
  }
  // solar elevation in degrees (low-precision almanac formula, good to a fraction of a degree)
  function elevation(date, lat, lon) {
    const d = date.getTime() / 86400000 - 10957.5;
    const g = (357.529 + 0.98560028 * d) * R, q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * R, e = (23.439 - 0.00000036 * d) * R;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * R;
    const ha = gmst + lon * R - ra;
    return Math.asin(Math.sin(lat * R) * Math.sin(dec) + Math.cos(lat * R) * Math.cos(dec) * Math.cos(ha)) / R;
  }
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function light(date = new Date(), force) {
    const [lat, lon] = place(date);
    let el = elevation(date, lat, lon);
    const rising = elevation(new Date(date.getTime() + 600000), lat, lon) > el;
    const f = { dawn: [2, true], day: [35, true], dusk: [2, false], night: [-20, false] }[force];
    if (f) [el] = f;
    const dawn = f ? (f[1] ? 1 : 0) : rising ? 1 : 0;
    const day = ss(-8, 14, el), night = 1 - ss(-12, -3, el), gold = Math.exp(-Math.pow((el - 2.5) / 7.5, 2)) * (1 - night * 0.7);
    const h = date.getHours();
    const part = night > 0.6 ? "night" : gold > 0.45 ? (dawn ? "dawn" : "sunset") : h < 13 ? "morning" : "afternoon";
    return { el, day, night, gold, dawn, part, lat, lon };
  }
  // is it storming where you are? one small request, cached for the session
  async function weather(lat, lon) {
    try {
      const k = "pp-sky", c = sessionStorage.getItem(k);
      if (c) return JSON.parse(c);
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 3500);
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(1)}&longitude=${lon.toFixed(1)}&current=weather_code`, { signal: ctl.signal });
      clearTimeout(t);
      const code = (await r.json()).current.weather_code;
      const w = { storm: code >= 95 ? 1 : [65, 67, 82].includes(code) ? 0.55 : [61, 63, 80, 81].includes(code) ? 0.25 : 0 };
      try { sessionStorage.setItem(k, JSON.stringify(w)); } catch (e) {}
      return w;
    } catch (e) { return { storm: 0 }; }
  }
  window.Sky = { light, weather };
})();
