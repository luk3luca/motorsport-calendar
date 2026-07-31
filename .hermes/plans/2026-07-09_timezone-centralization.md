# Piano — Gestione Centralizzata dei Fusi Orari

## Problema

Gli orari vengono gestiti in modo diverso e non robusto a seconda della fonte:

| Fonte | Metodo attuale | Problema |
|---|---|---|
| TheSportsDB | Fiducia cieca in `strTimestamp` (aggiunge "Z" se manca) | Errore dati fonte: gara São Paulo 16:30 UTC invece di 14:30. Ma `strTimeLocal` (11:30 BRT) è corretto |
| FIA F2/F3 | `Date.parse()` su ISO 8601 con offset | ✅ Robusto, già corretto |
| MotoGP scraper | Tabella manuale offset + aritmetica custom in `merge-motogp.ts` | Duplicato, fragile, non gestisce DST automaticamente |
| Display UI | dayjs + plugin utc/timezone | ✅ Già corretto |

## Soluzione

**Centralizzare la conversione track-local → UTC in un unico modulo** usando il plugin timezone di **dayjs** (già installato!) che gestisce i nomi IANA e il DST automaticamente. Nessun pacchetto nuovo necessario.

### 1. Nuovo modulo `src/lib/sources/venue-tz.ts`

```typescript
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Circuito/venue (match parziale) → IANA timezone */
const VENUE_TZ: Record<string, string> = {
  // F1
  "Interlagos": "America/Sao_Paulo",
  "Silverstone": "Europe/London",
  "Spa": "Europe/Brussels",
  "Monza": "Europe/Rome",
  // WEC
  "Sao Paulo": "America/Sao_Paulo",
  "Circuit de Spa": "Europe/Brussels",
  "Le Mans": "Europe/Paris",
  "Fuji": "Asia/Tokyo",
  "Lusail": "Asia/Qatar",
  "Bahrain": "Asia/Bahrain",
  "COTA": "America/Chicago",
  "Sebring": "America/New_York",
  // MotoGP
  "Sachsenring": "Europe/Berlin",
  "Misano": "Europe/Rome",
  "Red Bull Ring": "Europe/Vienna",
  "Motegi": "Asia/Tokyo",
  "Mandalika": "Asia/Makassar",
  "Phillip Island": "Australia/Melbourne",
  "Sepang": "Asia/Kuala_Lumpur",
  "Algarve": "Europe/Lisbon",
  "Ricardo Tormo": "Europe/Madrid",
  "MotorLand": "Europe/Madrid",
  // IndyCar / IMSA / NASCAR
  "Indianapolis": "America/Indiana/Indianapolis",
  "Daytona": "America/New_York",
  ...
};

/** Trova il fuso IANA per un venue (match parziale case-insensitive) */
export function venueTimezone(venue: string): string | null;

/** Converte data + ora locale → ISO UTC usando IANA timezone (DST-aware) */
export function localToUtc(date: string, time: string, tz: string): string {
  return dayjs.tz(`${date} ${time}`, tz).toISOString();
}

/** Sanity check: confronta due orari UTC, ritorna differenza in minuti */
export function utcDiffMinutes(a: string, b: string): number;
```

### 2. Aggiornare `normalizeTsdEvent` (thesportsdb.ts)

Nuova logica:
```typescript
// 1. Se strTimeLocal esiste E conosciamo il fuso del venue:
//    calcola UTC da local + fuso IANA → usa QUESTO
// 2. Altrimenti fallback: strTimestamp come prima
const tz = venueTimezone(e.strVenue ?? "");
if (tz && e.strTimeLocal) {
  const date = e.dateEvent ?? e.strTimestamp?.slice(0, 10);
  const localUtc = localToUtc(date, e.strTimeLocal, tz);
  // sanity: se differisce da strTimestamp di ±60min, preferisci localUtc
  const computed = localUtc;
  startUtc = computed;
} else {
  startUtc = strTimestamp + "Z";
}
```

Questo corregge il caso São Paulo: `strTimeLocal=11:30` + `America/Sao_Paulo` → `14:30 UTC` ✓

### 3. Aggiornare `merge-motogp.ts`

Sostituire l'aritmetica manuale `getUtcOffsetMinutes()` con `localToUtc()` dal modulo condiviso. La tabella `TRACK_TZ` viene rimossa (spostata in `venue-tz.ts`).

### 4. (Opzionale) `fetch-fia.ts` — nessun cambiamento

Già usa `Date.parse()` con offset espliciti — corretto.

## Fusi IANA principali per serie

| Circuito | Fuso | Note DST |
|---|---|---|
| Interlagos / São Paulo | America/Sao_Paulo | no DST (UTC-3) |
| Silverstone | Europe/London | BST estate |
| Spa-Francorchamps | Europe/Brussels | CEST estate |
| Monza / Misano / Imola | Europe/Rome | CEST estate |
| Le Mans | Europe/Paris | CEST estate |
| Fuji / Motegi | Asia/Tokyo | no DST |
| Lusail (Qatar) | Asia/Qatar | no DST |
| Bahrain | Asia/Bahrain | no DST |
| COTA (Austin) | America/Chicago | CDT estate |
| Indianapolis | America/Indiana/Indianapolis | EDT estate |
| Daytona / Sebring | America/New_York | EDT estate |
| Sachsenring | Europe/Berlin | CEST estate |
| Red Bull Ring | Europe/Vienna | CEST estate |
| Mandalika | Asia/Makassar | no DST |
| Phillip Island | Australia/Melbourne | AEST/AEDT |
| Sepang | Asia/Kuala_Lumpur | no DST |
| Algarve | Europe/Lisbon | WEST estate |
| Valencia / Aragon | Europe/Madrid | CEST estate |

## Vantaggi

1. **Un solo posto** per la conversione local→UTC
2. **DST automatico** — dayjs timezone usa i dati IANA, niente aritmetica manuale
3. **Sanity check** — se il fuso risolve un orario diverso da quello dichiarato da TheSportsDB, vinciamo noi (dato locale corretto > timestamp dichiarato)
4. Nessuna dipendenza nuova

## Task

1. Creare `src/lib/sources/venue-tz.ts` (mapping venue → IANA + `localToUtc` + `venueTimezone`)
2. Patchare `normalizeTsdEvent` in `thesportsdb.ts` per usare `strTimeLocal` quando possibile
3. Patchare `merge-motogp.ts` per usare `localToUtc` (rimuovere tabella + aritmetica manuale)
4. Rigenerare `calendar-2026.json` (merge-motogp + fetch) e verificare la gara São Paulo = 14:30 UTC
5. Verifica: eslint, tsc, next build
