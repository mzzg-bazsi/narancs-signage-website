/* Bemutató mód: a lejátszó szerver nélkül fut. Az /api/ hívásokat ez szolgálja ki:
   minta konfiguráció (a dátumok mára igazítva), élő időjárás az Open-Meteótól, minden más „ok”. */
(() => {
  const lang = window.DemoStore.lang;
  const realFetch = window.fetch.bind(window);
  const DAY = 864e5;
  const pad = (n) => String(n).padStart(2, '0');

  // a mentés óta eltelt napokkal tolja el az eseményeket, a visszaszámlálás a következő újév
  function prepare(cfg) {
    const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((midnight(new Date()) - midnight(new Date(cfg.captured))) / DAY);
    const shift = (v) => {
      if (/^\d{4}-\d\d-\d\d$/.test(v)) { const [y, m, d] = v.split('-').map(Number); const t = new Date(y, m - 1, d + days); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; }
      const t = Date.parse(v);
      return Number.isNaN(t) ? v : new Date(t + days * DAY).toISOString();
    };
    for (const evs of Object.values(cfg.calendars || {})) for (const e of evs) { e.start = shift(e.start); if (e.end) e.end = shift(e.end); }
    for (const s of Object.values(cfg.slides || {})) if (s.type === 'countdown') s.data.target = `${new Date().getFullYear() + 1}-01-01T00:00`;
    return cfg;
  }
  // ?preview=demo:1 → a weboldal bemutatója; slide/playlist/screen/brand → az admin bemutató előnézete a DemoStore adataiból
  const preview = new URLSearchParams(location.search).get('preview') || '';
  // csak az első konfiguráció kéréskor töltjük be (a zónák beágyazott lejátszói nem kérnek konfigurációt)
  let config = null;
  const getConfig = () => (config ||= preview.startsWith('demo') ? realFetch(`config-${lang}.json`).then((r) => r.json()).then(prepare) : window.DemoStore.load().then((d) => fromStore(d, preview)));

  function fromStore(d, pv) {
    const [kind, idStr] = pv.split(':'), id = +idStr;
    const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
    const slides = byId(d.slides);
    const playlists = Object.fromEntries(d.playlists.map((p) => [p.id, { id: p.id, name: p.name, transition: p.transition, items: p.items }]));
    const forms = Object.fromEntries(d.forms.map((f) => [f.id, { id: f.id, title: f.title || f.name, intro: f.intro, fields: f.fields, submit_text: f.submit_text, thanks_text: f.thanks_text }]));
    const calendars = Object.fromEntries(d.calendars.map((c) => [c.id, d.events.filter((e) => e.calendar_id === c.id)
      .map((e) => ({ title: e.title, description: e.description, location: e.location, start: e.start, end: e.end, all_day: !!e.all_day, color: e.color || c.color, calendar: c.name }))]));
    const media = Object.fromEntries((d.media || []).map((m) => [m.id, m]));
    const st = d.settings;
    const org = { name: st.org_name, slogan: st.slogan, logo_media_id: st.logo_media_id, branding: st.branding, lang: d.lang };
    let screen = { id: 0, name: 'Preview', playlist_id: d.playlists[0]?.id || 0, schedule: [], settings: { idle_return: 30 } };
    if (kind === 'screen') { const s = d.screens.screens.find((x) => x.id === id); if (s) screen = { id: s.id, name: s.name, playlist_id: s.playlist_id, schedule: s.schedule || [], settings: s.settings || {} }; }
    if (kind === 'playlist') screen.playlist_id = id;
    if (kind === 'slide') { playlists[0] = { id: 0, name: 'Preview', transition: 'fade', items: [{ slide_id: id }] }; screen.playlist_id = 0; }
    return { paired: true, preview: true, screen, org, playlists, slides, media, forms, calendars, version: String(Date.now()),
      alerts: kind === 'screen' ? d.alerts.filter((a) => (!a.expires_at || a.expires_at > Date.now()) && (!a.screen_ids || a.screen_ids.includes(id))) : [] };
  }
  const json = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

  window.fetch = (input, opts) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!u.pathname.startsWith('/api/')) return realFetch(input, opts);
    if (u.pathname === '/api/preview') return getConfig().then(json);
    if (u.pathname === '/api/player/weather') {
      const q = u.searchParams;
      return realFetch(`https://api.open-meteo.com/v1/forecast?latitude=${+q.get('lat')}&longitude=${+q.get('lon')}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`);
    }
    return Promise.resolve(json({ ok: true })); // űrlap beküldés stb. – nem megy sehova
  };
})();
