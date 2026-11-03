# GDG on Campus – University of Duisburg-Essen

Statische Website (HTML/CSS/JS, kein Build-Schritt) mit automatisch synchronisierten Events von
[gdg.community.dev](https://gdg.community.dev/gdg-on-campus-university-of-duisburg-essen-essen-germany/).

## So bleiben die Events aktuell

1. **Live im Browser:** `app.js` lädt bei jedem Seitenaufruf Events, Team und Mitgliederzahl direkt aus der
   öffentlichen API von gdg.community.dev (`/api/event_slim/for_chapter/3426/`, `/api/event/<id>/`,
   `/api/chapter_slim/<slug>/team/`). Die API erlaubt CORS (`Access-Control-Allow-Origin: *`).
   Ein neues Event, das dort veröffentlicht wird, steht also sofort auch hier.
2. **Snapshot als Fallback:** `data/gdg.json` wird zuerst angezeigt (schneller erster Seitenaufbau) und
   genutzt, falls die API mal nicht erreichbar ist.
3. **Automatisches Update & Deploy:** `.github/workflows/deploy.yml` läuft bei jedem Push und alle 6 Stunden, führt
   `scripts/update-events.mjs` aus, committet den Snapshot nur bei Änderungen und veröffentlicht die Seite auf GitHub Pages.

Browser und Node nutzen denselben Loader: `lib/gdg.js`.

## Lokal starten

```bash
npm run update   # Snapshot neu ziehen (Node ≥ 20)
npm run dev      # http://localhost:5173
```

## Deployment

Funktioniert auf jedem Static Host (GitHub Pages, Vercel, Netlify). Mit GitHub Pages + der Action
ist alles kostenlos und wartungsfrei.

## Credits

Hero-Foto: Campus Essen, Schützenbahn – Arne Rensing / UDE, CC BY-SA 4.0 (Wikimedia Commons).
