# Motorsport Calendar

Calendario settimanale dei principali campionati motorsport con orari convertiti automaticamente nel tuo fuso orario.

**Sito live:** https://luk3luca.github.io/motorsport-calendar/

## Serie coperte

| Serie | Fonte dati | Copertura |
|---|---|---|
| Formula 1, Formula E, NASCAR (Cup), IMSA, WEC | [TheSportsDB](https://www.thesportsdb.com) | Tutte le sessioni (si aggiorna da sola man mano che i round si avvicinano) |
| F2, F3 | Siti ufficiali FIA (`fiaformula2.com`, `fiaformula3.com`) | Practice, Qualifying, Sprint, Feature — orari completi |
| F1 Academy | Scraper `f1academy.com` | Orari ISO con fuso incluso |
| MotoGP, Moto2, Moto3 | Scraper Playwright su `motogp.com` | ~20-25 sessioni per round, orari locali del tracciato |
| IndyCar | Scraper HTML server-rendered da `indycar.com` | Sessioni in ET |
| DTM | Scraper Playwright su `dtm.com` | Timetable degli eventi (~2 settimane prima del weekend) |

## Funzionalità

- **Vista settimana / giorno** con blocchi sessione posizionati sulla griglia oraria
- **Fuso orario personalizzabile**: offset fisso o rilevamento automatico della zona locale
- **Gestione DST corretta**: conversioni tramite dayjs + database IANA (nessun offset manuale)
- **Orari stimati marcati**: start non confermati → `TBC`, fine stimata → `~HH:mm`
- **Filtro serie** con conteggi in tempo reale sul periodo visibile
- Tema chiaro/scuro, layout responsive con drawer mobile

## Stack

- Next.js (App Router) + React 19, export statico per GitHub Pages
- TypeScript, Tailwind CSS v4, dayjs (plugin utc/timezone)
- Playwright per gli scraper client-side-rendered

## Sviluppo locale

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # build statico in out/
```

## Pipeline dati

Il file `data/calendar-2026.json` è la singola fonte di verità importata a compile time. Viene rigenerato dalla pipeline completa:

```bash
# 1. TheSportsDB — finestra limitata (NON usare senza WINDOW_END: default = fine anno, ~80 min)
WINDOW_END=2026-10-05 npx tsx scripts/fetch-calendar.ts

# 2. Scraper dedicati
npx tsx scripts/scrape-motogp-all.ts     # → data/motogp-schedule.json
npx tsx scripts/scrape-f1academy.ts      # → data/f1academy-schedule.json
npx tsx scripts/scrape-indycar.ts        # → data/indycar-schedule.json
npx tsx scripts/scrape-dtm.ts            # → data/dtm-schedule.json

# 3. Merge nel calendario principale
npx tsx scripts/merge-motogp.ts
npx tsx scripts/merge-extra-series.ts    # F1 Academy + IndyCar + DTM
```

## Aggiornamento automatico

Il workflow [`.github/workflows/update.yml`](.github/workflows/update.yml) gira ogni **lunedì alle 06:00 (ora italiana)**:

1. Fetch TheSportsDB con finestra di **8 settimane** da oggi (mai fino a fine anno)
2. Esecuzione di tutti gli scraper (un eventuale fallimento non blocca il deploy: si tengono i dati precedenti)
3. Merge nel JSON principale + commit automatico (`[bot] weekly data update`)
4. Build statico e deploy su GitHub Pages

Rilancio manuale: tab **Actions** → *Weekly data update + deploy* → **Run workflow**, oppure:

```bash
gh workflow run "Weekly data update + deploy"
```

## Note tecniche

- Le conversioni orarie passano tutte da [`src/lib/sources/venue-tz.ts`](src/lib/sources/venue-tz.ts): mapping circuito → fuso IANA con match longest-first
- `isEstimatedStart/isEstimatedEnd` distinguono orari ufficiali da quelli derivati (durate tipiche per serie/sessione in [`src/lib/sources/durations.ts`](src/lib/sources/durations.ts))
- Chiave TheSportsDB: la chiave pubblica gratuita `"123"` (placeholder documentato, nessun segreto nel repo)
