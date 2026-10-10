/* Bemutató adattár: az admin minta adatai (a build-demo.mjs menti egy tesztszerverről),
   a módosítások csak ebben a böngészőben, a localStorage-ban maradnak. Az admin és a lejátszó közösen használja. */
(() => {
  const KEY = 'narancs-demo-admin';
  const base = new URL('.', document.currentScript.src).href;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const param = new URLSearchParams(location.search).get('lang');
  const lang = ['en', 'hu'].includes(param) ? param : read()?.lang || 'en';
  window.SIGNAGE_LANG = lang;

  const DAY = 864e5;
  const pad = (n) => String(n).padStart(2, '0');
  // a mentés óta eltelt napokkal tolja el az eseményeket, a visszaszámlálás a következő újév
  function prepare(d) {
    const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((midnight(new Date()) - midnight(new Date(d.captured))) / DAY);
    const shift = (v) => {
      if (!v) return v;
      if (/^\d{4}-\d\d-\d\d$/.test(v)) { const [y, m, dd] = v.split('-').map(Number); const t = new Date(y, m - 1, dd + days); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; }
      const t = Date.parse(v);
      return Number.isNaN(t) ? v : new Date(t + days * DAY).toISOString();
    };
    for (const e of d.events) { e.start = shift(e.start); e.end = shift(e.end); }
    for (const s of d.slides) if (s.type === 'countdown') s.data.target = `${new Date().getFullYear() + 1}-01-01T00:00`;
    return d;
  }

  let data = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* tele vagy privát mód */ } };
  let loading = null;
  window.DemoStore = {
    lang,
    get data() { return data; },
    // lusta betöltés: a mentett állapot, ha ugyanazon a nyelven van, különben a friss minta adat
    load() {
      return (loading ||= (async () => {
        // a mentett állapot csak ugyanarra a nyelvre és ugyanarra a minta-kiadásra érvényes (új demó → friss adatok)
        const saved = read();
        const fresh = await (await fetch(`${base}admin-${lang}.json`)).json();
        data = saved?.lang === lang && saved.captured === fresh.captured ? saved : prepare(fresh);
        save();
        return data;
      })());
    },
    save,
    reset() { try { localStorage.removeItem(KEY); } catch { /* */ } },
  };
})();
