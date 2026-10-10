/* Bemutató mód: a lejátszó szerver nélkül fut. Az /api/ hívásokat ez szolgálja ki:
   minta konfiguráció (a dátumok mára igazítva), élő időjárás az Open-Meteótól, minden más „ok”. */
(() => {
  const lang = new URLSearchParams(location.search).get('lang') === 'hu' ? 'hu' : 'en';
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
  const config = realFetch(`config-${lang}.json`).then((r) => r.json()).then(prepare);
  const json = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

  window.fetch = (input, opts) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!u.pathname.startsWith('/api/')) return realFetch(input, opts);
    if (u.pathname === '/api/preview') return config.then(json);
    if (u.pathname === '/api/player/weather') {
      const q = u.searchParams;
      return realFetch(`https://api.open-meteo.com/v1/forecast?latitude=${+q.get('lat')}&longitude=${+q.get('lon')}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`);
    }
    return Promise.resolve(json({ ok: true })); // űrlap beküldés stb. – nem megy sehova
  };
})();
