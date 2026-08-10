# Motorsport Calendar — Agent Notes

## Data Sources

| Series | Source | Coverage |
|--------|--------|----------|
| F1, Formula E, NASCAR, IMSA, WEC | TheSportsDB (free API, key "123") | All sessions (self-updates as rounds approach) |
| **F2**, **F3** | **FIA official websites** (`fiaformula2.com/Calendar`, `fiaformula3.com/Calendar`) | Practice, Qualifying, Sprint, Feature — complete with real times |
| **F1 Academy** | **Scraper** (`scripts/scrape-f1academy.ts`) | Next.js JSON embed on f1academy.com — ISO times WITH tz offset (no manual conversion) |
| **MotoGP, Moto2, Moto3** | **Playwright scraper** (`scripts/scrape-motogp-all.ts`) | 12 events × ~20-25 sessions = 258 total, all practice/qualifying/sprint/race times in track local time |
| **IndyCar** | **Scraper** (`scripts/scrape-indycar.ts`) | Server-rendered HTML on indycar.com — session times in ET |
| **DTM** | **Playwright scraper** (`scripts/scrape-dtm.ts`) | Client-side rendered — timetable on dtm.com event pages, only DTM sessions kept |

**Removed series (not on the site): SBK, WRC.**

## Fetch Commands

- `npm run fetch-calendar` — full fetch from TheSportsDB (slow: ~80 min for 13 leagues × 180 days); supports `WINDOW_END=YYYY-MM-DD` and `OUTPUT_PATH=...` env vars
- `npm run fetch-fia` — quick supplement: replaces F2/F3 with FIA data, keeps rest
- `npm run scrape-motogp` — scrapes MotoGP/Moto2/Moto3 session times from motogp.com via Playwright
- `npm run scrape-f1academy` — scrapes F1 Academy sessions (6 race IDs)
- `npm run scrape-indycar` — scrapes IndyCar sessions (6 future rounds)
- `npm run scrape-dtm` — scrapes DTM sessions (3 future rounds; TIMETABLE appears ~2 weeks before each weekend)
- `npm run merge-extra-series` — merges F1A/IndyCar/DTM scraped data into calendar-2026.json (replaces TheSportsDB sessions for those series; dedupes Milwaukee double-header; filters non-race sessions)

## FIA Source (f2/f3)

The FIA F2/F3 websites embed a JSON blob with complete season data:
- All 14 F2 rounds × 4 sessions (Practice, Qualifying, Sprint, Feature) = 57 sessions (Monaco has 2 qualifying groups)
- All 9 F3 rounds × 4+ sessions = 38 sessions (Monaco/Monza have 2 qualifying groups)
- Sessions with `Unconfirmed: false` have official times; `Unconfirmed: true` are provisional

Module: `src/lib/sources/fia.ts`
- `fetchFiaSeriesCalendar(series)` → returns `Session[]`
- `getFiaSeries()` → returns `['f2', 'f3']`

## MotoGP Scraper (`scripts/scrape-motogp-all.ts`)

Uses Playwright (headless Chromium) to extract session data from motogp.com.
- `scrape-motogp-round.ts` — scrapes a single event (test with individual URL)
- `scrape-motogp-all.ts` — loops over all 12 future events, calls round script for each
- Saves to `data/motogp-schedule.json`
- Individual round script outputs JSON to stdout, logs to stderr
- Uses `{ force: true }` on clicks to bypass OneTrust overlay interception

## Timezone Handling (`src/lib/sources/venue-tz.ts`)

Centralized venue → IANA timezone conversion (DST-aware via dayjs timezone plugin):
- `venueTimezone(venue)` — partial-match lookup for circuit names
- `localToUtc(date, time, tz)` — local track time → UTC ISO string
- Used by `normalizeTsdEvent` (prefers `strTimeLocal` + venue tz over TheSportsDB's `strTimestamp` when they differ by ≥60 min) and by `merge-motogp.ts`
- No manual offset arithmetic anywhere — dayjs handles DST automatically
