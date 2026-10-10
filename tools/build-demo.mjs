// A lejátszó bemutató felépítése: a valódi lejátszó fájljai a signage repóból, plusz a minta tartalom
// konfigurációja, amit egy ideiglenes tesztszerver (külön port, ideiglenes adatkönyvtár) állít elő.
// Használat: node tools/build-demo.mjs [../signage]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SRC = path.resolve(process.argv[2] || '../signage');
const OUT = path.resolve('demo');
const PORT = 8199;
const TICKER = {
  en: 'Welcome to Narancs Café\nToday 14:00 – team meeting in room 2\nThis is the real player running in your browser',
  hu: 'Üdvözlünk a Narancs Caféban\nMa 14:00 – csapatmegbeszélés a 2-es tárgyalóban\nEz a valódi lejátszó, a böngésződben fut',
};

// 1. lejátszó + közös fájlok másolása (az abszolút /shared/ útvonalak relatívvá alakítva)
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };
for (const f of ['player.js', 'player.css']) copy(`${SRC}/server/public/player/${f}`, `${OUT}/player/${f}`);
for (const f of ['i18n.js', 'themes.js', 'zones.js', 'splash/logo.svg', 'splash/logo-color.svg']) copy(`${SRC}/server/public/shared/${f}`, `${OUT}/shared/${f}`);
let html = fs.readFileSync(`${SRC}/server/public/player/index.html`, 'utf8')
  .replaceAll('"/shared/', '"../shared/')
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace('<script src="../shared/i18n.js">', '<script src="../shared/demo-store.js"></script>\n  <script src="shim.js"></script>\n  <script src="../shared/i18n.js">');
if (!html.includes('shim.js')) throw new Error('index.html szerkezete megváltozott');
fs.writeFileSync(`${OUT}/player/index.html`, html);

// admin: a valódi admin felület, az /api/ hívásokat a demo/admin/shim.js szolgálja ki
copy(`${SRC}/server/public/admin/admin.css`, `${OUT}/admin/admin.css`);
copy(`${SRC}/server/public/shared/splash/favicon.svg`, `${OUT}/shared/splash/favicon.svg`);
const adminJs = fs.readFileSync(`${SRC}/server/public/admin/admin.js`, 'utf8')
  .replaceAll("'/shared/", "'../shared/")
  .replaceAll('`/player/?', '`../player/?')
  .replaceAll("'/player/?", "'../player/?");
