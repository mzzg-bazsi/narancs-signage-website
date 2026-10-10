/* Admin bemutató: az /api/ hívásokat a böngészőben szolgálja ki a DemoStore adataiból.
   Ami valódi szervert vagy kijelzőt igényelne (feltöltés, párosítás), barátságos hibát ad. */
(() => {
  const S = window.DemoStore;
  const HU = S.lang === 'hu';
  const NA = HU ? 'A bemutatóban ez nem érhető el.' : 'Not available in the demo.';
  const realFetch = window.fetch.bind(window);
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  class DemoError extends Error {}
  const fail = (msg = NA) => { throw new DemoError(msg); };
  const now = () => Date.now();
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const DEFAULTS = {
    slides: { duration: 10, data: {} }, playlists: { transition: 'fade', items: [] }, forms: { fields: [] },
    calendars: { color: 'var(--accent)', ical_url: '', ical_cache: [], ical_fetched: null }, events: { description: '', all_day: 0 },
  };

  // az első kijelző mindig online (ez „fut” a bemutatóban), a második régóta offline
  const fresh = (s, i) => ({ ...s, online: i === 0, agent_online: i === 0, last_seen: i === 0 ? now() : now() - 3 * 3600e3 });
  const screens = (d) => d.screens.screens.map(fresh);
  const activeAlerts = (d) => d.alerts.filter((a) => !a.expires_at || a.expires_at > now());

  async function handle(method, path, q, body) {
    const d = await S.load();
    const [, , coll, id, sub] = path.split('/');
    const list = d[coll];
    const find = (arr = list) => arr.find((x) => String(x.id) === id) || fail(HU ? 'Nem található' : 'Not found');
    const nextId = (arr) => Math.max(0, ...arr.map((x) => x.id)) + 1;

    switch (coll) {
      case 'auth': return path === '/api/auth/state' ? d.state : { ok: true };
      case 'settings':
        if (method === 'PUT') { const { language, ...rest } = body; Object.assign(d.settings, rest); S.save(); } // nyelvet a weboldal kapcsolója vált
        return d.settings;
      case 'dashboard': {
        const sc = screens(d);
        return {
          ...d.dashboard, screens: sc, alerts: activeAlerts(d),
          counts: { ...d.dashboard.counts, screens: sc.length, online: sc.filter((s) => s.online).length, slides: d.slides.length, playlists: d.playlists.length },
        };
      }
      case 'screens':
        if (id === 'pair') fail(HU ? 'A bemutatóban nincs valódi kijelző, amit párosítani lehetne. Telepítsd a lejátszót egy gépre, és próbáld ki élesben!' : 'There is no real screen to pair in the demo. Install the player on a device and try it for real!');
        if (id === 'broadcast' || sub === 'command') return { ok: true };
        if (!id) return { screens: screens(d), pending: [] };
        if (method === 'PUT') { Object.assign(find(d.screens.screens), body); S.save(); return fresh(find(d.screens.screens), 0); }
        if (method === 'DELETE') { d.screens.screens = d.screens.screens.filter((s) => String(s.id) !== id); S.save(); return { ok: true }; }
        break;
      case 'alerts':
        if (method === 'POST') {
          if (!body.message) fail(HU ? 'Az üzenet nem lehet üres' : 'The message cannot be empty');
          d.alerts.unshift({ id: nextId(d.alerts), title: body.title || '', message: body.message, level: body.level || 'info', screen_ids: body.screen_ids?.length ? body.screen_ids.map(Number) : null, expires_at: +body.minutes ? now() + body.minutes * 60e3 : null, created_at: now() });
          S.save(); return { ok: true };
        }
        if (method === 'DELETE') { find().expires_at = now() - 1; S.save(); return { ok: true }; }
        return d.alerts;
      case 'submissions':
        for (const k in d.submissions) d.submissions[k] = d.submissions[k].filter((x) => String(x.id) !== id);
        S.save(); return { ok: true };
      case 'geocode': {
        const r = await realFetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.get('q') || '')}&count=6&language=${S.lang}&format=json`);
        return ((await r.json()).results || []).map((x) => ({ name: x.name, country: x.country, admin: x.admin1, lat: x.latitude, lon: x.longitude }));
      }
      case 'reports': return d.reports || { totals: { views: 0, touches: 0, screens: 0, slides: 0 }, by_slide: [], by_screen: [], by_day: [] };
      case 'tokens':
        if (method === 'POST') fail(HU ? 'API kulcs a bemutatóban nem hozható létre.' : 'API keys cannot be created in the demo.');
        if (method === 'DELETE') { d.tokens = (d.tokens || []).filter((x) => String(x.id) !== id); S.save(); }
        return d.tokens || [];
      case 'users':
        if (method === 'POST') { if (!body.username) fail(HU ? 'Érvénytelen felhasználónév' : 'Invalid username'); d.users.push({ id: nextId(d.users), username: body.username, role: body.role || 'editor', created_at: now() }); }
        if (method === 'PUT') Object.assign(find(), { role: body.role });
        if (method === 'DELETE') d.users = d.users.filter((x) => String(x.id) !== id);
        S.save(); return d.users;
      case 'media': if (method === 'POST') fail(); break;
      case 'rss-test': case 'samples': case 'backup': case 'account': fail();
    }

    if (coll === 'slides' && sub === 'duplicate') {
      const c = { ...clone(find()), id: nextId(d.slides), name: find().name + (HU ? ' (másolat)' : ' (copy)'), updated_at: now() };
      d.slides.unshift(c); S.save(); return c;
    }
    if (coll === 'slides' && sub === 'usage') return d.playlists.filter((p) => p.items.some((i) => String(i.slide_id) === id)).map((p) => ({ id: p.id, name: p.name }));
    if (coll === 'slides' && id === 'brandify') return { ok: true, changed: 0, total: d.slides.length };
    if (coll === 'forms' && sub === 'submissions') return d.submissions[id] || [];
    if (coll === 'calendars' && sub === 'refresh') return { ok: true };

    // általános CRUD (tartalmak, listák, naptárak, események, űrlapok, média, felhasználók)
    if (!Array.isArray(list)) return method === 'GET' ? fail(HU ? 'Nem található' : 'Not found') : { ok: true };
    if (method === 'GET' && !id) return coll === 'events' && q.get('calendar_id') ? list.filter((e) => String(e.calendar_id) === q.get('calendar_id')) : list;
    if (method === 'GET') return find();
    if (method === 'POST') {
      if (coll === 'slides' && !body.name) fail(HU ? 'Adj nevet a tartalomnak' : 'Give the content a name');
      const { password, ...safe } = body; // jelszót nem tárolunk
      const x = { ...clone(DEFAULTS[coll] || {}), ...safe, id: nextId(list), created_at: now(), updated_at: now() };
      list.unshift(x); S.save(); return x;
    }
    if (method === 'PUT') { const x = Object.assign(find(), body, { updated_at: now() }); S.save(); return x; }
    if (method === 'DELETE') {
      d[coll] = list.filter((x) => String(x.id) !== id);
      if (coll === 'slides') for (const p of d.playlists) p.items = p.items.filter((i) => String(i.slide_id) !== id);
      if (coll === 'calendars') d.events = d.events.filter((e) => String(e.calendar_id) !== id);
      S.save(); return { ok: true };
    }
    return { ok: true };
  }

  window.fetch = async (input, opts = {}) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!u.pathname.startsWith('/api/')) return realFetch(input, opts);
    try {
      const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : {};
      return json(await handle((opts.method || 'GET').toUpperCase(), u.pathname, u.searchParams, body));
    } catch (e) {
      if (!(e instanceof DemoError)) console.error(e);
      return json({ error: e instanceof DemoError ? e.message : NA }, 400);
    }
  };

  // fájlfeltöltés (XHR) – a bemutatóban nincs szerver, ahová kerülhetne
  const RealXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = class extends RealXHR {
    open(m, url, ...rest) { this._demo = String(url).startsWith('/api/'); if (!this._demo) super.open(m, url, ...rest); }
    setRequestHeader(...a) { if (!this._demo) super.setRequestHeader(...a); }
    send(b) {
      if (!this._demo) return super.send(b);
      Object.defineProperty(this, 'status', { value: 400 });
      Object.defineProperty(this, 'responseText', { value: JSON.stringify({ error: HU ? 'Feltöltés a bemutatóban nem lehetséges.' : 'Uploading is disabled in the demo.' }) });
      setTimeout(() => this.onload?.(), 200);
    }
  };

  // bemutató sáv: jelzi, hogy a módosítások csak a böngészőben maradnak, és visszaállítható
  addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;align-items:center;background:#2a1a10;color:#fff;font:13px/1.3 system-ui,sans-serif;padding:7px 8px 7px 14px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25);white-space:nowrap';
    bar.innerHTML = `<span>🧪 ${HU ? 'Bemutató – a módosítások csak ebben a böngészőben maradnak' : 'Demo – changes stay in this browser'}</span>`;
    const b = document.createElement('button');
    b.textContent = HU ? 'Visszaállítás' : 'Reset';
    b.style.cssText = 'border:0;border-radius:999px;padding:4px 12px;background:#f59e5b;color:#2a1300;font:600 12px system-ui,sans-serif;cursor:pointer';
    b.onclick = () => { S.reset(); location.reload(); };
    bar.append(b);
    document.body.append(bar);
  });
})();
