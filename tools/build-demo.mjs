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
for (const f of ['i18n.js', 'themes.js', 'splash/logo.svg', 'splash/logo-color.svg']) copy(`${SRC}/server/public/shared/${f}`, `${OUT}/shared/${f}`);
let html = fs.readFileSync(`${SRC}/server/public/player/index.html`, 'utf8')
  .replaceAll('"/shared/', '"../shared/')
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace('<script src="../shared/i18n.js">', '<script src="shim.js"></script>\n  <script src="../shared/i18n.js">');
if (!html.includes('shim.js')) throw new Error('index.html szerkezete megváltozott');
fs.writeFileSync(`${OUT}/player/index.html`, html);

// 2. minta konfiguráció nyelvenként egy friss tesztszerverről
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
    const res = await fetch(`${base}/api/preview?playlist=1`, { headers: { Cookie: cookie } });
    if (!res.ok) throw new Error(`preview ${res.status}`);
    const cfg = await res.json();
    cfg.captured = new Date().toISOString();
    cfg.screen.settings = { ...cfg.screen.settings, ticker: TICKER[lang] };
    fs.writeFileSync(`${OUT}/player/config-${lang}.json`, JSON.stringify(cfg));
    console.log(`✔ config-${lang}.json: ${Object.keys(cfg.slides).length} slides`);
  } finally {
    srv.kill();
    await sleep(300);
    fs.rmSync(data, { recursive: true, force: true });
  }
}
