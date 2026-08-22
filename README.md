# Motorsport Calendar

Weekly calendar of the major motorsport championships, with session times automatically converted to your timezone.

**Live site:** https://luk3luca.github.io/motorsport-calendar/

## Covered series

| Series | Data source | Coverage |
|---|---|---|
| Formula 1, Formula E, NASCAR (Cup), IMSA, WEC | [TheSportsDB](https://www.thesportsdb.com) | All sessions (self-updates as rounds approach) |
| F2, F3 | Official FIA sites (`fiaformula2.com`, `fiaformula3.com`) | Practice, Qualifying, Sprint, Feature — complete times |
| F1 Academy | `f1academy.com` scraper | ISO times with timezone offset included |
| MotoGP, Moto2, Moto3 | Playwright scraper on `motogp.com` | ~20-25 sessions per round, track local time |
| IndyCar | Server-rendered HTML scraper on `indycar.com` | Session times in ET |
| DTM | Playwright scraper on `dtm.com` | Event timetables (~2 weeks before each weekend) |

## Features

- **Week / day views** with session blocks positioned on an hourly grid
- **Customizable timezone**: fixed UTC offset or automatic browser-local detection
- **Correct DST handling**: conversions via dayjs + IANA database (no manual offset arithmetic)
- **Estimated times are marked**: unconfirmed starts → `TBC`, estimated ends → `~HH:mm`
- **Series filters** with live counts for the visible period
- Light/dark theme, responsive layout with mobile drawer
- Sessions belong to the week they *start* in — a race finishing after midnight shows its tail in a spill column but never reappears in the next week

## Stack

- Next.js (App Router) + React 19, static export for GitHub Pages
- TypeScript, Tailwind CSS v4, dayjs (utc/timezone plugins)
- Playwright for client-side-rendered scrapers

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static build in out/
```

## Data pipeline

`data/calendar-2026.json` is the single source of truth, imported at compile time. The full refresh pipeline:

```bash
# 1. TheSportsDB — bounded window into a SEPARATE file (never write the main JSON directly)
WINDOW_END=2026-10-05 OUTPUT_PATH=tsd-window.json npx tsx scripts/fetch-calendar.ts

# 2. Dedicated scrapers
npx tsx scripts/scrape-motogp-all.ts     # → data/motogp-schedule.json
npx tsx scripts/scrape-f1academy.ts      # → data/f1academy-schedule.json
npx tsx scripts/scrape-indycar.ts        # → data/indycar-schedule.json
npx tsx scripts/scrape-dtm.ts            # → data/dtm-schedule.json

# 3. Surgical merges into the main calendar (history is never lost)
npx tsx scripts/merge-tsd-window.ts      # TSD overlap + FIA f2/f3 (with fallback guard)
npx tsx scripts/merge-motogp.ts          # replaces MotoGP/Moto2/Moto3
npx tsx scripts/merge-extra-series.ts    # replaces F1 Academy / IndyCar / DTM
```

> ⚠️ Do not run `fetch-calendar.ts` without `OUTPUT_PATH`: its default target is the main calendar file.

## Automatic updates

Two scheduled workflows run on GitHub Actions (see [.github/workflows/](.github/workflows/)):

| Workflow | When | What it does |
|---|---|---|
| **Weekly update** (`update.yml`) | Monday 06:00 CET | Refreshes everything: TheSportsDB (+8 weeks window), all scrapers, all surgical merges |
| **Weekend refresh** (`weekend-refresh.yml`) | Friday 06:30 CET | Re-checks only the current weekend's sessions on TheSportsDB (late TV slot changes etc.) — ~5 min |

Both are non-destructive: data merges into the existing calendar and history is preserved. If a scraper fails, the deploy continues with the last good data. Manual trigger: **Actions** tab → pick workflow → **Run workflow** (the weekly one also offers a fast *deploy only* mode that skips data updates), or:

```bash
gh workflow run "Weekly data update + deploy" -f deploy_only=true
gh workflow run "Weekend refresh"
```

## Technical notes

- All timezone conversions go through [`src/lib/sources/venue-tz.ts`](src/lib/sources/venue-tz.ts): circuit → IANA timezone mapping with longest-first partial matching
- `isEstimatedStart/isEstimatedEnd` distinguish official times from derived ones (typical per-series/session durations in [`src/lib/sources/durations.ts`](src/lib/sources/durations.ts))
- TheSportsDB key: the free public placeholder `"123"` (documented, no secrets in this repo)
