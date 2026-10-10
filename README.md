# Narancs Signage – website

The showcase site of [Narancs Signage](https://github.com/mzzg-bazsi/narancs-signage), a self-hosted digital signage system. English and Hungarian (`?lang=hu`, or the EN/HU switch).

Plain static HTML/CSS/JS, no build step: open `index.html` or serve the folder. Published with GitHub Pages from `main`.

- `index.html` – landing page with the five-step interactive demo
- `demo/` – the **real player** running in the browser: `demo/player/shim.js` answers its API calls (sample config with dates shifted to today, live weather from Open-Meteo)
- `i18n.js` – translations (key = English text)

**Updating the live demo** after player changes (starts a throwaway server on port 8199, needs Node ≥ 22.13):

```bash
node tools/build-demo.mjs ../signage
```

© 2026 Balázs Mazzag – [Narancs Signage License](LICENSE)
