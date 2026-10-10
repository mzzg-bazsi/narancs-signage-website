/* Narancs Signage sablongaléria (weboldal): az index.json alapján minden sablon egy mini kijelző, ami végiglapozza a saját diáit.
   A beküldött sablonok szövege megbízhatatlan: csak textContent-ként kerül az oldalra. */
'use strict';

const CATS = { food: ['Food & drink', 'Vendéglátás'], office: ['Office', 'Iroda'], retail: ['Retail', 'Kereskedelem'], health: ['Health & beauty', 'Egészség, szépség'], education: ['Education', 'Oktatás'], hospitality: ['Hotels', 'Szálláshely'], sport: ['Sport', 'Sport'], events: ['Events', 'Rendezvény'], other: ['Other', 'Egyéb'] };
const ACCENT = { food: '#f08a4b', office: '#6fa8e6', retail: '#ec6f95', health: '#4fc0a6', education: '#f2c14e', hospitality: '#b893f2', sport: '#86d46f', events: '#ff7d5c', other: '#e9a77d' };
const TYPE_ICON = { image: '🖼️', video: '🎬', web: '🌐', rss: '📰', weather: '🌤️', youtube: '▶️', calendar: '📅', countdown: '⏳', menu: '👆', form: '✍️', qr: '🔳', clock: '🕒' };

const lang = window.SITE_LANG || 'en';
const BASE = 'https://mzzg-bazsi.github.io/narancs-signage-templates/';
const t = (s, v = {}) => window.t(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const loc = (v) => (v && typeof v === 'object' ? v[lang] ?? v.en ?? Object.values(v)[0] ?? '' : v ?? '');
const fill = (s) => String(s).replace(/\{\{org_name\}\}/g, t('Your Business')).replace(/\{\{city\}\}/g, 'Budapest')
  .replace(/\{\{date([+-]\d+)?\}\}/g, (_, n) => new Date(Date.now() + (+n || 0) * 864e5).toLocaleDateString(lang, { month: 'long', day: 'numeric' }));
const text = (v) => fill(loc(v));

// elem létrehozása: a szöveg mindig textContent
function h(tag, cls, kids) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const k of [].concat(kids ?? [])) if (k != null && k !== '') el.append(k instanceof Node ? k : String(k));
  return el;
}

// determinisztikus „QR” minta (csak illusztráció)
function qr(seed) {
  let x = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), cells = '';
  const finder = (r, c) => [[0, 0], [0, 14], [14, 0]].some(([a, b]) => r >= a && r < a + 7 && c >= b && c < b + 7);
  for (let r = 0; r < 21; r++) for (let c = 0; c < 21; c++) {
    x = (x * 1103515245 + 12345) >>> 0;
    const fr = [[0, 0], [0, 14], [14, 0]].find(([a, b]) => r >= a && r < a + 7 && c >= b && c < b + 7);
    const on = fr ? (() => { const i = r - fr[0], j = c - fr[1]; return i === 0 || i === 6 || j === 0 || j === 6 || (i > 1 && i < 5 && j > 1 && j < 5); })() : !finder(r, c) && (x >> 16) & 1;
    if (on) cells += `M${c} ${r}h1v1h-1z`;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 21 21'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', cells); p.setAttribute('fill', '#2a1a10');
  svg.append(p);
  return svg;
}

// egy dia mini képe a típusa szerint
function slide(tpl, ref, depth = 0) {
  const s = tpl.screens?.[ref];
  if (!s) return h('div', 'slide center', h('div', 'icon', '📺'));
  const title = text(s.title || s.name);
  switch (s.type) {
    case 'text': return h('div', 'slide', [s.kicker && h('div', 'k', text(s.kicker)), h('div', 'h', title), s.body && h('div', 'b', text(s.body))]);
    case 'cards': case 'menu': {
      const tiles = h('div', 'tiles', s.items.slice(0, s.type === 'menu' ? 3 : 4).map((c) => h('div', '', [h('i', '', c.icon), text(c.title)])));
      tiles.style.setProperty('--n', Math.min(s.items.length || 1, s.type === 'menu' ? 3 : 4));
      return h('div', 'slide', [h('div', 'h', title), tiles]);
    }
    case 'clock': {
      const d = new Date();
      return h('div', 'slide center', [h('div', 'big', d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })), h('div', 'b', d.toLocaleDateString(lang, { weekday: 'long', month: 'long', day: 'numeric' })), s.title && h('div', 'k', title)]);
    }
    case 'calendar': return h('div', 'slide', [h('div', 'h', title), h('div', 'rows', ['09:00', '11:30', '14:00'].map((tm, i) => h('div', '', [h('b', '', tm), Object.assign(h('span'), { style: `max-width:${80 - i * 18}%` })])))]);
    case 'countdown': return h('div', 'slide center', [h('div', 'k', title), h('div', 'g-digits', ['02', '14', '37'].map((n) => h('b', '', n)))]);
    case 'qr': return h('div', 'slide qr', [qr(ref + tpl.id), h('div', '', [h('div', 'h', title), s.body && h('div', 'b', text(s.body))])]);
    case 'form': return h('div', 'slide', [h('div', 'h', title), h('div', 'g-field'), h('div', 'g-field'), h('div', 'send', '✓')]);
    case 'zones': {
      if (depth) break;
      const L = window.SIGNAGE_ZONES, box = h('div', 'zones');
      Object.assign(box.style, L ? L.gridStyle(s.layout, s.size) : { gridTemplateColumns: '1fr 1fr' });
      (s.zones || []).forEach((r, i) => { const z = h('div', '', slide(tpl, r, depth + 1)); z.style.gridArea = L?.AREAS[i] || 'auto'; box.append(z); });
      return box;
    }
  }
  return h('div', 'slide center', [h('div', 'icon', TYPE_ICON[s.type] || '📺'), h('div', 'k', title)]);
}

