# Piano — Merge MotoGP Scrapato nel JSON Principale

## Obiettivo

Script `scripts/merge-motogp.ts` che:
1. Legge `data/calendar-2026.json` (TheSportsDB)
2. Rimuove le sessioni TheSportsDB di MotoGP/Moto2/Moto3 (incomplete: solo gare)
3. Legge `data/motogp-schedule.json` (Playwright scraper)
4. Trasforma ogni sessione scrappata nel formato `Session[]`
5. Salva il risultato in `data/calendar-2026.json`

Stesso pattern di `fetch-fia-supplement.ts`.

## Da → A

### Input (scraped): 
```json
{
  "name": "GERMANY",
  "dateRange": "10 Jul - 12 Jul",
  "track": "Sachsenring",
  "days": [
    { "day": "FRIDAY", "sessions": [
      { "time": "09:00-09:35", "category": "Moto3", "name": "Free Practice Nr. 1" },
      ...
    ]}
  ]
}
```

### Output (Session):
```json
{
  "id": "motogp_2026_germany_fp1_motogp",
  "series": "motogp",
  "leagueName": "MotoGP",
  "name": "Grand Prix of Germany / Free Practice Nr. 1",
  "sessionType": "free_practice",
  "eventKey": "2026_germany",
  "round": null,
  "season": "2026",
  "startUtc": "2026-07-10T07:00:00.000Z",
  "endUtc": "2026-07-10T07:45:00.000Z",
  "durationMin": 45,
  "venue": "Sachsenring",
  "country": "Germany",
  "countryFlagEmoji": "🇩🇪",
  "city": null,
  "mapUrl": null,
  "isEstimatedStart": false,
  "isEstimatedEnd": true
}
```

## Trasformazioni Necessarie

### 1. Data dalla day tab
`"FRIDAY"` + `"10 Jul - 12 Jul"` = `2026-07-10`

Mapping: FRIDAY → primo giorno, SATURDAY → secondo, SUNDAY → terzo.
Parse di `"10 Jul - 12 Jul"` → `{day: 10, month: 7, year: 2026}`.

### 2. Track time → UTC
Ogni orario va convertito da track local time a UTC.

Circuito → timezone mapping (11 circuiti, costanti):

| Circuito (track) | IANA Timezone | Offset Lug-Nov |
|---|---|---|
| Sachsenring | Europe/Berlin | +02:00 |
| Silverstone Circuit | Europe/London | +01:00 |
| MotorLand Aragón | Europe/Madrid | +02:00 |
| Misano World Circuit... | Europe/Rome | +02:00 |
| Red Bull Ring - Spielberg | Europe/Vienna | +02:00 |
| Mobility Resort Motegi | Asia/Tokyo | +09:00 |
| Pertamina Mandalika... | Asia/Makassar | +08:00 |
| Phillip Island | Australia/Melbourne | +10:00 |
| Petronas Sepang... | Asia/Kuala_Lumpur | +08:00 |
| Lusail International Circuit | Asia/Qatar | +03:00 |
| Autódromo Internacional do Algarve | Europe/Lisbon | +01:00 |
| Circuit Ricardo Tormo | Europe/Madrid | +02:00 |

Usando `Intl.DateTimeFormat` o mapping statico offset→UTC.

### 3. Parse orario
Formati:
- `"09:00-09:35"` → start=09:00, end=09:35
- `"15:00"` → start=15:00, end=null → stimato da `estimateDurationMin`

### 4. category → series
- `MotoGP` → `series: "motogp"`, `leagueName: "MotoGP"`
- `Moto2` → `series: "moto2"`, `leagueName: "Moto2"`
- `Moto3` → `series: "moto3"`, `leagueName: "Moto3"`
- `Baggers` → da decidere (si può scartare o tenere)

### 5. sessionType
Usare `classifySessionType(name)` da `durations.ts` — già gestisce:
- "Free Practice Nr. 1" → `free_practice` (match `/bfree\s+practice\b/`)
- "Practice" → `practice`
- "Qualifying Nr. 1" → `qualifying`
- "Tissot Sprint" → `sprint`
- "Warm Up" → `warmup`
- "Race" / "Grand Prix" → `race`
- "Rider Parade" / "After the Flag" / "Press Conference" → `other`

### 6. durationMin
Usare `estimateDurationMin(series, sessionType, name)` — già ha tabella per motogp/moto2/moto3.

### 7. eventKey
Generare da `name` dell'evento: `"2026_germany"` (slugify lowercase).

### 8. id
`${series}_${season}_${eventSlug}_${sessionType}_[counter]`

### 9. country e flag
Deducibile dal nome del circuito o aggiungere un mapping track → country.

## Schema dello Script

```
scripts/merge-motogp.ts

1. Leggi calendar-2026.json
2. Filtra: tieni sessioni dove series ∉ {motogp, moto2, moto3}
3. Leggi motogp-schedule.json
4. Per ogni evento:
   a. Parse dateRange → date per Fri/Sat/Sun
   b. Determina timezone dal nome del circuito
   c. Per ogni giorno, per ogni sessione:
      - Converti track time → startUtc/endUtc
      - Mappa category → series
      - classifica sessionType
      - stima durationMin
      - genera eventKey, id, venue, country
      - pusha in allSessions[]
5. Sort per startUtc
6. Aggiorna seriesIncluded se motogp/moto2/moto3 non già presenti
7. Scrivi calendar-2026.json
```

## Paesi e flag

Mapping track → country (costante):

| Track (match parziale) | Country | Flag |
|---|---|---|
| Sachsenring | Germany | 🇩🇪 |
| Silverstone | Great Britain | 🇬🇧 |
| Aragón | Spain | 🇪🇸 |
| Misano | San Marino | 🇸🇲 |
| Spielberg | Austria | 🇦🇹 |
| Motegi | Japan | 🇯🇵 |
| Mandalika | Indonesia | 🇮🇩 |
| Phillip Island | Australia | 🇦🇺 |
| Sepang | Malaysia | 🇲🇾 |
| Lusail | Qatar | 🇶🇦 |
| Algarve | Portugal | 🇵🇹 |
| Ricardo Tormo | Spain | 🇪🇸 |

## Sessioni "speciali" da filtrare

Alcune sessioni cerimoniali si possono escludere o tenere come `other`:
- Rider Parade, After the Flag, Sunday Press Conference, GearUp
- Decidere: se tenere, vanno classificate come `other`

## Dipendenze

- `src/lib/sources/durations.ts` (classifySessionType, estimateDurationMin) — **esiste già**
- `dayjs` (opzionale per parse date) — **già installato**
- `Intl.DateTimeFormat` (per timezone conversion) — **nativo Node**

## Comandi

```json
// package.json
"merge-motogp": "tsx scripts/merge-motogp.ts"
```

Esecuzione: `npm run scrape-motogp && npm run merge-motogp`
