/* Narancs Signage bemutató – az öt lépéses interaktív ablak */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const steps = $$('.step'), panes = $$('.pane');
  const state = { step: 0, install: 0, paired: false, alert: false };


  function go(i) {
    state.step = i;
    steps.forEach((b, j) => { b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; b.classList.toggle('done', j < i); });
    panes.forEach((p, j) => p.classList.toggle('active', j === i));
    if (i === 0 && state.install < 1 && !installTimer) runInstall();
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
    [0, t('➜ Installing the graphical environment (X11)…')],
    [0.25, t('➜ Installing Chromium…')],
    [0.5, '✔ Chromium: /snap/bin/chromium'],
    [0.62, t('✔ Remote agent installed (restart from the admin panel)')],
    [0.74, t('➜ Setting up the boot screen…')],
    [0.9, t('✔ Quiet boot with boot screen configured (GRUB)')],
    [1, t('✔ Player installed! Restart the device to see the pairing code.')],
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
      if (i === cells.length - 1) setTimeout(() => { $('#pairOk').hidden = false; state.paired = true; btn.textContent = t('Paired'); }, 350);
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
  const BLOCKS = [[6, 7, null], [7, 11, t('Breakfast menu')], [11, 14, t('Lunch specials')], [14, 20, t('Events & calendar')], [20, 22, null]];
  const tl = $('#timeline'), blkEls = $$('.blk', tl);
  Object.assign(tl, { tabIndex: 0 });
  tl.setAttribute('role', 'slider'); tl.setAttribute('aria-label', 'Time of day'); tl.setAttribute('aria-valuemin', 6); tl.setAttribute('aria-valuemax', 22);
  let hour = 12.25;
  function setHour(h) {
    hour = Math.max(6, Math.min(21.99, h));
    $('#needle').style.left = ((hour - 6) / 16 * 100) + '%';
    const i = BLOCKS.findIndex(([a, b]) => hour >= a && hour < b);
    blkEls.forEach((el, j) => el.classList.toggle('now', j === i && BLOCKS[i][2]));
    const hm = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor(hour % 1 * 4) * 15).padStart(2, '0')}`;
    $('#nowPlaying').textContent = BLOCKS[i][2] ? `${hm} · ${t('Now playing:')} ${BLOCKS[i][2]}` : `${hm} · ${t('Screen off — monitor in standby (DPMS)')}`;
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
    e.currentTarget.textContent = state.alert ? t('Clear alert') : t('Send emergency alert');
  });

  go(0);

  // Képernyőkép fülek
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => {
    $$('.tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
    $$('.gallery').forEach((g) => { g.hidden = g.dataset.panel !== b.dataset.tab; });
  }));

  // Képnézegető: a galéria képei nagyítva, léptethetők (nyilak, gombok, húzás)
  const lb = $('#lightbox');
  let lbItems = [], lbIdx = 0;
  function lbShow(i) {
    lbIdx = (i + lbItems.length) % lbItems.length;
    const a = lbItems[lbIdx];
    $('#lbImg').src = a.href; $('#lbImg').alt = a.querySelector('img').alt;
    $('#lbCap').textContent = a.nextElementSibling.textContent;
    $('#lbNum').textContent = `${lbIdx + 1} / ${lbItems.length}`;
  }
  $$('.gallery a').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    lbItems = $$('a', a.closest('.gallery'));
    lbShow(lbItems.indexOf(a));
    lb.showModal();
  }));
  $('#lbPrev').addEventListener('click', () => lbShow(lbIdx - 1));
  $('#lbNext').addEventListener('click', () => lbShow(lbIdx + 1));
  $('#lbClose').addEventListener('click', () => lb.close());
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.tagName === 'FIGURE') lb.close(); });
  lb.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (d) { e.preventDefault(); lbShow(lbIdx + d); }
  });
  let swipeX = null;
  lb.addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
  lb.addEventListener('pointerup', (e) => {
    if (swipeX !== null && Math.abs(e.clientX - swipeX) > 50) lbShow(lbIdx + (e.clientX < swipeX ? 1 : -1));
    swipeX = null;
  });

  // Parancsok másolása
  $$('.copy').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.previousElementSibling.textContent); b.textContent = t('Copied'); }
    catch { b.textContent = t('Select & copy'); }
    setTimeout(() => { b.textContent = t('Copy'); }, 1600);
  }));
})();