// egy sablon kártyája: kijelző, pöttyök (diák), adatok, letöltés
function card(tpl) {
  const refs = tpl.playlist?.length ? tpl.playlist : Object.keys(tpl.screens || {});
  let pos = Math.max(0, refs.indexOf(tpl.preview)), timer = null;
  const screen = h('div', 'screen'), dots = h('div', 'dots');
  const show = (i) => {
    pos = (i + refs.length) % refs.length;
    screen.replaceChildren(slide(tpl, refs[pos]));
    [...dots.children].forEach((d, j) => d.setAttribute('aria-current', j === pos));
  };
  refs.forEach((r, i) => {
    const b = h('button');
    b.type = 'button';
    b.setAttribute('aria-label', t('Slide {n}: {name}', { n: i + 1, name: text(tpl.screens?.[r]?.name || '') }));
    b.onclick = () => { stop(); show(i); };
    dots.append(b);
  });
  const stop = () => { clearInterval(timer); timer = null; };
  const play = () => { if (!timer && refs.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => show(pos + 1), 1600); };

  const tv = h('div', 'g-tv', [h('div', 'bezel', screen), h('div', 'stand'), h('div', 'foot-bar'), dots]);
  tv.style.setProperty('--accent', ACCENT[tpl.category] || ACCENT.other);
  const li = h('li', 'tpl');
  li.addEventListener('mouseenter', play); li.addEventListener('mouseleave', stop);

  const langs = h('span', 'langs', ['en', 'hu'].map((l) => {
    const a = h('abbr', tpl.languages?.includes(l) ? '' : 'off', l.toUpperCase());
    a.title = tpl.languages?.includes(l) ? { en: 'English', hu: 'Magyar' }[l] : t('Not available in this language');
    return a;
  }));
  const counts = [t('{n} slides', { n: tpl.slides }), tpl.forms && (tpl.forms === 1 ? t('1 form') : t('{n} forms', { n: tpl.forms })), tpl.calendars && (tpl.calendars === 1 ? t('1 calendar') : t('{n} calendars', { n: tpl.calendars }))].filter(Boolean).join(', ');
  const dl = h('a', 'btn', t('Download'));
  dl.href = new URL(tpl.file, BASE).href; dl.setAttribute('download', `${tpl.id}.narancs.json`);
  li.append(tv, h('div', 'info', [
    h('h3', '', [h('span', '', tpl.icon), h('span', '', text(tpl.name))]),
    tpl.description && h('p', 'desc', text(tpl.description)),
    h('p', 'facts', [h('span', '', counts), langs, tpl.author && h('span', '', t('by {a}', { a: tpl.author }))]),
    h('div', 'actions', [dl, h('small', '', tpl.license === 'CC-BY-4.0' ? 'CC BY 4.0' : 'CC0')]),
  ]));
  show(pos);
  return { li, tpl };
}

let all = [], cat = 'all';
const $ = (id) => document.getElementById(id);

function render() {
  if (!all.length) return;
  const counts = all.reduce((m, x) => ((m[x.category] = (m[x.category] || 0) + 1), m), {});
  $('cats').replaceChildren(...['all', ...Object.keys(CATS).filter((c) => counts[c])].map((c) => {
    const b = h('button', '', [c === 'all' ? t('All') : CATS[c][lang === 'hu' ? 1 : 0], h('small', '', c === 'all' ? all.length : counts[c])]);
    b.type = 'button'; b.setAttribute('aria-pressed', c === cat);
    b.onclick = () => { cat = c; render(); };
    return b;
  }));
  const q = $('q').value.trim().toLowerCase();
  const shown = all.filter((x) => (cat === 'all' || x.category === cat) && (!q || [x.name, x.description].flatMap((v) => (v && typeof v === 'object' ? Object.values(v) : [v])).join(' ').toLowerCase().includes(q)));
  $('wall').replaceChildren(...shown.map((x) => card(x).li));
  $('status').textContent = shown.length ? '' : t('No templates match.');
}

$('q').placeholder = t('Search');
$('q').addEventListener('input', render);
render();
fetch(`${BASE}index.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((d) => { all = d.templates || []; render(); })
  .catch(() => { $('status').textContent = t('The gallery could not be loaded. Refresh the page to try again.'); });
