# Motorsport Calendar — Agent Notes

## Data Sources

| Series | Source | Coverage |
|--------|--------|----------|
| F1, MotoGP, etc. | TheSportsDB (free API, key "123") | All sessions |
| **F2**, **F3** | **FIA official websites** (`fiaformula2.com/Calendar`, `fiaformula3.com/Calendar`) | Practice, Qualifying, Sprint, Feature — complete with real times |
| F1 Academy | TheSportsDB (incomplete — may need alternative source) | Partial |

## FIA Source (f2/f3)

The FIA F2/F3 websites embed a JSON blob with complete season data:
- All 14 F2 rounds × 4 sessions (Practice, Qualifying, Sprint, Feature) = 57 sessions (Monaco has 2 qualifying groups)
- All 9 F3 rounds × 4+ sessions = 38 sessions (Monaco/Monza have 2 qualifying groups)
- Sessions with `Unconfirmed: false` have official times; `Unconfirmed: true` are provisional

Module: `src/lib/sources/fia.ts`
- `fetchFiaSeriesCalendar(series)` → returns `Session[]`
- `getFiaSeries()` → returns `['f2', 'f3']`

## Fetch Commands

- `npm run fetch-calendar` — full fetch from TheSportsDB (slow: ~80 min for 13 leagues × 180 days)
- `npx tsx scripts/fetch-fia-supplement.ts` — quick supplement: replaces F2/F3 with FIA data, keeps rest
