/* Narancs Signage bemutató – az öt lépéses interaktív ablak és a kijelzőfal */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const steps = $$('.step'), panes = $$('.pane');
  const state = { step: 0, install: 0, paired: false, alert: false };

  // Kijelzőfal: minden pont egy kijelző, fix véletlen értékkel (r), ebből és a lépésből jön az állapota
  const dotsEl = $('#dots');
  const dots = Array.from({ length: 144 }, (_, i) => {
    const el = document.createElement('i');
    const r = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    el.style.transitionDelay = (r * 0.6).toFixed(2) + 's';
    dotsEl.append(el);
    return { el, r };
  });
  function dotState(r) {
    const s = state.step;
    if (s === 0) return r < 0.1 + 0.2 * state.install ? 'pend' : 'off';
    if (s === 1) { const p = state.paired ? 0.4 : 0.28; return r < p ? 'pair' : r < p + 0.08 ? 'pend' : 'off'; }
    if (s === 2) return r < 0.6 ? 'pair' : r < 0.66 ? 'pend' : 'off';
    if (s === 3) return r < 0.3 ? 'play' : r < 0.75 ? 'pair' : r < 0.8 ? 'pend' : 'off';
    return r < 0.88 ? (state.alert ? 'alert' : 'play') : 'off';
  }
  const paintDots = () => dots.forEach((d) => { d.el.className = 's-' + dotState(d.r); });
  // érintések a lejátszás lépésben
  setInterval(() => {
    if (state.step !== 4 || state.alert) return;
    const d = dots[Math.floor(Math.random() * dots.length)];
    if (d.el.className !== 's-play') return;
    d.el.className = 's-touch';
    setTimeout(() => { if (d.el.className === 's-touch') d.el.className = 's-' + dotState(d.r); }, 700);
  }, 260);

  function go(i) {
    state.step = i;
    steps.forEach((b, j) => { b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; b.classList.toggle('done', j < i); });
    panes.forEach((p, j) => p.classList.toggle('active', j === i));
    if (i === 0 && state.install < 1 && !installTimer) runInstall();
    paintDots();
  }
  steps.forEach((b, i) => b.addEventListener('click', () => go(i)));
  $('.steps').addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    const n = (state.step + d + steps.length) % steps.length;
    go(n); steps[n].focus();
  });
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(+b.dataset.go)));

  // 1. Telepítés – a valódi telepítő üzeneteivel
  const ticks = Array.from({ length: 56 }, () => $('#ticks').appendChild(document.createElement('i')));
  const MSGS = [
    [0, '➜ Installing the graphical environment (X11)…'],
    [0.25, '➜ Installing Chromium…'],
    [0.5, '✔ Chromium: /snap/bin/chromium'],
    [0.62, '✔ Remote agent installed (restart from the admin panel)'],
    [0.74, '➜ Setting up the boot screen…'],
    [0.9, '✔ Quiet boot with boot screen configured (GRUB)'],
    [1, '✔ Player installed! Restart the device to see the pairing code.'],
  ];
  let installTimer = null;
  function runInstall() {
    clearInterval(installTimer);
    state.install = 0;
    installTimer = setInterval(() => {
      state.install = Math.min(1, state.install + Math.random() * 0.028);
      const on = Math.round(state.install * ticks.length);
      ticks.forEach((t, i) => t.classList.toggle('on', i < on));
      $('#instStatus').textContent = MSGS.filter(([p]) => p <= state.install).pop()[1];
      if (state.install >= 1) { clearInterval(installTimer); installTimer = null; }
      if (state.step === 0) paintDots();
    }, 110);
  }
  $('#instRun').addEventListener('click', runInstall);

  // 2. Párosítás – a kód begépelése számjegyenként
  $('#pairBtn').addEventListener('click', (e) => {
    const btn = e.currentTarget, code = $('#pairCode').textContent.replace(/\D/g, '');
    const cells = $$('#digits span');
    btn.disabled = true;
    cells.forEach((c, i) => setTimeout(() => {
      c.textContent = code[i]; c.classList.add('on');
      if (i === cells.length - 1) setTimeout(() => { $('#pairOk').hidden = false; state.paired = true; btn.textContent = 'Paired'; paintDots(); }, 350);
    }, 140 * (i + 1)));
  });

  // 3. Tartalomtípusok előnézete
  $('#types').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('#types button').forEach((x) => x.classList.toggle('on', x === b));
    $('#typeImg').src = `assets/shots/${b.dataset.img}.png`;
  });

  // 4. Ütemezés – húzható idővonal 06–22 óra között
  const BLOCKS = [[6, 7, null], [7, 11, 'Breakfast menu'], [11, 14, 'Lunch specials'], [14, 20, 'Events & calendar'], [20, 22, null]];
  const tl = $('#timeline'), blkEls = $$('.blk', tl);
  Object.assign(tl, { tabIndex: 0 });
  tl.setAttribute('role', 'slider'); tl.setAttribute('aria-label', 'Time of day'); tl.setAttribute('aria-valuemin', 6); tl.setAttribute('aria-valuemax', 22);
  let hour = 12.25;
  function setHour(h) {
    hour = Math.max(6, Math.min(21.99, h));
    $('#needle').style.left = ((hour - 6) / 16 * 100) + '%';
    const i = BLOCKS.findIndex(([a, b]) => hour >= a && hour < b);
    blkEls.forEach((el, j) => el.classList.toggle('now', j === i && BLOCKS[i][2]));
    const t = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor(hour % 1 * 4) * 15).padStart(2, '0')}`;
    $('#nowPlaying').textContent = BLOCKS[i][2] ? `${t} · Now playing: ${BLOCKS[i][2]}` : `${t} · Screen off — monitor in standby (DPMS)`;
    tl.setAttribute('aria-valuenow', hour.toFixed(2)); tl.setAttribute('aria-valuetext', $('#nowPlaying').textContent);
  }
  const fromPointer = (e) => { const b = tl.getBoundingClientRect(); setHour(6 + (e.clientX - b.left) / b.width * 16); };
  tl.addEventListener('pointerdown', (e) => { tl.setPointerCapture(e.pointerId); fromPointer(e); });
  tl.addEventListener('pointermove', (e) => { if (tl.hasPointerCapture(e.pointerId)) fromPointer(e); });
  tl.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 0.25, ArrowLeft: -0.25 }[e.key];
    if (d) { e.preventDefault(); setHour(hour + d); }
  });
  setHour(hour);

  // 5. Lejátszás – váltakozó diák és vészriasztás
  const slides = $$('#player > img');
  let cur = 0;
  const next = () => { slides[cur].classList.remove('on'); cur = (cur + 1) % slides.length; slides[cur].classList.add('on'); };
  setInterval(() => { if (state.step === 4 && !state.alert) next(); }, 3200);
  $('#nextSlide').addEventListener('click', next);
  $('#alertBtn').addEventListener('click', (e) => {
    state.alert = !state.alert;
    $('#alert').hidden = !state.alert;
    e.currentTarget.textContent = state.alert ? 'Clear alert' : 'Send emergency alert';
    paintDots();
  });

  go(0);

  // Képernyőkép fülek
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => {
    $$('.tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
    $$('.gallery').forEach((g) => { g.hidden = g.dataset.panel !== b.dataset.tab; });
  }));

  // Parancsok másolása
  $$('.copy').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.previousElementSibling.textContent); b.textContent = 'Copied'; }
    catch { b.textContent = 'Select & copy'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1600);
  }));
})();