if (/['`]\/(shared|player)\//.test(adminJs)) throw new Error('admin.js: maradt abszolút útvonal');
fs.writeFileSync(`${OUT}/admin/admin.js`, adminJs);
let adminHtml = fs.readFileSync(`${SRC}/server/public/admin/index.html`, 'utf8')
  .replaceAll('"/shared/', '"../shared/')
  .replace('"/admin/admin.css"', '"admin.css"')
  .replace('"/admin/admin.js"', '"admin.js"')
  .replace('<script src="/api/lang.js"></script>', '<script src="../shared/demo-store.js"></script>\n  <script src="shim.js"></script>');
if (!adminHtml.includes('shim.js') || adminHtml.includes('"/')) throw new Error('admin index.html szerkezete megváltozott');
fs.writeFileSync(`${OUT}/admin/index.html`, adminHtml);

// 2. minta konfiguráció nyelvenként egy friss tesztszerverről
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ha a port foglalt, egy másik (pl. teszt) szerverhez csatlakoznánk → inkább leállunk
if (await fetch(`http://127.0.0.1:${PORT}/api/auth/state`).then(() => true, () => false)) throw new Error(`A ${PORT}-es port foglalt – állítsd le az ott futó szervert`);
for (const lang of ['en', 'hu']) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'signage-demo-'));
  const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], {
    cwd: `${SRC}/server`, env: { ...process.env, PORT: String(PORT), SIGNAGE_DATA: data }, stdio: 'ignore',
  });
  try {
    const base = `http://127.0.0.1:${PORT}`;
    for (let i = 0; i < 50; i++) { try { await fetch(`${base}/api/auth/state`); break; } catch { await sleep(200); } }
    const setup = await fetch(`${base}/api/auth/setup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ username: 'demo', password: 'demo-build-1234', org_name: 'Narancs Café', language: lang }),
    });
    if (!setup.ok) throw new Error(`setup ${setup.status}: ${await setup.text()}`);
    const cookie = setup.headers.get('set-cookie').split(';')[0];
    const call = async (method, p, body) => {
      const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: base, 'X-Signage': '1' }, body: body && JSON.stringify(body) });
      if (!r.ok) throw new Error(`${method} ${p} ${r.status}: ${await r.text()}`);
      return r.json();
    };
    // osztott képernyő minta: fő területen a hirdetmény és a kártyák, oldalsávon az óra – a lista második eleme
    const zones = await call('POST', '/api/slides', { name: lang === 'hu' ? 'Osztott képernyő' : 'Split screen', type: 'zones', duration: 20,
      data: { layout: 'right', size: 32, gap: true, zones: [{ items: [{ slide_id: 3 }, { slide_id: 1 }], transition: 'fade' }, { items: [{ slide_id: 2 }], transition: 'fade' }] } });
    const pl = await call('GET', '/api/playlists/1');
    pl.items.splice(1, 0, { slide_id: zones.id, duration: null, enabled: true, valid_from: null, valid_to: null });
    await call('PUT', '/api/playlists/1', pl);
    const res = await fetch(`${base}/api/preview?playlist=1`, { headers: { Cookie: cookie } });
    if (!res.ok) throw new Error(`preview ${res.status}`);
    const cfg = await res.json();
    cfg.captured = new Date().toISOString();
    cfg.screen.settings = { ...cfg.screen.settings, ticker: TICKER[lang] };
    fs.writeFileSync(`${OUT}/player/config-${lang}.json`, JSON.stringify(cfg));
    console.log(`✔ config-${lang}.json: ${Object.keys(cfg.slides).length} slides`);

    // admin bemutató: két párosított minta kijelző, statisztika és beküldött űrlapok, majd az admin adatai
    const SCREENS = lang === 'hu' ? ['Előtér', 'Kávézó'] : ['Lobby', 'Café'];
    const slides = Object.values(cfg.slides);
    for (const [i, name] of SCREENS.entries()) {
      const device = `demo-device-${i + 1}-0000`;
      const hello = await call('POST', '/api/player/hello', { device, info: { w: 1920, h: 1080, ua: 'Chromium 140 (demo)' } });
      await call('POST', '/api/screens/pair', { code: hello.code, name, playlist_id: 1 });
      const stats = Array.from({ length: 160 }, (_, k) => ({ kind: k % 4 ? 'view' : 'touch', slide_id: slides[k % slides.length].id, t: Date.now() - (k * 37 % 168) * 3600e3 }));
      await call('POST', '/api/player/heartbeat', { device, stats, current: { id: slides[i].id, name: slides[i].name, type: slides[i].type }, info: { w: 1920, h: 1080 } });
    }
    const form = Object.values(cfg.forms)[0];
    for (const [overall, liked] of [[5, 0], [4, 1], [5, 2], [3, 0]]) {
      await call('POST', `/api/player/forms/${form.id}`, { device: 'demo-device-1-0000', data: { overall: String(overall), liked: form.fields[1].options[liked], comment: '' } });
    }
    const snap = { lang, captured: cfg.captured };
    for (const [k, p] of Object.entries({
      state: '/api/auth/state', settings: '/api/settings', dashboard: '/api/dashboard', screens: '/api/screens',
      slides: '/api/slides', playlists: '/api/playlists', calendars: '/api/calendars', events: '/api/events',
      forms: '/api/forms', media: '/api/media', alerts: '/api/alerts', users: '/api/users', tokens: '/api/tokens', reports: '/api/reports',
    })) snap[k] = await call('GET', p);
    snap.submissions = { [form.id]: await call('GET', `/api/forms/${form.id}/submissions`) };
    delete snap.settings.data_dir;
    fs.writeFileSync(`${OUT}/shared/admin-${lang}.json`, JSON.stringify(snap));
    console.log(`✔ admin-${lang}.json`);
  } finally {
    srv.kill();
    await sleep(300);
    fs.rmSync(data, { recursive: true, force: true });
  }
}
